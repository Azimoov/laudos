# REINICIAR O AGENTE PELO PROPRIO PROGRAMA (20/08/2026, pedido do Dr. Daniel).
#
# Fechar a janela NAO derruba o agente — e de proposito, porque e ele quem continua
# gravando com o navegador fechado. A consequencia era que trocar o codigo do agente so
# dava pelo Gerenciador de Tarefas. Este teste EXERCITA as tres pecas da rota nova:
#   1. agente_ocupado    — a recusa que protege ditado em curso;
#   2. esperar_porta_livre — o que impede DOIS agentes na mesma porta;
#   3. relancar_agente   — o sucessor sobe solto, com a porta e a marca certas.
#
# Nada de rede de verdade e nenhum processo e morto: as funcoes sao recortadas do agente
# instalado e rodadas num modulo de mentira, como o teste-rede.py ja faz.
import os
import sys
import threading
import time
import types

AQUI = os.path.dirname(os.path.abspath(__file__))
AG = os.path.join(os.path.expanduser("~"), "Laudos USG 2.0", "agente", "agente-laudos.py")

falhas = 0


def ok(cond, msg):
    global falhas
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas += 1


fonte = open(AG, encoding="utf-8").read()


def recortar(nome):
    i = fonte.index("def %s(" % nome)
    j = fonte.index("\ndef ", i + 1)
    return fonte[i:j]


mod = types.ModuleType("reinicio_falso")
popens = []


class PopenFalso:
    def __init__(self, cmd, **kw):
        popens.append({"cmd": cmd, "kw": kw})


import urllib.request as _ur  # noqa: E402

mod.__dict__.update({
    "os": os, "sys": sys, "time": time, "threading": threading,
    "subprocess": types.SimpleNamespace(Popen=PopenFalso),
    "urllib": types.SimpleNamespace(request=_ur),
    "print": print,
    "__file__": AG,          # relancar_agente aponta para o proprio arquivo do agente
    "PORT_HTTP": 8988,
    "MARCA_INICIO": None,
    "_transcr_lock": threading.Lock(),
    "BUF": types.SimpleNamespace(stream=None),
})
for _n in ("agente_ocupado", "esperar_porta_livre", "relancar_agente"):
    exec(compile(recortar(_n), _n, "exec"), mod.__dict__)

print("=== 1) A RECUSA: reiniciar nao pode custar ditado ===")
# A regra mais antiga do projeto ("nunca reiniciar com atendimento em curso") deixa de
# depender de alguem lembrar dela: o proprio agente recusa.
ok(mod.agente_ocupado() is None, "parado e sem microfone: pode reiniciar")

mod.MARCA_INICIO = 12345.0
m = mod.agente_ocupado()
ok(m is not None and "gravação" in m, "com gravacao em curso, RECUSA: %s" % m)
mod.MARCA_INICIO = None

mod._transcr_lock.acquire()
m = mod.agente_ocupado()
ok(m is not None and "transcrição" in m, "com transcricao em andamento, RECUSA: %s" % m)
mod._transcr_lock.release()
ok(not mod._transcr_lock.locked(), "e a tranca e DEVOLVIDA — testar nao pode travar o agente")

mod.BUF.stream = object()
m = mod.agente_ocupado()
ok(m is not None and "pré-buffer" in m,
   "com o microfone aberto RECUSA, citando a fita que se perderia")
mod.BUF.stream = None
ok(mod.agente_ocupado() is None, "e volta a liberar quando tudo se acalma")

print("\n=== 2) O SUCESSOR ESPERA O ANTIGO SAIR ===")
# Esta e a peca que impede o pior defeito possivel aqui: HTTPServer liga SO_REUSEADDR e
# no Windows DOIS processos conseguem escutar a mesma porta — os pedidos passariam a cair
# ora num ora noutro, intermitente e quase impossivel de diagnosticar.
respostas = {"n": 0}


