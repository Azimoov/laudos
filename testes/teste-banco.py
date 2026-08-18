# -*- coding: utf-8 -*-
# Banco estruturado de laudos (agente/banco.py): criacao, gravacao, identidade
# do paciente, versao final, busca e backup. Roda com qualquer Python 3 (sqlite3
# e biblioteca padrao) — nao precisa do agente no ar.
import json
import os
import shutil
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'agente'))
import banco  # noqa: E402

falhas = 0


def ok(cond, msg):
    global falhas
    print(('  ok   ' if cond else '  FALHA ') + msg)
    if not cond:
        falhas += 1


TMP = tempfile.mkdtemp(prefix='teste-banco-')
DB = os.path.join(TMP, 'laudos.db')


def payload(nome='Maria Silva Souza', cod='123', tipo='mama', data='2026-08-05',
            achados=None, documento=None):
    return {
        'paciente': {'nome_completo': nome, 'documento': documento,
                     'nascimento': None, 'sexo': None, 'codigo_aparelho': cod},
        'exame': {'data_exame': data, 'tipo_exame': tipo,
                  'indicacao_clinica': 'nodulo palpavel', 'study_uid': 'st-1',
                  'conclusao_codigo': 'provavelmente-benigno',
                  'laudo_gerado': 'texto gerado...', 'json_gerado': '{"a":1}',
                  'modelo_ia': 'gpt-5.5', 'custo_estimado_usd': 0.14},
        'achados': achados if achados is not None else [
            {'orgao': 'mama-direita', 'localizacao': 'QSE', 'tipo': 'nodulo',
             'medida_1_mm': 8, 'medida_2_mm': 6, 'medida_3_mm': None,
             'caracteristicas': '{"ecogenicidade":"hipoecoico"}',
             'classificacao': 'BI-RADS 3', 'descricao': 'Nodulo hipoecoico...'}]}


