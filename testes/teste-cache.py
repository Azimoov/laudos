# -*- coding: utf-8 -*-
"""Testa o cache da listagem: 2a varredura nao deve rebuscar tags; TTL de 2 s;
exame crescendo (imagens novas) so busca as tags NOVAS."""
import re
import sys
import threading
import time

ARQ = r"C:\Users\serru\AppData\Local\LaudosLocal\agente-laudos.py"
src = open(ARQ, encoding="utf-8").read()

ini = src.index("# ---- caches da listagem")
fim = src.index("# ---------------- pagina do certificado")
trecho = src[ini:fim]

CHAMADAS = {"tags": 0, "outras": 0}
BANCO = {
    "/studies": ["e1"],
    "/studies/e1": {"MainDicomTags": {"StudyDate": "20260803", "StudyTime": "1200"},
                    "PatientMainDicomTags": {"PatientName": "TESTE"},
                    "Series": ["s1"]},
    "/series/s1": {"MainDicomTags": {"SeriesNumber": "1"}, "Instances": ["i1", "i2"]},
    "/instances/i1/tags?simplify": {"ContentTime": "120001", "ContentDate": "20260803", "InstanceNumber": "1"},
    "/instances/i2/tags?simplify": {"ContentTime": "120002", "ContentDate": "20260803", "InstanceNumber": "2"},
    "/instances/i3/tags?simplify": {"ContentTime": "120010", "ContentDate": "20260803", "InstanceNumber": "3"},
}


def orthanc_falso(caminho, binario=False, timeout=20):
    if "/tags" in caminho:
        CHAMADAS["tags"] += 1
    else:
        CHAMADAS["outras"] += 1
    return BANCO[caminho]


ns = {"threading": threading, "time": time, "orthanc_get": orthanc_falso,
      "_data_br": lambda s: s, "_idade": lambda a, b: "", "print": print}
exec(compile(trecho, "listar", "exec"), ns)
listar = ns["listar_estudos"]

falhas = []
def ok(c, m):
    print(("  ok   " if c else "  FALHA ") + m)
    if not c:
        falhas.append(m)

print("=== 1a varredura (fria) ===")
r1 = listar()
ok(CHAMADAS["tags"] == 2, "buscou as 2 tags (%d)" % CHAMADAS["tags"])
ok([i for i in r1[0]["instancias"]] == ["i1", "i2"], "ordem cronologica")

print("=== 2a varredura imediata (TTL 2 s) ===")
antes = dict(CHAMADAS)
r2 = listar()
ok(CHAMADAS == antes, "ZERO chamadas ao Orthanc (resposta do TTL)")
ok(r2 is r1, "mesma resposta")

print("=== 3a varredura apos o TTL vencer ===")
ns["_ESTUDOS_CACHE"]["t"] = 0            # envelhece o TTL na marra
antes = dict(CHAMADAS)
r3 = listar()
ok(CHAMADAS["tags"] == antes["tags"], "tags do CACHE: nenhuma rebuscada")
ok(CHAMADAS["outras"] > antes["outras"], "estudos/series relistados (mudam de verdade)")

print("=== exame crescendo: imagem nova i3 chega ===")
BANCO["/series/s1"] = {"MainDicomTags": {"SeriesNumber": "1"}, "Instances": ["i1", "i2", "i3"]}
ns["_ESTUDOS_CACHE"]["t"] = 0
antes = dict(CHAMADAS)
r4 = listar()
ok(CHAMADAS["tags"] == antes["tags"] + 1, "buscou SO a tag nova (+1)")
ok(r4[0]["instancias"] == ["i1", "i2", "i3"], "i3 entrou, em ordem")
ok(r4[0]["imgHoraFim"] == "120010", "hora-fim atualizada p/ o recorte do audio")

print()
print("TODOS OS %d TESTES PASSARAM" % 9 if not falhas else "FALHAS: %d" % len(falhas))
sys.exit(1 if falhas else 0)
