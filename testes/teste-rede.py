# A queda da PLACA DE VIDEO para o PROCESSADOR, exercitada de verdade (13/08/2026).
#
# O teste-rede.js le o codigo e confere que a rede esta escrita. Este aqui RODA a rede:
# finge uma placa que quebra no meio da transcricao e verifica que o ditado sai mesmo
# assim, pelo processador. Sem isto, so se saberia no dia em que um exame se perdesse.
#
# Nenhum modelo de verdade e carregado: o WhisperModel e trocado por um de mentira.
import io
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
DITADO = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "Projeto WBOT", "ditado-local")
sys.path.insert(0, DITADO)

falhas = 0


def ok(cond, msg):
    global falhas
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas += 1


class Seg:
    def __init__(self, texto, ini, fim):
        self.text = texto
        self.start = ini
        self.end = fim


class ModeloFalso:
    """Uma placa que quebra: as primeiras `quebras` chamadas estouram."""

    def __init__(self, quebras=0, marca="cpu"):
        self.quebras = quebras
        self.marca = marca
        self.chamadas = 0
        self.leu_do_comeco = None

    def transcribe(self, audio, **kw):
        self.chamadas += 1
        try:
            self.leu_do_comeco = (audio.tell() == 0)
        except Exception:  # noqa: BLE001
            self.leu_do_comeco = None
        if self.quebras > 0:
            self.quebras -= 1
            # o gerador so estoura quando alguem itera — igualzinho ao caso real
            def explode():
                raise RuntimeError("CUDA failed with error out of memory")
                yield  # noqa

            return explode(), None
        return iter([Seg(" Figado de contornos regulares.", 0.0, 2.4),
                     Seg(" Rim direito sem alteracoes.", 2.4, 4.9)]), None


print("=== O ARQUIVO CERTO E O QUE O PROGRAMA CARREGA (13/08/2026) ===")
# A avaliacao pegou isto: eu consertei o asr.py de `Projeto WBOT\ditado-local` e o
# programa 2.0 carrega OUTRA copia — `laudos.py` define DITADO_DIR para a pasta
# ditado-local de dentro da instalacao, quando ela existe. Aquela copia era de 08/08,
# sem os metodos novos, e o conserto nao chegava a lugar nenhum. Pior: com a rede da
# nuvem no lugar, o erro barulhento virava nuvem paga em silencio, em todo exame.
#
# Por isso este teste NAO usa caminho fixo: ele resolve o caminho do MESMO jeito que o
# programa resolve, e cobra os metodos la.
def ditado_dir_de(instalacao):
    """Repete a regra de laudos.py — se existe ditado-local dentro da instalacao, e ela
    que vale; senao, o caminho padrao do agente-laudos.py.

    Importar o laudos.py de verdade puxaria a interface grafica junto, o que num teste
    de bancada nao se quer. Entao a regra e repetida AQUI e, logo abaixo, ha um vigia
    que le o laudos.py e falha se ele mudar de ideia — sem o vigia, a regra copiada
    envelheceria em silencio, e este teste e justamente a rede contra esse tipo de coisa.
    """
    local = os.path.join(instalacao, "ditado-local")
    if os.path.isdir(local):
        return local
    return DITADO


def vigiar_regra(instalacao):
    """Le o laudos.py da instalacao e confere que a regra ainda e a que este teste supoe."""
    lp = os.path.join(instalacao, "programa", "laudos.py")
    if not os.path.exists(lp):
        return None
    with open(lp, encoding="utf-8") as f:
        src = f.read()
    esperado = ["PASTA_DITADO = os.path.join(RAIZ, 'ditado-local')",
                "if not env.get('DITADO_DIR') and os.path.isdir(PASTA_DITADO):",
                "env['DITADO_DIR'] = PASTA_DITADO"]
    return [p for p in esperado if p not in src]


PRECISA = ["def _rodar(", "def _rodar_uma_vez(", "def transcribe_segments("]
instalacoes = [os.path.join(os.path.expanduser("~"), "Laudos USG 2.0"),
               os.path.join(os.path.expanduser("~"), "Laudos USG")]
achou_alguma = False
for inst in instalacoes:
    if not os.path.isdir(inst):
        continue
    achou_alguma = True
    nome = os.path.basename(inst)
    mudou = vigiar_regra(inst)
    if mudou is not None:
        ok(not mudou,
           'a regra do DITADO_DIR no laudos.py de "%s" e a que este teste supoe%s'
           % (nome, "" if not mudou else " | MUDOU, atualize o teste: " + " ~ ".join(mudou)))
    alvo = os.path.join(ditado_dir_de(inst), "src", "asr.py")
    if not os.path.exists(alvo):
        ok(False, '"%s" aponta para um asr.py que nao existe: %s' % (nome, alvo))
        continue
    with open(alvo, encoding="utf-8") as f:
        conteudo = f.read()
    faltando = [p for p in PRECISA if p not in conteudo]
    ok(not faltando,
       '"%s" carrega um asr.py COM a rede (%s)%s'
       % (nome, os.path.relpath(alvo, os.path.expanduser("~")),
          ("" if not faltando else " | FALTA: " + ", ".join(faltando))))
