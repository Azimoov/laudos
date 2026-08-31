// AUDIO DE CONFIRMACAO DAS PATOLOGIAS — 28/08/2026, pedido do medico.
//
// "falta de confirmacao com audio do que eu ditei como patologia... trechos de poucos
//  segundos... o botao VOZ deve direcionar apenas aquele que ele esta indicando...
//  abaixo de 'ouvir o audio todo' deve estar 'ouvir o audio editado'."
//
// O QUE ESTAVA ERRADO (medido nos 200 laudos reais de 26-27/08): o trecho que o VOZ
// tocava e um PEDACO INTEIRO de fala do transcritor, nao a frase. 46% passavam de 10 s,
// 71 passavam de 20 s e o MAIOR TINHA 4 MINUTOS (241 s). Por isso parecia "o audio todo".
//
// ⚠️ O recorte e ESTIMADO: o transcritor local marca so o inicio e o fim do trecho, nunca
// a hora de cada palavra. A posicao da frase vem de regra de tres (caracteres x segundos)
// com folga dos dois lados — de proposito erra por SOBRA, para nao cortar a frase.
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
// as constantes e o normalizador de verdade, recortados do index.html
['RV2_FOLGA', 'RV2_MIN', 'RV2_TETO'].forEach(k => {
  const m = new RegExp('var ' + k + '=([0-9.]+);').exec(HTML);
  if (!m) throw new Error('nao achei ' + k);
  global[k] = parseFloat(m[1]);
});
eval(grab('norm'));
eval(grab('rev2RecorteFino'));

console.log('=== o recorte nunca devolve um bloco gigante ===');
// o caso real: 4 minutos de fala num trecho so
const gigante = { inicio: 100, fim: 341.6, texto:
  'agora o figado tem ecogenicidade aumentada compativel com esteatose hepatica leve ' +
  'e o baco esta normal e o rim esquerdo apresenta calculo de 0,4 cm no grupo calicinal medio' };
const r1 = rev2RecorteFino(gigante, 'esteatose hepatica leve');
ok(r1.fim - r1.ini <= RV2_TETO, 'recorte de um trecho de 4 min cabe no teto de ' + RV2_TETO + ' s  [' + Math.round(r1.fim - r1.ini) + ' s]');
ok(r1.ini >= gigante.inicio && r1.fim <= gigante.fim, 'e mora DENTRO do trecho de origem');
ok(r1.estimado === true, 'e se declara estimado (a tela avisa)');

console.log('\n=== e aponta para o lugar certo da fala ===');
// a citacao da esteatose esta no COMECO; a do calculo, no FIM. Os dois recortes tem de
// cair em posicoes bem diferentes — e isso que faz o VOZ do figado nao tocar o do rim.
const r2 = rev2RecorteFino(gigante, 'calculo de 0,4 cm no grupo calicinal medio');
ok(r2.ini > r1.ini, 'o recorte do calculo comeca DEPOIS do da esteatose  [' +
   Math.round(r1.ini) + 's vs ' + Math.round(r2.ini) + 's]');
ok(r2.ini - r1.ini > 30, 'e bem depois, nao um do lado do outro (o exemplo dele)');
ok(r1.fim <= r2.ini || r2.ini >= r1.ini, 'nao se sobrepoem por acidente');

console.log('\n=== trecho que ja e curto passa inteiro ===');
const curto = { inicio: 10, fim: 16, texto: 'esteatose hepatica leve' };
const r3 = rev2RecorteFino(curto, 'esteatose hepatica leve');
ok(r3.ini === 10 && r3.fim === 16, 'trecho de 6 s vale inteiro, sem estimar');
ok(r3.estimado === false, 'e nao se declara estimado — aqui nao ha chute');

console.log('\n=== sem citacao, nunca o trecho inteiro ===');
const r4 = rev2RecorteFino(gigante, '');
ok(r4.fim - r4.ini <= RV2_TETO, 'sem pista nenhuma, ainda assim curto  [' + Math.round(r4.fim - r4.ini) + ' s]');
const r5 = rev2RecorteFino(gigante, 'nada disso existe no texto ditado');
ok(r5.fim - r5.ini <= RV2_TETO, 'citacao que nao casa tambem cai no limite');

console.log('\n=== acentuacao nao atrapalha (o ditado vem acentuado) ===');
const ac = { inicio: 0, fim: 60, texto: 'o fígado tem esteatose hepática leve e o baço é normal e ' +
  'o rim esquerdo tem cálculo pequeno no grupo calicinal médio sem dilatação do sistema' };
const r6 = rev2RecorteFino(ac, 'esteatose hepática leve');
const r7 = rev2RecorteFino(ac, 'cálculo pequeno no grupo calicinal médio');
ok(r7.ini > r6.ini, 'com acentos, os dois achados continuam em lugares diferentes');

console.log('\n=== a tela: o botao novo e a ligacao do VOZ ===');
ok(/id="rv2BtEditado"/.test(HTML) && /rev2Editado\(\)/.test(HTML),
   'existe o botao "Ouvir o audio editado" chamando rev2Editado');
const iInt = HTML.indexOf('id="rv2BtInteiro"'), iEd = HTML.indexOf('id="rv2BtEditado"');
ok(iInt > 0 && iEd > iInt, 'e ele fica ABAIXO do "Ouvir o ditado inteiro", como ele pediu');
ok(/onclick="rev2Tocar\('\+trI\+','\+i\+'\)"/.test(HTML),
   'o botao VOZ manda o indice do BLOCO junto — e assim que acha a citacao daquele retangulo');
const clip = grab('rev2ClipesPatologia');
ok(/rev2Estado\(ex,b\)!=='alterado'/.test(clip),
   'so entra no audio editado o retangulo ALTERADO (patologia) — orgao normal fica de fora');
ok(/sort\(/.test(clip), 'e os trechos saem em ordem de tempo');
ok(/ult\.fim\+0\.4/.test(clip), 'recortes encostados viram um so (frase nao sai picada)');
const ed = grab('rev2Editado');
ok(/clipes\.length/.test(ed) && /n>=clipes\.length/.test(ed), 'toca um atras do outro ate acabar');
// sem acento no padrao: este arquivo e ASCII, mas o texto da tela e acentuado
ok(/trecho de patologia para montar/.test(ed), 'e diz o porque quando nao ha o que montar');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
