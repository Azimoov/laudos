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

print('=== saude ===')
r = banco.saude(DB)
ok(r['ok'] and r['total_exames'] >= 6, 'saude responde com o total de exames')

shutil.rmtree(TMP, ignore_errors=True)
print()
print(('%d FALHA(S)' % falhas) if falhas else 'TODOS OS TESTES PASSARAM')
sys.exit(1 if falhas else 0)
