// REFERENCIAS DE TAMANHO NO LAUDO: TABELA ZERADA (decisao do medico, 26/08/2026).
//
// "remova todas as referencias. vamos ir colocando conforme formos editando os laudos."
// Esta suite congela o estado: NENHUM julgamento de tamanho ganha asterisco nem rodape,
// e o MECANISMO continua pronto — uma entrada nova reativa tudo na hora.
// O texto integral das entradas removidas: REFERENCIAS-REMOVIDAS-2026-08-26.md.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  let d = 0, st = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; st = true; }
    else if (HTML[j] === '}') { d--; if (st && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao achei ' + name);
}
const iRV = HTML.indexOf('const REF_VOLUME');
const RV = HTML.slice(iRV, HTML.indexOf(String.fromCharCode(10) + '};', iRV) + 3);
const api = new Function(RV + String.fromCharCode(10) + grab('refVolumeMarcar')
  + String.fromCharCode(10) + 'return {refVolumeMarcar, REF_VOLUME};')();

console.log('=== a tabela esta VAZIA, como decidido ===');
ok(Object.keys(api.REF_VOLUME).length === 0,
   'zero entradas no REF_VOLUME (' + Object.keys(api.REF_VOLUME).length + ')');

console.log('=== nenhum julgamento de tamanho dispara mais nada ===');
['Hepatomegalia.', 'Esplenomegalia.', 'Útero aumentado de volume.',
 'Nota-se ectasia ductal retroareolar.', 'Nervo mediano espessado.',
 'Próstata com dimensões aumentadas.', 'Vesícula biliar com dimensões aumentadas.',
 'Espessamento tendineo do supraespinal.', 'Rins com dimensões aumentadas.'
].forEach(f => {
  const r = api.refVolumeMarcar(f, '');
  ok(r.corpo === f && !r.nota && r.usados.length === 0,
     'sem asterisco e sem rodape: "' + f.slice(0, 40) + '"');
});

console.log('=== o mecanismo continua PRONTO para as entradas voltarem ===');
api.REF_VOLUME.injetada = { termos: [/hepatomegalia/i], ref: 'teste: ate 99 cm', fonte: 'Fonte X' };
const r2 = api.refVolumeMarcar('Hepatomegalia.', '');
ok(r2.corpo === 'Hepatomegalia*.' && /ate 99 cm — Fonte X/.test(r2.nota),
   'entrada nova reativa asterisco e rodape na hora');

console.log('=== os tres caminhos do laudo continuam LIGADOS ao mecanismo ===');
ok((HTML.match(/refVolumeMarcar\(/g) || []).length >= 4,
   'refVolumeMarcar segue chamado na geracao, na regeracao e na reabertura');

console.log('=== o que saiu esta arquivado, nao perdido ===');
const arq = path.join(__dirname, '..', 'REFERENCIAS-REMOVIDAS-2026-08-26.md');
ok(fs.existsSync(arq) && /Sienz/.test(fs.readFileSync(arq, 'utf8')),
   'REFERENCIAS-REMOVIDAS-2026-08-26.md guarda a tabela antiga na integra');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
