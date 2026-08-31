# -*- coding: utf-8 -*-
"""O MICROFONE FECHA SOZINHO QUANDO NINGUEM ESTA ATENDENDO — 30/08/2026.

Pedido do medico: "quando disser que o exame encerrou, o microfone fecha. Eu nao vejo
motivo pra ele ficar aberto mesmo quando os exames estao encerrados."

O CASO REAL: o microfone ficou aberto de 27/08 as 18h35 ate 30/08 as 23h — TRES DIAS.
Fechar a janela nao fecha o microfone (o agente e independente de proposito), e a unica
forma de fechar era apertar de novo "Aguardar exame do aparelho". Quem termina o dia e
vai embora deixa o microfone aberto sem saber. Alem da regra de privacidade do projeto
("o microfone fica FECHADO fora do modo exame"), isso recusava o reiniciar do motor para
sempre — foi assim que o medico ficou tres dias com a transcricao no processador.

⚠️ POR QUE NAO FECHA AO FIM DE CADA EXAME (que seria o literal do pedido): o pre-buffer
existe para capturar o comeco do PROXIMO exame ANTES de o medico mandar gravar. Fechar
entre um paciente e outro faria o inicio do proximo ditado se perder — exatamente o
problema que o pre-buffer resolve. Por isso a regra e por OCIOSIDADE, e um intervalo
entre pacientes cabe folgado no limite.

Roda sem microfone: dubla o buffer e controla o relogio.
LE A COPIA INSTALADA, como as outras suites .py.
"""
import os
import sys
import time
import importlib.util

AGENTE = os.path.join(os.path.expanduser("~"), "Laudos USG 2.0", "agente", "agente-laudos.py")
falhas = []


def ok(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


def carregar_agente():
    sys.path.insert(0, os.path.dirname(AGENTE))
    spec = importlib.util.spec_from_file_location("agente_laudos", AGENTE)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["agente_laudos"] = mod
    spec.loader.exec_module(mod)
    # sem isto o teste escreve no registro da clinica (ver teste-volta-placa.py)
    import builtins
    mod.print = builtins.print
    return mod


if not os.path.isfile(AGENTE):
    print("  -- agente instalado nao encontrado: " + AGENTE)
    sys.exit(0)
ag = carregar_agente()

print("=== a regra existe e e configuravel ===")
ok(hasattr(ag, "OCIOSO_LIMITE_MIN"), "ha um limite de ociosidade")
ok(hasattr(ag, "marcar_atividade"), "e uma forma de registrar atividade")
ok(ag.OCIOSO_LIMITE_MIN >= 30,
   "o limite (%.0f min) cabe um intervalo entre pacientes" % ag.OCIOSO_LIMITE_MIN)


class BufFalso:
    def __init__(self):
        self.stream = object()
        self.desligou = 0

    def desligar(self):
        self.desligou += 1
        self.stream = None

    def parado_ha(self):
        return None

    def reiniciar(self, motivo):
        pass


def um_ciclo(ocioso_min, gravando=False, aberto=True):
    """Roda UMA volta da vigilancia, com o cenario montado."""
    ag.BUF = BufFalso()
    if not aberto:
        ag.BUF.stream = None
    ag.MARCA_INICIO = time.time() if gravando else None
    ag.ULTIMA_ATIVIDADE["quando"] = time.time() - ocioso_min * 60
    ag.ULTIMA_ATIVIDADE["o_que"] = "um exame foi fechado"
    # a volta do laco, sem o sleep e sem o while
    if ag.BUF.stream is None:
        return ag.BUF
    if ag.MARCA_INICIO is not None:
        ag.marcar_atividade("gravacao em curso")
        return ag.BUF
    if ag.OCIOSO_LIMITE_MIN <= 0:
        return ag.BUF
    if not ag.ULTIMA_ATIVIDADE["quando"]:
        ag.marcar_atividade("microfone aberto")
        return ag.BUF
    ocioso = time.time() - ag.ULTIMA_ATIVIDADE["quando"]
    if ocioso > ag.OCIOSO_LIMITE_MIN * 60:
        ag.BUF.desligar()
        ag.ULTIMA_ATIVIDADE["quando"] = 0.0
    return ag.BUF


print("\n=== ENTRE EXAMES o microfone continua aberto ===")
b = um_ciclo(ocioso_min=1)
ok(b.desligou == 0 and b.stream is not None,
   "1 min depois de um exame: aberto (o proximo paciente ja esta sendo capturado)")
b = um_ciclo(ocioso_min=ag.OCIOSO_LIMITE_MIN - 5)
ok(b.desligou == 0, "faltando 5 min para o limite: ainda aberto (intervalo entre pacientes)")

print("\n=== ENCERRADO O ATENDIMENTO, fecha sozinho ===")
b = um_ciclo(ocioso_min=ag.OCIOSO_LIMITE_MIN + 1)
ok(b.desligou == 1 and b.stream is None,
   "passado o limite sem exame nenhum: o microfone FECHA")
b = um_ciclo(ocioso_min=3 * 24 * 60)
ok(b.desligou == 1, "e o caso real (tres dias parado) nao acontece mais")

print("\n=== o que NAO pode fechar o microfone ===")
b = um_ciclo(ocioso_min=9999, gravando=True)
ok(b.desligou == 0, "COM GRAVACAO EM CURSO nunca fecha — ha exame de verdade ali")
ok(ag.ULTIMA_ATIVIDADE["o_que"] == "gravacao em curso",
   "e gravar conta como atividade (a contagem reinicia)")
b = um_ciclo(ocioso_min=9999, aberto=False)
ok(b.desligou == 0, "microfone ja fechado: nao tenta fechar de novo")

print("\n=== a atividade reinicia a contagem ===")
ag.marcar_atividade("um exame foi fechado")
ok(abs(ag.ULTIMA_ATIVIDADE["quando"] - time.time()) < 2, "fechar um exame reinicia a contagem")
ag.marcar_atividade("a espera foi ligada")
ok(ag.ULTIMA_ATIVIDADE["o_que"] == "a espera foi ligada",
   "ligar a espera tambem (senao contaria desde o ultimo exame de ontem)")

print("\n=== a recusa do reiniciar parou de afirmar o que nao sabe ===")
fonte = open(AGENTE, encoding="utf-8", errors="replace").read()
ok("o app está em modo exame" not in fonte,
   'a mensagem nao diz mais "o app esta em modo exame" (o agente nao sabe disso)')
# o texto e montado em duas linhas no fonte: procuro o pedaco que cabe numa so
ok("aberto de uma sessão anterior" in fonte,
   "e passou a levantar a hipotese certa quando ha muito tempo sem nada")
ok("nada acontece ha %.0f min" in fonte or "nada acontece ha" in fonte,
   "dizendo ha quanto tempo nada acontece")

print("\n" + ("  %d FALHA(S)" % len(falhas) if falhas else "  tudo certo"))
sys.exit(1 if falhas else 0)
