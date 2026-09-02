# PARTE 1, prova: a IA consegue devolver a POSICAO (palavra_ini/palavra_fim) certa?
#
# Sem isto a Parte 1 e fe. Aqui pega-se ditados REAIS ja transcritos com hora de palavra,
# monta-se a fita numerada, e pergunta-se a ela as faixas das secoes que ela mesma
# escreveu naquele laudo. Depois compara-se com a posicao de verdade.
#
# Passa pelo /ia/chat do agente: a chave nunca sai de la.
import json, io, os, re, sqlite3, sys, unicodedata, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
FITAS = os.path.join(os.environ.get('WBOT_BANCO') or os.path.join(
    os.path.expanduser('~'), 'Desktop', 'Projeto WBOT', '_banco-de-provas'), 'fitas')
DB = r'C:\Users\serru\Laudos USG 2.0\agente\dados\laudos.db'
AGENTE = 'http://127.0.0.1:8988'
MODELO = sys.argv[1] if len(sys.argv) > 1 else 'gpt-5.5'
QUANTOS = int(sys.argv[2]) if len(sys.argv) > 2 else 3


def norm(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def casa(a, b):
    if a == b:
        return True
    if len(a) < 4 or len(b) < 4:
        return False
    return a[:4] == b[:4] and abs(len(a) - len(b)) <= 3


def verdade(fita, cit):
    """A janela mais apertada que contem a maior parte das palavras da citacao."""
    alvo = [w for w in norm(cit).split(' ') if w]
    if len(alvo) < 2:
        return None
    pal = [norm(w['p']) for w in fita]
    melhor = None
    for s in range(len(pal)):
        k = n = 0
        ult = s
        j = s
        while j < min(len(pal), s + len(alvo) * 3 + 4) and k < len(alvo):
            if casa(pal[j], alvo[k]):
                k += 1; n += 1; ult = j; j += 1
            else:
                k += 1
        if n / len(alvo) >= 0.8:
            if melhor is None or (ult - s) < (melhor[1] - melhor[0]):
                melhor = (s, ult)
    return melhor


def pedir(modelo, prompt):
    corpo = json.dumps({'model': modelo,
                        'messages': [{'role': 'user', 'content': prompt}],
                        'response_format': {'type': 'json_object'}}).encode()
    req = urllib.request.Request(AGENTE + '/ia/chat', data=corpo,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        j = json.load(r)
    return json.loads(j['choices'][0]['message']['content'])


def main():
    c = sqlite3.connect(DB); cur = c.cursor()
    cur.execute("select study_uid, json_gerado from exames "
                "where json_gerado is not null and json_gerado <> ''")
    casos = []
    for uid, jg in cur.fetchall():
        if not uid:
            continue
        s = re.sub(r'[^A-Za-z0-9._-]', '_', str(uid))
        arq = os.path.join(FITAS, s + '.json')
        if not os.path.exists(arq):
            continue
        try:
            o = json.loads(jg)
        except Exception:
            continue
        cits = [p for p in (o.get('procedencia') or []) if (p or {}).get('citacao')]
        if len(cits) < 2:
            continue
        fita = []
        for ti, t in enumerate(json.load(io.open(arq, encoding='utf-8'))['trechos']):
            for w in (t.get('palavras') or []):
                fita.append({'p': w['p'], 'i': w['i'], 'f': w['f'], 't': ti})
        if not fita or len(fita) > 700:
            continue
        casos.append((s, o, cits, fita))
        if len(casos) >= QUANTOS:
            break
    c.close()

    print('modelo: %s   casos: %d\n' % (MODELO, len(casos)))
    tot = ok_ = ruim = fora = 0
    for uid, o, cits, fita in casos:
        numerada = ' '.join('[%d]%s' % (n + 1, w['p']) for n, w in enumerate(fita))
        secoes = [p.get('secao') or '' for p in cits]
        prompt = (
            "Voce escreveu o laudo de ultrassom abaixo a partir do ditado do medico.\n"
            "O ditado vai NUMERADO: os numeros entre colchetes sao a POSICAO de cada palavra.\n\n"
            "DITADO NUMERADO:\n" + numerada + "\n\n"
            "CORPO DO LAUDO:\n" + (o.get('corpo') or '')[:4000] + "\n\n"
            "Para CADA secao listada, diga de qual pedaco do ditado ela saiu, pelos numeros:\n"
            "palavra_ini = numero da PRIMEIRA palavra; palavra_fim = numero da ULTIMA.\n"
            "Aponte so a fala daquele achado (dez a quinze palavras costumam bastar), nao o exame inteiro.\n"
            "Secao que nao veio do ditado: 0 nos dois.\n\n"
            "SECOES: " + '; '.join(secoes) + "\n\n"
            'Responda SOMENTE em JSON: {"procedencia":[{"secao":"","palavra_ini":0,"palavra_fim":0}]}')
        try:
            r = pedir(MODELO, prompt)
        except Exception as e:
            print('%s  FALHOU: %s: %s' % (uid[:10], type(e).__name__, e)); continue
        devolvidas = {(p.get('secao') or ''): p for p in (r.get('procedencia') or [])}
        print('=== %s ===' % uid[:10])
        for p in cits:
            sec = p.get('secao') or ''
            cit = p.get('citacao')
            v = verdade(fita, cit)
            d = devolvidas.get(sec) or {}
            a, z = d.get('palavra_ini'), d.get('palavra_fim')
            tot += 1
            if v is None:
                fora += 1
                print('   %-22s (sem verdade confiavel — fora da nota)' % sec[:22]); continue
            if not isinstance(a, int) or not isinstance(z, int) or a < 1 or z < a or z > len(fita):
                ruim += 1
                print('   %-22s NUMEROS INVALIDOS: %r-%r' % (sec[:22], a, z)); continue
            # acerto: a faixa apontada encosta na verdade (sobreposicao de palavras)
            bate = not (z - 1 < v[0] or a - 1 > v[1])
            if bate:
                ok_ += 1
            else:
                ruim += 1
            print('   %-22s IA=%d-%d  verdade=%d-%d  %s'
                  % (sec[:22], a, z, v[0] + 1, v[1] + 1, 'OK' if bate else '>>> ERROU'))
        print('')
    print('---------------------------------------------')
    print('faixas conferidas: %d   acertos: %d   erros: %d   fora da nota: %d' % (tot, ok_, ruim, fora))


main()
