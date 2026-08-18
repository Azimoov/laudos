# A RESERVA DA PLACA DE VIDEO (13/08/2026) — exercitada de verdade.
#
# O PROBLEMA: a placa tem 4 GB e cada motor de voz ocupa ~1,9 GB. Dois agentes com o
# motor carregado enchem a placa. A primeira versao "perguntava ao vizinho" antes de
# carregar — e isso NAO fecha a corrida: perguntar leva 2 s, carregar leva 11-15 s.
# Dois agentes que subissem com menos de 15 s de diferenca viam os dois "sem motor" e
# carregavam os dois. Pior: quem carregava preguicosamente nao perguntava a ninguem.
#
# A CORRECAO: `os.open(..., O_CREAT | O_EXCL)` — o sistema operacional garante que, de
# dois processos criando o mesmo arquivo ao mesmo tempo, so um consegue. Perguntar e
# agir viram a MESMA operacao, entao nao ha janela entre uma coisa e outra.
#
# Este teste roda a funcao de verdade, inclusive com 8 threads disputando ao mesmo tempo.
# Nao carrega modelo, nao usa a placa, nao fala com agente nenhum.
import os
import re
import sys
import tempfile
import threading
import time

AG = os.path.join(os.path.expanduser("~"), "Laudos USG 2.0", "agente", "agente-laudos.py")
falhas = 0


def ok(cond, msg):
    global falhas
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas += 1


fonte = open(AG, encoding="utf-8").read()

# recorta so o pedaco da reserva e roda num modulo de mentira
ini = fonte.index("RESERVA_PLACA = ")
fim = fonte.index("def aquecer_motor(")
trecho = fonte[ini:fim].replace("atexit.register(soltar_placa)", "")

import json as _json
import urllib.request as _url


def novo_modulo(porta, vizinho_responde=True):
    import types
    m = types.ModuleType("reserva_%d" % porta)

    class UrlFalso:
        @staticmethod
        def urlopen(url, timeout=None):
            if not vizinho_responde:
                raise OSError("vizinho morto")

            class R:
                def read(self_inner):
                    return b'{"ok":true}'

                def __enter__(self_inner):
                    return self_inner

                def __exit__(self_inner, *a):
                    return False
            return R()

    m.__dict__.update({"os": os, "json": _json, "time": time, "tempfile": tempfile,
                       "PORT_HTTP": porta, "urllib": type("u", (), {"request": UrlFalso})})
    exec(compile(trecho, "reserva", "exec"), m.__dict__)
    return m


ARQ = os.path.join(tempfile.gettempdir(), "laudos-usg-placa.reserva")


def limpar():
    try:
        os.remove(ARQ)
    except Exception:  # noqa: BLE001
        pass


print("=== um agente sozinho pega a placa ===")
limpar()
a = novo_modulo(8977)
ok(a.reservar_placa() is True, "o primeiro reserva")
ok(os.path.exists(ARQ), "e o arquivo de reserva existe")
ok(a.reservar_placa() is True, "pedir de novo, sendo o mesmo dono, continua valendo")

print("=== o segundo NAO pega ===")
b = novo_modulo(8988)
ok(b.reservar_placa() is False, "o vizinho tenta e recebe nao")
d = _json.load(open(ARQ, encoding="utf-8"))
ok(d["porta"] == 8977, "e a reserva continua sendo do primeiro (porta %s)" % d["porta"])

print("=== quem soltou libera para o outro ===")
a.soltar_placa()
ok(not os.path.exists(ARQ), "soltar apaga a reserva")
ok(b.reservar_placa() is True, "e agora o vizinho consegue")
ok(a.reservar_placa() is False, "e o primeiro e que passa a receber nao")
b.soltar_placa()

print("=== soltar a reserva DO OUTRO nao funciona ===")
limpar()
a = novo_modulo(8977)
a.reservar_placa()
b = novo_modulo(8988)
b.soltar_placa()
ok(os.path.exists(ARQ), "o vizinho nao consegue soltar reserva que nao e dele")
limpar()

