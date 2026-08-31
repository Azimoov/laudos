// OBSTETRICO: COMO OS NUMEROS SAO ESCRITOS — 31/08/2026, pedidos do medico (itens 4 e 5).
//
// ITEM 5: "a idade gestacional e um numero de semanas... em situacoes onde um numero e
// redondo, e preciso que seja dito por exemplo: 25 semanas e 0 dias."
// Antes, semana redonda saia SEM a parte dos dias ("25 semanas"), e ler assim deixa no ar
// se o dado e exato ou arredondado. Dizer "e 0 dias" afirma que a conta fechou na semana.
//
// ITEM 4: o percentil do peso fetal tem de ser numero redondo. Conferido em 31/08 nos
// laudos reais: os 17 percentis ja saiam inteiros — mas por SORTE, nao por regra (nada no
// pedido a IA falava disso, e a regra da "uma casa decimal" de 26/08 podia contaminar).
// Agora ha regra explicita.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  let i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
eval(grab('obstParseIG'));
eval(grab('obstIgTexto'));

console.log('=== a idade gestacional SEMPRE diz os dias (item 5) ===');
[['25w', '25 semanas e 0 dias', 'semana redonda diz "e 0 dias" — era o pedido'],
 ['25w0d', '25 semanas e 0 dias', 'o aparelho escrevendo 0d da no mesmo'],
 ['25s', '25 semanas e 0 dias', 'e no formato com "s" tambem'],
 ['34w2d', '34 semanas e 2 dias', 'com dias, como sempre foi'],
 ['39w6d', '39 semanas e 6 dias', 'no fim da gestacao'],
 ['34 semanas e 1 dia', '34 semanas e 1 dia', 'UM dia continua no singular']]
  .forEach(([entrada, esperado, oque]) => {
    const saiu = obstIgTexto(obstParseIG(entrada));
    ok(saiu === esperado, oque + '  [' + entrada + ' -> ' + saiu + ']');
  });
// zero e PLURAL em portugues: "0 dias", nunca "0 dia"
ok(obstIgTexto({ sem: 30, dias: 0 }).endsWith('0 dias'), 'zero e plural: "0 dias", nao "0 dia"');
ok(obstIgTexto(null) === '', 'sem idade gestacional, texto vazio (nao inventa)');

console.log('\n=== o calculador ja escrevia certo — nao foi mexido ===');
// as duas linhas do calculador (DUM e CCN) sempre disseram os dias e ja tratavam o plural
const calc = (HTML.match(/IG de '\+Math\.floor\([^)]+\)\+' semana'[^\n]*/g) || []);
ok(calc.length === 2, 'as duas linhas do calculador continuam la  [' + calc.length + ']');
ok(calc.every(l => /dia'\+\((?:dias|dg)%7===1\?'':'s'\)/.test(l)),
   'e cada uma resolve o plural pelo proprio numero de dias');

console.log('\n=== percentil e peso fetal: numeros redondos (item 4) ===');
ok(HTML.indexOf('NÚMEROS INTEIROS, SEM CASA DECIMAL NENHUMA') >= 0,
   'a regra existe no pedido a IA');
ok(HTML.indexOf("percentil 64' e 'Peso fetal: 2658 g'") >= 0,
   'com exemplo do certo');
ok(/nunca 'percentil 64,3'/.test(HTML), 'e do errado');
ok(/A regra da casa decimal acima vale para MEDIDAS e VOLUMES, não para estes dois/.test(HTML),
   'e diz que a regra da casa decimal (26/08) NAO se aplica a eles — senao uma briga com a outra');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
