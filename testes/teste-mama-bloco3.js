// BLOCO 3 — apresentação dos achados de mama (21/08/2026).
// Especificações 05 (lista de achados múltiplos) e 09 (ordenação por gravidade + correlação).
//
// TUDO AQUI MEXE NO TEXTO DO LAUDO. Por isso a asserção mais importante desta suíte não é
// "ficou bonito", é: NENHUMA LINHA DE ACHADO SE PERDE, SE DUPLICA OU SE ALTERA. Laudo
// embaralhado é dano; laudo na ordem de ditado é só menos cômodo.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function fatia(de, ate) {
  const i = HTML.indexOf(de), f = HTML.indexOf(ate, i);
  if (i < 0 || f < 0) throw new Error('não achei ' + de);
  return HTML.slice(i, f);
}
const ESQ = fatia('/* ============ ESQUEMA ANATÔMICO DA MAMA ============',
                  '/* ============ GRÁFICO DE EVOLUÇÃO DO ACHADO ============');
const EVO = fatia('/* ============ GRÁFICO DE EVOLUÇÃO DO ACHADO ============',
                  '/* ============ BLOCO 3 — apresentação dos achados de mama ============');
const B3 = fatia('/* ============ BLOCO 3 — apresentação dos achados de mama ============',
                 '/* ============ Categoria BI-RADS por extenso');
const CAT = fatia('/* ============ Categoria BI-RADS por extenso', 'function classifCasar(');

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// classificador de mentira: devolve a categoria que o teste mandar, pelo texto do achado
let CAT_FAKE = {};
const api = new Function('esc', 'norm', 'document', 'log',
  'var BIRADS_ESPECIAIS={cistoSimples:["2","x"],cistoComplicado:["3","x"],microcistos:["2","x"],linfonodo:["2","x"]};'
  + 'function classifLerDescritores(){ return {falta:[], achou:{}}; }'
  + 'function biradsAvaliar(){ return {cat:"3"}; }\n'
  + ESQ + '\n' + EVO + '\n' + CAT + '\n' + B3 +
  '\nreturn {mamaOrdenarAchados, mamaListaMultiplos, mamaCorrelacao, _mamaBlocosCorpo,'
  + ' _mamaRank, MAMA_LISTA_MIN, MAMA_LISTA_DOMINANTE};'
)(s => String(s == null ? '' : s), norm,
  { getElementById: () => null, addEventListener: () => {} }, () => {});

const CAB = 'INDICAÇÃO: rastreamento assintomático\n\nACHADOS:\n\n';
function corpoCom(dir, esq) {
  return CAB + '**MAMA DIREITA**\nPele sem alterações.\n' + dir.join('\n')
       + '\n\n**MAMA ESQUERDA**\nPele sem alterações.\n' + (esq || []).join('\n');
}
const linhasDe = t => t.split('\n').filter(l => /às?\s*\d{1,2}\s*h/i.test(l));

console.log('=== a leitura dos blocos de mama ===');
const b = api._mamaBlocosCorpo(corpoCom(
  ['Notou-se nódulo na mama direita, às 10 h, distando 3 cm da papila, medindo 12 mm.'],
  ['Notou-se cisto na mama esquerda, às 4 h, distando 6 cm da papila, medindo 5 mm.']));
ok(b.blocos.length === 2, 'as duas mamas são reconhecidas');
ok(b.blocos[0].lado === 'D' && b.blocos[1].lado === 'E', 'com o lado certo em cada uma');
ok(b.blocos[0].achados.length === 1 && b.blocos[1].achados.length === 1, 'um achado em cada');
ok(api._mamaBlocosCorpo(CAB + '**MAMA DIREITA**\nPele sem alterações.').blocos[0].achados.length === 0,
   'linha sem localização NÃO é contada como achado');

console.log('\n=== §9A — ordenar por gravidade dentro de cada mama ===');
ok(api._mamaRank('5') > api._mamaRank('4C'), '5 é mais grave que 4C');
ok(api._mamaRank('4C') > api._mamaRank('4B') && api._mamaRank('4B') > api._mamaRank('4A'), '4C > 4B > 4A');
ok(api._mamaRank('4A') > api._mamaRank('3') && api._mamaRank('3') > api._mamaRank('2'), '4A > 3 > 2');
ok(api._mamaRank('') === -1,
   'categoria vazia vai para o FIM — achado que o programa não classificou não pode passar por urgente');
ok(api._mamaRank('') < api._mamaRank('1'), 'atrás até do BI-RADS 1');

