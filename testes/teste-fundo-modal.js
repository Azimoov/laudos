// O MODAL "FUNDO DOS LAUDOS" QUE EMPILHAVA — 24/08/2026, defeito visto em atendimento.
//
// Cada chamada de escolherFundo() criava um overlay NOVO. Gerar duas vezes (ou gerar e
// depois "refazer com o exame anterior") empilhava dois modais IDENTICOS, um sobre o
// outro. O medico clicava, o de cima sumia, o de baixo continuava — parecia que o clique
// nao fez nada e que o laudo "nao gerou". Ele clicava em gerar de novo e empilhava mais.
// Pior: gerarLaudo() ESPERA esse dialogo na PRIMEIRA linha (await garantirFundo()), entao
// enquanto ele nao for respondido nada acontece — nem uma linha no diario.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function corpoDe(nome) {
  let i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
const ESC = corpoDe('escolherFundo');

console.log('=== um dialogo de cada vez ===');
ok(/var _fundoPromessa=null;/.test(HTML), 'ha uma promessa unica guardada');
ok(/if\(_fundoPromessa\) return _fundoPromessa;/.test(ESC),
   'quem chega com a pergunta ja aberta ESPERA A MESMA — nao abre outra');
ok(/_fundoPromessa=new Promise/.test(ESC), 'a promessa e guardada ao abrir');
ok(/_fundoPromessa=null; resolve\(/.test(ESC),
   'e liberada ao responder — senao a proxima sessao nunca mais perguntaria');
ok(ESC.indexOf('_fundoPromessa=null') < ESC.indexOf('resolve(window.__fundo)'),
   'a liberacao vem ANTES do resolve (quem espera ja encontra o campo limpo)');

console.log('=== rede de seguranca ===');
ok(/function fundoLimparRepetidos/.test(HTML),
   'ha uma limpeza para o caso de sobrar modal repetido na tela');

console.log('=== o que NAO pode ter mudado ===');
ok(/window\.__fundoPerguntado=true/.test(ESC), 'responder continua marcando que ja perguntou');
ok(/garantirFundo\(\)\{ return window\.__fundoPerguntado \? Promise\.resolve/.test(HTML),
   'e garantirFundo continua nao perguntando duas vezes na mesma sessao');
ok(/z-index:100000/.test(ESC), 'o modal continua acima de todas as telas cheias (z 9000-9999)');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