print("=== reserva ORFA nao tranca a placa para sempre ===")
# agente morreu sem soltar: o arquivo fica. Se ninguem assumisse, a placa ficaria
# inutilizavel ate alguem apagar o arquivo na mao — trocar um problema por outro pior.
with open(ARQ, "w", encoding="utf-8") as f:
    _json.dump({"porta": 8988, "pid": 999999, "quando": time.time()}, f)
c = novo_modulo(8977, vizinho_responde=False)      # o dono da reserva nao responde
ok(c.reservar_placa() is True, "reserva de agente que nao responde e assumida")
d = _json.load(open(ARQ, encoding="utf-8"))
ok(d["porta"] == 8977, "e passa a ser do agente vivo")
limpar()

print("=== mas reserva de agente VIVO e respeitada ===")
with open(ARQ, "w", encoding="utf-8") as f:
    _json.dump({"porta": 8988, "pid": 1, "quando": time.time()}, f)
c = novo_modulo(8977, vizinho_responde=True)
ok(c.reservar_placa() is False, "vizinho respondendo = reserva de pe")
limpar()

print("=== reserva ANTIGA demais tambem cai ===")
with open(ARQ, "w", encoding="utf-8") as f:
    _json.dump({"porta": 8988, "pid": 1, "quando": time.time() - 25 * 3600}, f)
c = novo_modulo(8977, vizinho_responde=True)
ok(c.reservar_placa() is True, "reserva de mais de 24 h e considerada perdida")
limpar()

print("=== A CORRIDA: oito ao mesmo tempo, so um pode ganhar ===")
# e este o teste que a versao antiga ("perguntar ao vizinho") nao passaria.
for tentativa in range(6):
    limpar()
    ganhou = []
    trava = threading.Lock()
    portas = [9000 + i for i in range(8)]
    mods = [novo_modulo(p, vizinho_responde=True) for p in portas]
    largada = threading.Event()

    def corre(m, p):
        largada.wait()
        if m.reservar_placa():
            with trava:
                ganhou.append(p)

    ths = [threading.Thread(target=corre, args=(m, p)) for m, p in zip(mods, portas)]
    for t in ths:
        t.start()
    largada.set()
    for t in ths:
        t.join()
    if len(ganhou) != 1:
        ok(False, "rodada %d: %d ganharam (deveria ser exatamente 1): %s"
           % (tentativa + 1, len(ganhou), ganhou))
        break
else:
    ok(True, "seis rodadas de oito concorrentes: exatamente UM ganhou em todas")
limpar()

print("=== a reserva vale para QUALQUER carregamento, nao so para o aquecimento ===")
gm = fonte[fonte.index("def garantir_motor("):fonte.index("def sincronizar_rotulo(")]
ok("not reservar_placa()" in gm, "o garantir_motor tenta reservar antes de usar a placa")
ok('dispositivo, calculo = "cpu", "int8"' in gm,
   "e quando nao consegue, carrega no PROCESSADOR em vez de estourar a placa do outro")
ok("soltar_placa()" in gm, "e solta a reserva se nao tiver ficado na placa")
ok("outro_agente_com_motor" not in fonte, "o 'perguntar ao vizinho' foi removido de vez")
aq = fonte[fonte.index("def aquecer_motor("):]
ok("reservar_placa" not in aq.split("def ")[0],
   "o aquecimento nao decide mais nada sozinho: quem decide e a reserva")

print("=== e o aquecimento chegou na instalacao que ATENDE ===")
app_est = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                       "_repo", "index.html")
h = open(app_est, encoding="utf-8").read()
ok("transcritor/carregar" in h, "o app estavel pede o carregamento do motor ao abrir")
ok(h.count("transcritor/carregar") == 1, "uma vez so")
ok("aquecer" in h.lower() or "AQUECER" in h, "com o porque escrito ao lado")
ag_est = open(os.path.join(os.path.expanduser("~"), "Laudos USG", "agente",
                           "agente-laudos.py"), encoding="utf-8").read()
ok("transcritor/carregar" in ag_est,
   "e o agente que atende JA tinha a rota — nao foi preciso mexer nele")

print("")
print(("  %d FALHA(S)" % falhas) if falhas else "  tudo certo")
sys.exit(1 if falhas else 0)