console.log('\n=== a trava: nenhuma linha se perde, se duplica ou se altera ===');
// É a asserção que mais importa desta suíte inteira.
const tres = corpoCom([
  'Notou-se cisto simples na mama direita, às 2 h, distando 3 cm da papila, medindo 4 mm.',
  'Notou-se nódulo suspeito na mama direita, às 10 h, distando 3 cm da papila, medindo 12 mm.',
  'Notou-se cisto simples na mama direita, às 6 h, distando 5 cm da papila, medindo 3 mm.']);
const r = api.mamaOrdenarAchados(tres, []);
const antes = linhasDe(tres).slice().sort();
const depois = linhasDe(r.corpo).slice().sort();
ok(antes.length === depois.length, 'mesmo número de linhas de achado (' + antes.length + ')');
ok(JSON.stringify(antes) === JSON.stringify(depois), 'e exatamente as MESMAS linhas, sem alteração');
ok(r.corpo.indexOf('**MAMA DIREITA**') >= 0 && r.corpo.indexOf('Pele sem alterações.') >= 0,
   'o resto do texto continua intacto');

console.log('\n=== e com achados de gravidade diferente, a ordem muda ===');
// classificador de mentira: o achado "suspeito" vira 4B, os demais 2
const B3b = B3.replace('function _mamaCatDoAchado(d){',
  'function _mamaCatDoAchado(d){ if(d&&d.__cat) return d.__cat;');
const api2 = new Function('esc', 'norm', 'document', 'log',
  'var BIRADS_ESPECIAIS={};function classifLerDescritores(){return {falta:[],achou:{}};}'
  + 'function biradsAvaliar(){return {cat:"3"};}\n' + ESQ + '\n' + EVO + '\n' + CAT + '\n' + B3b +
  '\nreturn {mamaOrdenarAchados, mamaListaMultiplos};'
)(s => String(s == null ? '' : s), norm, { getElementById: () => null }, () => {});
const bir = [{ localizacao: 'às 2 h', __cat: '2' },
             { localizacao: 'às 10 h', __cat: '4B' },
             { localizacao: 'às 6 h', __cat: '2' }];
const r2 = api2.mamaOrdenarAchados(tres, bir);
ok(r2.mudou, 'houve reordenação');
const ordenadas = linhasDe(r2.corpo);
ok(/às 10 h/.test(ordenadas[0]), 'o achado 4B passou para a frente');
ok(/às 2 h/.test(ordenadas[1]) && /às 6 h/.test(ordenadas[2]),
   'e os dois de categoria 2 mantiveram a ordem de ditado entre si (empate não inventa critério)');

console.log('\n=== §05 — lista de achados múltiplos ===');
ok(api.MAMA_LISTA_MIN === 3, 'dispara a partir de 3 achados, não de 2');
const doisCistos = corpoCom([
  'Notou-se cisto simples na mama direita, às 2 h, distando 3 cm da papila, medindo 4 mm.',
  'Notou-se cisto simples na mama direita, às 6 h, distando 5 cm da papila, medindo 3 mm.']);
ok(api.mamaListaMultiplos(doisCistos, []).mudou === false,
   'com 2 achados, continua em prosa — a lista só compensa a partir de volume');

const quatro = corpoCom([
  'Notou-se cisto simples na mama direita, às 2 h, distando 3 cm da papila, medindo 4 mm.',
  'Notou-se cisto simples na mama direita, às 10 h, distando 2 cm da papila, medindo 3 mm.',
  'Notou-se cisto simples na mama direita, às 6 h, distando 5 cm da papila, medindo 5 mm.'],
 ['Notou-se cisto simples na mama esquerda, às 4 h, distando 4 cm da papila, medindo 4 mm.']);
const bir4 = [0, 1, 2, 3].map(() => ({ localizacao: 'cisto simples', __cat: '2' }));
const rl = api2.mamaListaMultiplos(quatro, bir4);
ok(rl.mudou && rl.n === 4, 'os 4 cistos viraram lista (' + rl.n + ')');
ok(/Notaram-se 4 formações císticas simples/.test(rl.corpo), 'com a linha de abertura no plural certo');
ok((rl.corpo.match(/^\s+• /gm) || []).length === 4, 'uma linha por achado (nada de "idem")');
ok(/Categoria: BI-RADS 2 \(achados múltiplos\)/.test(rl.corpo),
   'e UMA categoria para o grupo inteiro, não uma por achado');
