// ABRIR LAUDO ANTIGO DO HISTÓRICO — 21/08/2026.
//
// O médico tocou em "Abrir laudo" e recebeu DUAS mensagens sem sentido: "o navegador
// bloqueou a janela" e uma caixa do Windows oferecendo procurar na Microsoft Store um
// aplicativo para abrir um link 'about'.
//
// A causa: window.open('', '_blank'). A janela do programa NÃO é um navegador — o pywebview
// não tem abas. O window.open devolvia nulo (daí a primeira mensagem) ou empurrava um
// about:blank para o Windows resolver (daí a segunda).
//
// Esta suíte existe para não voltar a supor navegador onde há um programa de mesa.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// sem comentários: eles falam de window.open justamente para explicar por que ele saiu
const CODIGO = HTML.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

console.log('=== nada de window.open num programa de mesa ===');
ok(!/window\.open\s*\(/.test(CODIGO),
   'window.open não é usado em lugar nenhum — a janela do programa não tem abas');
ok(!/o navegador bloqueou a janela/.test(CODIGO),
   'e a mensagem que falava em "navegador" saiu junto com a causa dela');

console.log('\n=== o laudo antigo abre DENTRO da janela ===');
ok(/id="telaVerLaudo"/.test(HTML), 'existe a tela de leitura');
ok(/id="areaImpressaoHist"/.test(HTML), 'com a área onde o laudo é desenhado');
const abrir = CODIGO.slice(CODIGO.indexOf('abrindo o laudo guardado'), CODIGO.indexOf('function hisFecharLaudo'));
ok(/areaImpressaoHist.*innerHTML=html/s.test(abrir), 'o HTML guardado é escrito nela');
ok(/telaVerLaudo.*style\.display='block'/s.test(abrir), 'e a tela é mostrada');
ok(/classList\.add\('verHist'\)/.test(abrir), 'marcando no body que é laudo do histórico');

console.log('\n=== e abre POR CIMA, não por trás ===');
// A primeira versão saiu com z-index 60 enquanto TODAS as telas cheias deste app usam
// 9000. Ela abria atrás do histórico, que é opaco — de fora parecia que o botão não fazia
// nada, exatamente como antes do conserto. Bug corrigido reaparecendo com outra cara.
const zTelas = (HTML.match(/#tela[A-Za-z]+\{position:fixed;inset:0;z-index:(\d+)/g) || [])
  .map(s => +/z-index:(\d+)/.exec(s)[1]);
ok(zTelas.length >= 4, 'as telas cheias do app têm z-index declarado (' + zTelas.length + ')');
const zVer = +/id="telaVerLaudo"[^>]*z-index:(\d+)/.exec(HTML)[1];
ok(zVer >= Math.max.apply(null, zTelas),
   'e a tela de leitura fica em cima de todas (' + zVer + ' contra ' + Math.max.apply(null, zTelas) + ')');
const abrir2 = CODIGO.slice(CODIGO.indexOf('abrindo o laudo guardado'), CODIGO.indexOf('function hisFecharLaudo'));
ok(/telaHistorico.*display='none'/s.test(abrir2),
   'e o histórico sai da frente — duas telas cheias empilhadas deixam a rolagem do fundo viva');

console.log('\n=== dá para sair, e sair limpa ===');
const fechar = CODIGO.slice(CODIGO.indexOf('function hisFecharLaudo'), CODIGO.indexOf('function hisFecharLaudo') + 500);
ok(/display='none'/.test(fechar), 'fechar esconde a tela');
ok(/classList\.remove\('verHist'\)/.test(fechar), 'e tira a marca do body');
ok(/innerHTML=''/.test(fechar),
   'e esvazia a área — laudo de outro paciente não fica pendurado na memória');
ok(/onclick="hisFecharLaudo\(\)"/.test(HTML), 'e há um botão que chama isso');

console.log('\n=== a impressão sai de graça, reaproveitando o CSS que já existia ===');
const printCss = HTML.slice(HTML.indexOf('@media print{'), HTML.indexOf('@page{size:A4;margin:8mm;}'));
ok(/body \*\{visibility:hidden;\}/.test(printCss), 'a regra base esconde tudo…');
ok(/#areaImpressaoHist,#areaImpressaoHist \*\{visibility:visible;\}/.test(printCss),
   '…e a área do laudo antigo ganhou o mesmo tratamento da área da revisão');
ok(/body\.verHist #areaImpressao,body\.verHist #areaImpressao \*\{visibility:hidden;\}/.test(printCss),
   'e quando o antigo está aberto, a área da REVISÃO é escondida à força — senão sairiam '
   + 'dois laudos na mesma impressão');
ok(/#telaVerLaudo > div:first-child\{display:none;\}/.test(printCss),
   'a barra de botões não vai para o papel');
ok(/onclick="window\.print\(\)"/.test(HTML), 'e há botão de imprimir na tela de leitura');

console.log('\n=== a nota explica por que este não é editável ===');
ok(/não ficam guardadas no histórico/.test(CODIGO),
   'diz que as imagens não ficam guardadas — é por isso que ele abre só para leitura');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
