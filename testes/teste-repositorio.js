// O REPOSITORIO UNICO DE EXAMES — 04/09/2026, pedido do Dr. Daniel.
//
// "Um repositorio unico de exames, separados por datas... linhas com a data. Quando voce
// clica, existe uma expansao para baixo dos exames daquele dia. Nessa linha, o nome do
// paciente e se tem o audio, se tem as imagens, se o exame ja foi liberado. Tudo com
// botoes, sinais, cada um com uma cor... e nesses botoes voce continua tendo acesso as
// imagens e ao audio enquanto aquilo estiver armazenado. Essa mesma lista serve tanto
// para os exames de outros dias como para a lista do proprio dia."
//
// O QUE TORNOU ISTO POSSIVEL: as quatro verdades do programa ja se encontram numa chave
// so — o id do estudo no recebedor de imagens. /dicom/estudos (imagens), /exame/ditados
// (7 dias), /capturas (90 dias) e /exames/liberados (study_uid) falam todos dele. O
// repositorio nao inventou dado nenhum: e o cruzamento.
//
// ESTA SUITE EXISTE PARA TRES COISAS QUE ESTA CASA JA COBROU CARO:
//   1. a lista tem de estar na TELA QUE ELE USA (3 vezes um botao nasceu na interface
//      antiga — ver o comentario em teste-trazer-exame.js);
//   2. o painel do dia se redesenha a cada 5 s, e agora tem painel que ABRE dentro dele:
//      reescrever a cada volta cortaria o audio no meio da frase;
//   3. audio casado por NOME nao pode ir para o exame errado.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}
// em que <div id="telaX"> um trecho cai
function telaDe(marca) {
  const i = HTML.indexOf(marca);
  if (i < 0) return 'NAO ACHEI';
  const m = [...HTML.slice(0, i).matchAll(/<div id="(tela[A-Za-z0-9]+)"/g)];
  return m.length ? m[m.length - 1][1] : '(fora de tela)';
}