ok(achou_alguma, "achei ao menos uma instalacao para conferir")

print("=== o motor carrega ===")
try:
    from src.asr import Transcriber
    ok(True, "o asr.py importa (faster-whisper instalado)")
except Exception as e:  # noqa: BLE001
    print("  -- PULADO: nao consegui importar o asr.py (%s)" % e)
    sys.exit(0)

import src.asr as asrmod

# ---- monta um Transcriber SEM carregar modelo de verdade ----
def fabricar(device, modelo):
    t = Transcriber.__new__(Transcriber)
    t.model = modelo
    t.model_size = "large-v3"
    t.device = device
    t.compute_type = "float16" if device == "cuda" else "int8"
    t.language = "pt"
    return t


print("=== com a placa boa, nada muda ===")
m = ModeloFalso(quebras=0)
t = fabricar("cuda", m)
segs = t._rodar(io.BytesIO(b"RIFFfake"), [])
ok(len(segs) == 2, "transcreveu normalmente (%d segmentos)" % len(segs))
ok(t.device == "cuda", "e continua na placa — nao troca de motor a toa")
ok(m.chamadas == 1, "uma unica passada")

print("=== a placa quebra NO MEIO: cai para o processador e o ditado sai ===")
criados = []
original = asrmod.WhisperModel


def fabrica_espia(tamanho, device=None, compute_type=None, **kw):
    m = ModeloFalso(quebras=0, marca="cpu-novo")
    criados.append({"tamanho": tamanho, "device": device, "compute_type": compute_type, "modelo": m})
    return m


asrmod.WhisperModel = fabrica_espia
try:
    m = ModeloFalso(quebras=1)
    t = fabricar("cuda", m)
    audio = io.BytesIO(b"RIFFfake" * 40)
    segs = t._rodar(audio, ["hepatomegalia"])
    ok(len(segs) == 2, "o ditado SAIU mesmo com a placa quebrando (%d segmentos)" % len(segs))
    ok(t.device == "cpu", "o motor passou para o processador")
    ok(t.compute_type == "int8", "com a precisao que cabe na CPU")
    ok(len(criados) == 1, "um unico motor novo foi construido")
    ok(criados[0]["device"] == "cpu", "e construido explicitamente para a CPU")
    ok(criados[0]["tamanho"] == "large-v3", "com o MESMO tamanho de modelo de antes")
    # o `or True` que estava aqui fazia esta verificacao passar SEMPRE. O detalhe mais
    # delicado da camada 1 — rebobinar o audio — ficava dado como provado sem prova.
    # Agora quem responde e o motor da 2a tentativa: ele leu do byte zero?
    novo = criados[0]["modelo"]
    ok(novo is not None and novo.leu_do_comeco is True,
       "o motor da 2a tentativa leu do BYTE ZERO — sem rebobinar, ele transcreveria "
       "so o resto do audio e o comeco do ditado sumiria")
finally:
    asrmod.WhisperModel = original

print("=== na CPU nao ha para onde cair: o erro sobe, sem laco infinito ===")
m = ModeloFalso(quebras=5)
t = fabricar("cpu", m)
try:
    t._rodar(io.BytesIO(b"RIFFfake"), [])
    ok(False, "deveria ter levantado o erro")
except RuntimeError as e:
    ok("out of memory" in str(e), "o erro sobe intacto, para quem chamou decidir")
ok(m.chamadas == 1, "e tentou UMA vez so — nada de ficar tentando em circulo")

print("=== os trechos com hora continuam saindo pelo caminho da rede ===")
asrmod.WhisperModel = fabrica_espia
try:
    t = fabricar("cuda", ModeloFalso(quebras=1))
    trechos = t.transcribe_segments(io.BytesIO(b"RIFFfake"), [])
    ok(len(trechos) == 2, "dois trechos")
    ok(trechos[0]["inicio"] == 0.0 and trechos[0]["fim"] == 2.4, "com inicio e fim em segundos")
    ok(trechos[0]["texto"] == "Figado de contornos regulares.", "e o texto ja aparado")
    t = fabricar("cuda", ModeloFalso(quebras=1))
    texto = t.transcribe(io.BytesIO(b"RIFFfake"), [])
    ok(texto.startswith("Figado") and "Rim direito" in texto,
       "e o texto corrido tambem sai pela CPU, sem o chamador saber da troca")
