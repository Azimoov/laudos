// A PROBABILIDADE DE MALIGNIDADE SAIU DO LAUDO — 24/08/2026, pedido do medico.
//
// A linha da categoria e montada pelo codigo (biradsLinhaCategoria) e saiu limpa. Mas a
// CONCLUSAO e escrita pela IA, que sabe a tabela do BI-RADS de cor e pode reintroduzir a
// frase sozinha. Por isso ha tambem uma peneira (tirarProbabilidade) em todo ponto onde
// texto da IA entra no laudo. O que a peneira NAO pode fazer e apagar categoria ou conduta.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const DADOS = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
const tabela = HTML.match(/const BIRADS_CAT = \{[\s\S]*?\n\};/)[0];
const api = new Function(tabela + '\n' + grab('biradsCategoria') + '\n'
  + grab('biradsLinhaCategoria') + '\n' + grab('tirarProbabilidade')
  + '\nreturn {biradsLinhaCategoria, tirarProbabilidade};')();

console.log('=== a linha do laudo nao traz mais a probabilidade ===');
['1','2','3','4A','4B','4C','5','6','0'].forEach(function (c) {
  const l = api.biradsLinhaCategoria(c, '');
  ok(!/probabilidade/i.test(l), 'BI-RADS ' + c + ': sem "probabilidade" — ' + JSON.stringify(l.split('\n')[0]));
  ok(!/\d\s*%/.test(l), 'BI-RADS ' + c + ': sem percentual');
});

console.log('=== mas categoria e conduta CONTINUAM (sem elas o laudo perde o que importa) ===');
const l3 = api.biradsLinhaCategoria('3', '');
ok(/BI-RADS 3/.test(l3) && /Provavelmente benigno/.test(l3), 'categoria e rotulo seguem na linha');
ok(/Recomendação de conduta: .*6 meses/.test(l3), 'e a conduta segue inteira');
ok(api.biradsLinhaCategoria('4', '').indexOf('BI-RADS 4A') === 0 ||
   /BI-RADS 4A/.test(api.biradsLinhaCategoria('4', '')), 'o 4 sem letra continua assumindo 4A');
ok(api.biradsLinhaCategoria('3', 'Nódulo 1 — ').indexOf('Nódulo 1 — ') === 0,
   'o prefixo de multiplos achados continua funcionando');

console.log('=== a peneira pega o que a IA escreveria por conta propria ===');
const casos = [
  ['Nódulo. Categoria: BI-RADS 3 — Provavelmente benigno. Probabilidade de malignidade: > 0% e ≤ 2%.', 'frase padrao'],
  ['Categoria: BI-RADS 5. Risco de malignidade: ≥ 95%.', 'variante "risco de malignidade"'],
  ['Categoria: BI-RADS 4B. Chance de malignidade: 10 a 50%.', 'variante "chance de malignidade"'],
  ['Achado suspeito (≥ 95% de malignidade) — biópsia.', 'percentual entre parenteses'],
  ['Provavelmente benigno (~2% de malignidade), seguimento.', 'percentual com til entre parenteses'],
];
casos.forEach(function (par) {
  const r = api.tirarProbabilidade(par[0]);
  ok(!/malignidade\s*:/i.test(r) && !/\d\s*%[^)]{0,20}malign/i.test(r),
     par[1] + ' → ' + JSON.stringify(r));
});

console.log('=== e NAO pode apagar o que nao foi pedido ===');
const preserva = api.tirarProbabilidade(
  'Categoria: BI-RADS 5 — Altamente sugestivo de malignidade.\nRecomendação de conduta: Diagnóstico tecidual (biópsia).');
ok(/Altamente sugestivo de malignidade/.test(preserva),
   'o ROTULO "altamente sugestivo de malignidade" fica (nao e percentual)');
ok(/Diagnóstico tecidual/.test(preserva), 'a conduta fica');
const nodulo = api.tirarProbabilidade('Nódulo sólido medindo 12 x 8 mm, a 3 cm da papila.');
ok(nodulo === 'Nódulo sólido medindo 12 x 8 mm, a 3 cm da papila.',
   'texto sem probabilidade passa intacto (medidas nao sao tocadas)');
ok(api.tirarProbabilidade('Esteatose hepática em 30% do parênquima.') ===
   'Esteatose hepática em 30% do parênquima.',
   'percentual que NAO e de malignidade sobrevive (outros exames usam %)');

console.log('=== ligado em todo ponto onde a IA entrega texto ===');
ok(/let conclusaoFinal = tirarProbabilidade\(/.test(HTML), 'na geracao do laudo');
ok(/_conclusaoBase:tirarProbabilidade\(/.test(HTML),
   'e na base guardada — senao voltaria ao resolver uma pendencia na revisao');
ok((HTML.match(/L\.conclusao=tirarProbabilidade\(resp\.conclusao\)/g) || []).length === 2,
   'nos dois caminhos de ajuste/regeracao pela IA na revisao');
ok(!/Probabilidade de malignidade/.test(DADOS),
   'e o modelo de mama em dados.js tambem nao traz mais a frase');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
