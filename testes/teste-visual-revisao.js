// Aparencia da tela de revisao — quatro queixas do Dr. Daniel em 17/08/2026:
//   1. "as letras da selecao do fundo do laudo sao brancas num fundo branco"
//   2. "as cores estao muito lavadas, quero mais vivas"
//   3. "o destaque da foto quando clico em IMG e muito discreto"
//   4. "passar o mouse na foto deveria aumentar ela, e nao acontece"
//
// Este teste le o FOLHETO DE ESTILO do proprio index.html. Nao substitui olhar a
// tela, mas impede que estas quatro correcoes sejam desfeitas sem querer — e foi
// a unica verificacao possivel de fora: o painel de navegador usado no
// desenvolvimento fica oculto e nao desenha quadros, entao transicoes e
// animacoes nunca avancam nele (a foto ficava parada no tamanho inicial mesmo
// com a regra certa aplicada).
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function regra(seletor) {
  const i = HTML.indexOf(seletor + '{');
  if (i < 0) return null;
  return HTML.slice(i + seletor.length + 1, HTML.indexOf('}', i));
}

console.log('=== 1. a letra do seletor de fundo NAO pode sumir no branco ===');
const sel = regra('#telaRev2 .cab select');
ok(!!sel, 'a regra do seletor existe');
ok(/color:#12202B/i.test(sel || ''), 'a cor da letra e escura e EXPLICITA (nao herdada)');
ok(/background:#fff/i.test(sel || ''), 'sobre fundo branco');
ok(/#telaRev2 \.cab select option\{[^}]*color:#12202B/i.test(HTML),
   'e as opcoes da lista tambem tem cor propria');

console.log('=== 2. cores vivas, nao lavadas ===');
const alterado = regra('#telaRev2 .bloco.alterado');
ok(/background:#DCF0EE/i.test(alterado || ''), 'o alterado ganhou fundo mais saturado');
ok(/border-color:#0E6E6B/i.test(alterado || ''), 'e borda no tom CHEIO da paleta');
ok(/#telaRev2 \.bloco\.alterado \.tit\{color:#0B5F5C/i.test(HTML), 'com o titulo no verde escuro');
ok(/#telaRev2 \.bloco \.barra\{width:7px\}/.test(HTML), 'a barra de cor engrossou (5px -> 7px)');
[['falta', '#FBE0E0'], ['conflito', '#FBEFD2'], ['ia', '#FBE6F0']].forEach(function (p) {
  ok(new RegExp('background:' + p[1], 'i').test(regra('#telaRev2 .bloco.' + p[0]) || ''),
     'o estado "' + p[0] + '" tambem ficou mais vivo');
});
ok(/#telaRev2 \.lg\.on\{[^}]*font-weight:700/.test(HTML),
   'o alerta ACESO fica em negrito (antes se parecia com o apagado)');

console.log('=== 3. o destaque da foto (botao IMG) tem de saltar aos olhos ===');
const viva = regra('#telaRev2 .grade img.viva');
ok(/border:3px solid #0E6E6B/i.test(viva || ''), 'borda de 3px no verde cheio (era 2,5px)');
ok(/transform:scale\(1\.12\)/.test(viva || ''), 'a foto citada cresce um degrau');
ok(/box-shadow:0 0 0 4px/.test(viva || ''), 'e ganha um halo em volta');
ok(/animation:rv2Pisca/.test(viva || ''), 'com um piscar no momento do toque');
ok(/@keyframes rv2Pisca/.test(HTML), 'e o piscar esta definido');
ok(/z-index:10/.test(viva || ''), 'aparecendo por cima das vizinhas');

console.log('=== 4. passar o mouse aumenta a foto ===');
const hover = regra('#telaRev2 .grade img:hover');
ok(!!hover, 'a regra de passar o mouse existe');
ok(/transform:scale\(1\.9\)/.test(hover || ''), 'a foto quase dobra de tamanho');
ok(/z-index:20/.test(hover || ''), 'e sobe por cima das outras (nao empurra a grade)');
ok(/transition:transform/.test(regra('#telaRev2 .grade img') || ''),
   'o crescimento e suave, nao um salto');
ok(/#telaRev2 \.grade img\.viva:hover\{transform:scale\(1\.9\)\}/.test(HTML),
   'a foto ja destacada tambem cresce ao passar o mouse');
ok(/padding:6px 8px 6px 6px/.test(regra('#telaRev2 .grade') || ''),
   'a grade tem folga em volta para a foto crescer sem ser cortada');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
