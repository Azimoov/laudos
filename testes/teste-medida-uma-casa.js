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

// ===================================================================================
// 31/08/2026 — AS EXCECOES DO CENTIMETRO
// Pedido dele: "todas as medidas sao em centimetros, mas ha algumas excecoes. 2 delas
// sao endometrio e IPP, que sao medidos em milimetros."
// Centimetro continua sendo o padrao; o que muda e que agora HA uma lista, e ela e o
// unico lugar onde se acrescenta a proxima excecao. Ele disse "algumas" e citou duas —
// a lista foi feita para crescer sem mexer no resto.
console.log('\n=== as excecoes: o que NAO vira centimetro ===');
const mLista = /const MEDIDAS_EM_MM = \[([^\]]*)\]/.exec(HTML);
ok(!!mLista, 'existe uma LISTA de excecoes (nao regra espalhada pelo texto)');
const lista = mLista ? eval('[' + mLista[1] + ']') : [];
ok(lista.some(x => /endom/i.test(x)), 'o endometrio esta nela  [' + lista.join(', ') + ']');
// a sigla E o nome por extenso, os dois: ele dita das duas formas, e a IA reconhece
// pelo que esta escrito aqui (confirmado por ele em 31/08: "IPP e indice de protrusao
// prostatica, isso mesmo").
ok(lista.some(x => /\bIPP\b/.test(x)), 'e o IPP tambem');
ok(lista.some(x => /índice de protrusão prostática/i.test(x)),
   'com o nome por extenso junto, para a IA reconhecer o ditado das duas formas');

const regra = grab('regraDeUnidade');
ok(/TODA medida sai em CENTÍMETROS/.test(regra), 'o padrao continua sendo o centimetro');
ok(/EXCEÇÕES/.test(regra) && /MEDIDAS_EM_MM\.join/.test(regra),
   'e as excecoes sao montadas A PARTIR da lista — nao ha uma segunda copia dos nomes');
ok(/0,8 cm → 8 mm/.test(regra),
   'ditado em centimetro numa excecao e convertido PARA milimetro (o caminho inverso)');
ok(/toda outra medida do mesmo laudo continua em centímetros/.test(regra),
   'e a excecao nao contamina o resto do laudo');
// a instrucao antiga nao pode ter sobrado solta no prompt: duas regras de unidade no
// mesmo pedido e como nasce laudo com metade em cm e metade em mm
ok((HTML.match(/UNIDADE DE MEDIDA \(regra do médico, 26\/08\/2026\)/g) || []).length === 1,
   'a regra de unidade aparece UMA vez so no programa');
ok(/regraDeUnidade\(\)\+/.test(HTML), 'e o pedido a IA a chama, em vez de repetir o texto');
// o modelo do transvaginal ja escrevia o endometrio em mm: a regra so parou de brigar com ele
const dados = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');
ok(/Endométrio homogêneo, medindo \*\*\.\.\.\.\. mm\.\*\*/.test(dados),
   'e o modelo do transvaginal segue pedindo o endometrio em mm, como sempre pediu');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