finally:
    asrmod.WhisperModel = original

print("=== CAMADA 3: a ida para a nuvem, EXERCITADA (nao so lida) ===")
# Esta e a funcao que roda quando todo o resto ja falhou e o audio nao existe em
# nenhum outro lugar. Ate agora so havia regex sobre o codigo dela.
import importlib.util
import types

AG = os.path.join(os.path.expanduser("~"), "Laudos USG 2.0", "agente", "agente-laudos.py")
fonte = open(AG, encoding="utf-8").read()
# recorta so o pedaco da nuvem e roda num modulo de mentira, sem subir o agente inteiro
ini = fonte.index("def transcrever_na_nuvem(")
fim = fonte.index("def transcrever_audio_f32(")
mod = types.ModuleType("nuvem_falsa")
chamadas = []


def ia_falso(caminho, corpo, ctype, timeout=None):
    chamadas.append({"caminho": caminho, "corpo": corpo, "ctype": ctype})
    return ia_falso.resposta


mod.__dict__.update({"time": __import__("time"), "json": __import__("json"),
                     "ia_encaminhar": ia_falso,
                     "wav_bytes": lambda a: b"WAVFALSO" * 10})
exec(compile(fonte[ini:fim], "nuvem", "exec"), mod.__dict__)

ia_falso.resposta = (200, b'{"text":"figado de contornos regulares"}')
r = mod.transcrever_na_nuvem_bytes(b"RIFF" + b"\0" * 1000, ["hepatomegalia", "esteatose"])
ok(r == "figado de contornos regulares", "200 com texto -> devolve o texto")
c = chamadas[-1]
ok(c["caminho"] == "/audio/transcriptions", "bate na rota de transcricao da OpenAI")
ok(c["ctype"].startswith("multipart/form-data; boundary="), "com o tipo certo")
lim = c["ctype"].split("boundary=")[1].encode()
ok(c["corpo"].startswith(b"--" + lim), "o corpo comeca na fronteira declarada")
ok(c["corpo"].endswith(b"--" + lim + b"--\r\n"), "e termina no fechamento dela")
ok(b'name="file"; filename="audio.wav"' in c["corpo"], "o arquivo vai como file/audio.wav")
ok(b"RIFF" in c["corpo"], "com os bytes do audio dentro")
ok(b"hepatomegalia" in c["corpo"], "e o vocabulario de USG junto, para nao errar termo")
ok(c["corpo"].count(b"--" + lim) == 6, "cinco campos + o fechamento, sem fronteira sobrando")

print("--- e quando a nuvem recusa ---")
ia_falso.resposta = (400, b'{"error":{"message":"model not found"}}')
chamadas.clear()
try:
    mod.transcrever_na_nuvem_bytes(b"RIFF", [])
    ok(False, "400 deveria virar erro")
except RuntimeError as e:
    ok("nao transcreveu" in str(e), "400 vira erro claro, nao texto vazio")
ok(len(chamadas) == 3, "e antes de desistir tentou os TRES modelos (%d)" % len(chamadas))
ok(chamadas[0]["corpo"] != chamadas[1]["corpo"], "cada tentativa com um modelo diferente")

ia_falso.resposta = (401, b'{"error":{"message":"invalid api key"}}')
chamadas.clear()
try:
    mod.transcrever_na_nuvem_bytes(b"RIFF", [])
except RuntimeError:
    pass
ok(len(chamadas) == 1, "chave errada nao melhora com outro modelo: desiste na 1a (%d)" % len(chamadas))

ia_falso.resposta = (200, b"isto nao e json")
try:
    mod.transcrever_na_nuvem_bytes(b"RIFF", [])
    ok(False, "200 ilegivel deveria falhar")
except RuntimeError as e:
    ok("ilegivel" in str(e) or "nao transcreveu" in str(e), "200 com corpo ilegivel nao vira texto vazio")

ia_falso.resposta = (200, b'{"semTexto":1}')
r = mod.transcrever_na_nuvem_bytes(b"RIFF", [])
ok(r == "", "200 sem o campo de texto devolve vazio, e quem chama decide")

print("--- audio grande demais e avisado, nao descoberto pelo erro cru ---")
chamadas.clear()
try:
    mod.transcrever_na_nuvem_bytes(b"\0" * (26 * 1024 * 1024), [])
    ok(False, "deveria recusar antes de enviar")
except RuntimeError as e:
    ok("grande demais" in str(e), "recusa com explicacao: " + str(e)[:60])
    ok("esta guardado no disco" in str(e), "e diz que o audio nao se perdeu")
