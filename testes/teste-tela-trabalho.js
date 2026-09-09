// A TELA DE TRABALHO E A ABERTURA DE DOIS BOTOES (09/09/2026)
//
// Pedido do Dr. Daniel: "Na primeira página, após os testes, eu quero que tenha só dois
// botões: 1. Trabalho  2. Configuração". E o Trabalho leva a uma tela nova onde mora tudo
// o que antes estava espalhado em quatro botoes.
//
// O que este teste tranca, e por que cada coisa:
//  - DOIS botoes, nao tres. A engrenagem do rodape saiu junto; se voltar sem ninguem
//    pedir, a tela volta a ter tres caminhos, e o pedido era dois.
//  - Nenhum caminho MORREU. Os quatro botoes antigos viraram lugares dentro da tela de
//    trabalho. Um botao removido cujo destino tambem sumiu nao e simplificacao: e perda.
//  - As caixas da tela nova enchem as MESMAS gavetas da tela de antigos. Se alguem criar
//    gavetas proprias aqui, passam a existir dois caminhos para o mesmo lugar -- e eles
//    divergem no dia em que alguem conserta so um.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function corpoDa(id) {
  const i = HTML.indexOf('<div id="' + id + '"');
  if (i < 0) return '';
  // ate a proxima tela de primeiro nivel, que e o que separa uma da outra neste arquivo
  const j = HTML.indexOf('\n<div id="tela', i + 5);
  const k = HTML.indexOf('\n<!-- =======================', i + 5);
  const fim = Math.min(j < 0 ? HTML.length : j, k < 0 ? HTML.length : k);
  return HTML.slice(i, fim);
}
function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) return '';
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  return '';
}

const ABERTURA = corpoDa('telaAbertura');

console.log('=== 1. a abertura tem DOIS botoes, e sao esses dois ===');
const botoes = ABERTURA.match(/class="ab-botao"/g) || [];
ok(botoes.length === 2, 'exatamente 2 botoes na tela de abertura (achei ' + botoes.length + ')');
ok(/onclick="trabAbrir\(\)"/.test(ABERTURA), 'o primeiro chama trabAbrir()');
ok(/>Trabalho</.test(ABERTURA), 'e se chama "Trabalho"');
ok(/modCfgAbrir\(\)/.test(ABERTURA), 'o segundo abre as Configuracoes');
ok(/>Configuração</.test(ABERTURA), 'e se chama "Configuração"');
/* A engrenagem do rodape era um TERCEIRO caminho para as configuracoes, no canto.
   Saiu junto: o pedido era dois botoes. */
ok(!/class="ab-cfg"/.test(ABERTURA), 'a engrenagem do rodape saiu (seria o terceiro)');

console.log('\n=== 2. os quatro botoes antigos sairam DA ABERTURA ===');
[['Fazer laudos com fotos e áudios antigos', 'material antigo'],
 ['Realizar exames', 'realizar exames'],
 ['Liberar laudos', 'liberar laudos'],
 ['Histórico', 'histórico']].forEach(function (p) {
  ok(ABERTURA.indexOf('>' + p[0] + '<') < 0, 'saiu da abertura: ' + p[1]);
});

console.log('\n=== 3. mas NENHUM caminho morreu ===');
/* Botao removido cujo destino tambem sumiu nao e simplificacao, e perda. Cada um dos
   quatro tem de continuar alcancavel — agora de dentro da tela de trabalho. */
const TRAB = corpoDa('telaTrabalho');
ok(TRAB.length > 0, 'a tela de trabalho existe');
ok(/id="trabSoltaImg"/.test(TRAB) && /id="trabSoltaAud"/.test(TRAB),
   'material antigo: as duas caixas pontilhadas estao la');
ok(/onclick="exAbrir\(\)"/.test(TRAB), 'realizar exames: o cartao chama a MESMA exAbrir()');
ok(/onclick="antAbrir\(\)"/.test(TRAB), 'e a tela de antigos continua alcancavel por um toque');
ok(grab('trabAbrir').length > 0 && grab('trabFechar').length > 0,
   'e as funcoes de abrir e fechar existem');

console.log('\n=== 4. esquerda e direita, como ele pediu ===');
/* "no canto superior esquerdo, as duas caixas... no canto superior [direito], realizar
   exames". A ordem no HTML e a ordem na tela: as caixas vem ANTES do cartao. */
