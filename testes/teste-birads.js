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
const state = { biEsp: '', biEco: '', biHalo: false, biVasc: '', biElasto: '', biPseudocap: false,
                biTipoAchado: '', biTecGland: '', biNmDist: '', biNmPadrao: '' };
const radios = {};
const RES = {};
const document = {
  getElementById(id) {
    if (id === 'biEsp') return { value: state.biEsp };
    if (id === 'biEco') return { value: state.biEco };
    if (id === 'biHalo') return { checked: state.biHalo };
    if (id === 'biPseudocap') return { checked: state.biPseudocap };
    if (id === 'biVasc') return { value: state.biVasc };
    if (id === 'biElasto') return { value: state.biElasto };
    if (id === 'biTipoAchado') return { value: state.biTipoAchado };
    if (id === 'biTecGland') return { value: state.biTecGland };
    if (id === 'biNmDist') return { value: state.biNmDist };
    if (id === 'biNmPadrao') return { value: state.biNmPadrao };
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
  grab('norm'), grab('classifCasar'), grab('classifLerDescritores'),
  grab('classifCategoriaDitada'), grab('classifConferir'),
  grab('calcRadio'), grab('calcOut'),
  grab('biradsAvaliar'), grab('calcBiradsLerTela'), grab('calcBirads'), grab('processarBirads')
].join('\n');
const api = new Function('document', src + '\nreturn {calcBirads, biradsAvaliar, CLASSIF, processarBirads};')(document);
const { calcBirads, CLASSIF, processarBirads } = api;

function rodar(c) {
  state.biEsp = c.esp || ''; state.biEco = c.eco || ''; state.biHalo = !!c.halo;
  state.biVasc = c.vasc || ''; state.biElasto = c.elasto || ''; state.biPseudocap = !!c.pseudocap;
  state.biTipoAchado = c.tipoAchado || ''; state.biTecGland = c.tec || '';
  state.biNmDist = c.nmDist || ''; state.biNmPadrao = c.nmPad || '';
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

console.log('=== v2025 §13.3 — os cinco itens pedidos em 12/08, construidos em 17/08 ===');
// a tela: os seletores novos existem no bloco da mama, com as opcoes NA ORDEM DO MANUAL
const selVasc = dentroDaMama(/<select id="biVasc"[\s\S]*?<\/select>/, 'select biVasc');
const opsVasc = [...selVasc.matchAll(/<option value="(\w+)"/g)].map(m => m[1]);
ok(opsVasc.join(',') === 'avascular,interna,periferica', 'vascularizacao: as 3 do manual (' + opsVasc.join(',') + ')');
const selEl = dentroDaMama(/<select id="biElasto"[\s\S]*?<\/select>/, 'select biElasto');
const opsEl = [...selEl.matchAll(/<option value="(\w+)"/g)].map(m => m[1]);
ok(opsEl.join(',') === 'macia,intermediaria,dura', 'elastografia: macia, intermediaria, dura');
ok(/biPseudocap/.test(MAMA), 'pseudocapsula ecogenica esta nos achados associados');
const selDist = dentroDaMama(/<select id="biNmDist"[\s\S]*?<\/select>/, 'select biNmDist');
const opsDist = [...selDist.matchAll(/<option value="(\w+)"/g)].map(m => m[1]);
ok(opsDist.join(',') === 'regional,focal,linear,segmentar',
   'nao-massa: QUATRO distribuicoes na ordem do manual — "difusa" (da 5a ed.) NAO esta');
const selPad = dentroDaMama(/<select id="biNmPadrao"[\s\S]*?<\/select>/, 'select biNmPadrao');
const opsPad = [...selPad.matchAll(/<option value="(\w+)"/g)].map(m => m[1]);
ok(opsPad.join(',') === 'hiperecoico,heterogeneo,hipoecoico',
   'nao-massa: TRES padroes na ordem do manual — "anecoico" NAO esta');
const selTec = dentroDaMama(/<select id="biTecGland"[\s\S]*?<\/select>/, 'select biTecGland');
const opsTec = [...selTec.matchAll(/<option value="(\w+)"/g)].map(m => m[1]);
ok(opsTec.join(',') === 'minimo,discreto,moderado,acentuado', 'tecido glandular: as 4 faixas do manual');

// a tela e a tabela nao podem divergir — tambem nos novos
ok(daTabela('vasc').join(',') === opsVasc.join(','), 'vascularizacao: tabela === tela');
ok(daTabela('elasto').join(',') === opsEl.join(','), 'elastografia: tabela === tela');
ok(daTabela('distribuicao').join(',') === opsDist.join(','), 'distribuicao nao-massa: tabela === tela');
ok(daTabela('padrao').join(',') === opsPad.join(','), 'padrao nao-massa: tabela === tela');

console.log('=== decisao do medico (16/08): contam quando suspeitas; ausencia = negativa ===');
const descDe = k => CLASSIF.birads.desc.find(d => d.k === k);
ok(descDe('vasc').opcional === true && descDe('elasto').opcional === true,
   'vascularizacao e elastografia sao OPCIONAIS: nao ditadas, nao cobram cartao');
ok(descDe('pseudocapsula').opcional === true, 'pseudocapsula e opcional');
ok(descDe('distribuicao').sobDemanda === true && descDe('padrao').sobDemanda === true,
   'descritores de nao-massa nunca cobram cartao (sobDemanda)');
ok(cat(rodar({ ...benigno, vasc: 'interna' })) === '4A', 'vascularizacao INTERNA conta: 4A');
ok(cat(rodar({ ...benigno, elasto: 'dura' })) === '4A', 'elastografia DURA conta: 4A');
ok(cat(rodar({ ...benigno, vasc: 'avascular' })) === '3', 'avascular nao pesa: segue 3');
ok(cat(rodar({ ...benigno, vasc: 'periferica' })) === '3', 'hipervascularizacao periferica nao pesa (§5.6): segue 3');
ok(cat(rodar({ ...benigno, elasto: 'macia' })) === '3', 'macia nao pesa: segue 3');
ok(cat(rodar({ ...benigno, elasto: 'intermediaria' })) === '3', 'intermediaria nao pesa: segue 3');
ok(cat(rodar({ ...benigno, vasc: 'interna', elasto: 'dura' })) === '4B', 'interna + dura = dois suspeitos: 4B');
ok(cat(rodar({ ...benigno, pseudocap: true })) === '3', 'pseudocapsula e NEUTRA: nao tira da 3');
ok(!descDe('pseudocapsula').ops.some(o => o.susp), 'pseudocapsula nao carrega marca de suspeicao');

console.log('=== tecido glandular: registra, nao pesa ===');
const comTec = rodar({ ...benigno, tec: 'moderado' });
ok(cat(comTec) === '3', 'tecido glandular nao muda a conta');
ok(/tecido glandular: moderado \(50/.test(comTec), 'e sai escrito no resultado');
ok(/tecido glandular/.test(rodar({ tec: 'minimo' })), 'so a composicao, sem descritores: sai a composicao');
ok(!/BI-RADS/.test(rodar({ tec: 'minimo' })), 'e sem categoria nenhuma');

console.log('=== lesao nao-massa: NUNCA uma categoria ===');
const nm = rodar({ tipoAchado: 'naoMassa', nmDist: 'segmentar', nmPad: 'hipoecoico' });
ok(/Les.o n.o-massa/.test(nm), 'nao-massa: o resultado diz o que e');
ok(!/BI-RADS\s+[0-6]/.test(nm), 'e NUNCA imprime uma categoria numerada');
ok(/n.o calculada/.test(nm) && /decis.o cl.nica/.test(nm), 'diz as claras: categoria e decisao clinica');
ok(/distribui..o segmentar/.test(nm) && /hipoecoico/.test(nm), 'os descritores ditos aparecem');
ok(/Les.o n.o-massa\./.test(rodar({ tipoAchado: 'naoMassa' })), 'sem descritores: so o fato, sem inventar');
// e mesmo com os campos de massa preenchidos por engano, o tipo manda
ok(!/BI-RADS\s+[0-6]/.test(rodar({ tipoAchado: 'naoMassa', ...benigno })), 'tipo nao-massa ignora os campos de massa');

console.log('=== o laudo automatico (processarBirads) ===');
const rb = processarBirads([{ localizacao: 'mama direita, QSE', tipo: 'naoMassa',
                              distribuicao: 'segmentar', padrao: 'hipoecoico' }], '');
ok(rb.pendencias.length === 0, 'nao-massa NAO cobra forma/margem/orientacao (sao descritores de massa)');
ok(rb.linhas.length === 1 && /n.o calculada/.test(rb.linhas[0]), 'a linha do laudo diz: categoria nao calculada');
ok(/distribui..o segmentar/.test(rb.linhas[0]), 'a distribuicao ditada aparece na linha');
const rb2 = processarBirads([{ localizacao: 'mama esquerda', forma: 'oval', orientacao: 'paralela',
                               margem: 'circunscrita', eco: 'hipoecoico', posterior: 'sem alteracao' }], '');
ok(/BI-RADS 3/.test(rb2.linhas[0] || ''), 'massa sem vasc/elasto ditadas: categoria sai normalmente (ausencia = negativa)');
ok(rb2.pendencias.length === 0, 'e sem cobranca de vascularizacao/elastografia');
const rb3 = processarBirads([{ localizacao: 'mama esquerda', forma: 'oval', orientacao: 'paralela',
                               margem: 'circunscrita', eco: 'hipoecoico', posterior: 'sem alteracao',
                               vasc: 'vascularizacao interna' }], '');
ok(/BI-RADS 4A/.test(rb3.linhas[0] || ''), 'vascularizacao interna ditada: 4A no laudo automatico');

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
