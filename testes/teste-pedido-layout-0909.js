// A RELEITURA FINAL: os pedidos do Dr. Daniel de 09/09/2026, um a um.
//
// Ele pediu, com estas palavras: "ao final, releia todas as tarefas para se certificar de
// que nao esqueceu de executar nenhuma."
//
// Esta suite E essa releitura, so que executavel. Cada bloco cita o pedido dele
// LITERALMENTE e confere o programa contra a frase — nao contra a minha lembranca do que
// eu fiz. Uma conferencia feita de memoria confere a memoria, nao o programa.
//
// ⚠️ Se um destes blocos ficar vermelho um dia, nao e "um teste que envelheceu": e um
// pedido dele que foi desfeito. Trate assim antes de mexer na linha.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) return '';
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
  return '';
}
function tela(id) {
  const i = HTML.indexOf('<div id="' + id + '"');
  if (i < 0) return '';
  const j = HTML.indexOf('\n<div id="tela', i + 5);
  const k = HTML.indexOf('\n<!-- =======================', i + 5);
  return HTML.slice(i, Math.min(j < 0 ? HTML.length : j, k < 0 ? HTML.length : k));
}
const ABERTURA = tela('telaAbertura'), TRAB = tela('telaTrabalho'), DIA = tela('telaDia');

console.log('=== 1. "so dois botoes: 1. Trabalho  2. Configuracao" ===');
ok((ABERTURA.match(/class="ab-botao"/g) || []).length === 2, 'sao exatamente dois');
ok(/>Trabalho</.test(ABERTURA) && /onclick="trabAbrir\(\)"/.test(ABERTURA), 'o primeiro e "Trabalho"');
ok(/>Configuração</.test(ABERTURA), 'o segundo e "Configuração"');
ok(!/class="ab-cfg"/.test(ABERTURA), 'e a engrenagem do rodape saiu (seria um terceiro)');

console.log('\n=== 2. "o botao configuracao vai levar a tela de configuracao, a mesma que ja existe" ===');
ok(/modCfgAbrir\(\)/.test(ABERTURA), 'chama a MESMA modCfgAbrir de sempre');
ok(/<div id="telaModelos">/.test(HTML), 'e a tela de configuracao continua existindo');

console.log('\n=== 3. "o botao Trabalho vai levar a uma nova tela" ===');
ok(TRAB.length > 0, 'a tela de Trabalho existe');
ok(grab('trabAbrir').length > 0 && grab('trabFechar').length > 0, 'com abrir e fechar');

console.log('\n=== 4. "no canto superior esquerdo, as duas caixas pontilhadas" ===');
ok(/id="trabSoltaImg"/.test(TRAB), 'caixa de IMAGENS');
ok(/id="trabSoltaAud"/.test(TRAB), 'caixa de AUDIO');
ok(/trabSoltaImg[\s\S]*antAddImgs/.test(grab('antLigarArrastar')),
   'e elas enchem as MESMAS gavetas da tela de antigos (uma esteira so)');

console.log('\n=== 5. "no canto superior [direito], realizar exames, a mesma que ja existe" ===');
ok(/onclick="exAbrir\(\)"/.test(TRAB), 'chama a MESMA exAbrir de sempre');
ok(TRAB.indexOf('trabSoltaImg') < TRAB.indexOf('cartaoEx'),
   'e vem DEPOIS das caixas (esquerda, depois direita)');

console.log('\n=== 6. "abaixo, duas listas: lista de trabalho e historico" ===');
ok(/LISTA DE TRABALHO/.test(HTML) && /HISTÓRICO/.test(HTML), 'as duas existem, com esses nomes');
ok(grab('duasListasHtml').length > 0, 'desenhadas por uma peca so');

console.log('\n=== 7. "na lista de trabalho, os que ainda NAO foram terminados" ===');
const dias = grab('repoDiasHtml');
ok(/filtro==='trabalho'[\s\S]{0,80}!it\.liberado/.test(dias),
   'a coluna da esquerda mostra o que ainda NAO foi liberado');
