// Testa a fila de reprocessamento e o classificador de falha transitoria.
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

const logs = [];
let exames = [];
let geracoes = [];
const agendarSalvarSessao = () => {};
const src = [grab('ehFalhaTransitoria'), grab('filaEnfileirar'), grab('filaAgendar')].join('\n');
const api = new Function('log', 'exames', 'gerarLaudo', 'agendarSalvarSessao', 'setTimeout',
  'var _fila=[],_filaTimer=null;' + src +
  ';return {trans:ehFalhaTransitoria, enf:filaEnfileirar, fila:function(){return _fila;}};'
)((m) => logs.push(m), exames, async (id) => { geracoes.push(id); }, agendarSalvarSessao, () => 1);

console.log('=== classificador de falha ===');
[['Failed to fetch', true], ['NetworkError when attempting to fetch', true],
 ['429 Too Many Requests', true], ['503 Service Unavailable', true],
 ['The server is overloaded', true], ['signal timed out', true],
 ['A IA respondeu fora do formato JSON', false],
 ['Configure sua chave da API', false],
 ['Escolha o tipo de exame', false]].forEach(([msg, esperado]) => {
  ok(api.trans(new Error(msg)) === esperado,
    (esperado ? 'RETENTA' : 'nao retenta') + ': "' + msg.slice(0, 42) + '"');
});

console.log('\n=== fila: backoff e desistencia ===');
exames.push({ id: 7, paciente: 'MARIA TESTE', laudo: null });
api.enf(7, 'Failed to fetch');
ok(api.fila().length === 1 && api.fila()[0].tentativas === 1, '1a falha: entra na fila');
ok(/tentativa 1 de 4/.test(logs.join(' ')), 'avisa o medico da nova tentativa');
ok(/em 10s/.test(logs.join(' ')), 'espera 10s na 1a (backoff exponencial)');
api.enf(7, 'Failed to fetch');
ok(api.fila()[0].tentativas === 2, '2a falha: mesma entrada, contador sobe (nao duplica)');
ok(/em 20s/.test(logs.join(' ')), '2a espera 20s');
api.enf(7, 'Failed to fetch');
api.enf(7, 'Failed to fetch');
ok(api.fila().length === 1, 'ainda na fila na 4a');
api.enf(7, 'Failed to fetch');
ok(api.fila().length === 0, '5a chamada: desiste e TIRA da fila');
ok(/Desisti de gerar o laudo de MARIA TESTE/.test(logs.join(' ')), 'avisa a desistencia com o nome do paciente');

console.log('\n=== nao mistura exames ===');
logs.length = 0;
exames.push({ id: 9, paciente: 'JOAO', laudo: null });
api.enf(9, 'timeout'); api.enf(9, 'timeout');
ok(api.fila().length === 1 && api.fila()[0].exId === 9, 'fila separada por exame');

console.log('\n=== integracao no gerarLaudo ===');
const g = grab('gerarLaudo');
ok(/ehFalhaTransitoria\(e\)/.test(g), 'gerarLaudo consulta o classificador');
ok(/filaEnfileirar\(ex\.id/.test(g), 'gerarLaudo enfileira em falha transitoria');
ok(/nao e falha temporaria|não é falha temporária/.test(g), 'falha definitiva avisa em vez de retentar em silencio');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
