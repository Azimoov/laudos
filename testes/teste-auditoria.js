// Testa as funcoes novas da auditoria: extrairJson, registrarUso, esc.
const fs = require('fs');
const HTML = fs.readFileSync('C:/Users/serru/OneDrive/Desktop/Projeto WBOT/_repo/index.html', 'utf8');
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

// ---- extrairJson ----
const extrairJson = new Function('return ' + grab('extrairJson'))();
console.log('=== extrairJson ===');
ok(extrairJson('{"a":1}').a === 1, 'JSON puro');
ok(extrairJson('```json\n{"a":2}\n```').a === 2, 'cerca ```json');
ok(extrairJson('Claro! Aqui está o laudo:\n{"a":3,"b":{"c":4}}\nEspero ter ajudado.').a === 3, 'frase antes e depois (caso que antes DERRUBAVA o laudo)');
ok(extrairJson('```\n{"a":5}\n```').a === 5, 'cerca sem "json"');
let deu = null; try { extrairJson('nada de json aqui'); } catch (e) { deu = e.message; }
ok(deu && deu.includes('fora do formato'), 'sem JSON: erro claro com trecho da resposta');
ok(extrairJson('{"corpo":"linha1\\nlinha2 com ```code``` dentro"}').corpo.includes('code'), 'crases DENTRO de string nao quebram');

// ---- registrarUso ----
console.log('=== registrarUso ===');
const store = {};
const localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
const salvos = [];
const dadoSalvar = (k, v) => { store[k] = v; salvos.push(k); };
const registrarUso = new Function('localStorage', 'dadoSalvar', grab('registrarUso') + '; return registrarUso;')(localStorage, dadoSalvar);
registrarUso('gpt-5.5', { prompt_tokens: 22000, completion_tokens: 900 });
registrarUso('gpt-5.5', { prompt_tokens: 30000, completion_tokens: 1100 });
registrarUso('gpt-5-mini', { prompt_tokens: 500, completion_tokens: 80 });
const g = JSON.parse(store.guso);
const dia = Object.keys(g)[0];
ok(g[dia]['gpt-5.5'].n === 2, 'conta 2 chamadas do modelo principal');
ok(g[dia]['gpt-5.5'].entrada === 52000, 'soma entrada (52000)');
ok(g[dia]['gpt-5.5'].saida === 2000, 'soma saida (2000)');
ok(g[dia]['gpt-5-mini'].n === 1, 'modelo auxiliar separado');
ok(salvos.every(k => k === 'guso'), 'grava via dadoSalvar (vai ao disco + backup diario)');
// poda de 90 dias
for (let i = 0; i < 95; i++) {
  const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  const gg = JSON.parse(store.guso); gg[d] = gg[d] || { x: { n: 1, entrada: 1, saida: 1 } };
  store.guso = JSON.stringify(gg);
}
registrarUso('gpt-5.5', { prompt_tokens: 1, completion_tokens: 1 });
ok(Object.keys(JSON.parse(store.guso)).length <= 91, 'poda mantem no maximo ~90 dias (' + Object.keys(JSON.parse(store.guso)).length + ')');

// ---- esc ----
console.log('=== esc (barreira XSS) ===');
const esc = new Function('return ' + grab('esc'))();
ok(esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;', 'neutraliza tag');
ok(esc('Maria & José <3') === 'Maria &amp; José &lt;3', 'escapa & e <');
ok(esc(null) === '' && esc(undefined) === '', 'null/undefined viram vazio');
// os 4 pontos criticos usam esc()/negrito()?
const linhaCab = HTML.split('\n').find(l => l.includes('Nome do Paciente:'));
ok(/esc\(c\.nome/.test(linhaCab) && /esc\(c\.dados_clinicos/.test(linhaCab), 'cabecalho do laudo escapado');
ok(/esc\(L\.titulo\)/.test(HTML), 'titulo do laudo escapado');
ok(/const nome=esc\(/.test(HTML), 'nome no cartao de revisao escapado');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
