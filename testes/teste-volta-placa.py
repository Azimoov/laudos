# -*- coding: utf-8 -*-
"""A VOLTA AUTOMATICA PARA A PLACA — 30/08/2026, pedido do medico.

"quero estrategias pra quando o motor cair pro processador, que ele possa voltar
 automaticamente para a placa assim que possivel"

O QUE ACONTECEU (registro de 27/08): as 10h16 o motor caiu para a CPU no meio de uma
transcricao e ficou la o resto do dia. Antes: 322s de audio em 12s. Depois: 368s em 380s.
So reiniciar o agente devolvia a placa — e ninguem tinha como saber que precisava.

Este teste roda SEM placa de video: ele troca o Transcriber por um dubl e controla o
relogio, entao exercita a REGRA (espera crescente, reserva, exame em curso) e nao o
hardware. A prova de que a placa carrega mesmo e o teste-placa.py, que ja existe.

⚠️ LE A COPIA INSTALADA (Laudos USG 2.0), como as outras suites .py do projeto: editar so
o repositorio e rodar isto daria verde testando codigo velho.
"""
import os
import sys
import time
import types
import importlib.util

AGENTE = os.path.join(os.path.expanduser("~"), "Laudos USG 2.0", "agente", "agente-laudos.py")
falhas = []


