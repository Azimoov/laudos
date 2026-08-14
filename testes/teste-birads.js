// Calculadora de mama (BI-RADS) — conferida contra o MANUAL ORIGINAL em 12/08/2026.
//
// Antes este arquivo so IMPRIMIA as saidas, sem verificar nada: passava mesmo se a conta
// mudasse sozinha. Agora ele TRANCA o lexico do ACR BI-RADS v2025 (Apendice A do capitulo
// de Ultrassom, pag. impressa 489) e a conta da categoria.
//
// Os dois termos da 5a edicao que sairam na v2025 — "cistico complexo e solido" no padrao
// ecogenico e "padrao combinado" nos achados posteriores — tem teste proprio: se alguem os
// puser de volta sem querer, isto falha.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, started = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; started = true; }
    else if (HTML[j] === '}') { d--; if (started && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + name);
}
function bloco(re, oque) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei o bloco ' + oque);
  return m[0];
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// ---- DOM de mentira ----
const state = { biEsp: '', biEco: '', biHalo: false };
const radios = {};
const RES = {};
const document = {
  getElementById(id) {
    if (id === 'biEsp') return { value: state.biEsp };
    if (id === 'biEco') return { value: state.biEco };
    if (id === 'biHalo') return { checked: state.biHalo };
    if (id === 'biRes') return RES;
    return null;
  },
  querySelector(sel) {
    const m = /input\[name=(\w+)\]:checked/.exec(sel);
    if (m) { const v = radios[m[1]]; return v ? { value: v } : null; }
    return null;
  }
};
Object.defineProperty(RES, 'textContent', { set(v) { RES._v = v; }, get() { return RES._v; } });

const src = [
  bloco(/const CLASSIF = \{[\s\S]*?\n\};/, 'CLASSIF'),
  bloco(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/, 'BIRADS_ESPECIAIS'),
  grab('calcRadio'), grab('calcOut'),
  grab('biradsAvaliar'), grab('calcBiradsLerTela'), grab('calcBirads')
].join('\n');
const api = new Function('document', src + '\nreturn {calcBirads, biradsAvaliar, CLASSIF};')(document);
const { calcBirads, CLASSIF } = api;

function rodar(c) {
  state.biEsp = c.esp || ''; state.biEco = c.eco || ''; state.biHalo = !!c.halo;
  radios.biForma = c.forma; radios.biOri = c.ori; radios.biMarg = c.marg; radios.biPost = c.post;
  RES._v = '';
  calcBirads();
  return RES._v || '';
}
const cat = s => (/BI-RADS\s+([0-6][abcABC]?)/.exec(s) || [])[1] || '';

console.log('=== o lexico do manual v2025, na tela ===');
// SO o pedaco da mama: "Forma" e "Margem" tambem existem no bloco da tireoide, que vem
// antes no arquivo — sem recortar, o teste conferia a calculadora errada.
const MAMA = bloco(/id="blocoBirads"[\s\S]*?id="blocoOrads"/, 'bloco da mama');
const dentroDaMama = (re, oque) => {
  const m = MAMA.match(re);
  if (!m) throw new Error('nao achei ' + oque + ' dentro do bloco da mama');
  return m[0];
};
const selEco = bloco(/<select id="biEco"[\s\S]*?<\/select>/, 'select biEco');
const opsEco = [...selEco.matchAll(/<option value="([a-zA-Z]+)"/g)].map(m => m[1]);
ok(opsEco.length === 6, 'padrao ecogenico tem as SEIS opcoes do manual (' + opsEco.length + ')');
ok(!opsEco.includes('cisticoComplexo'), '"cistico complexo e solido" NAO esta la — saiu na v2025');
ok(opsEco.join(',') === 'anecoico,hiperecoico,isoecoico,hipoecoico,heterogeneo,misto',
   'na ordem do manual, do menos ao mais suspeito: ' + opsEco.join(' > '));
ok(opsEco.indexOf('isoecoico') < opsEco.indexOf('hipoecoico'), 'isoecoico vem ANTES de hipoecoico');

const blocoPost = bloco(/<label>Ac[^<]*stico posterior<\/label>[\s\S]*?<\/div>/, 'acustico posterior');
const opsPost = [...blocoPost.matchAll(/value="(\w+)"/g)].map(m => m[1]);
ok(opsPost.length === 3, 'achados posteriores tem as TRES opcoes do manual (' + opsPost.length + ')');
ok(!opsPost.includes('combinado'), '"padrao combinado" NAO esta la — saiu na v2025');

