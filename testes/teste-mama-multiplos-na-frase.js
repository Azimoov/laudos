// UMA FRASE, VARIOS ACHADOS (26/08/2026) — o laudo REAL impresso pelo medico.
//
// "notando-se formacoes cisticas simples ... localizadas as 2 h, 8 h e 9 h, medindo
//  6,1 x 2,6 x 3,7 mm, 6,3 x 6,9 x 3,6 mm e 5,8 x 5,9 x 6,6 mm, respectivamente."
//
// O desenho saiu com os TRES cistos empilhados as 2 h, os tres "do mesmo tamanho"
// (a primeira medida repetida), e "profundidade posterior" que ninguem ditou — o
// "posterior" veio de "reforco ACUSTICO posterior", que e achado ecografico, nao
// posicao. Esta suite roda contra a frase real e congela os tres consertos.
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, started = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; started = true; }
    else if (HTML[j] === '}') { d--; if (started && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('chaves desbalanceadas em ' + name);
}
function bloco(re, nome) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei o bloco ' + nome);
  return m[0];
}

const src = [
  bloco(/const MAMA_RAIO_CM = \d+;/, 'MAMA_RAIO_CM'),
  bloco(/const MAMA_DIST_INDEF_CM = [^;]+;/, 'MAMA_DIST_INDEF_CM'),
  bloco(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/, 'BIRADS_ESPECIAIS'),
  grab('mamaCmInteiro'), grab('mamaMm'), grab('mamaLocalDoTexto'),
  grab('_mamaFraseDo'), grab('mamaCasoEspecialDoTexto'), grab('_mamaCatDoAchado'),
  grab('mamaLesoes'),
].join('\n');
const api = new Function('norm', src + '\nreturn {mamaLocalDoTexto, mamaLesoes};')(
  s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

const FRASE_D = 'Parênquima mamário com ecogênicidade habituais de padrão heterogêneo, '
  + 'notando-se formações císticas simples, anecoicas, de contornos regulares e com '
  + 'reforço acústico posterior, localizadas às 2 h, 8 h e 9 h, medindo '
  + '6,1 x 2,6 x 3,7 mm, 6,3 x 6,9 x 3,6 mm e 5,8 x 5,9 x 6,6 mm, respectivamente.';

console.log('=== a leitura da frase (mamaLocalDoTexto) ===');
const L1 = api.mamaLocalDoTexto(FRASE_D);
ok(JSON.stringify(L1.horas) === '[2,8,9]', 'TODAS as horas sao lidas: ' + JSON.stringify(L1.horas));
ok(L1.hora === 2, 'a primeira continua sendo a "principal" (nada do antigo muda)');
ok(L1.mms && L1.mms.length === 3, 'TODAS as triplas de medida sao lidas (' + (L1.mms || []).length + ')');
ok(L1.mms && Math.round(L1.mms[1][1]) === 7 && Math.round(L1.mms[2][2]) === 7,
  'com os valores certos em cada uma');
ok(L1.prof === 'media', '"reforço ACÚSTICO posterior" NAO vira profundidade posterior: ' + L1.prof);
ok(api.mamaLocalDoTexto('nódulo no terço posterior da mama, às 3 h.').prof === 'posterior',
  'mas profundidade posterior DITADA de verdade continua lida');
ok(api.mamaLocalDoTexto('lesão com sombra acústica posterior, às 4 h.').prof === 'media',
  'sombra acústica idem: achado, nao posicao');

console.log('\n=== o desenho (mamaLesoes) com os 3 itens da IA ===');
const CORPO = '**MAMA DIREITA**\n**DESCRIÇÃO:**\n\nMama simétrica.\n' + FRASE_D + '\n';
// caso 1: a IA deu a hora de cada um no rotulo
const r1 = api.mamaLesoes({ corpo: CORPO, _classifBruto: { birads: [
  { localizacao: 'mama direita, às 2 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 8 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 9 h', caso_especial: 'cistoSimples' },
] } });
ok(r1.plot.length === 3, 'os tres cistos sao plotados (' + r1.plot.length + ')');
const horas1 = r1.plot.map(p => p.hora).sort((a, b) => a - b);
ok(JSON.stringify(horas1) === '[2,8,9]', 'cada um NA SUA hora: ' + JSON.stringify(horas1) + ' (era [2,2,2])');
const tam1 = r1.plot.map(p => (p.mm || []).map(v => Math.round(v)).join('x'));
ok(new Set(tam1).size === 3, 'cada um com a SUA medida: ' + tam1.join(' | ') + ' (era a 1a repetida)');
const das8 = r1.plot.filter(p => p.hora === 8)[0];
ok(das8 && Math.round(das8.mm[1]) === 7, 'e o "respectivamente" e respeitado: o das 8 h leva a 2a medida');
ok(r1.plot.every(p => p.prof === 'media'), 'nenhum ganha profundidade que nao foi ditada');

// caso 2: rotulo com hora que NAO esta na lista da frase — o rotulo e DESTE item,
// entao a hora dele vale (rotulo certo com frase incompleta e mais comum que o oposto)
const r2 = api.mamaLesoes({ corpo: CORPO, _classifBruto: { birads: [
  { localizacao: 'mama direita, às 2 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 5 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 9 h', caso_especial: 'cistoSimples' },
] } });
const horas2 = r2.plot.map(p => p.hora).sort((a, b) => a - b);
ok(r2.plot.length === 3 && JSON.stringify(horas2) === '[2,5,9]',
  'hora do rotulo vale mesmo fora da lista da frase: ' + JSON.stringify(horas2));

// caso 3: frase de UM achado so — o caminho antigo intacto
const r3 = api.mamaLesoes({ corpo: '**MAMA ESQUERDA**\n**DESCRIÇÃO:**\n\n'
  + 'Notou-se formação cística simples, anecoica, localizada às 9 h, distando 3 cm da papila, '
  + 'medindo 6,1 x 2,6 x 3,7 mm.\n',
  _classifBruto: { birads: [{ localizacao: 'mama esquerda, às 9 h', caso_especial: 'cistoSimples' }] } });
ok(r3.plot.length === 1 && r3.plot[0].hora === 9 && r3.plot[0].distCm === 3,
  'frase de UM achado: tudo como sempre foi (9 h, 3 cm)');

console.log('\n=== 2a volta (26/08 a tarde): distancia e profundidade em LISTA ===');
// O laudo real da tarde: horas certas, medidas certas — mas "a 2 cm da papila" e
// "20 mm da pele" repetidos nos tres. O primeiro valor de cada lista era aplicado a todos.
const FRASE_L = 'Parênquima mamário heterogêneo, notando-se formações císticas simples, '
  + 'anecoicas, com reforço acústico posterior, localizadas às 2 h, 8 h e 9 h, '
  + 'distando 2 cm, 3 cm e 4 cm da papila, a 20 mm, 25 mm e 30 mm da pele, medindo '
  + '6,1 x 2,6 x 3,7 mm, 6,3 x 6,9 x 3,6 mm e 5,8 x 5,9 x 6,6 mm, respectivamente.';
const L2 = api.mamaLocalDoTexto(FRASE_L);
ok(JSON.stringify(L2.dists) === '[2,3,4]', 'TODAS as distancias da papila: ' + JSON.stringify(L2.dists));
ok(JSON.stringify(L2.profsMm) === '[20,25,30]', 'TODAS as profundidades da pele: ' + JSON.stringify(L2.profsMm));
ok(L2.distCm === 2 && L2.profMm === 20, 'o primeiro valor continua sendo o principal (nada do antigo muda)');
// unidade dita UMA vez no fim da lista, como na fala: "2, 3 e 4 cm"
const L3 = api.mamaLocalDoTexto('cistos às 2 h, 8 h e 9 h, distando 2, 3 e 4 cm da papila.');
ok(JSON.stringify(L3.dists) === '[2,3,4]', 'unidade compartilhada no fim vale para a lista: ' + JSON.stringify(L3.dists));
ok(!L3.dists || L3.dists.indexOf(8) < 0, 'e as HORAS nao contaminam a lista de distancias');
// frase de UM valor: sem lista, comportamento identico ao de sempre
const L4 = api.mamaLocalDoTexto('cisto às 9 h, distando 3 cm da papila, a 15 mm da pele.');
ok(L4.dists == null && L4.profsMm == null && L4.distCm === 3 && L4.profMm === 15,
  'um valor so: nenhuma lista, tudo como era');

const CORPO_L = '**MAMA DIREITA**\n**DESCRIÇÃO:**\n\nMama simétrica.\n' + FRASE_L + '\n';
const rL = api.mamaLesoes({ corpo: CORPO_L, _classifBruto: { birads: [
  { localizacao: 'mama direita, às 2 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 8 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 9 h', caso_especial: 'cistoSimples' },
] } });
ok(rL.plot.length === 3, 'os tres continuam plotados');
const _p8 = rL.plot.filter(p => p.hora === 8)[0];
const _p9 = rL.plot.filter(p => p.hora === 9)[0];
ok(_p8 && _p8.distCm === 3 && _p9 && _p9.distCm === 4,
  'cada um com a SUA distancia da papila (8h->3cm, 9h->4cm; era 2cm nos tres)');
ok(_p8 && Math.round(_p8.profMm) === 25 && _p9 && Math.round(_p9.profMm) === 30,
  'cada um com a SUA profundidade da pele (8h->25mm, 9h->30mm; era 20mm nos tres)');

console.log('\n=== bullets (regra de 26/08): uma linha por cisto ===');
const NL2 = String.fromCharCode(10);
const CORPO_B = '**MAMA DIREITA**' + NL2 + '**DESCRIÇÃO:**' + NL2 + NL2 + 'Mama simétrica.' + NL2
  + 'Formações císticas simples, anecoicas, de contornos regulares e com reforço acústico posterior:' + NL2
  + '• às 2 h, a 2 cm da papila, medindo 0,6 x 0,3 x 0,4 cm;' + NL2
  + '• às 8 h, a 3 cm da papila, medindo 0,6 x 0,7 x 0,4 cm;' + NL2
  + '• às 9 h, a 4 cm da papila, medindo 0,6 x 0,6 x 0,7 cm.' + NL2;
const rB = api.mamaLesoes({ corpo: CORPO_B, _classifBruto: { birads: [
  { localizacao: 'mama direita, às 2 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 8 h', caso_especial: 'cistoSimples' },
  { localizacao: 'mama direita, às 9 h', caso_especial: 'cistoSimples' },
] } });
ok(rB.plot.length === 3, 'os tres bullets viram tres achados no desenho (' + rB.plot.length + ')');
const b8 = rB.plot.filter(p => p.hora === 8)[0];
ok(b8 && b8.distCm === 3 && Math.round(b8.mm[1]) === 7,
  'cada bullet carrega os SEUS dados (8h -> 3cm, 0,6x0,7x0,4)');
ok(rB.plot.every(p => !p.distIgnorada), 'nenhum fica sem distancia — cada linha tem a sua');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