console.log('=== a lista existe, e e UMA so ===');
ok(/function repoDiasHtml\(/.test(HTML), 'ha uma funcao que desenha os dias');
ok(/function repoLinhaHtml\(/.test(HTML), 'e uma que desenha a linha do exame');
ok(/function repoSelosHtml\(/.test(HTML), 'e uma que desenha os tres sinais');
// as duas telas chamam a MESMA funcao: e isso que impede elas de divergirem
const usos = (HTML.match(/repoPintar\(/g) || []).length;
ok(usos >= 3, 'repoPintar e o unico caminho para desenhar a lista  [' + usos + ' usos]');

console.log('\n=== e aparece NAS DUAS TELAS que ele usa ===');
ok(/id="diaOutrosDias"/.test(HTML), 'ha lugar para os outros dias no painel do dia');
ok(telaDe('id="diaOutrosDias"') === 'telaDia',
   'e ele esta na telaDia  [' + telaDe('id="diaOutrosDias"') + ']');
ok(/id="antRepo"/.test(HTML), 'ha lugar para a lista na tela de exames antigos');
ok(telaDe('id="antRepo"') === 'telaAntigos',
   'e ele esta na telaAntigos  [' + telaDe('id="antRepo"') + ']');
// a armadilha desta casa: telaExames/telaRevisao/telaAntigos-velha sao a interface que
// ele NAO abre. Nada do repositorio pode nascer la.
ok(telaDe('id="diaOutrosDias"') !== 'telaExames' && telaDe('id="antRepo"') !== 'telaExames',
   'nenhum dos dois caiu na interface antiga');
const antAbrir = grab('antAbrir');
ok(/repoPintar\('antRepo'/.test(antAbrir),
   'abrir "fazer laudos com fotos e audios antigos" ja pinta a lista');

console.log('\n=== linhas de data que abrem para baixo ===');
const dias = grab('repoDiasHtml');
ok(/<details class="repoDia"/.test(dias), 'cada dia e uma linha que expande');
ok(/repoOrdemDia\(b\)\.localeCompare\(repoOrdemDia\(a\)\)/.test(dias),
   'os dias mais recentes primeiro');
ok(/ontoggle="_repoAberto\[/.test(dias),
   'o dia que ele abre fica aberto — o redesenho nao fecha na cara dele');
ok(/opc\.excluirDia/.test(dias),
   'da para tirar um dia da lista (no painel do dia, HOJE ja esta desenhado acima)');
const outros = grab('repoOutrosDiasAbrir');
ok(/excluirDia:repoHojeBr\(\)/.test(outros),
   'e o painel do dia usa isso: hoje nao aparece duas vezes na mesma tela');
ok(/regs\.length\+' exame'/.test(dias), 'a linha do dia diz quantos exames tem');
ok(/class="hoje"/.test(dias), 'e o dia de hoje vem marcado');

console.log('\n=== os TRES sinais, com cor, como ele pediu ===');
const selos = grab('repoSelosHtml');
ok(/repoSelo img/.test(selos), 'sinal de IMAGENS');
ok(/repoSelo aud/.test(selos), 'sinal de AUDIO');
ok(/repoSelo lib/.test(selos) && /repoSelo falta/.test(selos),
   'sinal de LIBERADO, com o estado contrario (a liberar)');
ok(/repoSelo vazio/.test(selos), 'e o sinal de que aquilo NAO existe');
// cada um com a sua cor: sao a legenda, nao enfeite
for (const [cls, cor] of [['img', '#0B5A57'], ['aud', '#24507F'], ['lib', '#1B7048'],
                          ['falta', '#8A6210'], ['vazio', '#8A93A0']]) {
  const re = new RegExp('\\.repoSelo\\.' + cls + '\\{[^}]*' + cor);
  ok(re.test(HTML), 'o sinal .' + cls + ' tem cor propria (' + cor + ')');
}
ok(/it\.nImagens\+\(it\.nImagens===1\?' imagem':' imagens'\)/.test(selos),
   'o sinal das imagens diz QUANTAS sao');

console.log('\n=== sinal que abre e botao; sinal que nao abre, nao e ===');
// Botao que nao faz nada ensina a nao confiar nos outros botoes.
ok(/<button type="button" class="repoSelo img/.test(selos),
   'com imagens: e botao, e abre as fotos');
ok(/repoVerFotos\(/.test(selos), 'que chama quem mostra as fotos');
ok(/<button type="button" class="repoSelo aud/.test(selos), 'com audio: e botao');
ok(/repoOuvir\(/.test(selos), 'que chama o tocador');
ok(/<span class="repoSelo vazio"/.test(selos),
   'sem imagens / sem audio: e SINAL, nao botao — nao ha o que abrir');
ok(/<span class="repoSelo lib"/.test(selos),
   'liberado sem laudo aberto nesta sessao tambem e sinal');
ok(/title="o áudio guardado se apaga aos '\s*\+_repo\.retAudio/.test(selos),
   'e o sinal cinza do audio DIZ POR QUE nao existe mais (os 90 dias)');

console.log('\n=== as fotos e o audio abrem na propria linha ===');
const fotos = grab('repoVerFotos');
ok(/_repoPainel\[chave\]==='fotos'/.test(fotos) && /repoFecharPainel\(chave\)/.test(fotos),
   'tocar de novo FECHA — nao empilha galeria aberta');
ok(/it\.ex&&\(it\.ex\.imagens\|\|\[\]\)\.length/.test(fotos),
   'exame que ja esta na tela usa as fotos que ja tem: nao pede nada ao aparelho');
ok(/_repoFotos\[it\.estudoId\]/.test(fotos),
   'e o que foi baixado fica guardado — nao rebaixa a cada toque');
ok(/dicomBaixarImagem/.test(fotos), 'as demais vem do aparelho, uma a uma');
ok(/catch\(e\)\{[^}]*\}/.test(fotos), 'foto ilegivel nao esconde as outras');
ok(/if\(_repoPainel\[chave\]!=='fotos'\) return;/.test(fotos),
   'e se ele fechar enquanto baixava, nao escreve por cima do que ele abriu depois');
ok(/ampliarImg/.test(fotos), 'da para ver em tamanho cheio');

const ouvir = grab('repoOuvir');
ok(/<audio controls/.test(ouvir), 'o audio abre num tocador de verdade');
ok(/_repoPainel\[chave\]==='audio'/.test(ouvir), 'e o mesmo sinal fecha');
ok(/it\.audio\.dia\s*&&\s*it\.audio\.dia!==it\.diaIso/.test(ouvir),
   'quando a gravacao esta guardada em outro dia, a tela DIZ de onde veio');
ok(/agente[\s\S]{0,40}desligado/.test(ouvir),
   'e explica que o audio mora no computador, nao na janela');

console.log('\n=== de onde vem o audio: a ordem, e a guarda ===');
const audioDe = grab('repoAudioDe');
ok(audioDe.indexOf('_repo.ditados[eid]') < audioDe.indexOf('repoCapturaNoDia'),
   'PRIMEIRO o ditado casado pelo id do estudo, que nao erra de paciente');
ok(/fonte:'arquivo'/.test(audioDe), 'depois a copia de consulta, casada por dia + nome');
ok(/fonte:'sessao'/.test(audioDe), 'e por fim o que so existe na memoria desta sessao');
ok(/norm\(/.test(audioDe),
   'o nome e comparado com o `norm` do proprio app, sem repetir aqui a regra do agente');
// A GUARDA QUE IMPEDE O PIOR ERRO: o audio de um exame indo para outro exame.
ok(/repoDiaSeguinte\(diaIso\)/.test(audioDe),
   'o dia seguinte tambem e olhado (exame da noite fecha na manha seguinte)');
ok(/quantos<=1/.test(audioDe),
   'MAS so quando o paciente tem UM exame nesses dois dias — com dois, nao ha como saber qual');
ok(/return \{tem:false/.test(audioDe),
   'e na duvida a resposta e "sem audio", que e a verdade');
const capNoDia = grab('repoCapturaNoDia');
ok(/replace\(\/\\s\*\\\(\\d\+\\\)\$\/,''\)/.test(capNoDia),
   '"Maria (2).wav" — o segundo exame do mesmo dia — casa pelo mesmo nome');

console.log('\n=== o painel do dia nao paga pela lista do aparelho ===');
// Medido em 04/09/2026: 582 exames no recebedor, 1,06 s por chamada. A telaDia se
// redesenha a cada 5 s — carregar junto seria bater no recebedor 720 vezes por hora.
const render = grab('diaRenderLista');
ok(!/capOrtListar|repoCarregar\(/.test(render),
   'diaRenderLista NAO chama a lista do aparelho');
ok(/repoOutrosDiasBotao\(\)/.test(render), 'so desenha o botao fechado dos outros dias');
const botao = grab('repoOutrosDiasBotao');
ok(/data-aberto/.test(botao), 'e o botao nao se refaz por cima da lista ja aberta');
ok(/repoOutrosDiasAbrir\(\)/.test(botao), 'a busca so acontece quando ele toca');
const leve = grab('repoCarregarLeve');
ok(!/capOrtListar/.test(leve),
   'a carga leve (ditados, capturas, liberados) nao encosta na lista do aparelho');
ok(/60000/.test(leve), 'e ela mesma se segura, para nao repetir a cada 5 s');
const atualizar = grab('diaAtualizar');
ok(/repoCarregarLeve\(\)/.test(atualizar),
   'o painel do dia busca as tres baratas — senao, quem recarregasse a pagina veria '
   + '"sem audio" com o ditado inteiro no disco');

console.log('\n=== e nao reescreve a lista a cada 5 s ===');
// Sem isto, as fotos fechariam sozinhas e o audio cortaria no meio da frase.
ok(/if\(htmlLista!==_diaListaHtml\)/.test(render),
   'so escreve a lista do dia quando ela MUDOU de verdade');
ok(/_repoPainel=\{\}/.test(render),
   'e quando muda, a marca de painel aberto e apagada — o sinal nao fica aceso mentindo');
ok(/_diaListaHtml=''/.test(render), 'a lista vazia tambem zera a memoria do desenho');

console.log('\n=== os selos valem tambem para HOJE ===');
// Ele pediu UMA lista. Se o exame de anteontem mostra os tres sinais e o de hoje nao,
// voltaram a ser duas listas.
ok(/var it=repoItem\(null, x\); _repoIndice\[it\.chave\]=it;/.test(render),
   'cada exame de hoje vira um item do repositorio');
ok(/repoSelosHtml\(it\)/.test(render), 'e ganha os mesmos tres sinais');
ok(/id="repoP'\+it\.chave\+'"/.test(render),
   'com o mesmo lugar para as fotos e o audio abrirem');
// o cartao de hoje NAO perde o que so ele tem
ok(/faltou medir/.test(render), 'e continua avisando a medida que faltou');
ok(/diaRevisar\(/.test(render) && /diaAbrirNaPasta\(/.test(render) && /diaReabrir\(/.test(render),
   'e continua com os tres botoes de trabalho do dia');

console.log('\n=== o indice das linhas nao se apaga entre as telas ===');
const itens = grab('repoItens');
ok(!/_repoIndice=\{\}/.test(itens),
   'repoItens ACRESCENTA ao indice em vez de zerar — senao um toque no selo de hoje '
   + 'nao faria nada depois de abrir a outra tela');
ok(/_repoIndice\[it\.chave\]=it/.test(itens), 'e registra cada linha pela sua chave');
const item = grab('repoItem');
ok(/est\?\('E'\+est\.id\):\('S'\+/.test(item),
   'exame do aparelho e exame da sessao tem chaves diferentes — nao colidem');

console.log('\n=== exame que nao veio do aparelho tambem aparece ===');
ok(/exames\.forEach\(function\(x\)\{ if\(!jaVi\[x\.id\]\)/.test(itens),
   'ditado avulso e laudo reaberto do historico entram na lista — existem, tem de aparecer');

console.log('\n=== trazer daqui usa o caminho ja provado ===');
const trazer = grab('repoTrazer');
ok(/capForcarTrazer\(it\.est\.id, destino\)/.test(trazer),
   'reusa capForcarTrazer, com as travas de 03/09 (inclusive a pergunta antes de duplicar)');
const acoes = grab('repoAcoesHtml');
// as aspas do destino vao escapadas dentro do template: \'hoje\'
ok(/hoje\\'\)/.test(acoes) && /antigos\\'\)/.test(acoes),
   'os dois destinos que ele escolheu em 03/09 continuam sendo dele');
ok(/if\(!it\.est\) return ''/.test(acoes),
   'exame que nao esta mais no aparelho nao oferece um botao que falharia');

console.log('\n=== agente desligado vira mensagem, nao lista vazia ===');
const pintar = grab('repoPintar');
ok(/nao consegui falar com o agente|não consegui falar com o agente/.test(pintar),
   'diz que nao falou com o agente');
ok(/ligue o agente/.test(pintar), 'e diz o que fazer');
ok(/procurando os exames guardados/.test(pintar),
   'e enquanto busca, diz que esta buscando — em vez de ficar em branco');
const carregar = grab('repoCarregar');
ok((carregar.match(/catch/g) || []).length >= 1 && /repoCarregarLeve/.test(carregar),
   'cada fonte cai sozinha: o recebedor fora do ar nao apaga os selos de audio');
ok(/if\(!_repo\.estudos\) _repo\.estudos=\[\]/.test(carregar),
   'e uma falha nunca deixa a lista sem chao');
ok(/atualizar/.test(pintar), 'ha como mandar buscar de novo');

console.log('\n=== a legenda das cores esta na tela ===');
ok(/repoLegenda/.test(dias), 'a lista traz a legenda dos sinais');
ok(/guardado por '\+_repo\.retAudio\+' dias/.test(dias),
   'dizendo quantos dias o audio dura — o numero vem do agente, nao escrito a mao');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
