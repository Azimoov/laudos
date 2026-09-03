// OUVIR O ÁUDIO: O EXAME INTEIRO, SEM OS SILÊNCIOS — 02/09/2026, pedido do Dr. Daniel.
//
// "Esses dois botões devem sair, devem dar lugar a um botão apenas dizendo ouvir o
// áudio, e esse áudio deve ser o áudio do exame completo, exceto pelas partes de
// silêncio."
//
// Saíram: "Ouvir o ditado inteiro" (19/08) e "Ouvir o áudio editado — só as
// patologias" (28/08). Entrou um só.
//
// POR QUE VALE TANTO, medido nos 40 exames mais recentes com marcação de tempo:
// 196 minutos de gravação para 98 minutos de fala. METADE do áudio é silêncio.
//
// COMO O SILÊNCIO É ACHADO: não se analisa a onda sonora. O transcritor já diz onde
// houve fala; silêncio é o que sobra entre os trechos. É exato, sai de graça, e não
// depende de um limiar de volume que erraria com o ar-condicionado ligado.
//
// O LIMITE DE 1 SEGUNDO foi medido em 792 pausas reais antes de ser escolhido:
//   acima de 0,5 s -> tira 97 min      acima de 1,5 s -> tira 94 min
//   acima de 1,0 s -> tira 96 min      acima de 2,0 s -> tira 93 min
// Um segundo pega quase todo o ganho E preserva a respiração entre frases.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}

// as constantes vêm do próprio index.html: assim o teste vigia o valor de verdade,
// e mudá-lo no código sem pensar quebra aqui.
const RV2_PAUSA_MAX = parseFloat(/var RV2_PAUSA_MAX *= *([\d.]+)/.exec(HTML)[1]);
const RV2_FOLGA_FALA = parseFloat(/var RV2_FOLGA_FALA *= *([\d.]+)/.exec(HTML)[1]);

// dependências de mentira, para a função rodar isolada
let TRECHOS = [], URL_DE = () => ({ url: 'exame.wav' });
const rev2Ex = () => ({ id: 1, laudo: { trechos: TRECHOS } });
const audios = [{ exameId: 1, url: 'exame.wav' }];
const rev2AudioDoTrecho = (lista, t) => URL_DE(t);
eval(grab('rev2ClipesSemSilencio'));

const T = (ini, fim) => ({ inicio: ini, fim: fim });

console.log('=== os números escolhidos estão no código ===');
ok(RV2_PAUSA_MAX === 1.0, 'corta silêncio acima de 1 segundo  [' + RV2_PAUSA_MAX + ']');
ok(RV2_FOLGA_FALA === 0.25, 'e deixa 0,25 s de respiro nas pontas  [' + RV2_FOLGA_FALA + ']');

console.log('\n=== silêncio longo vira corte ===');
TRECHOS = [T(0, 5), T(30, 35)];          // 25 s calado no meio
let b = rev2ClipesSemSilencio();
ok(b.length === 2, 'duas falas separadas por 25 s viram DOIS blocos  [' + b.length + ']');
const ouvido = b.reduce((s, x) => s + (x.fim - x.ini), 0);
ok(ouvido < 12, 'e o que se ouve encolhe de 35 s para ~10 s  [' + ouvido.toFixed(1) + ' s]');

console.log('\n=== pausa curta FICA: é a respiração da fala ===');
TRECHOS = [T(0, 5), T(5.6, 9)];          // 0,6 s entre frases
b = rev2ClipesSemSilencio();
ok(b.length === 1, 'pausa de 0,6 s não corta nada  [' + b.length + ' bloco]');
ok(b[0].ini === 0 && Math.abs(b[0].fim - 9.25) < 0.01,
   'o bloco vai do começo ao fim, com o respiro só na ponta livre');

console.log('\n=== o limite é 1 segundo, e ele é firme dos dois lados ===');
TRECHOS = [T(0, 5), T(5.9, 9)];          // 0,9 s -> junta
ok(rev2ClipesSemSilencio().length === 1, 'pausa de 0,9 s: junta');
TRECHOS = [T(0, 5), T(6.2, 9)];          // 1,2 s -> corta
ok(rev2ClipesSemSilencio().length === 2, 'pausa de 1,2 s: corta');

console.log('\n=== a folga nunca faz dois blocos se sobreporem ===');
// Sem limitar a folga pela pausa que existe de fato, um bloco entraria no outro e a
// fala seria ouvida duas vezes — ou pior, o salto voltaria no tempo.
TRECHOS = [T(0, 5), T(6.2, 9)];          // pausa de 1,2 s: cabe 0,6 s de cada lado
b = rev2ClipesSemSilencio();
ok(b[0].fim <= b[1].ini, 'o fim do primeiro não passa do começo do segundo  ['
   + b[0].fim.toFixed(2) + ' <= ' + b[1].ini.toFixed(2) + ']');
