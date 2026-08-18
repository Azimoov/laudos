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
ok(/window\.innerWidth\*0\.5/.test(lupaJs),
   'o tamanho sai da TELA, nao da miniatura (300% ainda ficava pequeno numa tela grande)');
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

console.log('=== 5. a foto CRESCE e ENCOLHE (18/08, "como na 1.0") ===');
const lupaCss = regra('#rv2Lupa');
ok(/opacity:0/.test(lupaCss || '') && /transform:scale\(\.16\)/.test(lupaCss || ''),
   'ela nasce BEM pequena (16%) e invisivel — 18/08: "o crescimento ficou discreto"');
ok(/#rv2Lupa\.aberta\{opacity:1;transform:scale\(1\)\}/.test(HTML), 'e se abre ate o tamanho cheio');
ok(/transition:transform \.32s/.test(lupaCss || ''),
   'com transicao LONGA o bastante para o olho ver o movimento (.32s)');
ok(/1\.28\)/.test(lupaCss || ''), 'e passando um pouco do ponto antes de assentar');
ok(/Math\.min\(820, window\.innerWidth\*0\.5\)/.test(HTML),
   'a foto ocupa metade da largura da tela (ate 820px), nao 300% da miniatura');
ok(/Math\.max\(480,/.test(HTML), 'com piso de 480px: nunca sai pequena');
ok(/transformOrigin=\(x < r\.left\)/.test(HTML),
   'crescendo A PARTIR do lado onde esta a miniatura, para o olho seguir o caminho');
ok(/classList\.remove\('aberta'\)/.test(HTML), 'ao sair o mouse ela ENCOLHE');
ok(/__rv2LupaFim=setTimeout/.test(HTML),
   'e so some depois de encolher — por tempo fixo, nao esperando o aviso de fim da transicao');
ok(/janela estiver sem desenhar quadros/.test(HTML),
   'com o porque anotado: esperar o fim da transicao deixaria a foto pendurada para sempre');

console.log('=== 6. letra preta tambem no seletor de MODELO do exame ===');
ok(/#telaRev2 \.dir select\{[^}]*color:#12202B/.test(HTML), 'o seletor de modelo tem cor escura propria');
ok(/#telaRev2 \.dir select option\{color:#12202B/.test(HTML), 'as opcoes dele tambem');

console.log('=== 7. o microfone do "peca a IA correcoes" avisa o que houve ===');
// 18/08: o medico tocou, falou, e nada aconteceu — nem o texto, nem uma explicacao.
// Todo aviso ia para o diario, que fica ATRAS desta tela. Erro invisivel = erro nenhum.
const ouvir = grabFn('rev2Ouvir');
ok(/function rev2Status/.test(HTML), 'existe um aviso proprio da tela (nao so o diario)');
ok(/rv2PedidoStatus/.test(HTML.slice(HTML.indexOf('function rev2Status'), HTML.indexOf('function rev2Status') + 400)),
   'que escreve embaixo da caixa de texto, onde o medico esta olhando');
ok(!/log\('Nao consegui abrir o microfone/.test(ouvir) && /rev2Status\(/.test(ouvir),
   'os avisos do microfone passaram do diario para a tela');
ok(/gravando \('\+seg\+'s\)/.test(ouvir), 'mostra que esta gravando e ha quantos segundos');
ok(/toque no microfone de novo para parar/.test(ouvir), 'e diz como parar (nao e obvio)');
ok(/NotAllowedError/.test(ouvir), 'permissao negada vira uma explicacao, nao silencio');
ok(/microfone pode estar mudo/.test(ouvir), 'microfone mudo tambem e dito');

function grabFn(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, s = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; s = true; }
    else if (HTML[j] === '}') { d--; if (s && d === 0) return HTML.slice(i, j + 1); }
  }
  return '';
}

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
