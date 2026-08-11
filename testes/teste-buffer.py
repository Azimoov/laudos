# -*- coding: utf-8 -*-
"""Testa a fita circular do agente: preenchimento de silencio e mapeamento hora->posicao.
Reproduz o caso real de 31/07 (microfone parou as 12:43, exame pediu janela as 12:54)."""
import os
import re
import sys
import threading
import time

import numpy as np

# 10/08/2026: a pasta do agente saiu do cache do app Claude, onde uma
# reinstalacao levaria o banco de pacientes junto. Ver README do laudos-programa.
ARQ = os.path.join(os.path.expanduser("~"), "Laudos USG", "agente", "agente-laudos.py")
src = open(ARQ, encoding="utf-8").read()

# extrai so as constantes e a classe, sem subir servidor nem thread
ini = src.index("SR = 16000")
fim = src.index("BUF = BufferContinuo")
trecho_src = src[ini:fim]
ns = {"threading": threading, "time": time, "np": np, "os": __import__("os"), "print": print}
exec(compile(trecho_src, "buffer", "exec"), ns)
BufferContinuo = ns["BufferContinuo"]
SR = ns["SR"]

falhas = []


def ok(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


print("=== 1. gravacao normal: hora -> posicao ===")
b = BufferContinuo(60)                      # fita de 60 s p/ o teste
b.buf = np.zeros(b.N, dtype="float32")
b.t_inicio = 1000.0
b.escritos = 0
# escreve 30 s de "audio" com valor 0.5
b.buf[:30 * SR] = 0.5
b.escritos = 30 * SR
b.ultimo = 1030.0
aud, t_real = b.trecho(1010.0, 1020.0)      # 10 s do meio
ok(abs(len(aud) / SR - 10) < 0.01, "pediu 10 s, veio %.2f s" % (len(aud) / SR))
ok(abs(t_real - 1010.0) < 0.01, "inicio real bate com o pedido (%.2f)" % t_real)
ok(float(aud.mean()) > 0.4, "conteudo e o audio gravado, nao silencio")

print("\n=== 2. o BUG de 31/07: fita para, relogio continua (SEM correcao) ===")
b2 = BufferContinuo(1800)
b2.buf = np.zeros(b2.N, dtype="float32")
b2.t_inicio = 0.0
b2.buf[:915 * SR] = 0.5
b2.escritos = 915 * SR                      # fita congelou em 915 s
agora = 1569.0                              # 12:54:46, 1569 s depois de ligar
aud2, _ = b2.trecho(agora - 266, agora)     # janela de 266 s atras
ok(len(aud2) == 0, "reproduz o bug: fatia VAZIA (era isso que acontecia)")

print("\n=== 3. COM a correcao: silencio preenche a lacuna ===")
b3 = BufferContinuo(1800)
b3.buf = np.zeros(b3.N, dtype="float32")
b3.t_inicio = 0.0
b3.buf[:915 * SR] = 0.5
b3.escritos = 915 * SR
b3.ultimo = 915.0
b3._pad_silencio(1569.0 - 915.0)            # o vigia teria preenchido a lacuna
ok(abs(b3.escritos / SR - 1569) < 0.1,
   "fita voltou a bater com o relogio: %.0f s (esperado 1569)" % (b3.escritos / SR))
# agora o medico fala 30 s e o exame fecha
pos = b3.escritos % b3.N
b3.buf[pos:pos + 30 * SR] = 0.7
b3.escritos += 30 * SR
aud3, t3 = b3.trecho(1569.0, 1599.0)
ok(abs(len(aud3) / SR - 30) < 0.01, "os 30 s falados voltam inteiros (%.2f s)" % (len(aud3) / SR))
ok(float(aud3.mean()) > 0.6, "e o audio novo, no lugar certo da fita")

print("\n=== 4. lacuna cai DENTRO da janela do exame ===")
b4 = BufferContinuo(1800)
b4.buf = np.zeros(b4.N, dtype="float32")
b4.t_inicio = 0.0
b4.escritos = 100 * SR
b4.ultimo = 100.0
b4.lacunas = [(120.0, 145.0)]               # 25 s parado no meio
perdido = b4.perdido_na_janela(100.0, 200.0)
ok(abs(perdido - 25.0) < 0.01, "conta 25 s perdidos dentro da janela (%.1f)" % perdido)
perdido2 = b4.perdido_na_janela(150.0, 200.0)
ok(perdido2 == 0.0, "janela depois da lacuna: nada perdido (%.1f)" % perdido2)
perdido3 = b4.perdido_na_janela(130.0, 200.0)
ok(abs(perdido3 - 15.0) < 0.01, "janela pega so parte da lacuna: 15 s (%.1f)" % perdido3)

print("\n=== 5. lacuna maior que a fita inteira ===")
b5 = BufferContinuo(60)
b5.buf = np.ones(b5.N, dtype="float32")
b5.t_inicio = 0.0
b5.escritos = 60 * SR
b5.ultimo = 60.0
b5._pad_silencio(300.0)                     # 5 min parado, fita so tem 1 min
ok(float(b5.buf.max()) == 0.0, "fita inteira zerada (nada daquele periodo sobrou)")
ok(abs(b5.escritos / SR - 360) < 0.1, "relogio da fita continua certo: %.0f s" % (b5.escritos / SR))

print("\n=== 6. vivo() mede amostra que chega, nao objeto que existe ===")
b6 = BufferContinuo(60)
b6.stream = object()                        # objeto de pe...
b6.ultimo = time.time() - 10                # ...mas nada chega ha 10 s
ok(b6.vivo() is False, "objeto existe + sem audio = MORTO (o bug de 31/07)")
b6.ultimo = time.time()
ok(b6.vivo() is True, "audio recente = vivo")
ok(abs(b6.parado_ha()) < 0.5, "parado_ha ~0 s quando esta vivo")

print("\n" + ("TODOS OS %d TESTES PASSARAM" % 16 if not falhas else "FALHAS: %d" % len(falhas)))
sys.exit(1 if falhas else 0)
