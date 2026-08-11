// Lado do APP do banco estruturado: montagem do envio, fila de reenvio e as
// ligacoes no fluxo do laudo. (O lado do agente e testado em teste-banco.py.)
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function grab(n) {
  let i = HTML.indexOf('async function ' + n + '(');
  if (i < 0) i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('nao achei ' + n);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// ---- caixa de areia ----
const store = {};
const localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = v; } };
const CONSTS = (HTML.match(/const FILA_BANCO_CHAVE='[^']+', FILA_BANCO_MAX=\d+;/) || [])[0];
const cfg = { modelo: 'gpt-5.5' };
const textoBaseLaudo = () => 'TEXTO DO LAUDO';
const console2 = { warn: () => {}, log: () => {} };
const app = new Function('localStorage', 'cfg', 'textoBaseLaudo', 'console',
  CONSTS + '\n'
  + [ 'bancoFilaLer', 'bancoFilaGravar', 'bancoFilaUpsert', 'bancoDataISO', 'bancoNascISO',
      'bancoMontarPayload' ]
    .map(grab).join('\n')
  + '\n return {bancoFilaLer, bancoFilaGravar, bancoFilaUpsert, bancoDataISO, bancoNascISO,'
  + ' bancoMontarPayload, FILA_BANCO_MAX};')(
  localStorage, cfg, textoBaseLaudo, console2);
const { bancoFilaLer, bancoFilaGravar, bancoFilaUpsert, bancoDataISO, bancoNascISO,
        bancoMontarPayload, FILA_BANCO_MAX } = app;

console.log('=== data no formato do banco ===');
ok(bancoDataISO('05/08/2026') === '2026-08-05', 'dd/mm/aaaa vira ISO');
ok(bancoDataISO('2026-08-05') === '2026-08-05', 'ISO passa direto');
ok(/^\d{4}-\d{2}-\d{2}$/.test(bancoDataISO('')), 'sem data legivel: usa hoje (o laudo e gerado no ato)');
ok(/^\d{4}-\d{2}-\d{2}$/.test(bancoDataISO('lixo')), 'data ilegivel tambem cai em hoje, nao em lixo');

console.log('=== data de nascimento vinda do DICOM ===');
// Sem nascimento o banco nao consegue separar homonimos. Ate 10/08/2026 o app
// mandava null aqui e 74 pacientes ficaram sem ela. Nascimento ERRADO e pior
// que vazio, entao o que nao for confiavel vira null.
ok(bancoNascISO('19620113') === '1962-01-13', 'AAAAMMDD do DICOM vira ISO');
ok(bancoNascISO('1962-01-13') === '1962-01-13', 'ja com tracos: continua valendo');
ok(bancoNascISO('') === null, 'vazio: null, nao data de hoje');
ok(bancoNascISO(null) === null, 'ausente: null');
ok(bancoNascISO('1962011') === null, 'curta demais: null, nao adivinha');
ok(bancoNascISO('19621301') === null, 'mes 13: null');
ok(bancoNascISO('19620132') === null, 'dia 32: null');
ok(bancoNascISO('18000101') === null, 'ano absurdo: null');

console.log('=== montagem do envio ===');
const ex = { paciente: 'Maria Silva', codPac: '123', tipo: 'mama', dataExame: '05/08/2026',
             nascPac: '19871026', sexoPac: 'f',
             _estudoId: 'st-9', laudo: {} };
const resp = { corpo: 'x', dados_estruturados: { indicacao_clinica: 'nodulo palpavel',
  conclusao_codigo: 'Provavelmente-Benigno',
  achados: [
    { orgao: 'mama-direita', localizacao: 'QSE', tipo: 'nodulo', medida_1_mm: 8,
      medida_2_mm: '6', medida_3_mm: null, caracteristicas: { margens: 'circunscritas' },
      classificacao: 'BI-RADS 3', descricao: 'Nodulo...' },
    { orgao: '', tipo: 'cisto' },            // sem orgao: fora
    { orgao: 'figado', tipo: '' },           // sem tipo: fora
    'lixo', null                             // lixo: fora, sem quebrar
  ] } };
const p = bancoMontarPayload(ex, resp);
ok(p.paciente.nome_completo === 'Maria Silva' && p.paciente.codigo_aparelho === '123',
   'paciente leva nome e o codigo do aparelho (a ancora de identidade)');
ok(p.paciente.nascimento === '1987-10-26', 'paciente leva a data de nascimento em ISO');
ok(p.paciente.sexo === 'F', 'sexo normalizado para maiuscula');
ok(p.paciente.documento === null, 'documento segue null: o aparelho nao manda esse');
const pSemNasc = bancoMontarPayload({ paciente: 'Sem Data', codPac: '', tipo: 'abdome',
                                      dataExame: '05/08/2026', laudo: {} }, resp);
ok(pSemNasc.paciente.nascimento === null && pSemNasc.paciente.sexo === null,
   'exame sem tags de paciente nao inventa nascimento nem sexo');
ok(p.exame.data_exame === '2026-08-05' && p.exame.tipo_exame === 'mama', 'exame com data ISO e tipo');
ok(p.exame.study_uid === 'st-9', 'vinculo com as imagens do Orthanc');
ok(p.exame.conclusao_codigo === 'provavelmente-benigno', 'conclusao_codigo normalizado');
ok(p.exame.laudo_gerado === 'TEXTO DO LAUDO' && p.exame.json_gerado.includes('dados_estruturados'),
   'texto integral + JSON bruto guardados');
// O ditado que virou o laudo vai junto: e a PERGUNTA que gerou a resposta. Sem
// ele o banco guarda laudo sem origem — nao serve para auditar nem para treinar.
const pTrans = bancoMontarPayload(Object.assign({}, ex,
  { _transcricao: 'figado sem lesoes focais' }), resp);
ok(pTrans.exame.transcricao === 'figado sem lesoes focais',
   'a transcricao do ditado viaja junto com o laudo');
ok(p.exame.transcricao === null,
   'exame sem ditado manda null, nao string vazia');
ok(p.achados.length === 1, 'so o achado valido entra; lixo nao quebra nada');
ok(p.achados[0].medida_2_mm === 6, 'medida em texto vira numero');
ok(p.achados[0].caracteristicas === '{"margens":"circunscritas"}', 'caracteristicas viram JSON texto');
const p2 = bancoMontarPayload({ paciente: 'Ana', tipo: 'abdome-total', laudo: {} }, {});
ok(p2.achados.length === 0 && p2.exame.conclusao_codigo === 'outro',
   'IA sem dados_estruturados: exame vai mesmo assim, sem achados (perder estrutura e aceitavel; perder o laudo, nao)');
const p3 = bancoMontarPayload({ paciente: 'Ana', tipo: 'mama', laudo: {} },
                              { dados_estruturados: { conclusao_codigo: 'maligno-invencao' } });
ok(p3.exame.conclusao_codigo === 'outro', 'codigo fora da lista vira "outro", nao passa adiante');

console.log('=== fila de reenvio ===');
delete store.filaExamesPendentes;
ok(bancoFilaLer().length === 0, 'fila comeca vazia');
bancoFilaUpsert('L1', e => { e.payload = { a: 1 }; });
bancoFilaUpsert('L2', e => { e.payload = { a: 2 }; });
bancoFilaUpsert('L1', e => { e.final = 'texto final'; });
const fila = bancoFilaLer();
ok(fila.length === 2, 'mesmo laudo nao duplica na fila (upsert por chave)');
ok(fila.find(e => e.k === 'L1').final === 'texto final' && fila.find(e => e.k === 'L1').payload.a === 1,
   'o final se junta ao payload do mesmo laudo');
store.filaExamesPendentes = 'nao e json';
ok(bancoFilaLer().length === 0, 'fila corrompida nao quebra o app');
const cheia = []; for (let i = 0; i < FILA_BANCO_MAX + 15; i++) cheia.push({ k: 'k' + i, payload: {}, ts: i });
bancoFilaGravar(cheia);
const depois = bancoFilaLer();
ok(depois.length === FILA_BANCO_MAX, 'fila tem teto (' + FILA_BANCO_MAX + ') — nao estoura o navegador');
ok(depois[0].k === 'k15', 'quando estoura, caem os mais ANTIGOS');

console.log('=== ligacoes no fluxo do laudo ===');
ok(/try\{ bancoEnviarExame\(ex, resp\); \}catch\(_\)\{\}/.test(HTML),
   'apos gerar: envia a versao GERADA, embrulhado para nunca derrubar o laudo');
ok(/if\(exB\) bancoEnviarFinal\(exB, textoEditadoLaudo\(\)\)/.test(HTML),
   'ao salvar/assinar: envia a versao FINAL (o texto que o medico editou)');
ok(/DOMContentLoaded[\s\S]{0,140}bancoReenviarFila\(\)/.test(HTML),
   'ao abrir o app: tenta mandar o que ficou pendente');
const envia = grab('bancoEnviarExame');
ok(/catch\(e\)\{[\s\S]*bancoFilaUpsert/.test(envia), 'falha de envio vira fila, nao erro na tela');
ok(!/\blog\(/.test(envia), 'melhor-esforco silencioso: nada de aviso na area de mensagens');
const refila = grab('bancoReenviarFila');
ok(/break/.test(refila), 'reenvio para no primeiro erro (agente fora do ar) e tenta depois');
ok(/if\(_bancoReenviando\) return/.test(refila), 'trava de reentrada: dois reenvios nao correm juntos');
ok(/id="bancoStatus"/.test(HTML), 'indicador discreto nas Configuracoes');
ok(/rotina desta noite/.test(HTML), 'sem as rotas no agente ainda, o indicador explica em vez de so falhar');

console.log('=== o pedido a IA ===');
ok(/DADOS ESTRUTURADOS \(campo 'dados_estruturados'\)/.test(HTML), 'o prompt pede os dados estruturados');
ok(/NUNCA invente medida, órgão ou classificação/.test(HTML), 'com a trava anti-invencao');
ok(/medidas em MILÍMETROS/.test(HTML), 'medidas em milimetros (converte de cm)');
ok(/normal \| benigno \| provavelmente-benigno \| suspeito \| indeterminado \| outro/.test(HTML),
   'os codigos de conclusao sao enumerados');
ok(/\\"dados_estruturados\\":\{\\"indicacao_clinica\\"/.test(HTML),
   'o campo esta no formato de resposta JSON (nao e bloco de texto: nunca vaza para a folha)');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