print('=== criacao do banco do zero ===')
con = banco.conectar(DB)
tabelas = {r[0] for r in con.execute(
    "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
con.close()
ok({'pacientes', 'exames', 'achados'} <= tabelas, 'as 3 tabelas existem')
ok(os.path.isfile(DB), 'o arquivo laudos.db foi criado')

print('=== gravar exame cria paciente e achados ===')
r1 = banco.gravar_exame(payload(), DB)
ok(r1['exame_id'] == 1 and r1['paciente_id'] == 1, 'primeiro exame: ids 1/1')
con = banco.conectar(DB)
a = con.execute('SELECT * FROM achados WHERE exame_id=1').fetchall()
ok(len(a) == 1 and a[0]['orgao'] == 'mama-direita' and a[0]['medida_1_mm'] == 8,
   'achado gravado campo a campo')
con.close()

print('=== identidade do paciente ===')
r2 = banco.gravar_exame(payload(cod='123'), DB)
ok(r2['paciente_id'] == 1, 'mesmo codigo do aparelho -> mesmo paciente')
r3 = banco.gravar_exame(payload(nome='Maria Silva Souza', cod='999'), DB)
ok(r3['paciente_id'] == 2, 'HOMONIMA com codigo diferente -> paciente NOVO (nunca mescla)')
r4 = banco.gravar_exame(payload(nome='Joao Pereira', cod=None), DB)
r5 = banco.gravar_exame(payload(nome='joao  pereira', cod=None), DB)
ok(r4['paciente_id'] == r5['paciente_id'],
   'sem codigo: nome exato (caixa/espacos normalizados) reusa o paciente')
r6 = banco.gravar_exame(payload(nome='Ana Costa', cod=None, documento='111.222.333-44'), DB)
r7 = banco.gravar_exame(payload(nome='Ana C. Alterada', cod=None, documento='111.222.333-44'), DB)
ok(r6['paciente_id'] == r7['paciente_id'], 'documento manda mais que o nome')

print('=== versao final ===')
r = banco.gravar_final(r1['exame_id'], 'texto final assinado', DB)
ok(r['ok'] is True, 'final gravado')
con = banco.conectar(DB)
e = con.execute('SELECT laudo_final, finalizado_em FROM exames WHERE id=1').fetchone()
ok(e['laudo_final'] == 'texto final assinado' and e['finalizado_em'], 'texto e carimbo de hora')
con.close()
r = banco.gravar_final(r1['exame_id'], 'segunda assinatura', DB)
ok(r['ok'] is True, 'repetir sobrescreve sem erro (idempotente)')
try:
    banco.gravar_final(9999, 'x', DB)
    ok(False, 'exame inexistente deveria dar erro')
except LookupError:
    ok(True, 'exame inexistente da erro claro, nao grava no vazio')

print('=== achado invalido nao derruba o exame ===')
r8 = banco.gravar_exame(payload(nome='Pedro Lima', cod='555', achados=[
    {'orgao': '', 'tipo': 'nodulo'}, 'lixo', {'orgao': 'figado', 'tipo': 'cisto'}]), DB)
con = banco.conectar(DB)
n = con.execute('SELECT COUNT(*) c FROM achados WHERE exame_id=?',
                (r8['exame_id'],)).fetchone()['c']
con.close()
ok(n == 1, 'so o achado valido entrou; o exame foi gravado mesmo assim')

print('=== buscar paciente ===')
r = banco.buscar_paciente({'codigo': '123'}, DB)
ok(r['ok'] and r['paciente']['id'] == 1 and len(r['exames']) == 2,
   'busca por codigo traz so os 2 exames DESTA paciente (o da homonima fica fora)')
r_hom = banco.buscar_paciente({'codigo': '999'}, DB)
ok(r_hom['ok'] and r_hom['paciente']['id'] == 2 and len(r_hom['exames']) == 1,
   'a homonima tem o exame dela, separado')
ok(len(r['exames'][0]['achados']) == 1, 'achados vem juntos, estruturados')
r = banco.buscar_paciente({'codigo': 'nao-existe'}, DB)
ok(r['ok'] and r['paciente'] is None and r['exames'] == [], 'paciente inexistente: vazio, sem erro')

print('=== despachante (integracao de 1 linha no agente) ===')
st, r = banco.responder('POST', '/exames', payload(nome='Rita Dias', cod='777'))
# despachante usa o DB padrao do modulo; aqui so validamos o contrato de erro
ok(banco.responder('GET', '/rota-que-nao-existe', {}) is None,
   'rota desconhecida devolve None (o agente segue o fluxo normal)')
st, r = banco.responder('POST', '/exames', {'paciente': {}, 'exame': {}})
ok(st == 400 and 'erro' in r, 'corpo invalido: 400 com mensagem, nao excecao')
st, r = banco.responder('POST', '/exames/1/final', {})
ok(st == 400 and 'erro' in r, 'final sem texto: 400')

print('=== backup diario ===')
pasta_bak = os.path.join(TMP, 'backup')
b1 = banco.backup_diario(DB, pasta_bak)
ok(b1 and os.path.isfile(b1), 'backup do dia criado')
con = sqlite3.connect(b1)
integ = con.execute('PRAGMA integrity_check').fetchone()[0]
n = con.execute('SELECT COUNT(*) FROM exames').fetchone()[0]
con.close()
ok(integ == 'ok', 'integridade do backup confere (PRAGMA integrity_check)')
ok(n >= 6, 'o backup tem os exames (%d)' % n)
b2 = banco.backup_diario(DB, pasta_bak)
ok(b2 == b1, 'segundo pedido no mesmo dia nao recopia')

print('=== copia cifrada: pecas faltando so avisam, nunca quebram ===')
ok(banco.backup_nuvem(b1, sete_zip=os.path.join(TMP, 'nao-existe-7z.exe')) is None,
   'sem 7-Zip: avisa e pula')
ok(banco.backup_nuvem(b1, sete_zip=sys.executable,
                      arq_senha=os.path.join(TMP, 'sem-senha.txt')) is None,
   'sem arquivo de senha: avisa e pula')
ok(banco.backup_nuvem(None) is None, 'sem arquivo de backup: nada a fazer')

print('=== historico de versoes do laudo (nada e sobrescrito) ===')
p = payload(nome='Versoes Da Silva', cod='v-1')
p['exame']['laudo_gerado'] = 'VERSAO DA IA'
rv = banco.gravar_exame(p, caminho=DB)
eid = rv['exame_id']
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
vs = lambda: con.execute('SELECT versao, origem, motivo, texto FROM laudo_versoes'
                         ' WHERE exame_id=? ORDER BY versao', (eid,)).fetchall()
v = vs()
ok(len(v) == 1 and v[0]['origem'] == 'ia' and v[0]['texto'] == 'VERSAO DA IA',
   'gravar o exame ja registra a versao 1, a da IA')
banco.gravar_final(eid, 'PRIMEIRA do medico', caminho=DB)
banco.gravar_final(eid, 'SEGUNDA do medico', caminho=DB, motivo='medida errada')
v = vs()
ok(len(v) == 3, 'tres versoes guardadas (a IA e as duas assinaturas)')
ok(v[1]['texto'] == 'PRIMEIRA do medico' and v[2]['texto'] == 'SEGUNDA do medico',
   'a correcao anterior NAO foi apagada pela seguinte')
ok(v[2]['motivo'] == 'medida errada', 'motivo informado guardado como foi escrito')
ok(v[1]['motivo'] and 'medida errada' not in v[1]['motivo'],
   'a assinatura sem motivo escrito ganha o resumo automatico (ver bloco do motivo)')
banco.gravar_final(eid, 'SEGUNDA do medico', caminho=DB)
ok(len(vs()) == 3, 'reenvio do MESMO texto nao cria versao repetida (a fila do app repete)')
ok(con.execute('SELECT laudo_final FROM exames WHERE id=?', (eid,)).fetchone()[0]
   == 'SEGUNDA do medico', 'laudo_final aponta para a versao mais recente')
con.close()

print('=== o motivo se escreve sozinho (sem caixa na tela) ===')
# Dr. Daniel, 10/08: nao quer campo para digitar o motivo (nem sempre ia
# preencher), entao o sistema anota o FATO da mudanca. Deterministico e local:
# sem IA, sem rede, sem custo.
res = banco._resumo_da_mudanca
LAUDO = 'Figado de dimensoes normais.\nRim direito mede 98 mm.\nBaco sem alteracoes.'
ok(res(LAUDO, LAUDO) is None, 'texto igual: nenhum motivo (nem versao nova)')
ok(res('Figado  normal.', 'Figado normal.') == 'so espacamento',
   'mesma frase com espacos diferentes: dito como formatacao, nao como correcao')
r_med = res(LAUDO, LAUDO.replace('98', '104'))
ok('98 -> 104' in r_med, 'medida trocada aparece no motivo (o que mais importa no laudo)')
ok('1 linha alterada' in r_med, 'linha trocada por outra conta como UMA alterada, nao duas')
ok('acrescentada' in res(LAUDO, LAUDO + '\nCisto de 12 mm.'), 'achado novo: linha acrescentada')
ok('removida' in res(LAUDO, 'Figado de dimensoes normais.\nRim direito mede 98 mm.'),
   'linha apagada: linha removida')
ok('11,5 -> 13,2' in res('Cisto de 11,5 mm.', 'Cisto de 13,2 mm.'),
   'medida com virgula tambem e reconhecida')
ok('numeros' not in res(LAUDO, LAUDO.replace('Baco sem alteracoes.', 'Baco preservado.')),
   'reescrita sem mudar numero nao inventa mudanca de medida')

print('=== o motivo automatico chega ao historico ===')
p = payload(nome='Motivo Da Silva', cod='mo-1')
p['exame']['laudo_gerado'] = 'Rim direito mede 98 mm.'
rm = banco.gravar_exame(p, caminho=DB)
em = rm['exame_id']
banco.gravar_final(em, 'Rim direito mede 104 mm.', caminho=DB)
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
mv = con.execute('SELECT versao, motivo FROM laudo_versoes WHERE exame_id=? ORDER BY versao',
                 (em,)).fetchall()
ok(mv[0]['motivo'] is None, 'a versao 1 (da IA) nao tem motivo: nao havia com o que comparar')
ok(mv[1]['motivo'] and '98 -> 104' in mv[1]['motivo'],
   'a correcao do medico ganhou o motivo automatico')
banco.gravar_final(em, 'Rim direito mede 105 mm.', caminho=DB, motivo='paciente trouxe exame antigo')
mv = con.execute('SELECT motivo FROM laudo_versoes WHERE exame_id=? ORDER BY versao',
                 (em,)).fetchall()
ok(mv[2]['motivo'] == 'paciente trouxe exame antigo',
   'motivo escrito por uma pessoa GANHA do automatico')
ok(mv[1]['motivo'] and '98 -> 104' in mv[1]['motivo'],
   'e nao sobrescreve o motivo da versao anterior')
con.close()

print('=== o ditado que virou o laudo fica guardado ===')
p = payload(nome='Ditado Da Silva', cod='d-1')
p['exame']['transcricao'] = 'figado de dimensoes normais, sem lesoes focais'
rd = banco.gravar_exame(p, caminho=DB)
con = sqlite3.connect(DB); con.row_factory = sqlite3.Row
row = con.execute('SELECT transcricao FROM exames WHERE id=?', (rd['exame_id'],)).fetchone()
ok(row['transcricao'] == 'figado de dimensoes normais, sem lesoes focais',
   'a transcricao enviada pelo app e gravada junto com o laudo')
p2 = payload(nome='Sem Ditado', cod='d-2')
r2 = banco.gravar_exame(p2, caminho=DB)
ok(con.execute('SELECT transcricao FROM exames WHERE id=?',
               (r2['exame_id'],)).fetchone()[0] is None,
   'exame sem ditado grava normalmente, com o campo vazio')
con.close()

print('=== banco ANTIGO ganha as colunas novas sozinho ===')
# CREATE TABLE IF NOT EXISTS nao acrescenta coluna em tabela que ja existe: se a
# migracao falhar, um banco de antes de 10/08 quebra com "no such column".
velho = os.path.join(TMP, 'antigo.db')
c = sqlite3.connect(velho)
c.executescript("""CREATE TABLE pacientes (id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo TEXT NOT NULL, documento TEXT, nascimento TEXT, sexo TEXT,
  codigo_aparelho TEXT, criado_em TEXT);
CREATE TABLE exames (id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_id INTEGER NOT NULL,
  data_exame TEXT NOT NULL, tipo_exame TEXT NOT NULL, indicacao_clinica TEXT,
  study_uid TEXT, conclusao_codigo TEXT, laudo_gerado TEXT, laudo_final TEXT,
  json_gerado TEXT, modelo_ia TEXT, custo_estimado_usd REAL, criado_em TEXT,
  finalizado_em TEXT);
CREATE TABLE achados (id INTEGER PRIMARY KEY AUTOINCREMENT, exame_id INTEGER NOT NULL,
  orgao TEXT NOT NULL, localizacao TEXT, tipo TEXT NOT NULL, medida_1_mm REAL,
  medida_2_mm REAL, medida_3_mm REAL, caracteristicas TEXT, classificacao TEXT,
  descricao TEXT);""")
c.commit(); c.close()
con = banco.conectar(velho)
cols = [r['name'] for r in con.execute('PRAGMA table_info(exames)')]
ok('transcricao' in cols, 'a coluna transcricao foi acrescentada ao banco antigo')
ok(cols.count('transcricao') == 1, 'nao duplicou a coluna')
tabs = {r['name'] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
ok('laudo_versoes' in tabs, 'a tabela de versoes tambem nasce no banco antigo')
con.close()
con = banco.conectar(velho)      # de novo: tem de ser inofensivo
ok([r['name'] for r in con.execute('PRAGMA table_info(exames)')].count('transcricao') == 1,
   'abrir o banco outra vez nao acrescenta de novo')
con.close()
r3 = banco.gravar_exame(payload(nome='Depois Da Migracao', cod='m-1'), caminho=velho)
ok(r3['exame_id'] >= 1, 'grava normalmente depois de migrado')

print('=== quais exames ja foram liberados (para a recuperacao nao esquecer) ===')
# 12/08: ao recuperar depois de fechar a janela sem querer, exames JA assinados
# voltavam como "nao liberados" e o medico perdia a conta do que faltava.
p = payload(nome='Liberado Da Silva', cod='lib-1')
p['exame']['study_uid'] = 'uid-assinado'
r_lib = banco.gravar_exame(p, caminho=DB)
p2 = payload(nome='Pendente Da Silva', cod='lib-2')
p2['exame']['study_uid'] = 'uid-pendente'
banco.gravar_exame(p2, caminho=DB)
uids = banco.liberados(caminho=DB)['uids']
ok('uid-assinado' not in uids and 'uid-pendente' not in uids,
   'antes de assinar, nenhum dos dois aparece como liberado')
banco.gravar_final(r_lib['exame_id'], 'laudo assinado', caminho=DB)
uids = banco.liberados(caminho=DB)['uids']
ok('uid-assinado' in uids, 'depois de assinar, o exame aparece na lista')
ok('uid-pendente' not in uids, 'o que nao foi assinado NAO aparece')
p3 = payload(nome='Sem Uid', cod='lib-3')
p3['exame']['study_uid'] = None
r3 = banco.gravar_exame(p3, caminho=DB)
banco.gravar_final(r3['exame_id'], 'assinado sem uid', caminho=DB)
ok(None not in uids and '' not in banco.liberados(caminho=DB)['uids'],
   'exame sem study_uid nao entra na lista (nao haveria como casar)')

print('=== laudo estruturado (laudo_obj) e a leitura do Recuperar (17/08) ===')
# 17/08/2026: os laudos do dia foram refeitos porque a sessao morreu com a
# janela. O banco passa a guardar a FORMA estruturada (laudo_obj) e a rota
# /exames/laudo?uid= devolve — o Recuperar restaura em vez de re-gerar.
pl = payload(nome='Rita Recuperada', cod='777')
pl['exame']['study_uid'] = 'st-recup-1'
pl['exame']['laudo_obj'] = '{"corpo":"CORPO ESTRUTURADO","conclusao":"C1"}'
rr = banco.gravar_exame(pl, DB)
g = banco.laudo_guardado('st-recup-1', DB)
ok(g['achou'] and g['laudo_obj'] == pl['exame']['laudo_obj'],
   'laudo_obj volta IDENTICO pelo study_uid')
ok(g['finalizado'] is False and g['versoes'] == 1,
   'antes de assinar: 1 versao, nao finalizado')
banco.gravar_final(rr['exame_id'], 'TEXTO ASSINADO', DB,
                   laudo_obj='{"corpo":"CORRIGIDO PELO MEDICO"}')
g2 = banco.laudo_guardado('st-recup-1', DB)
ok(g2['laudo_obj'] == '{"corpo":"CORRIGIDO PELO MEDICO"}',
   'a assinatura ATUALIZA a forma estruturada (volta como o medico deixou)')
ok(g2['finalizado'] is True and g2['versoes'] == 2,
   'assinou: 2 versoes no historico e finalizado')
ok(banco.laudo_guardado('st-nao-existe', DB)['achou'] is False,
   'uid desconhecido: achou=False, sem erro')
try:
    banco.laudo_guardado('', DB)
    ok(False, 'uid vazio deveria recusar')
except ValueError:
    ok(True, 'uid vazio e recusado com erro claro')

print('=== o ditado nao se perde quando a pasta dos 7 dias e limpa (17/08) ===')
# A pasta ditados\ e rede de CURTO prazo; o banco e o arquivo definitivo. Em
# 17/08 oito exames reais tinham o ditado so na pasta e iam sumir calados.
pg = payload(nome='Guarda Ditado', cod='gd-1')
pg['exame']['study_uid'] = 'uid-guarda'
pg['exame'].pop('transcricao', None)
rg = banco.gravar_exame(pg, DB)
ok(banco.garantir_transcricao('uid-inexistente', 'texto', DB) == 'sem_exame',
   'ditado sem exame no banco: nao ha onde guardar (orfao)')
ok(banco.garantir_transcricao('uid-guarda', '   ', DB) == 'vazio',
   'ditado vazio nao vira gravacao')
ok(banco.garantir_transcricao('uid-guarda', 'O DITADO ORIGINAL', DB) == 'gravado',
   'exame sem ditado no banco: o ditado e gravado')
ok(banco.garantir_transcricao('uid-guarda', 'OUTRO TEXTO QUALQUER', DB) == 'ja_tinha',
   'exame que ja tem ditado: o segundo e recusado')
import sqlite3 as _s
_c = _s.connect(DB)
ok(_c.execute('SELECT transcricao FROM exames WHERE id=?',
              (rg['exame_id'],)).fetchone()[0] == 'O DITADO ORIGINAL',
   'e o ditado que ja estava NUNCA e sobrescrito')
_c.close()

print('=== saude ===')
r = banco.saude(DB)
ok(r['ok'] and r['total_exames'] >= 6, 'saude responde com o total de exames')

shutil.rmtree(TMP, ignore_errors=True)
print()
print(('%d FALHA(S)' % falhas) if falhas else 'TODOS OS TESTES PASSARAM')
sys.exit(1 if falhas else 0)