def ok(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


def carregar_agente():
    """Importa o agente SEM subir servidor nenhum (o modulo so define coisas no topo).

    A pasta do agente entra no caminho primeiro: ele importa vizinhos (arquivos.py,
    banco.py, impressao.py) que moram ao lado dele.
    """
    sys.path.insert(0, os.path.dirname(AGENTE))
    spec = importlib.util.spec_from_file_location("agente_laudos", AGENTE)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["agente_laudos"] = mod
    spec.loader.exec_module(mod)
    # ⚠️ 30/08/2026 — SEM ESTA LINHA O TESTE SUJA O REGISTRO DA CLINICA.
    # O agente troca o `print` por um que grava TAMBEM em agente-diario.log (o autostart
    # descarta o stdout). Importar o modulo traz esse print junto: a primeira versao deste
    # teste escreveu 39 linhas dizendo "a placa recusou" e "A PLACA VOLTOU" no registro de
    # VERDADE — simulacao virando fato, justamente no unico arquivo onde se investiga a
    # placa. Foram removidas na mao em 30/08 (backup: agente-diario.log.antes-limpeza-*).
    # Devolver o print embutido mantem a saida do teste na tela e FORA do registro.
    import builtins
    mod.print = builtins.print
    return mod


print("=== o agente instalado tem a volta automatica ===")
if not os.path.isfile(AGENTE):
    print("  -- agente instalado nao encontrado: " + AGENTE)
    sys.exit(0)
ag = carregar_agente()
ok(hasattr(ag, "tentar_voltar_para_placa"), "a funcao tentar_voltar_para_placa existe")
ok(hasattr(ag, "CPU_QUEDA"), "e o registro da queda (CPU_QUEDA) existe")
ok(ag.TEMPO_ESPERA_INICIAL == 300 and ag.TEMPO_ESPERA_MAXIMO == 3600,
   "espera comeca em 5 min e nao passa de 60")


class MotorFalso:
    def __init__(self, device):
        self.device = device


def preparar(device_atual, quando, espera, gravando=False, reserva_ok=True, carrega=None):
    """Monta o cenario: motor no device dado, queda ha `quando` segundos, etc."""
    ag.ASR = MotorFalso(device_atual)
    ag.ASR_DEVICE = "cuda"
    ag.CPU_QUEDA["quando"] = (time.time() - quando) if quando is not None else 0.0
    ag.CPU_QUEDA["espera"] = espera
    ag.CPU_QUEDA["tentativas"] = 0
    ag.MARCA_INICIO = time.time() if gravando else None
    chamou = {"reservou": 0, "soltou": 0, "carregou": 0}

    ag.reservar_placa = lambda: (chamou.__setitem__("reservou", chamou["reservou"] + 1)
                                 or reserva_ok)
    ag.soltar_placa = lambda: chamou.__setitem__("soltou", chamou["soltou"] + 1)
    ag._reserva_ler = lambda: {"porta": 8977}

    # o dubl do Transcriber entra por sys.modules, que e onde o `from src.asr import`
    # vai procurar — assim nao carregamos modelo nenhum de verdade
    mod_src = types.ModuleType("src")
    mod_asr = types.ModuleType("src.asr")

    def fabricar(**kw):
        chamou["carregou"] += 1
        if carrega is None:
            raise RuntimeError("placa recusou (teste)")
        return MotorFalso(carrega)

    mod_asr.Transcriber = fabricar
    mod_src.asr = mod_asr
    sys.modules["src"] = mod_src
    sys.modules["src.asr"] = mod_asr
    return chamou


print("\n=== quando NAO deve tentar ===")
c = preparar("cpu", quando=60, espera=300)          # caiu ha 1 min, espera 5
ag.tentar_voltar_para_placa()
ok(c["carregou"] == 0, "dentro da espera: nao tenta (nao gasta 13s a toa)")

c = preparar("cuda", quando=9999, espera=300)       # ja esta na placa
ag.tentar_voltar_para_placa()
ok(c["carregou"] == 0, "ja esta na placa: nao faz nada")

c = preparar("cpu", quando=None, espera=300)        # nunca caiu (CPU de proposito)
ag.tentar_voltar_para_placa()
ok(c["carregou"] == 0, "na CPU de proposito (reserva do vizinho): nao tenta")

c = preparar("cpu", quando=9999, espera=300, gravando=True)
ag.tentar_voltar_para_placa()
ok(c["carregou"] == 0, "COM EXAME GRAVANDO: nao mexe no motor no meio do ditado")

c = preparar("cpu", quando=9999, espera=300, reserva_ok=False)
ag.tentar_voltar_para_placa()
ok(c["carregou"] == 0, "sem conseguir a reserva: nao carrega (dois motores nao cabem)")
ok(ag.ASR.device == "cpu", "e segue no processador, sem quebrar nada")

print("\n=== quando DEVE tentar ===")
c = preparar("cpu", quando=9999, espera=300, carrega="cuda")
ag.tentar_voltar_para_placa()
ok(c["reservou"] == 1, "reserva a placa ANTES de carregar")
ok(c["carregou"] == 1, "e carrega o motor")
ok(ag.ASR.device == "cuda", "o motor volta para a placa")
ok(ag.CPU_QUEDA["quando"] == 0.0, "e a marca da queda e zerada (nao tenta de novo a toa)")
ok("cuda" in ag.MODELO_ROTULO, "o /health passa a dizer cuda  [" + ag.MODELO_ROTULO + "]")

print("\n=== a espera cresce quando falha, e a reserva e devolvida ===")
c = preparar("cpu", quando=9999, espera=300, carrega=None)   # a placa recusa
ag.tentar_voltar_para_placa()
ok(c["carregou"] == 1, "tentou")
ok(c["soltou"] == 1, "SOLTOU a reserva ao falhar (senao a placa ficaria travada sem uso)")
ok(ag.ASR.device == "cpu", "e o motor bom continua no lugar (nao ficou sem motor)")
ok(ag.CPU_QUEDA["espera"] == 600, "a espera dobrou: 5 -> 10 min")
ag.CPU_QUEDA["quando"] = time.time() - 9999
ag.tentar_voltar_para_placa()
ok(ag.CPU_QUEDA["espera"] == 1200, "e de novo: 10 -> 20 min")
ag.CPU_QUEDA["espera"] = 3600
ag.CPU_QUEDA["quando"] = time.time() - 9999
ag.tentar_voltar_para_placa()
ok(ag.CPU_QUEDA["espera"] == 3600, "mas trava no teto de 60 min")

print("\n=== carregar e cair de novo nao troca um motor bom por um ruim ===")
c = preparar("cpu", quando=9999, espera=300, carrega="cpu")  # carrega, mas na CPU
ag.tentar_voltar_para_placa()
ok(ag.ASR.device == "cpu", "segue no processador")
ok(c["soltou"] == 1, "e a reserva volta (nao ficamos na placa)")

print("\n=== a queda solta a reserva e agenda a volta ===")
ag.ASR = MotorFalso("cpu")
ag.MODELO_ROTULO = "local: faster-whisper large-v3 (cuda)"
ag.CPU_QUEDA["quando"] = 0.0
soltou = {"n": 0}
ag.soltar_placa = lambda: soltou.__setitem__("n", soltou["n"] + 1)
ag.sincronizar_rotulo()
ok(soltou["n"] == 1, "ao detectar a queda, solta a reserva da placa")
ok(ag.CPU_QUEDA["quando"] > 0, "e marca a hora da queda (comeca a contar a espera)")
ok("cpu" in ag.MODELO_ROTULO, "o /health passa a dizer cpu — sem mentir sobre a placa")

print("\n" + ("  %d FALHA(S)" % len(falhas) if falhas else "  tudo certo"))
sys.exit(1 if falhas else 0)