ok(b[0].fim > 5, 'mas o respiro entrou mesmo assim  [' + b[0].fim.toFixed(2) + ']');

console.log('\n=== nunca começa antes do zero ===');
TRECHOS = [T(0.1, 4)];
ok(rev2ClipesSemSilencio()[0].ini === 0, 'fala que começa em 0,1 s não puxa o clipe para negativo');

console.log('\n=== gravações diferentes não se fundem ===');
// Dois arquivos são duas gravações: juntá-los daria um salto para outro áudio no meio
// de um bloco, e o tempo de um não vale no outro.
TRECHOS = [T(0, 5), T(5.2, 9)];
URL_DE = (t) => ({ url: t.inicio < 5 ? 'a.wav' : 'b.wav' });
b = rev2ClipesSemSilencio();
ok(b.length === 2, 'mesmo com 0,2 s entre elas, arquivos diferentes ficam separados');
URL_DE = () => ({ url: 'exame.wav' });

console.log('\n=== sem marcação de tempo, devolve vazio (o app toca inteiro) ===');
TRECHOS = [];
ok(rev2ClipesSemSilencio().length === 0, 'ditado sem trechos não inventa bloco nenhum');
TRECHOS = [{ inicio: 3 }, { texto: 'só texto' }];
ok(rev2ClipesSemSilencio().length === 0, 'nem trecho pela metade vira bloco');

console.log('\n=== com um exame REAL (só os tempos, nenhuma palavra) ===');
// Exame de 02/09/2026: 28 trechos, 266,8 s de gravação, 182,8 s de fala.
const REAL = [[0,0.2],[4.3,7.88],[8.5,11.4],[12.02,17.96],[18.54,20.8],[21.12,21.56],
  [37.13,37.87],[38.23,77.73],[78.77,81.91],[82.29,82.73],[86.59,87.63],[87.63,89.71],
  [89.99,93.39],[93.39,96.75],[99.9,101.62],[115.54,116.26],[118.95,121.45],
  [125.41,166.58],[166.58,179.52],[185.04,211.56],[211.56,216.24],[216.24,217.4],
  [222.25,224.73],[224.73,225.87],[225.87,227.79],[248.96,251.92],[252.24,253.86],
  [254.46,266.75]];
TRECHOS = REAL.map(p => T(p[0], p[1]));
b = rev2ClipesSemSilencio();
const bruto = REAL[REAL.length - 1][1] - REAL[0][0];
const total = b.reduce((s, x) => s + (x.fim - x.ini), 0);
console.log('     gravação %ss -> ouvido %ss em %d bloco(s)'
  .replace('%s', bruto.toFixed(1)).replace('%s', total.toFixed(1)).replace('%d', b.length));
ok(total < bruto, 'o áudio encolhe');
ok(total > bruto * 0.6, 'mas não some: sobra a fala toda  [' + Math.round(100 * total / bruto) + '% do original]');
ok(b.length < REAL.length, 'e os 28 trechos viram menos blocos, porque as pausas curtas foram mantidas  ['
   + b.length + ' blocos]');
// os blocos têm de estar em ordem e sem se sobrepor: é o que o tocador espera
let ordenado = true, sobrepoe = false;
for (let i = 1; i < b.length; i++) {
  if (b[i].ini < b[i - 1].ini) ordenado = false;
  if (b[i].ini < b[i - 1].fim) sobrepoe = true;
}
ok(ordenado, 'os blocos saem em ordem de tempo');
ok(!sobrepoe, 'e nenhum invade o anterior');

console.log('\n=== a tela: um botão só, e os dois antigos sumiram ===');
ok(/id="rv2BtAudio"[^>]*onclick="rev2OuvirAudio\(\)"/.test(HTML),
   'existe o botão único chamando rev2OuvirAudio');
ok(/🔊 Ouvir o áudio</.test(HTML), 'e ele se chama "Ouvir o áudio"');
ok(!/id="rv2BtInteiro"/.test(HTML), 'o botão "Ouvir o ditado inteiro" saiu');
ok(!/id="rv2BtEditado"/.test(HTML), 'o botão "Ouvir o áudio editado" saiu');
ok(!/function rev2Editado\(/.test(HTML), 'e a função do áudio editado não ficou como código morto');
ok(!/function rev2ClipesPatologia\(/.test(HTML), 'nem a montagem por patologia');
ok(!/function rev2Inteiro\(/.test(HTML), 'nem a do ditado inteiro');

console.log('\n=== sem marcação de tempo o app ainda toca, e diz por quê ===');
const f = grab('rev2OuvirAudio');
ok(/sem marcação de tempo/.test(f),
   'quando não dá para achar o silêncio, toca inteiro e explica — ouvir com silêncio é melhor que não ouvir');
ok(/rev2PararEditado\(\)/.test(f), 'e uma nova reprodução cancela a anterior');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