class RespostaFalsa:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def urlopen_falso(url, timeout=None):
    respostas["n"] += 1
    if respostas["n"] <= 3:
        return RespostaFalsa()          # o antigo AINDA responde
    raise OSError("connection refused")  # saiu


mod.urllib = types.SimpleNamespace(request=types.SimpleNamespace(urlopen=urlopen_falso))
t0 = time.time()
ok(mod.esperar_porta_livre(8988, ate=10.0) is True,
   "espera enquanto o antigo responde e libera quando ele para")
ok(respostas["n"] == 4, "perguntou %d vezes, ate a recusa — nao chutou o tempo" % respostas["n"])
ok(time.time() - t0 >= 1.0, "e realmente ESPEROU entre as perguntas, sem girar a toa")

respostas["n"] = 0


def urlopen_teimoso(url, timeout=None):
    respostas["n"] += 1
    return RespostaFalsa()              # o antigo NUNCA sai


mod.urllib = types.SimpleNamespace(request=types.SimpleNamespace(urlopen=urlopen_teimoso))
ok(mod.esperar_porta_livre(8988, ate=2.0) is False,
   "antigo que nao sai devolve False — e quem chama DESISTE, em vez de subir por cima")

print("\n=== 3) O SUCESSOR SOBE SOLTO, E COM A PORTA CERTA ===")
popens.clear()
mod.relancar_agente()
ok(len(popens) == 1, "subiu exatamente um sucessor")
p = popens[0]
ok(p["cmd"][0] == sys.executable, "com o MESMO interpretador deste agente")
ok(p["cmd"][1].endswith("agente-laudos.py"), "e apontando para o proprio agente")
env = p["kw"]["env"]
ok(env.get("AGENTE_SUBSTITUIR") == "1",
   "com a marca que manda ESPERAR o antigo sair (sem ela, dois agentes na porta)")
ok(env.get("AGENTE_PORT") == "8988",
   "e com a porta escrita na mao: a porta atual pode ter vindo do padrao, e o sucessor "
   "nao pode adivinhar 8977 quando esta linha roda em 8988")
if os.name == "nt":
    ok(p["kw"].get("creationflags") == (0x00000008 | 0x00000200),
       "DETACHED|NEW_GROUP: o sucessor NAO morre junto com quem o criou")
else:
    ok(p["kw"].get("start_new_session") is True, "sessao nova: nao morre junto")

print("\n=== 4) A ROTA, lida no codigo: a ordem das coisas importa ===")
rota = fonte[fonte.index('if rota == "/agente/reiniciar":'):]
rota = rota[:rota.index("# Banco estruturado (POST /exames")]
ok(rota.index("agente_ocupado()") < rota.index("relancar_agente()"),
   "pergunta se pode ANTES de lancar o sucessor")
ok(rota.index("relancar_agente()") < rota.index("morrer_em_breve"),
   "e lanca o sucessor ANTES de marcar a propria saida")
ok("except OSError" in rota and "continua no ar" in rota,
   "sucessor que nao sobe NAO mata este: trocar agente velho por agente nenhum e pior")
ok('self._json(409' in rota, "a recusa volta como 409, que o app distingue de erro de verdade")
ok(rota.index("self._json(200") < rota.index("morrer_em_breve"),
   "responde ao app ANTES de agendar a morte — senao o app fica sem resposta")

print("\n=== 5) O AGENTE NOVO espera ANTES de abrir a porta ===")
main = fonte[fonte.index('if __name__ == "__main__":'):]
ok(main.index('AGENTE_SUBSTITUIR') < main.index("ThreadingHTTPServer"),
   "a espera vem ANTES do bind — depois dele ja seria tarde")
ok("raise SystemExit(1)" in main,
   "e se o antigo nao sair, o novo DESISTE (um agente velho de pe > dois brigando)")

print("\n" + ("  tudo certo" if not falhas else "  %d FALHA(S)" % falhas))
sys.exit(1 if falhas else 0)