const blocoMarg = dentroDaMama(/<label>Margem<\/label>[\s\S]*?<\/div>/, 'margem');
ok(/microlobulada/.test(blocoMarg), 'MICROLOBULADA continua na margem — confirmado no manual, pag. 489');
ok((blocoMarg.match(/value="/g) || []).length === 5, 'margem tem 5 opcoes (circunscrita + 4 nao circunscritas)');

const blocoForma = dentroDaMama(/<label>Forma<\/label>[\s\S]*?<\/div>/, 'forma');
ok(/lobulada/.test(blocoForma), 'LOBULADA e forma propria (acrescentada na v2025)');
ok((blocoForma.match(/value="/g) || []).length === 4, 'forma tem 4 opcoes: oval, lobulada, redonda, irregular');

console.log('=== a tela e a tabela nao podem divergir ===');
// a tabela CLASSIF alimenta o pedido a IA e os botoes de "faltou este descritor";
// se ela e a tela discordarem, o medico ve uma opcao e a IA recebe outra.
const daTabela = k => CLASSIF.birads.desc.find(d => d.k === k).ops.map(o => o.v);
ok(daTabela('eco').join(',') === opsEco.join(','), 'padrao ecogenico: tabela === tela');
ok(daTabela('posterior').join(',') === opsPost.join(','), 'achados posteriores: tabela === tela');
ok(daTabela('margem').join(',') === [...blocoMarg.matchAll(/value="(\w+)"/g)].map(m => m[1]).join(','),
   'margem: tabela === tela');
ok(daTabela('forma').join(',') === [...blocoForma.matchAll(/value="(\w+)"/g)].map(m => m[1]).join(','),
   'forma: tabela === tela');

console.log('=== casos especiais (dispensam os descritores) ===');
ok(cat(rodar({ esp: 'cat0a' })) === '0a', '0a — necessita imagem adicional');
ok(cat(rodar({ esp: 'cat0b' })) === '0b', '0b — necessita exames previos');
ok(cat(rodar({ esp: 'cat6' })) === '6', '6 — malignidade comprovada');
ok(!/cirurgi/i.test(rodar({ esp: 'cat6' })), 'o texto da 6 nao e mais cirurgico-centrado (v2025)');
ok(/6, 12 e 24/.test(rodar({ esp: 'cistoComplicado' })), 'cisto complicado: seguimento 6, 12 e 24 meses');
ok(cat(rodar({ esp: 'cistoSimples' })) === '2', 'cisto simples e categoria 2');

console.log('=== a conta da categoria ===');
const benigno = { forma: 'oval', ori: 'paralela', marg: 'circ', eco: 'hipoecoico', post: 'nenhum' };
ok(cat(rodar(benigno)) === '3', 'todos os descritores benignos -> BI-RADS 3');
ok(/2 anos de estabilidade/.test(rodar(benigno)), 'e o texto manda 2 anos de estabilidade documentada');

const lob = rodar({ ...benigno, forma: 'lobulada' });
ok(cat(lob) === '3', 'LOBULADA sozinha nao tira da categoria 3');
ok(/discretamente mais suspeita/.test(lob), 'mas sai a nota de que nao e neutra (v2025)');

ok(cat(rodar({ ...benigno, eco: 'misto' })) === '4A', 'misto solido e cistico -> um suspeito -> 4A');
ok(cat(rodar({ ...benigno, marg: 'microlobulada' })) === '4A', 'margem microlobulada -> 4A');
ok(cat(rodar({ ...benigno, post: 'sombra' })) === '4A', 'sombra acustica posterior -> 4A');
ok(cat(rodar({ ...benigno, halo: true })) === '4A', 'halo ecogenico sozinho ja tira da 3 (v2025)');
ok(/incluir o halo/.test(rodar({ ...benigno, halo: true })), 'e lembra de incluir o halo na medida');
ok(cat(rodar({ ...benigno, eco: 'misto', post: 'sombra' })) === '4B', 'dois suspeitos -> 4B');
ok(cat(rodar({ ...benigno, marg: 'espiculada' })) === '4C', 'espiculada sozinha -> 4C');
ok(cat(rodar({ forma: 'irregular', ori: 'nao', marg: 'espiculada', eco: 'heterogeneo', post: 'sombra' })) === '5',
   'espiculada + varios suspeitos -> 5');
ok(rodar({ forma: 'oval', ori: 'paralela' }) === '', 'sem margem, nao arrisca categoria nenhuma');

console.log('=== os termos aposentados nao voltam pela porta dos fundos ===');
// mesmo que alguem force o valor antigo, ele nao pode contar como descritor suspeito
ok(cat(rodar({ ...benigno, eco: 'cisticoComplexo' })) === '3',
   'valor antigo "cisticoComplexo" nao e reconhecido — nao vira suspeicao fantasma');
ok(cat(rodar({ ...benigno, post: 'combinado' })) === '3',
   'valor antigo "combinado" nao e reconhecido');
ok(!/cistica complexa/i.test(rodar({ ...benigno, eco: 'cisticoComplexo' })),
   'e o termo aposentado nao aparece no texto emitido');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
