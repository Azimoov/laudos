// OS BOTOES DE FORMATACAO DA TELA DE LIBERACAO — 31/08/2026.
// "O botao de negrito nao esta funcionando na tela de liberacao de laudos, e eu nao sei
//  quais outros botoes tambem nao estao funcionando" — dele.
//
// O PROGRAMA TEM DUAS BARRAS DE FORMATACAO, e e por isso que o conserto de 30/08 nao
// resolveu esta tela:
//   1. #barraFormato — nasce na tela de revisao antiga e e emprestada para o "Ver o
//      laudo final". Foi a corrigida em 30/08.
//   2. #telaRev2 .fmt — a da tela de LIBERACAO, com os retangulos. Ficou de fora.
// Quem acrescentar uma terceira barra: a trava de foco vale para ela tambem.
//
// DOIS DEFEITOS DIFERENTES:
// A) O BOTAO ROUBAVA O FOCO. Um <button> comum, ao ser pressionado, tira o cursor do
//    texto; quando o clique termina, a selecao ja nao e a que ele fez e o comando cai no
//    vazio. Cura: impedir o padrao do MOUSEDOWN (nao do click).
// B) "ZERAR FORMATACAO" NAO ZERAVA. O `removeFormat` do navegador nao desmonta
//    <b>/<i>/<u> — medido: com o trecho em negrito selecionado, devolvia o texto igual.
//    E ele ainda DESFAZ A SELECAO, entao tentar desligar o negrito depois dele tambem
//    falhava (execCommand devolvia false). Por isso os tres formatos saem ANTES.
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
function barra(abre, fecha) {
  const i = HTML.indexOf(abre);
  return HTML.slice(i, HTML.indexOf(fecha, i));
}

console.log('=== AS DUAS barras existem, e as DUAS estao protegidas ===');
const b1 = barra('<div id="barraFormato">', '</div>');
const b2 = barra('<div class="fmt">', '</div>\n\n      <div class="duas">');
[['barra da tela final (#barraFormato)', b1], ['barra da tela de LIBERACAO (.fmt)', b2]]
  .forEach(([nome, txt]) => {
    const bts = txt.match(/<button[^>]*>/g) || [];
    ok(bts.length >= 3, nome + ': tem botoes  [' + bts.length + ']');
    ok(bts.every(b => /onmousedown="event\.preventDefault\(\)"/.test(b)),
       nome + ': TODOS impedem o mousedown (sem isso o foco sai do texto)');
  });
// e nenhuma barra do programa pode ficar de fora
const todasBarras = (HTML.match(/<button[^>]*onclick="fmt(Cmd|Zerar)\(/g) || []);
ok(todasBarras.every(b => /onmousedown="event\.preventDefault\(\)"/.test(b)),
   'nenhum botao de formatacao no programa inteiro ficou sem a trava  [' + todasBarras.length + ']');

console.log('\n=== zerar formatacao tira o que o laudo carrega ===');
const zerar = grab('fmtZerar');
ok(/\['bold','italic','underline'\]/.test(zerar),
   'desliga explicitamente negrito, italico e sublinhado');
ok(/queryCommandState\(k\)/.test(zerar), 'perguntando o estado de cada um');
// ⚠️ a ordem e o conserto: removeFormat desfaz a selecao
const semComentario = zerar.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok(semComentario.indexOf("'bold','italic','underline'") < semComentario.indexOf('removeFormat'),
   'e os tres saem ANTES do removeFormat, que desfaz a selecao');
ok(/fmtEditavelDaSelecao\(\)/.test(zerar), 'so age dentro de um campo editavel');
ok(/fmtAvisar\(/.test(zerar), 'e avisa quando falta selecao, em vez de falhar calado');
ok(HTML.indexOf('onclick="fmtCmd(\'removeFormat\')"') < 0,
   'nenhum botao chama mais o removeFormat cru (que nao zerava)');

console.log('\n=== o retangulo grava no blur, e a trava nao atrapalha isso ===');
// A trava impede o blur AO CLICAR NO BOTAO — de proposito. O retangulo grava quando ele
// clica em QUALQUER outro lugar, e nada redesenha esta tela sozinha (sem temporizador).
ok(/onblur="rev2Editou\(this\)"/.test(HTML), 'o retangulo grava ao perder o foco');
ok(!/setInterval\([^)]*rev2Render/.test(HTML),
   'e nada redesenha a tela de liberacao sozinho (a formatacao nao se perde esperando)');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
