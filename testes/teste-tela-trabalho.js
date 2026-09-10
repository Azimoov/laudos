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

console.log('\n=== 9. os TRES ajustes no painel do dia (etapa 5, 09/09/2026) ===');
/* Palavras dele: "o botao 'Trazer exame do aparelho' deve ser removido; o botao 'Ver os
   exames de outros dias' deve abrir justamente as duas listas; o botao 'Revisar laudos
   pendentes' tambem deve ser removido." */
const DIA = corpoDa('telaDia');
ok(!/onclick="capForcarAbrir\(\)"/.test(DIA), 'saiu: "Trazer exame do aparelho"');
ok(!/id="diaPend"/.test(DIA), 'saiu: "Revisar laudos pendentes"');
ok(/id="diaOutrosDias"/.test(DIA), 'e "OUTROS DIAS" continua la');
const outros = grab('repoOutrosDiasAbrir');
ok(/duasListasHtml\('dia2'\)/.test(outros) && /duasListasPintar\('dia2'/.test(outros),
   'que agora abre AS DUAS listas, pela mesma peca da tela de Trabalho');
/* 10/09/2026 — mudou a pedido dele: HOJE passou a entrar aqui tambem. Ver a nota em
   repoOutrosDiasAbrir. O nome do botao mudou junto, senao ele prometeria menos do que faz. */
ok(!/excluirDia/.test(outros),
   'e HOJE entra: o exame do dia coexiste em "exames de hoje" e na lista de trabalho');
ok(/Ver a lista de trabalho e o hist/.test(grab('repoOutrosDiasBotao')),
   'e o botao deixou de prometer so "outros dias"');

console.log('\n=== 10. o que foi removido nao levou junto a capacidade ===');
/* Remover um botao a pedido e uma coisa; remover o unico caminho para algo e outra. */
ok(/function capForcarTrazer\(/.test(HTML),
   'a valvula de escape da trava de repetidos continua existindo');
ok(/capForcarTrazer\(/.test(grab('repoTrazer')),
   'e os botoes ⤵ do cartao a chamam — o exame do aparelho continua alcancavel');
ok(/repoLiberar\(/.test(grab('repoSelosHtml')),
   'e liberar laudo tem caminho pelo 3o botao do cartao, exame a exame');
/* ⚠️ A CAIXA DE AVISO FICOU, mesmo sem o botao que a criou. Ao tirar o botao eu tirei
   junto este div, e com ele o unico lugar VISIVEL onde sete caminhos escrevem o que
   aconteceu -- inclusive o "reabrir exame". A mensagem cairia so no diario, que fica
   ATRAS da tela: tocar e nao ver nada acontecer e o defeito de 03/09, de novo. */
ok(/id="capForcarLista"/.test(DIA), 'o lugar do aviso continua no painel do dia');
ok(/id="trabAviso"/.test(TRAB), 'e a tela de Trabalho tem o seu');
const caixa = grab('capForcarCaixa');
ok(caixa.length > 0 && /telaTrabalho/.test(caixa),
   'e o aviso aparece na tela ABERTA, nao sempre na mesma');
ok(/capForcarCaixa\(\)/.test(grab('capForcarAviso')),
   'quem escreve o aviso usa essa escolha');

console.log('\n=== 11. nada some: a sessao volta SOZINHA (etapa 6, 09/09/2026) ===');
/* Palavras dele: "essa questao de sessao anterior encontrada, um laudo gerado na data tal
   — isso deve sumir. (...) Nenhum exame deve sumir mais da tela do aplicativo. Entao esses
   avisos de restaurar e tal devem ser removidos tambem."

   ⚠️ O QUE NAO PODE SE PERDER JUNTO COM O BANNER. Aquela barra azul nasceu de um estrago
   real (17/08/2026: o medico REFEZ laudos porque o dia inteiro sumiu ao fechar a janela).
   Tirar o aviso e certo; tirar a RESTAURACAO seria repetir o estrago. Estas linhas
   existem para separar as duas coisas. */
const verificar = grab('verificarSessaoSalva');
ok(verificar.length > 0, 'a rotina que procura a sessao guardada continua existindo');
ok(!/bannerRecup/.test(verificar), 'e NAO cria mais a barra azul de "Sessao anterior encontrada"');
ok(!/Restaurar</.test(HTML) || !/Sessão anterior encontrada/.test(HTML),
   'o texto "Sessao anterior encontrada" saiu da tela');
ok(/restaurarSessao\(idAuto, \{silencioso:true\}\)/.test(verificar),
   'e a sessao e restaurada SOZINHA, sem esperar toque nenhum');
/* O prazo de 24 h era "some sozinho" com outro nome. So existe UMA sessao guardada (cada
   salvamento escreve por cima), entao nao ha acumulo a temer. */
ok(!/24\*3600\*1000/.test(verificar),
   'e o prazo de 24h saiu — sessao de ontem tambem volta, porque nada some');

const restaurar = grab('restaurarSessao');
ok(/opc\.silencioso/.test(restaurar) || /quieto=!!\(opc&&opc\.silencioso\)/.test(restaurar),
   'restaurarSessao aceita o modo silencioso');
/* ⚠️ SEM ISTO, ABRIR O PROGRAMA JOGA O MEDICO NA INTERFACE ANTIGA. A restauracao trocava
   para a aba "Revisao dos laudos" do programa velho e rolava ate la. Fazendo isso sozinha
   na abertura, todo dia comecaria numa tela que ele nao usa — e ja custou uma tarde
   tira-lo de la uma vez. */
ok(/if\(!quieto\)\{[\s\S]{0,200}mostrarAba\('revisao'\)/.test(restaurar),
   'e no modo silencioso NAO troca de aba (senao a abertura cai na interface antiga)');
ok(/trabPintar\(\)/.test(restaurar),
   'e as listas se acertam sozinhas quando os exames voltam');
/* Descartar continua existindo para quem apaga de proposito; o que saiu foi o BOTAO que
   oferecia jogar fora o dia de trabalho ao lado do botao que o trazia de volta. */
ok(/function descartarSessao\(/.test(HTML),
   'a funcao de descartar continua existindo (para quem apaga de proposito)');
ok(!/onclick="descartarSessao\(/.test(HTML),
   'mas nao ha mais botao oferecendo jogar fora o dia de trabalho');
/* E o aviso que mandava tocar num botao que nao existe mais. */
ok(!/toque em “Restaurar”/.test(HTML),
   'e nenhum texto manda tocar em "Restaurar" (mandaria procurar o que nao existe)');

console.log('\n=== 12. sair do painel do dia NAO para a gravacao (09/09/2026) ===');
/* Pedido dele: "quando eu apertar Iniciar (...) eu gostaria de poder continuar navegando
   sem que o agente pare de gravar."
   ⚠️ O FATO QUE ORGANIZA ISTO: quem grava e o AGENTE, nao a janela. "Iniciar" manda o
   agente abrir o microfone (/gravacao/prebuffer). E a vigilancia que apanha os exames que
   chegam (capOrtTimer) e um relogio da JANELA, ligado por "Iniciar" e desligado so por
   "Parar espera" — nao pela tela que esta a vista. Sair do painel nunca parou nada disso;
   o que faltava era a porta de saida e o aviso de que a gravacao continua. */
const fechar2 = grab('diaFechar');
ok(!/capOrtToggle|capOrtWatching\s*=\s*false/.test(fechar2),
   'fechar o painel do dia NAO desliga a espera do aparelho');
ok(!/clearInterval\(capOrtTimer\)/.test(fechar2),
   'e NAO para a vigilancia que apanha os exames que chegam');
ok(!/prebuffer/.test(fechar2),
   'e nao manda o agente fechar o microfone (quem grava e ele, nao a janela)');
ok(/_diaTimer|_diaSeg|_ondaFeed/.test(fechar2),
   'o que ele para sao so os lacos de EXIBICAO — painel, relogio e grafico da onda');

const paraTrab = grab('diaParaTrabalho');
ok(paraTrab.length > 0 && /diaFechar\(\)/.test(paraTrab) && /trabAbrir\(\)/.test(paraTrab),
   'ha um caminho do painel do dia para a lista de trabalho');
ok(/onclick="diaParaTrabalho\(\)"/.test(DIA), 'e um botao na barra do painel que o chama');

/* E o aviso: sem ele, "estou gravando?" vira duvida a cada dois minutos, e a resposta
   a essa duvida seria voltar ao painel para conferir — que e o que ele quer nao ter de
   fazer. */
ok(/id="faixaGravando"/.test(HTML), 'existe a faixa que avisa que a gravacao continua');
const faixa = grab('faixaGravandoPintar');
ok(/capOrtWatching/.test(faixa), 'ela so aparece quando a espera esta LIGADA de verdade');
ok(/telaDia/.test(faixa),
   'e some dentro do proprio painel do dia (aviso redundante vira ruido que se ignora)');
ok(/diaAbrir\(\)/.test(HTML.slice(HTML.indexOf('id="faixaGravando"'), HTML.indexOf('id="faixaGravando"') + 600)),
   'e ela traz de volta ao painel num toque');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
