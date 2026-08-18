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
ok(/border:3px solid #0B5F5C/i.test(viva || ''), 'borda de 3px no verde escuro');
// 18/08: o anel era um verde translucido que se perdia; agora e cor CHEIA
ok(/box-shadow:0 0 0 5px #12B5AC/i.test(viva || ''),
   'o anel usa o verde-agua ACESO e opaco (#12B5AC), nao um tom translucido');
ok(!/rgba\(14,110,107,\.32\)/.test(viva || ''), 'o anel lavado de antes saiu');
ok(/animation:rv2Pisca/.test(viva || ''), 'com um piscar no momento do toque');
ok(/@keyframes rv2Pisca/.test(HTML), 'e o piscar esta definido');
ok(/rgba\(18,181,172,1\)/.test(HTML), 'o piscar comeca na cor cheia');
ok(/z-index:10/.test(viva || ''), 'aparecendo por cima das vizinhas');

console.log('=== 4. passar o mouse mostra a foto GRANDE, fora do quadradinho ===');
// 18/08/2026: crescer a propria miniatura NAO resolve — a grade tem rolagem
// (overflow) e corta tudo que passa da borda dela. Era por isso que a foto "so
// aumentava dentro do quadradinho". A foto grande passou a ser um elemento
// separado (#rv2Lupa), que vive FORA da grade e nao e cortado por nada.
ok(/<img id="rv2Lupa"/.test(HTML), 'existe o elemento da foto ampliada (a lupa)');
ok(!/#telaRev2 [^{]*#rv2Lupa/.test(HTML) && /#rv2Lupa\{position:fixed/.test(HTML),
   'ela e posicionada na TELA (fixed), nao dentro da grade');
ok(/z-index:9999/.test(regra('#rv2Lupa') || ''), 'e fica por cima de tudo');
ok(/pointer-events:none/.test(regra('#rv2Lupa') || ''), 'sem roubar o clique da miniatura');
ok(/object-fit:contain/.test(regra('#rv2Lupa') || ''),
   'mostra a imagem INTEIRA (a miniatura e cortada; aqui o medico quer ver tudo)');
const lupaJs = (function () {
  const i = HTML.indexOf('function rev2LupaMostrar(');
  return i < 0 ? '' : HTML.slice(i, HTML.indexOf('\nfunction rev2LupaEsconder'));
})();
ok(/r\.width\*3/.test(lupaJs), 'o tamanho e ~300% da miniatura (pedido de 18/08)');
ok(/window\.innerWidth/.test(lupaJs) && /window\.innerHeight/.test(lupaJs),
   'e ela nunca sai da tela, por maior que a foto seja');
ok(/function rev2LupaEsconder/.test(HTML) && /mouseout/.test(HTML),
   'some quando o mouse sai da foto');
ok(/addEventListener\('scroll', rev2LupaEsconder/.test(HTML),
   'e tambem ao rolar a lista de fotos (senao ficaria flutuando sozinha)');
ok(/rev2LupaEsconder\(\); \}catch\(e\)\{\} \}/.test(HTML),
   'e ao fechar a tela de revisao');
ok((HTML.match(/_rv2LupaLigada/g) || []).length === 3,
   'os ouvintes sao ligados UMA vez (a lista de fotos e redesenhada a cada laudo)');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
