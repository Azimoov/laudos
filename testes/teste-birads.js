// Harness: extrai calcBirads/calcRadio/calcOut do index.html e roda com DOM stub.
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

// ---- DOM stub ----
const state = { biEsp: '', biEco: '', biHalo: false, biRes: '' };
const radios = {};                       // name -> value escolhido
const RES = { biRes: '' };
const document = {
  getElementById(id) {
    if (id === 'biEsp') return { value: state.biEsp };
    if (id === 'biEco') return { value: state.biEco };
    if (id === 'biHalo') return { checked: state.biHalo };
    if (id === 'biRes') return RES;      // calcOut escreve .textContent
    return null;
  },
  querySelector(sel) {
    const m = /input\[name=(\w+)\]:checked/.exec(sel);
    if (m) { const v = radios[m[1]]; return v ? { value: v } : null; }
    return null;
  }
};
Object.defineProperty(RES, 'textContent', { set(v) { RES._v = v; }, get() { return RES._v; } });

const src = [grab('calcRadio'), grab('calcNum'), grab('calcOut'), grab('calcBirads')].join('\n');
const fn = new Function('document', src + '\nreturn {calcBirads: calcBirads};');
const api = fn(document);

// ---- casos ----
const casos = [
  ['0a (imagem adicional)',        { esp: 'cat0a' }],
  ['0b (comparar com previos)',    { esp: 'cat0b' }],
  ['6 (malignidade comprovada)',   { esp: 'cat6' }],
  ['cisto complicado',             { esp: 'cistoComplicado' }],
  ['oval, tudo benigno',           { forma: 'oval', ori: 'paralela', marg: 'circ', eco: 'hipoecoico', post: 'nenhum' }],
  ['LOBULADA, resto benigno',      { forma: 'lobulada', ori: 'paralela', marg: 'circ', eco: 'hipoecoico', post: 'nenhum' }],
  ['MISTO solido-cistico',         { forma: 'oval', ori: 'paralela', marg: 'circ', eco: 'misto', post: 'nenhum' }],
  ['CISTICO complexo e solido',    { forma: 'oval', ori: 'paralela', marg: 'circ', eco: 'cisticoComplexo', post: 'nenhum' }],
  ['HALO ecogenico isolado',       { forma: 'oval', ori: 'paralela', marg: 'circ', post: 'nenhum', halo: true }],
  ['posterior COMBINADO',          { forma: 'oval', ori: 'paralela', marg: 'circ', post: 'combinado' }],
  ['microlobulada (deve existir)', { forma: 'oval', ori: 'paralela', marg: 'microlobulada', post: 'nenhum' }],
  ['irregular+nao paralela+espic', { forma: 'irregular', ori: 'nao', marg: 'espiculada', eco: 'heterogeneo', post: 'sombra' }],
  ['incompleto (sem margem)',      { forma: 'oval', ori: 'paralela' }]
];

for (const [nome, c] of casos) {
  state.biEsp = c.esp || ''; state.biEco = c.eco || ''; state.biHalo = !!c.halo;
  radios.biForma = c.forma; radios.biOri = c.ori; radios.biMarg = c.marg; radios.biPost = c.post;
  RES._v = '';
  api.calcBirads();
  console.log('### ' + nome + '\n' + (RES._v === '' ? '(saida vazia)' : RES._v) + '\n');
}
