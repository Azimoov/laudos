// CALIBRE DUCTAL NO RODAPE: SAIU JUNTO COM A TABELA (decisao do medico, 26/08/2026).
//
// Esta suite nasceu para garantir que a referencia do ducto so aparecia com ACHADO
// ductal (nunca em mama normal). Com o REF_VOLUME zerado a pedido dele, o congelado
// agora e: ectasia/dilatacao ductal NAO gera asterisco nem rodape — em nenhum caso.
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
  + String.fromCharCode(10) + 'return {refVolumeMarcar};')();
[
 ['mama NORMAL segue limpa', 'Pele integra. Parenquima homogeneo. Ausencia de dilatacao dos ductos.'],
 ['ectasia ductal: SEM rodape (tabela zerada)', 'Nota-se ectasia ductal retroareolar.'],
 ['dilatacao ductal: SEM rodape', 'Ha dilatação ductal periferica de 0,4 cm.']
].forEach(par => {
  const r = api.refVolumeMarcar(par[1], '');
  ok(r.corpo === par[1] && !r.nota, par[0]);
});
console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
