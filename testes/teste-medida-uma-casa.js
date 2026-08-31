// MEDIDAS COM UMA CASA DECIMAL — 26/08/2026 (noite), regra ditada pelo medico:
// "as medidas so devem ter uma casa decimal depois da virgula. Se for de 0 ate 5,
//  deve ser arredondado para baixo. Se for de 6 ate 9 deve ser arredondado para cima.
//  exemplo: 0,48 vira 0,5. exemplo 2: 2,72 vira 2,7."
// Atencao: e uma regua DIFERENTE da escola — o 5 CAI (0,45 vira 0,4).
// Supersede o "ate 2 casas" da manha de 26/08 (o teste antigo nao congelava cmTxt).
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

console.log('=== a regua dele, numero a numero (cmTxt recebe MILIMETRO) ===');
const cmTxt = eval('(' + grab('cmTxt') + ')');
const casos = [
  [4.8, '0,5', 'o exemplo dele: 0,48 vira 0,5 (8 sobe)'],
  [27.2, '2,7', 'o exemplo 2 dele: 2,72 vira 2,7 (2 cai)'],
  [6.3, '0,6', '0,63 vira 0,6 (3 cai) — antes saia 0,63'],
  [4.5, '0,4', '0,45 vira 0,4 — o 5 CAI, diferente da escola'],
  [12.6, '1,3', '1,26 vira 1,3 (6 sobe)'],
  [6, '0,6', 'medida ja com uma casa nao muda'],
  [30, '3', 'numero redondo sai sem zeros a toa'],
  [19.9, '2', '1,99 vira 2 (9 sobe) — e sem virgula sobrando'],
];
casos.forEach(c => ok(cmTxt(c[0]) === c[1], c[2] + '  [' + cmTxt(c[0]) + ']'));
ok(cmTxt(null) === '' && cmTxt(undefined) === '' && cmTxt(NaN) === '', 'sem valor, sem texto (nunca "NaN" no laudo)');

console.log('\n=== e a IA recebe a MESMA regua (medidas que ela escreve do ditado) ===');
ok(HTML.indexOf('MEDIDAS COM UMA CASA DECIMAL') >= 0, 'a regra esta no prompt da IA');
ok(HTML.indexOf('0,48 cm vira 0,5 cm') >= 0 && HTML.indexOf('2,72 cm vira 2,7 cm') >= 0,
   'com os exemplos ditados por ele, palavra por palavra');
ok(HTML.indexOf('segunda casa de 0 a 5 CAI') >= 0, 'e a regua explicita: 0-5 cai, 6-9 sobe');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
