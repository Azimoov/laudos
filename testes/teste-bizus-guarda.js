// OS DIZERES PADRÃO QUE NÃO CHEGAVAM NA IA (20/08/2026).
//
// O que aconteceu: em 30/07 ficou salvo, no lugar dos BIZUS, um texto de teste de 37
// caracteres ("MEUS DIZERES PADRÃO — texto do médico"). Durante 20 dias foi ISSO que a IA
// recebeu como dizeres do médico, em todo exame. Os 42 mil caracteres de BIZUS do código,
// das 14 regiões, nunca chegaram nela.
//
// Por que ninguém viu: a memória do navegador morre a cada abertura (o programa serve o
// app numa porta SORTEADA, e memória de navegador é por endereço). Quem manda de verdade é
// o valor no disco do agente — ele vence a sincronização de abertura sempre. Valor ruim em
// disco não é episódio: é permanente e silencioso. E o botão "Restaurar padrão" limpava só
// o navegador, então desfazia sozinho na abertura seguinte.
//
// Esta suíte roda as funções DE VERDADE, recortadas do index.html.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const DADOS = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + nome);
}
function bloco(re, oque) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei ' + oque);
  return m[0];
}

// O BIZUS de verdade, do dados.js — é o que tem de sobrar quando o salvo não presta.
const BIZUS = (function () {
  const i = DADOS.indexOf('const BIZUS');
  const ini = DADOS.indexOf('"', i);
  let j = ini + 1;
  while (true) {
    if (DADOS[j] === '\\') { j += 2; continue; }
    if (DADOS[j] === '"') break;
    j++;
  }
  return JSON.parse(DADOS.slice(ini, j + 1));
})();

// localStorage e log de mentira, para as funções reais rodarem fora do navegador
let guardado = {}, avisos = [];
const localStorage = {
  getItem: k => (k in guardado ? guardado[k] : null),
  setItem: (k, v) => { guardado[k] = String(v); },
  removeItem: k => { delete guardado[k]; },
};
const log = (m) => avisos.push(String(m));
let posts = [];
const fetch = (url, opt) => { posts.push({ url, opt }); return { catch: () => {} }; };
const agenteBase = () => 'http://127.0.0.1:8988';
const confirm = () => true;
const document = { getElementById: () => null };
const Date_ = Date;

const api = new Function(
  'BIZUS', 'localStorage', 'log', 'fetch', 'agenteBase', 'confirm', 'document',
  bloco(/const BIZUS_SECOES = [^\n]*/, 'BIZUS_SECOES') + '\n' +
  grab('bizusParse') + '\n' + grab('bizusEfetivo') + '\n' +
  grab('bizusParaTipo') + '\n' +
  bloco(/const BIZUS_POR_TIPO = \{[\s\S]*?\n\};/, 'BIZUS_POR_TIPO') + '\n' +
  grab('restaurarBizus') + '\n' +
  'return {bizusEfetivo, bizusParaTipo, bizusParse, restaurarBizus};'
)(BIZUS, localStorage, log, fetch, agenteBase, confirm, document);

console.log('=== o arquivo de dizeres do código está inteiro ===');
ok(BIZUS.length > 30000, 'BIZUS do código tem ' + BIZUS.length + ' caracteres');
const secs = api.bizusParse(BIZUS).secoes;
// >=13 e não ==14 de propósito: esta suíte roda nas DUAS linhas, e o Doppler arterial de
// MMII só existe na 2.0. O que importa aqui é "tem muitas regiões", não o número exato.
ok(secs.length >= 13, 'com ' + secs.length + ' regiões reconhecidas');
ok(secs.some(s => s.nome === 'MAMA'), 'inclusive MAMA, que é o assunto do pacote em curso');

console.log('\n=== O DEFEITO: valor salvo sem região nenhuma engolia tudo ===');
guardado = { gbizus: 'MEUS DIZERES PADRÃO — texto do médico' };   // o valor real de 30/07
avisos = [];
const efetivo = api.bizusEfetivo();
ok(efetivo === BIZUS,
   'valor de teste de 37 caracteres é RECUSADO — vale o arquivo do código');
ok(efetivo.length > 30000, 'e o que sobra tem tamanho de arquivo de verdade (' + efetivo.length + ')');
ok(avisos.length === 1 && /ileg/i.test(avisos[0]),
   'e o médico é avisado de que o guardado está ilegível, em vez de silêncio');
avisos = [];
api.bizusEfetivo();
ok(avisos.length === 0, 'o aviso não se repete a cada chamada (viraria ruído e seria ignorado)');

console.log('\n=== e o que a IA recebia no exame de mama ===');
guardado = { gbizus: 'MEUS DIZERES PADRÃO — texto do médico' };
const paraMama = api.bizusParaTipo('mama');
ok(paraMama !== 'MEUS DIZERES PADRÃO — texto do médico',
   'o montador não devolve mais o texto de teste');
ok(/MAMA/.test(paraMama) && paraMama.length > 1000,
   'devolve a seção MAMA de verdade (' + paraMama.length + ' caracteres)');
ok(/nódulo|cisto/i.test(paraMama), 'com os dizeres de nódulo e cisto dentro');

console.log('\n=== BIZUS personalizado DE VERDADE continua valendo ===');
// A trava não pode atrapalhar quem edita: tudo que sai do editor tem cabeçalho de região.
const custom = 'MAMA:\n\nMeu dizer novo:\n\nTexto do médico.\n\nCONCLUSÃO: minha conclusão.\n\n';
guardado = { gbizus: custom };
ok(api.bizusEfetivo() === custom, 'valor com região reconhecível é aceito, como sempre foi');
ok(/Meu dizer novo/.test(api.bizusParaTipo('mama')), 'e chega ao laudo de mama');

console.log('\n=== vazio e ausente também caem no código ===');
guardado = {};
ok(api.bizusEfetivo() === BIZUS, 'sem nada guardado, vale o código');
guardado = { gbizus: '   ' };
ok(api.bizusEfetivo() === BIZUS, 'guardado só com espaços não substitui nada');

console.log('\n=== "Restaurar padrão" precisa apagar nos DOIS lugares ===');
// Antes limpava só o navegador. Como a memória do navegador morre a cada abertura e a
// sincronização traz de volta o disco, o botão desfazia sozinho — dizia "restaurado" sem
// ter restaurado. Este é o teste que prova que ele deixou de mentir.
guardado = { gbizus: 'MEUS DIZERES PADRÃO — texto do médico', gbizus__ts: '1785434202635' };
posts = [];
api.restaurarBizus();
ok(!('gbizus' in guardado), 'apagou no navegador');
ok(!('gbizus__ts' in guardado),
   'e apagou a marca de hora junto — deixá-la faz disco e navegador empatarem, e empate congela');
ok(posts.length === 1 && /\/dados\/gbizus$/.test(posts[0].url), 'e avisou o agente');
const corpo = JSON.parse(posts[0].opt.body);
ok(corpo.valor === null,
   'mandando valor NULO, que é o apagar que a sincronização entende (ela só baixa != null)');
ok(typeof corpo.ts === 'number' && corpo.ts > 1785434202635,
   'com hora NOVA, senão o valor velho do disco continuaria vencendo');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