ok(len(chamadas) == 0, "e nem chega a subir 26 MB para levar um 413")

print("=== o motor nem carregou: a nuvem PRECISA ser tentada mesmo assim ===")
# Defeito real, apanhado na 2a avaliacao: o ramo escrevia DIC.apply_replacements(nuvem(...)).
# O Python resolve o DIC ANTES de chamar a nuvem — e o DIC nasce junto com o motor, que
# acabou de falhar. Estourava AttributeError e a nuvem nem era tentada: o ramo criado
# para ser a ultima rede nunca rodava. Pior, o AttributeError e o sinal de "instalacao
# desencontrada", entao mandava quem investigasse para a pista errada.
mod2 = types.ModuleType("agente_falso")
ini2 = fonte.index("def transcrever_audio_f32(")
fim2 = fonte.index("\ndef ", ini2 + 10)
nuvem_chamou = {"n": 0}


def nuvem_falsa(audio, boost):
    nuvem_chamou["n"] += 1
    return "  texto cru da nuvem  "


def motor_quebrado():
    raise RuntimeError("CUDA driver ausente")


import threading as _th

mod2.__dict__.update({
    "time": __import__("time"), "io": io, "json": __import__("json"),
    "_transcr_lock": _th.Lock(),
    "garantir_motor": motor_quebrado,
    "transcrever_na_nuvem": nuvem_falsa,
    "guardar_ditado": lambda *a, **k: True,
    "wav_bytes": lambda a: b"WAV",
    "DIC": None, "ASR": None, "SR": 16000,
    "sincronizar_rotulo": lambda: None,
})
exec(compile(fonte[ini2:fim2], "tf", "exec"), mod2.__dict__)

texto, trechos, motor = mod2.transcrever_audio_f32([0.0] * 16000)
ok(nuvem_chamou["n"] == 1, "a nuvem FOI chamada (%d vez) — o ramo funciona" % nuvem_chamou["n"])
ok(motor == "nuvem", 'e a origem volta como "nuvem"')
ok(texto == "texto cru da nuvem", "o texto sai aparado, sem passar pelo dicionario que nao existe")
ok(trechos == [], "sem trechos, porque a nuvem nao devolve hora")

# e quando o DIC existe, ele TEM de ser usado
mod2.DIC = type("D", (), {"apply_replacements": staticmethod(lambda t: t.strip().upper())})()
nuvem_chamou["n"] = 0
texto2, _, _ = mod2.transcrever_audio_f32([0.0] * 16000)
ok(texto2 == "TEXTO CRU DA NUVEM", "com o dicionario disponivel, ele e aplicado")

print("=== o pre-salvamento NAO pode duplicar o audio da pasta clinica ===")
# Regressao real da rodada passada: guardar_ditado passou a rodar duas vezes por exame,
# e a copia de consulta usa nome LIVRE (nunca sobrescreve). Cada exame deixava dois .wav
# na pasta do dia, e o de nome limpo era justamente o que ficava SEM o .txt ao lado.
gd = fonte[fonte.index("def guardar_ditado("):fonte.index("\ndef ", fonte.index("def guardar_ditado(") + 10)]
ok("arquivar=True" in gd.split("\n")[0], "guardar_ditado ganhou a chave `arquivar`")
ok("if not arquivar:" in gd and "return True" in gd.split("if not arquivar:")[1][:40],
   "e sai antes da copia de consulta quando ela nao e pedida")
pos_guard = gd.index("if not arquivar:")
pos_copia = gd.index("arquivos.salvar_captura")
ok(pos_guard < pos_copia, "a saida vem ANTES do salvar_captura, que e quem cria o nome livre")
ok(pos_guard > gd.index("DITADOS_DIR, eid"),
   "e DEPOIS do WAV de recuperacao — que e o unico que o pre-salvamento precisa")
ok('guardar_ditado(salvar_antes, audio, "", "pre-transcricao", arquivar=False)' in fonte,
   "o pre-salvamento pede arquivar=False")
ok(fonte.count(', arquivar=False)') == 1,
   "e e a UNICA chamada que pula o arquivamento (o outro `arquivar=False` do arquivo "
   "esta na explicacao da propria funcao, nao numa chamada)")

print("=== a troca de motor nao e muda em nenhum dos dois caminhos ===")
avisos_nuvem = fonte.count('if motor == "nuvem":')
ok(avisos_nuvem == 2, "o aviso da nuvem existe no exame fechado E no botao vermelho (%d)" % avisos_nuvem)

print("")
print(("  %d FALHA(S)" % falhas) if falhas else "  tudo certo")
sys.exit(1 if falhas else 0)