ok(TRAB.indexOf('trabSoltaImg') < TRAB.indexOf('cartaoEx'),
   'as caixas vem antes do cartao de exames (esquerda, depois direita)');
ok(/#telaTrabalho \.topo2\{display:flex/.test(HTML),
   'e as duas colunas ficam lado a lado, nao empilhadas');

console.log('\n=== 5. as caixas enchem as MESMAS gavetas da tela de antigos ===');
const receber = grab('trabReceber');
ok(receber.length > 0, 'trabReceber existe');
ok(/antAddImgs|antAddAuds|guardar\(/.test(receber), 'ela entrega o material para as funcoes de sempre');
const ligar = grab('antLigarArrastar');
ok(/trabSoltaImg[\s\S]*antAddImgs/.test(ligar), 'a caixa de imagem cai em antAddImgs');
ok(/trabSoltaAud[\s\S]*antAddAuds/.test(ligar), 'a caixa de audio cai em antAddAuds');
ok(!/_trabImgs\s*=|_trabAuds\s*=/.test(HTML),
   'e NAO nasceram gavetas proprias (dois caminhos para o mesmo lugar divergem)');
ok(/antAbrir\(\)/.test(receber),
   'depois de receber, abre a tela de antigos com o material ja dentro');
ok(/if\(!n\) return/.test(receber),
   'arrastar e nao vir nada NAO troca de tela (nada acontecer e melhor que ir para o lugar errado)');

console.log('\n=== 6. abrir e fechar trocam as telas de verdade ===');
const abrir = grab('trabAbrir'), fechar = grab('trabFechar');
/* Confere o FIM, nao o meio: o que importa e que nenhuma outra tela fique de pe, seja
   qual for a maneira. A 1a versao desta linha exigia o texto `telaAbertura...display=none`
   e passou a acusar defeito no minuto em que a chamada virou telasEsconder() -- que faz
   MAIS, nao menos. Assercao presa ao meio repreende o programa por melhorar. */
ok(/telasEsconder\('telaTrabalho'\)/.test(abrir),
   'abrir esconde TODAS as outras telas, nao so a abertura');
ok(/telaTrabalho[\s\S]*display='block'/.test(abrir), 'e mostra o trabalho');
/* E a lista de telas e UMA SO. Cinco copias dela foi o que me fez esquecer a quinta ao
   criar esta tela: o fundo continuava rolando por baixo, com duas barras de rolagem. */
ok(/var TELAS_DO_APP = \[/.test(HTML), 'existe uma lista unica de telas do app');
ok(/'telaTrabalho'/.test((HTML.match(/var TELAS_DO_APP = \[[\s\S]*?\];/) || [''])[0]),
   'e a tela de trabalho esta nela');
ok(!/\['telaAbertura','telaExames','telaDia','telaRevisao'/.test(HTML),
   'e nenhuma copia da lista antiga sobrou espalhada pelo arquivo');
ok(/telaTrabalho[\s\S]*display='none'/.test(fechar), 'fechar esconde o trabalho');
ok(/semVoltar/.test(fechar),
   'e sabe fechar SEM voltar ao inicio (senao a abertura pisca no meio do caminho)');
ok(/abContarPendentes/.test(fechar), 'ao voltar, reconta os pendentes');

console.log('\n=== 7. as etiquetas antigas nao derrubam nada ao sumir ===');
/* `hisSelo` vivia no botao Historico, que saiu. Quem escreve nela precisa conferir se
   ela existe ANTES de escrever -- senao a tela de historico quebra ao ser pintada. */
const hisP = grab('hisPintar');
ok(/var selo=document\.getElementById\('hisSelo'\);\s*\n?\s*if\(selo\)/.test(hisP),
   'hisPintar confere se hisSelo existe antes de escrever nela');
ok(/id="abPendentes"/.test(ABERTURA),
   'e abPendentes continua na tela, agora no botao Trabalho');

console.log('\n=== 8. o desenho das caixas e UM SO para as duas telas ===');
/* Copiar o estilo para a tela nova e como duas telas irmas comecam a ficar diferentes
   sem ninguem perceber. O seletor cita as duas. */
ok(/#telaAntigos \.solta,#telaTrabalho \.solta\{/.test(HTML),
   'a caixa pontilhada tem UMA definicao, citando as duas telas');
ok(/#telaAntigos \.cx,#telaTrabalho \.cx\{/.test(HTML), 'idem para a moldura das colunas');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
