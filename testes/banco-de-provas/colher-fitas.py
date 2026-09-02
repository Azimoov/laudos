# BANCO DE PROVAS, passo 1: colher a FITA DE PALAVRAS dos ditados ja guardados.
#
# Passa pela rota /transcrever do agente DE PROPOSITO: ela reusa o motor que ja esta
# carregado na placa (nao carrega um segundo, que nao caberia nos 4 GB) e entra na MESMA
# fila do exame ao vivo — se o medico acordar e comecar a atender, o exame dele espera no
# maximo uma transcricao, em vez de disputar a placa.
#
# Resumivel: cada ditado vira um arquivo no cache. Rodar de novo pula o que ja tem.
import base64, json, io, os, re, sqlite3, sys, time, urllib.request

BASE = r'C:\Users\serru\Laudos USG 2.0\agente'
DB = os.path.join(BASE, 'dados', 'laudos.db')
DITADOS = os.path.join(BASE, 'ditados')
# ⚠️ FORA DO REPOSITORIO: a fita traz o DITADO DO PACIENTE, palavra por palavra,
# e este repo vai para o GitHub. Nunca aponte este caminho para dentro dele.
FORA = os.environ.get('WBOT_BANCO') or os.path.join(
    os.path.expanduser('~'), 'Desktop', 'Projeto WBOT', '_banco-de-provas')
CACHE = os.path.join(FORA, 'fitas')
AGENTE = 'http://127.0.0.1:8988'
os.makedirs(CACHE, exist_ok=True)


def seguro(s):
    return re.sub(r'[^A-Za-z0-9._-]', '_', str(s))


def alvos():
    """(uid, caminho_wav, tamanho) dos exames que tem citacao E audio em disco."""
    tem = set(f[:-4] for f in os.listdir(DITADOS) if f.endswith('.wav'))
    c = sqlite3.connect(DB)
    cur = c.cursor()
    cur.execute("select study_uid, json_gerado from exames "
                "where json_gerado is not null and json_gerado <> ''")
    saida = []
    for uid, j in cur.fetchall():
        if not uid:
            continue
        s = seguro(uid)
        if s not in tem:
            continue
        try:
            o = json.loads(j)
        except Exception:
            continue
        if not any((p or {}).get('citacao') for p in (o.get('procedencia') or [])):
            continue
        wav = os.path.join(DITADOS, s + '.wav')
        saida.append((s, wav, os.path.getsize(wav)))
    c.close()
    # dos menores para os maiores: resultado util cedo, e se algo travar perde-se pouco
    return sorted(set(saida), key=lambda t: t[2])


def transcrever(wav):
    b64 = 'data:audio/wav;base64,' + base64.b64encode(open(wav, 'rb').read()).decode()
    req = urllib.request.Request(AGENTE + '/transcrever',
                                 data=json.dumps({'audioBase64': b64}).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=1800) as r:
        return json.load(r)


def main():
    lista = alvos()
    seg_total = sum(t[2] for t in lista) / (16000.0 * 2)
    print('%d ditados a colher (~%.1f h de audio)' % (len(lista), seg_total / 3600.0), flush=True)
    feitos = falhas = 0
    t0 = time.time()
    for n, (uid, wav, tam) in enumerate(lista, 1):
        destino = os.path.join(CACHE, uid + '.json')
        if os.path.exists(destino):
            feitos += 1
            continue
        dur = tam / (16000.0 * 2)
        try:
            t = time.time()
            j = transcrever(wav)
            dt = time.time() - t
            if not j.get('ok'):
                raise RuntimeError(j.get('erro') or 'sem ok')
            tre = j.get('trechos') or []
            pal = sum(len(x.get('palavras') or []) for x in tre)
            with io.open(destino, 'w', encoding='utf-8') as f:
                json.dump({'uid': uid, 'segundos': round(dur, 1), 'motor': j.get('motor'),
                           'trechos': tre}, f, ensure_ascii=False)
            feitos += 1
            print('  [%3d/%3d] %s  %.0fs de audio em %.0fs (%.0fx)  %d trecho(s) %d palavra(s)'
                  % (n, len(lista), uid[:10], dur, dt, dur / max(dt, 0.01), len(tre), pal), flush=True)
        except Exception as e:
            falhas += 1
            print('  [%3d/%3d] %s  FALHOU: %s: %s'
                  % (n, len(lista), uid[:10], type(e).__name__, e), flush=True)
    print('FIM: %d colhidos, %d falhas, %.0f min' % (feitos, falhas, (time.time() - t0) / 60.0), flush=True)


main()
