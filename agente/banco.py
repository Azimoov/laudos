# -*- coding: utf-8 -*-
"""Banco estruturado de laudos (SQLite) — camada de persistencia do agente.

Vive JUNTO do agente-laudos.py (copie este arquivo para a pasta dele). O agente
e a UNICA porta de escrita; o app nunca toca o .db. Integracao minima: no
despacho de rotas do servidor que ja existe na porta 8977, chame

    import banco
    resposta = banco.responder(metodo, caminho, corpo_dict)   # ou None

Se `responder` devolver None, a rota nao e do banco e o agente segue o fluxo
normal. Caso contrario devolve (status_http, dict_para_json).

O banco fica em  <pasta do agente>\\dados\\laudos.db  (fora do git, fora da nuvem).
Backup diario local em dados\\backup\\; copia CIFRADA para o iCloud Drive quando
7-Zip e senha existirem (melhor-esforco: falta de qualquer peca so avisa e pula).
"""
import collections
import difflib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time

# pasta dados\ ao lado deste arquivo (no notebook: ...\LaudosLocal\dados\)
BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dados')
CAMINHO_DB = os.path.join(BASE, 'laudos.db')
PASTA_BACKUP = os.path.join(BASE, 'backup')
ARQ_SENHA = os.path.join(BASE, 'backup-senha.txt')
SETE_ZIP = r'C:\Program Files\7-Zip\7z.exe'
MANTER_BACKUPS = 30

DDL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS pacientes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_completo   TEXT NOT NULL,
    documento       TEXT,
    nascimento      TEXT,
    sexo            TEXT,
    codigo_aparelho TEXT,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes(nome_completo);
CREATE INDEX IF NOT EXISTS idx_pacientes_doc  ON pacientes(documento);
CREATE INDEX IF NOT EXISTS idx_pacientes_cod  ON pacientes(codigo_aparelho);

CREATE TABLE IF NOT EXISTS exames (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id        INTEGER NOT NULL REFERENCES pacientes(id),
    data_exame         TEXT NOT NULL,
    tipo_exame         TEXT NOT NULL,
    indicacao_clinica  TEXT,
    study_uid          TEXT,
    conclusao_codigo   TEXT,
    laudo_gerado       TEXT,
    laudo_final        TEXT,
    json_gerado        TEXT,
    modelo_ia          TEXT,
    custo_estimado_usd REAL,
    -- O DITADO QUE VIROU ESTE LAUDO (10/08/2026). E o texto que a IA leu para
    -- escrever, exatamente como ela recebeu. Sem ele o banco guarda respostas
    -- sem as perguntas, e nao serve para treinar nada.
    -- NAO e a gravacao do dia inteiro: o agente grava a sala toda (recepcao,
    -- conversa com o paciente) e isso NAO entra aqui. So o trecho recortado
    -- para este exame, que foi o que gerou o laudo. Decisao do Dr. Daniel em
    -- 10/08 depois de ver que a fita apanha a sala inteira.
    transcricao        TEXT,
    criado_em          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    finalizado_em      TEXT
);
CREATE INDEX IF NOT EXISTS idx_exames_paciente ON exames(paciente_id, data_exame);
CREATE INDEX IF NOT EXISTS idx_exames_tipo     ON exames(tipo_exame);

CREATE TABLE IF NOT EXISTS achados (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exame_id        INTEGER NOT NULL REFERENCES exames(id) ON DELETE CASCADE,
    orgao           TEXT NOT NULL,
    localizacao     TEXT,
    tipo            TEXT NOT NULL,
    medida_1_mm     REAL,
    medida_2_mm     REAL,
    medida_3_mm     REAL,
    caracteristicas TEXT,
    classificacao   TEXT,
    descricao       TEXT
);
CREATE INDEX IF NOT EXISTS idx_achados_exame ON achados(exame_id);

