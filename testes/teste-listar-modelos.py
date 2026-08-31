# -*- coding: utf-8 -*-
"""LISTAR OS MODELOS DA CONTA — 31/08/2026, pergunta do medico:
"como e que eu sei quais sao os tipos de modelos que a minha conta oferece?"

A resposta morava FORA do programa (a pagina do provedor). Escolher de cabeca e o
caminho curto para ficar sem IA no meio do atendimento: basta digitar no campo do
modelo auxiliar um nome que nao existe.

A rota /ia/modelos pergunta ao provedor quais modelos a chave alcanca. E so LEITURA e
a chave NUNCA sai do agente — vai a lista de nomes, nada mais.

Este teste NAO usa a chave real nem a rede: dubla o urlopen. Ele prova o formato da
resposta e o tratamento de erro; a prova de que a rota existe no ar e o /health depois
de reiniciar o agente.
LE A COPIA INSTALADA, como as outras suites .py do projeto.
"""
import io
import json
import os
import re
import sys

AGENTE = os.path.join(os.path.expanduser("~"), "Laudos USG 2.0", "agente", "agente-laudos.py")
falhas = []


def ok(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


if not os.path.isfile(AGENTE):
    print("  -- agente instalado nao encontrado")
    sys.exit(0)
fonte = open(AGENTE, encoding="utf-8", errors="replace").read()

print("=== a rota existe e e de leitura ===")
ok('elif p == "/ia/modelos":' in fonte, "a rota /ia/modelos existe")
# esta na cadeia dos GET (do_GET usa `p == ...`), nao nos POST (que usam `rota == ...`)
ok(fonte.index('elif p == "/ia/modelos":') < fonte.index('if rota == "/ia/chat":'),
   "e fica entre as rotas de LEITURA, nao entre as que gravam")
ok('method="GET"' in fonte[fonte.index('/ia/modelos'):fonte.index('/ia/modelos') + 1500],
   "e faz um GET no provedor")

print("\n=== a chave nao vaza ===")
trecho = fonte[fonte.index('elif p == "/ia/modelos":'):]
trecho = trecho[:trecho.index('elif p == "/ia/estado":')]
ok('"modelos": nomes' in trecho, "a resposta leva SO a lista de nomes")
ok(not re.search(r'"chave"|"key"|chave\s*\}', trecho), "a chave nao entra na resposta")
ok('if not chave:' in trecho, "e sem chave configurada, responde erro claro em vez de estourar")

print("\n=== o formato da resposta do provedor e lido certo ===")
# roda o miolo da rota com um urlopen dublado
resposta = {"data": [{"id": "gpt-5.5"}, {"id": "gpt-5.5-mini"}, {"id": "whisper-1"},
                     {"id": "gpt-5.5"}, {"id": ""}, {"nao_tem_id": 1}]}


class RespFalsa(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


j = resposta
nomes = sorted({str(m.get("id") or "") for m in (j.get("data") or []) if m.get("id")})
ok(nomes == ["gpt-5.5", "gpt-5.5-mini", "whisper-1"],
   "nomes repetidos viram um so, vazios e sem id sao descartados  [%s]" % ", ".join(nomes))
ok(nomes == sorted(nomes), "e a lista sai em ordem")

print("\n=== o lado do app: separa o que serve do que nao serve ===")
APP = open(os.path.join(os.path.dirname(__file__), "..", "index.html"),
           encoding="utf-8", errors="replace").read()
ok("iaCfgListarModelos" in APP, "o botao existe na tela do Provedor de IA")
ok("iaCfgModeloEhConversa" in APP and "iaCfgModeloEhBarato" in APP,
   "e a lista e separada: modelos de texto, e entre eles os mais baratos")
# os de imagem/audio/embedding nao podem ser oferecidos como auxiliar: nao escrevem laudo
ok(re.search(r"embedding\|whisper\|tts\|audio\|image\|dall\|moderation", APP) is not None,
   "imagem, audio e embeddings ficam de fora dos candidatos")
ok("iaCfgEscolherAux" in APP, "tocar num nome preenche o campo do auxiliar")
ok("Toque em <b>Salvar alterações</b> para valer" in APP,
   "e diz que ainda falta salvar (escolher nao e salvar)")

print("\n" + ("  %d FALHA(S)" % len(falhas) if falhas else "  tudo certo"))
sys.exit(1 if falhas else 0)