const itens = rl.corpo.split('\n').filter(l => /^\s+• /.test(l));
ok(/direita/.test(itens[0]) && /esquerda/.test(itens[3]), 'ordenado por mama: direita antes de esquerda');
const horasD = itens.slice(0, 3).map(l => +/(\d{1,2})h/.exec(l)[1]);
ok(horasD[0] < horasD[1] && horasD[1] < horasD[2],
   'e por hora crescente dentro da mama (' + horasD.join(', ') + ')');
ok(!/medindo 4 x/.test(rl.corpo) && /— 4 mm/.test(rl.corpo),
   'a lista traz só o MAIOR diâmetro — é lista de triagem, não descrição detalhada');

console.log('\n=== achado dominante sai da lista e volta para a prosa ===');
const comDominante = corpoCom([
  'Notou-se cisto simples na mama direita, às 2 h, distando 3 cm da papila, medindo 4 mm.',
  'Notou-se cisto simples na mama direita, às 10 h, distando 2 cm da papila, medindo 3 mm.',
  'Notou-se cisto simples na mama direita, às 6 h, distando 5 cm da papila, medindo 30 mm.',
  'Notou-se cisto simples na mama direita, às 8 h, distando 4 cm da papila, medindo 4 mm.']);
const rd = api2.mamaListaMultiplos(comDominante, bir4);
ok(rd.mudou, 'a lista acontece');
ok(rd.n === 3, 'com 3 achados — o de 30 mm ficou de fora (' + rd.n + ')');
ok(/medindo 30 mm/.test(rd.corpo), 'e ele continua descrito em prosa, por extenso');
ok(api.MAMA_LISTA_DOMINANTE === 2, 'o limiar de dominância é 2x');
ok(/ESTE 2x É NOSSO/.test(B3),
   'e está DECLARADO no código que esse número é nosso, não do manual — para poder ser discutido');

console.log('\n=== §9B — correlação com outro método ===');
const rastreio = api.mamaCorrelacao(CAB + '**MAMA DIREITA**\nNotou-se nódulo às 10 h, distando 3 cm da papila.');
ok(rastreio.mudou === false,
   'em RASTREAMENTO não se fala em correlação — não há outro método a correlacionar');
const diag = 'INDICAÇÃO: investigação diagnóstica de nódulo palpável\n\nACHADOS:\n\n'
  + '**MAMA DIREITA**\nNotou-se nódulo na mama direita, às 10 h, distando 3 cm da papila, medindo 12 mm.';
const rc = api.mamaCorrelacao(diag);
ok(rc.mudou, 'em investigação diagnóstica, a correlação é registrada');
ok(rc.metodo === 'exame clínico', 'reconheceu o achado clínico (nódulo palpável)');
ok(/Achado correlacionável com o descrito à exame clínico\./.test(rc.corpo), 'com a frase do manual');
const semCorr = api.mamaCorrelacao('INDICAÇÃO: investigação diagnóstica\n\nACHADOS:\n\n'
  + '**MAMA DIREITA**\nNotou-se nódulo na mama direita, às 10 h, distando 3 cm da papila.');
ok(semCorr.mudou && semCorr.metodo === null, 'sem outro método citado, também escreve algo');
ok(/sem correlação identificada/.test(semCorr.corpo),
   'a AUSÊNCIA de correlação é DITA — o manual pede que seja afirmação, não omissão');
ok(api.mamaCorrelacao(diag.replace('ACHADOS:', 'Achado correlacionável com mamografia. ACHADOS:')).mudou === false,
   'e não repete quando a correlação já está no texto');

console.log('\n=== a ordem em que os três rodam, lida no código ===');
const chamada = HTML.slice(HTML.indexOf("if(ex.tipo==='mama'){\n      try{\n        var _ord="),
                           HTML.indexOf('/* Doppler arterial: as travas rodam'));
ok(chamada.indexOf('mamaOrdenarAchados') < chamada.indexOf('mamaListaMultiplos'),
   'ordena ANTES de agrupar — senão a lista congelaria uma ordem que ainda ia mudar');
ok(chamada.indexOf('mamaListaMultiplos') < chamada.indexOf('mamaCorrelacao'),
   'e a correlação vem por último, porque se prende ao ÚLTIMO achado');
ok((chamada.match(/log\(/g) || []).length >= 3,
   'cada transformação que acontece é DITA ao médico — texto remexido em silêncio, nunca');
ok(/catch\(e\)/.test(chamada), 'e uma falha aqui não pode custar o laudo');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