-- Historico completo do laudo. NADA aqui e apagado ou sobrescrito: cada versao
-- assinada vira uma linha nova. Pedido do Dr. Daniel em 10/08/2026 ("as
-- informacoes das mudancas dos laudos sao para serem mantidas indefinidamente").
-- Antes existia so exames.laudo_final, um campo unico: corrigir o laudo pela
-- segunda vez apagava a correcao anterior sem deixar rastro.
-- exames.laudo_final continua existindo e aponta sempre para a versao mais
-- recente — quem so quer o laudo valendo nao precisa saber que isto existe.
CREATE TABLE IF NOT EXISTS laudo_versoes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    exame_id INTEGER NOT NULL REFERENCES exames(id) ON DELETE CASCADE,
    versao   INTEGER NOT NULL,        -- 1, 2, 3... na ordem em que foram assinadas
    texto    TEXT NOT NULL,
    origem   TEXT NOT NULL,           -- 'ia' (versao 1) | 'medico' (as correcoes)
    motivo   TEXT,                    -- opcional: por que mudou (vale ouro p/ treino)
    quando   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_versoes_exame ON laudo_versoes(exame_id, versao);
"""


def _log(msg):
    print('[banco] ' + msg, flush=True)


_NUMERO = re.compile(r'\d+(?:[.,]\d+)?')
_LIMITE_NUMEROS = 4          # o resumo e uma linha, nao um relatorio


def _resumo_da_mudanca(antes, depois):
    """O que mudou entre duas versoes do laudo, em uma linha. None se nada mudou.

    Deterministico e local: sem IA, sem rede, sem custo. Nasceu de uma escolha
    do Dr. Daniel em 10/08/2026 — ele nao quer uma caixa na tela para escrever o
    motivo da correcao (nem sempre vai preencher), entao o sistema anota
    sozinho o FATO da mudanca. Nao e a razao, e o que mudou; mas e automatico, e
    e justamente isso que serve para treinar depois.

    A mudanca de NUMEROS vem primeiro de proposito: num laudo de ultrassom, uma
    medida trocada e a correcao que mais importa. Depois da separacao da
    identificacao (mesma data), idade e data do exame nao estao mais no texto,
    entao nao poluem essa comparacao.
    """
    antes, depois = (antes or ''), (depois or '')
    if antes == depois:
        return None
    if antes.split() == depois.split():
        return 'so espacamento'          # mesma coisa escrita, formatacao diferente

    partes = []
    ca = collections.Counter(_NUMERO.findall(antes))
    cd = collections.Counter(_NUMERO.findall(depois))
    sairam = sorted((ca - cd).elements())
    entraram = sorted((cd - ca).elements())
    if sairam or entraram:
        partes.append('numeros: %s -> %s'
                      % (', '.join(sairam[:_LIMITE_NUMEROS]) or '(nenhum)',
                         ', '.join(entraram[:_LIMITE_NUMEROS]) or '(nenhum)'))

    mais = menos = 0
    for linha in difflib.unified_diff(antes.splitlines(), depois.splitlines(),
                                      lineterm='', n=0):
        if linha.startswith('+') and not linha.startswith('+++'):
            mais += 1
        elif linha.startswith('-') and not linha.startswith('---'):
            menos += 1
    # Linha que sai e outra que entra no lugar e UMA linha alterada, nao duas
    # mexidas. O resumo e para o medico ler de relance.
    alteradas = min(mais, menos)
    for n, palavra in ((alteradas, 'alterada'), (mais - alteradas, 'acrescentada'),
                       (menos - alteradas, 'removida')):
        if n:
            partes.append('%d linha%s %s%s' % (n, 's' if n > 1 else '',
                                               palavra, 's' if n > 1 else ''))

    if not partes:                       # mudou, mas nada acima descreveu o quê
        dif = len(depois) - len(antes)
        partes.append('%s%d caracteres' % ('+' if dif >= 0 else '', dif))
    return '; '.join(partes)


def _gravar_versao(con, exame_id, texto, origem, motivo=None):
    """Empilha mais uma versao do laudo. Nunca sobrescreve, nunca apaga.

    Texto igual ao da ultima versao NAO cria linha nova: a fila de reenvio do
    app pode mandar o mesmo laudo duas vezes (foi feita assim de proposito, para
    nao perder laudo quando o agente esta fora do ar), e versao repetida sujaria
    o historico sem acrescentar informacao.

    Devolve o numero da versao gravada (ou da existente, se era repetida).
    """
    texto = texto or ''
    if not texto.strip():
        return None
    ult = con.execute(
        'SELECT versao, texto FROM laudo_versoes WHERE exame_id=?'
        ' ORDER BY versao DESC LIMIT 1', (exame_id,)).fetchone()
    if ult is not None and (ult['texto'] or '') == texto:
        return ult['versao']
    prox = (ult['versao'] + 1) if ult is not None else 1
    # Sem motivo escrito, o sistema anota sozinho O QUE mudou em relacao a
    # versao anterior. Motivo informado sempre ganha: o que a pessoa escreveu
    # vale mais que o que a maquina deduziu.
    motivo = (motivo or '').strip() or None
    if motivo is None and ult is not None:
        motivo = _resumo_da_mudanca(ult['texto'], texto)
    con.execute(
        'INSERT INTO laudo_versoes (exame_id, versao, texto, origem, motivo)'
        ' VALUES (?,?,?,?,?)', (exame_id, prox, texto, origem, motivo))
    return prox


def conectar(caminho=None):
    """Abre (criando se preciso) o banco e garante o esquema."""
    caminho = caminho or CAMINHO_DB
    pasta = os.path.dirname(caminho)
    if pasta and not os.path.isdir(pasta):
        os.makedirs(pasta)
    con = sqlite3.connect(caminho)
    con.row_factory = sqlite3.Row
    con.executescript(DDL)
    _acrescentar_colunas(con)
    return con


# Colunas que nasceram depois do banco. O "CREATE TABLE IF NOT EXISTS" acima NAO
# acrescenta coluna em tabela que ja existe — ele so ve que a tabela esta la e
# passa direto. Sem isto, um banco antigo continuaria sem os campos novos e as
# gravacoes falhariam com "no such column".
COLUNAS_NOVAS = {
    'exames': [('transcricao', 'TEXT')],       # 10/08/2026
}


def _acrescentar_colunas(con):
    """Poe as colunas que faltam. Roda a cada conexao; nao faz nada se ja estao la."""
    for tabela, colunas in COLUNAS_NOVAS.items():
        try:
            existentes = {r['name'] for r in con.execute('PRAGMA table_info(%s)' % tabela)}
        except Exception:  # noqa: BLE001
            continue
        for nome, tipo in colunas:
            if nome in existentes:
                continue
            try:
                con.execute('ALTER TABLE %s ADD COLUMN %s %s' % (tabela, nome, tipo))
                con.commit()
                _log('coluna %s.%s acrescentada' % (tabela, nome))
            except Exception as ex:  # noqa: BLE001
                _log('nao consegui acrescentar %s.%s: %s' % (tabela, nome, ex))


def _norm_nome(s):
    return re.sub(r'\s+', ' ', str(s or '').strip()).lower()


def _achar_paciente(con, p):
    """Ordem de identidade: documento > codigo do aparelho > nome exato + nascimento.
    NUNCA por similaridade de nome — homonimos existem (regra do projeto)."""
    doc = str(p.get('documento') or '').strip()
    cod = str(p.get('codigo_aparelho') or '').strip()
    nome = _norm_nome(p.get('nome_completo'))
    nasc = str(p.get('nascimento') or '').strip()
    if doc:
        r = con.execute('SELECT * FROM pacientes WHERE documento=?', (doc,)).fetchone()
        if r:
            return r
    if cod:
        r = con.execute('SELECT * FROM pacientes WHERE codigo_aparelho=?', (cod,)).fetchone()
        if r:
            return r
    if nome:
        for r in con.execute(
                'SELECT * FROM pacientes WHERE lower(nome_completo)=?', (nome,)).fetchall():
            r_nasc = str(r['nascimento'] or '').strip()
            if r_nasc != nasc:          # iguais, ou ambos vazios
                continue
            # nome igual NAO basta se um identificador forte dos dois lados discordar:
            # homonimo com codigo/documento diferente e OUTRA pessoa
            r_cod = str(r['codigo_aparelho'] or '').strip()
            if cod and r_cod and cod != r_cod:
                continue
            r_doc = str(r['documento'] or '').strip()
            if doc and r_doc and doc != r_doc:
                continue
            return r
    return None


def gravar_exame(payload, caminho=None):
    """POST /exames — grava a versao GERADA. Devolve {exame_id, paciente_id}."""
    if not isinstance(payload, dict):
        raise ValueError('corpo invalido')
    p = payload.get('paciente') or {}
    e = payload.get('exame') or {}
    if not str(p.get('nome_completo') or '').strip():
        raise ValueError('paciente.nome_completo obrigatorio')
    if not str(e.get('data_exame') or '').strip() or not str(e.get('tipo_exame') or '').strip():
        raise ValueError('exame.data_exame e exame.tipo_exame obrigatorios')

    con = conectar(caminho)
    try:
        row = _achar_paciente(con, p)
        if row:
            pid = row['id']
            # completa o que faltava no cadastro; nunca sobrescreve o que ja existe
            for campo in ('documento', 'nascimento', 'sexo', 'codigo_aparelho'):
                novo = str(p.get(campo) or '').strip()
                if novo and not str(row[campo] or '').strip():
                    con.execute('UPDATE pacientes SET %s=? WHERE id=?' % campo, (novo, pid))
        else:
            cur = con.execute(
                'INSERT INTO pacientes (nome_completo, documento, nascimento, sexo, codigo_aparelho)'
                ' VALUES (?,?,?,?,?)',
                (str(p.get('nome_completo')).strip(), p.get('documento') or None,
                 p.get('nascimento') or None, p.get('sexo') or None,
                 str(p.get('codigo_aparelho') or '').strip() or None))
            pid = cur.lastrowid

        cur = con.execute(
            'INSERT INTO exames (paciente_id, data_exame, tipo_exame, indicacao_clinica,'
            ' study_uid, conclusao_codigo, laudo_gerado, json_gerado, modelo_ia,'
            ' custo_estimado_usd, transcricao) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            (pid, e.get('data_exame'), e.get('tipo_exame'), e.get('indicacao_clinica'),
             e.get('study_uid'), e.get('conclusao_codigo'), e.get('laudo_gerado'),
             e.get('json_gerado'), e.get('modelo_ia'), e.get('custo_estimado_usd'),
             e.get('transcricao')))
        eid = cur.lastrowid

        # versao 1 do historico = o que a IA escreveu. As correcoes do medico
        # entram depois como 2, 3... pela rota /exames/<id>/final.
        _gravar_versao(con, eid, e.get('laudo_gerado'), 'ia')

        # achados invalidos nao derrubam o exame: perder estrutura e aceitavel,
        # perder o laudo nao (regra das instrucoes)
        for a in (payload.get('achados') or []):
            try:
                if not isinstance(a, dict):
                    continue
                orgao = str(a.get('orgao') or '').strip()
                tipo = str(a.get('tipo') or '').strip()
                if not orgao or not tipo:
                    continue
                con.execute(
                    'INSERT INTO achados (exame_id, orgao, localizacao, tipo, medida_1_mm,'
                    ' medida_2_mm, medida_3_mm, caracteristicas, classificacao, descricao)'
                    ' VALUES (?,?,?,?,?,?,?,?,?,?)',
                    (eid, orgao, a.get('localizacao'), tipo, a.get('medida_1_mm'),
                     a.get('medida_2_mm'), a.get('medida_3_mm'), a.get('caracteristicas'),
                     a.get('classificacao'), a.get('descricao')))
            except Exception as ex:  # noqa: BLE001
                _log('achado ignorado: %s' % ex)
        con.commit()
        return {'exame_id': eid, 'paciente_id': pid}
    finally:
        con.close()


def gravar_final(exame_id, laudo_final, caminho=None, motivo=None):
    """POST /exames/<id>/final — o laudo assinado pelo medico.

    Desde 10/08/2026 NADA e perdido aqui: cada assinatura vira uma linha em
    laudo_versoes. O campo exames.laudo_final continua existindo e passa a ser
    um atalho para a versao mais recente (antes ele era o unico lugar, e a
    correcao seguinte apagava a anterior).
    """
    con = conectar(caminho)
    try:
        row = con.execute('SELECT laudo_final FROM exames WHERE id=?', (exame_id,)).fetchone()
        if row is None:
            raise LookupError('exame %s nao existe' % exame_id)
        versao = _gravar_versao(con, exame_id, laudo_final, 'medico', motivo)
        con.execute(
            "UPDATE exames SET laudo_final=?, finalizado_em=datetime('now','localtime')"
            ' WHERE id=?', (laudo_final, exame_id))
        con.commit()
        if row['laudo_final']:
            _log('exame %s: nova versao assinada (v%s); a anterior continua guardada'
                 % (exame_id, versao))
        return {'ok': True, 'exame_id': exame_id, 'versao': versao}
    finally:
        con.close()


def buscar_paciente(filtros, caminho=None):
    """GET /pacientes/buscar — exames anteriores com achados estruturados."""
    con = conectar(caminho)
    try:
        p = _achar_paciente(con, {
            'documento': filtros.get('documento'),
            'codigo_aparelho': filtros.get('codigo'),
            'nome_completo': filtros.get('nome'),
            'nascimento': filtros.get('nascimento')})
        if not p:
            return {'ok': True, 'paciente': None, 'exames': []}
        exames = []
        for e in con.execute(
                'SELECT * FROM exames WHERE paciente_id=? ORDER BY data_exame DESC, id DESC',
                (p['id'],)).fetchall():
            achados = [dict(a) for a in con.execute(
                'SELECT * FROM achados WHERE exame_id=?', (e['id'],)).fetchall()]
            d = dict(e)
            d['achados'] = achados
            exames.append(d)
        return {'ok': True,
                'paciente': {'id': p['id'], 'nome_completo': p['nome_completo'],
                             'codigo_aparelho': p['codigo_aparelho']},
                'exames': exames}
    finally:
        con.close()


def saude(caminho=None):
    """GET /dados/saude — diagnostico rapido."""
    caminho = caminho or CAMINHO_DB
    try:
        con = conectar(caminho)
        try:
            total = con.execute('SELECT COUNT(*) c FROM exames').fetchone()['c']
        finally:
            con.close()
        ultimo = ''
        if os.path.isdir(PASTA_BACKUP):
            baks = sorted(x for x in os.listdir(PASTA_BACKUP) if x.endswith('.db'))
            if baks:
                ultimo = baks[-1]
        return {'ok': True, 'total_exames': total, 'caminho_db': caminho,
                'backup_mais_recente': ultimo}
    except Exception as ex:  # noqa: BLE001
        return {'ok': False, 'erro': str(ex)}


# ---------------------------------------------------------------- backups ----

def backup_diario(caminho=None, pasta_backup=None, agora=None):
    """Copia laudos.db para backup\\laudos-AAAAMMDD.db (API de backup do sqlite,
    nunca copia de arquivo aberto). Mantem os ultimos MANTER_BACKUPS."""
    caminho = caminho or CAMINHO_DB
    pasta = pasta_backup or PASTA_BACKUP
    if not os.path.isfile(caminho):
        return None                      # sem banco ainda: nada a fazer
    if not os.path.isdir(pasta):
        os.makedirs(pasta)
    dia = time.strftime('%Y%m%d', time.localtime(agora or time.time()))
    destino = os.path.join(pasta, 'laudos-%s.db' % dia)
    if os.path.isfile(destino):
        return destino                   # ja tem o backup de hoje
    origem = sqlite3.connect(caminho)
    alvo = sqlite3.connect(destino)
    try:
        origem.backup(alvo)
    finally:
        alvo.close()
        origem.close()
    baks = sorted(x for x in os.listdir(pasta)
                  if re.match(r'^laudos-\d{8}\.db$', x))
    for velho in baks[:-MANTER_BACKUPS]:
        try:
            os.remove(os.path.join(pasta, velho))
        except OSError:
            pass
    _log('backup diario: ' + destino)
    return destino


def _achar_icloud():
    home = os.environ.get('USERPROFILE') or os.path.expanduser('~')
    for nome in ('iCloudDrive', 'iCloud Drive'):
        c = os.path.join(home, nome)
        if os.path.isdir(c):
            return c
    return None


def backup_nuvem(arquivo_db, sete_zip=None, arq_senha=None, destino_base=None):
    """Cifra o backup do dia (7z AES-256, -mhe=on) e copia para o iCloud Drive.
    Melhor-esforco TOTAL: qualquer peca faltando -> avisa e pula, sem erro.
    NUNCA sobe o laudos.db vivo — so o arquivo de backup estatico."""
    if not arquivo_db or not os.path.isfile(arquivo_db):
        return None
    zexe = sete_zip or SETE_ZIP
    if not os.path.isfile(zexe):
        _log('AVISO: 7-Zip nao encontrado (%s) — copia cifrada pulada. '
             'Instale o 7-Zip para ativar o backup na nuvem.' % zexe)
        return None
    senha_arq = arq_senha or ARQ_SENHA
    if not os.path.isfile(senha_arq):
        _log('AVISO: crie %s com a senha do backup (uma linha) e guarde essa senha '
             'tambem fora do computador — sem ela os backups sao irrecuperaveis.' % senha_arq)
        return None
    with open(senha_arq, 'r') as f:
        senha = f.readline().strip()
    if not senha:
        _log('AVISO: arquivo de senha vazio — copia cifrada pulada.')
        return None
    destino_base = destino_base or _achar_icloud()
    if not destino_base:
        _log('AVISO: iCloud Drive nao encontrado — copia cifrada pulada.')
        return None
    destino = os.path.join(destino_base, 'Backups Laudos')
    if not os.path.isdir(destino):
        os.makedirs(destino)
    z7 = os.path.join(destino, os.path.basename(arquivo_db).replace('.db', '.7z'))
    if os.path.isfile(z7):
        return z7                        # o de hoje ja subiu
    try:
        r = subprocess.run(
            [zexe, 'a', '-t7z', '-mhe=on', '-p' + senha, z7, arquivo_db],
            capture_output=True, timeout=300)
        if r.returncode != 0:
            _log('AVISO: 7z falhou (%s) — copia cifrada pulada.' %
                 r.stderr.decode('utf-8', 'replace')[:200])
            return None
    except Exception as ex:  # noqa: BLE001
        _log('AVISO: falha ao cifrar (%s) — copia cifrada pulada.' % ex)
        return None
    zips = sorted(x for x in os.listdir(destino)
                  if re.match(r'^laudos-\d{8}\.7z$', x))
    for velho in zips[:-MANTER_BACKUPS]:
        try:
            os.remove(os.path.join(destino, velho))
        except OSError:
            pass
    _log('backup cifrado na nuvem: ' + z7)
    return z7


def iniciar_rotinas():
    """Chamar UMA vez na subida do agente. Nunca lanca."""
    try:
        bak = backup_diario()
        if bak:
            backup_nuvem(bak)
    except Exception as ex:  # noqa: BLE001
        _log('AVISO: rotina de backup falhou (%s) — o agente segue normal.' % ex)


# ------------------------------------------------------------- despachante ----

def responder(metodo, caminho, corpo):
    """Ponto unico de integracao com o servidor do agente.
    Devolve (status, dict) para rotas do banco, ou None para as demais."""
    try:
        if metodo == 'POST' and caminho == '/exames':
            return (200, gravar_exame(corpo))
        m = re.match(r'^/exames/(\d+)/final$', caminho or '')
        if metodo == 'POST' and m:
            texto = (corpo or {}).get('laudo_final')
            if not texto:
                return (400, {'erro': 'laudo_final obrigatorio'})
            # 'motivo' e opcional: o app ainda nao tem campo para ele, mas a
            # rota ja aceita, para nao precisar mexer no agente depois.
            return (200, gravar_final(int(m.group(1)), texto,
                                      motivo=(corpo or {}).get('motivo')))
        if metodo == 'GET' and (caminho or '').startswith('/pacientes/buscar'):
            try:
                from urllib.parse import parse_qs, urlparse
                q = parse_qs(urlparse(caminho).query)
                filtros = {k: (v[0] if v else '') for k, v in q.items()}
            except Exception:  # noqa: BLE001
                filtros = {}
            return (200, buscar_paciente(filtros))
        if metodo == 'GET' and caminho == '/dados/saude':
            return (200, saude())
        return None
    except LookupError as ex:
        return (404, {'erro': str(ex)})
    except ValueError as ex:
        return (400, {'erro': str(ex)})
    except Exception as ex:  # noqa: BLE001
        _log('erro interno: %s' % ex)
        return (500, {'erro': 'erro interno: %s' % ex})