ok(/filtro==='historico'[\s\S]{0,80}it\.liberado/.test(dias),
   'e a da direita, o que ja foi');

console.log('\n=== 8. "exames que tem so a imagem" tambem ficam na de trabalho ===');
/* Nao ha filtro por "tem laudo": o corte e UNICO (liberado ou nao), entao exame so com
   imagem cai na esquerda por construcao. E ha prova disso no teste do navegador. */
ok(!/filtro==='trabalho'[\s\S]{0,120}laudo/.test(dias),
   'o corte e SO por liberado — exame sem laudo nao e excluido da fila');

console.log('\n=== 9. "o formato igual ao que ja existe: pasta com a data e botao de expandir" ===');
ok(/<details class="repoDia"/.test(dias), 'as datas continuam em pastas que abrem e fecham');
ok(/<summary><span class="seta">▶<\/span>/.test(dias), 'com a setinha de sempre');

console.log('\n=== 10. botao 1: "alem de abrir as imagens, incluir ou excluir" ===');
const pintaFotos = grab('repoFotosPintar');
ok(/repoImgIncluir/.test(pintaFotos), 'INCLUIR imagens');
ok(/repoImgTirar\(/.test(pintaFotos), 'EXCLUIR uma imagem');
ok(/repoImgTirarTodas/.test(pintaFotos), 'e excluir todas');
ok(/ampliarImg/.test(pintaFotos), 'e continua dando para ver em tamanho cheio');

console.log('\n=== 11. botao 2: "ouvir · gravar novo · trazer de fora · apagar" ===');
const pintaAudio = grab('repoAudioPintar');
ok(/<audio controls/.test(pintaAudio), 'OUVIR');
ok(/repoAudioGravar/.test(pintaAudio), 'GRAVAR um novo');
ok(/repoAudioArquivo/.test(pintaAudio), 'TRAZER um arquivo de fora');
ok(/repoAudioApagar/.test(pintaAudio), 'APAGAR o que existe');
/* "para substituir ou adicionar" — ele pediu os DOIS. */
const anexar = grab('repoAudioAnexar');
ok(/SUBSTITUIR/.test(anexar) && /ADICIONAR/.test(anexar),
   'e ao trazer com audio ja existente, pergunta SUBSTITUIR ou ADICIONAR');

console.log('\n=== 12. botao 3: liberacao, com aviso se ja liberado ===');
const liberar = grab('repoLiberar');
ok(/rev2Abrir\(it\.ex\.id\)/.test(liberar), 'leva a tela de liberacao');
ok(/JÁ FOI LIBERADO/.test(liberar), 'e avisa quando o laudo ja foi liberado');
ok(/FAZER O LAUDO/.test(liberar), 'dizendo que ele volta a FAZER o laudo');
ok(/lista de trabalho/.test(liberar), 'e que o exame volta para a lista de trabalho');

console.log('\n=== 13. botao 4: "apenas o laudo, o laudo e as fotos, ou apenas as fotos" ===');
const imprimir = grab('repoImprimir');
ok(/só o laudo/.test(imprimir), 'so o laudo');
ok(/laudo e fotos/.test(imprimir), 'laudo e fotos');
ok(/só as fotos/.test(imprimir), 'so as fotos');
ok(/oQue/.test(grab('impImprimirAgora')), 'e quem imprime sabe distinguir as tres');

console.log('\n=== 14. "os laudos gerados com material antigo vao para a lista de trabalho" ===');
/* A tela de antigos cria exames em `exames`, e repoItens le `exames`. Nao ha caminho
   separado: e por isso que eles caem na fila sozinhos. */
ok(/exames\.forEach\(function\(x\)\{ if\(!jaVi\[x\.id\]\) itens\.push\(repoItem\(null, x\)\); \}\);/
   .test(grab('repoItens')),
   'exame da sessao que nao veio do aparelho entra na lista assim mesmo');

console.log('\n=== 15. "Realizar Exames leva a tela de hoje; depois de Iniciar, idem" ===');
ok(/onclick="exAbrir\(\)"/.test(TRAB), 'o cartao chama a tela de sempre');
ok(/<div id="telaExames">/.test(HTML) && /<div id="telaDia">/.test(HTML),
   'e as duas telas do caminho continuam existindo, sem troca');

console.log('\n=== 16. "o botao Trazer exame do aparelho deve ser removido" ===');
ok(!/onclick="capForcarAbrir\(\)"/.test(DIA), 'saiu do painel do dia');
ok(/capForcarTrazer\(/.test(grab('repoTrazer')),
   'mas a capacidade ficou: os ⤵ do cartao chamam a mesma valvula de escape');

console.log('\n=== 17. "Ver os exames de outros dias deve abrir as duas listas" ===');
const outros = grab('repoOutrosDiasAbrir');
ok(/duasListasHtml\('dia2'\)/.test(outros), 'abre as duas listas');
ok(/duasListasPintar\('dia2'/.test(outros), 'pela mesma peca da tela de Trabalho');

console.log('\n=== 18. "sempre paralelas: trabalho a esquerda, historico a direita" ===');
const molde = grab('duasListasHtml');
ok(molde.indexOf('LISTA DE TRABALHO') < molde.indexOf('HISTÓRICO'),
   'a de trabalho e escrita antes (fica a esquerda)');
ok(/\.duasListas\{display:flex[^}]*flex-wrap:nowrap/.test(HTML),
   'e SEMPRE lado a lado: nao empilham nem em janela estreita');
ok(/\.duasListas\{[^}]*overflow-x:auto/.test(HTML),
   'em janela apertada quem cede e a largura, com rolagem DENTRO da faixa');

console.log('\n=== 19. "o botao Revisar laudos pendentes tambem deve ser removido" ===');
ok(!/id="diaPend"/.test(DIA), 'saiu do painel do dia');
ok(/repoLiberar\(/.test(grab('repoSelosHtml')),
   'e liberar continua alcancavel, exame a exame, pelo 3o botao do cartao');

console.log('\n=== 20. "sessao anterior encontrada... isso deve sumir" ===');
const verif = grab('verificarSessaoSalva');
ok(!/bannerRecup/.test(verif), 'a barra azul nao e mais criada');
ok(!/Sessão anterior encontrada/.test(HTML), 'e o texto saiu do programa');

console.log('\n=== 21-23. "nenhum exame deve sumir mais da tela do aplicativo" ===');
ok(/restaurarSessao\(idAuto, \{silencioso:true\}\)/.test(verif),
   'a sessao volta SOZINHA na abertura');
ok(!/24\*3600\*1000/.test(verif), 'e o prazo de 24h saiu — sessao de ontem tambem volta');
/* A lacuna que esta releitura encontrou: o laudo feito de fotos soltas nao tem estudo no
   aparelho e, passada a sessao, nao aparecia em lista nenhuma. */
ok(/_repo\.historico/.test(grab('repoItens')),
   'e o historico do agente entra na lista: laudo que nao veio do aparelho tambem aparece');
ok(grab('repoItemDoHistorico').length > 0, 'com cartao proprio');
ok(/liberado:true/.test(grab('repoItemDoHistorico')),
   'marcado como liberado — estar no historico E ter sido assinado');

console.log('\n=== 24. "esses avisos de restaurar e tal devem ser removidos" ===');
ok(!/onclick="descartarSessao\(/.test(HTML), 'nao ha botao de descartar o dia de trabalho');
ok(!/toque em “Restaurar”/.test(HTML), 'nem texto mandando tocar num botao que nao existe');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo — os 24 pedidos conferidos');
process.exit(falhas ? 1 : 0);
