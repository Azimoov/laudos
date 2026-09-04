// "REABRIR EXAME" NAO PODE SER UM BECO SEM SAIDA — 04/09/2026, relatado pelo Dr. Daniel.
//
// "Na tela de realizar exames, quando tem um exame que eu aperto reabrir exame, ele vai
// para a tela da primeira versao do programa, e um beco sem saida. Nao tem como voltar,
// nem como sair, nem como mudar de posicao."
//
// O QUE ACONTECIA: diaReabrir fazia `diaFechar(); mostrarAba('captura')` — fechava o
// painel do dia e abria a aba "Captura ao vivo" da interface ANTIGA. Aquelas abas so tem
// saida pelo botao "voltar ao inicio", que `abEscolher` acende ao ENTRAR por elas; quem
// chega por outro caminho nao o tem. Painel fechado, botao apagado, tela antiga: preso.
//
// E O ENGANO DE FUNDO: reabrir e uma mudanca de ESTADO do exame, nao de TELA. O exame
// volta para a fila de "a liberar" e continua na lista de hoje. Quem decide ir a algum
// lugar e ele.
//
// ESTA E A QUARTA VEZ QUE A INTERFACE ANTIGA COBRA PEDAGIO nesta casa (ver o comentario
// em teste-trazer-exame.js). O index.html tem DUAS interfaces vivas, e a velha continua
// inteira no arquivo: qualquer `mostrarAba` a partir de uma tela nova cai dentro dela.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + nome);
}

/* Tira os comentarios. O comentario de diaReabrir CITA o codigo antigo
   ("diaFechar(); mostrarAba('captura')") para registrar o que mordeu — e sem isto a
   propria explicacao do defeito faria o teste do defeito falhar. */
function semComentarios(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const reabrir = semComentarios(grab('diaReabrir'));

console.log('=== nao sai mais do painel do dia ===');
ok(!/mostrarAba\(/.test(reabrir),
   'diaReabrir NAO chama mostrarAba — era ela que levava para a interface antiga');
ok(!/diaFechar\(\)/.test(reabrir),
   'e NAO fecha o painel do dia: era isso que tirava o chao e o botao de voltar');
ok(!/telaExames|telaRevisao|telaAntigos/.test(reabrir),
   'e nao abre nenhuma tela da interface antiga');

console.log('\n=== reabrir e mudanca de ESTADO, e ela acontece ===');
ok(/x\._liberado=false/.test(reabrir),
   'o exame volta para a fila de laudos a liberar');
ok(/confirm\(/.test(reabrir) && /já foi assinado/.test(reabrir),
   'e um laudo JA ASSINADO so e reaberto depois de perguntar');
ok(/O arquivo já salvo na pasta continua lá/.test(reabrir),
   'dizendo que o arquivo ja salvo nao se perde');
ok(/agendarSalvarSessao\(\)/.test(reabrir),
   'a mudanca entra no retrato da sessao — reabrir tem de sobreviver a um recarregamento');

console.log('\n=== a lista se refaz na hora, e ele VE o que mudou ===');
ok(/diaRenderLista\(\)/.test(reabrir), 'a lista do dia e redesenhada');
ok(/renderExames\(\)/.test(reabrir), 'e a interface antiga tambem, para nao ficar mentindo atras');

console.log('\n=== "receber mais imagens" continua sendo verdade ===');
// SAO DUAS LISTAS, e a ordem importa. Em capOrtVarrer a peneira de capOrtSeen vem ANTES
// da de capOrtFeitos: um exame em capOrtSeen e pulado sem sequer chegar a capOrtCompletar.
// E ao religar a espera, TUDO que ja esta no aparelho entra em capOrtSeen. Marcar so
// capOrtFeitos era uma promessa que a varredura nao cumpria.
ok(/capOrtSeen\.delete\(x\._estudoId\)/.test(reabrir),
   'o exame sai de capOrtSeen — sem isso a varredura o pula antes de tudo');
ok(/capOrtFeitos\.add\(x\._estudoId\)/.test(reabrir),
   'e volta a ser vigiado como qualquer exame capturado');
const varrer = grab('capOrtVarrer');
ok(varrer.indexOf('capOrtSeen.has') < varrer.indexOf('capOrtFeitos.has'),
   'e a ordem da varredura confirma o porque: capOrtSeen e peneirada PRIMEIRO');
ok(/if\(x\._estudoId\)/.test(reabrir),
   'so quando ele veio do aparelho — ditado avulso nao tem estudo a vigiar');
const completar = grab('capOrtCompletar');
ok(/_instIds/.test(completar) && !/_liberado/.test(completar),
   'e quem completa as imagens nao depende de o laudo estar liberado ou nao');

console.log('\n=== o retorno aparece ONDE ele esta olhando ===');
// log() escreve em #log, que vive ATRAS da telaDia (position:fixed, fundo opaco). A frase
// existia e ele nunca a leria — a mesma armadilha ja registrada em capForcarTrazer.
ok(/capForcarAviso\(/.test(reabrir), 'usa o aviso visivel da propria telaDia');
/* "Visivel" nao basta: a caixa vive DEPOIS da lista de exames. Num dia de 25 exames ela
   nasce a 5.793 px do topo, numa janela de 484 — a 1a versao desta correcao apenas trocou
   "atras da tela" por "abaixo da dobra", e ele atende perto de 100 por dia. */
const avisoFn = grab('capForcarAviso');
ok(/scrollIntoView/.test(avisoFn), 'e o aviso ROLA ate ficar na tela');
ok(!/behavior:'smooth'/.test(avisoFn),
   'sem rolagem suave: sao milhares de pixels de viagem, e assincrona — a tela ainda '
   + 'estaria a caminho quando ele olhasse');
ok(/continua na lista de hoje/.test(reabrir),
   'dizendo que o exame continua na lista — em vez de sumir sem explicacao');
ok(/Revisar/.test(reabrir), 'e qual botao usar quando quiser trabalhar nele');
ok(/jaEstavaAberto/.test(reabrir) && /já estava aberto/.test(reabrir),
   'exame que NAO estava assinado tambem da retorno — botao sem efeito visivel ensina '
   + 'a nao confiar nos outros botoes');

console.log('\n=== as palavras dizem so o que o programa faz ===');
// Nao existe caminho para acrescentar DITADO a um exame ja capturado: capOrtCompletar
// baixa imagem, e o anexo manual da revisao e de foto. Prometer ditado era prometer o
// que o programa nao cumpre.
ok(!/ditado/i.test(reabrir),
   'a mensagem e o confirm nao prometem mais "receber ditado"');
ok(/imagens que o aparelho enviar/.test(reabrir),
   'prometem o que de fato acontece: as imagens atrasadas entram');
/* ...e SO quando ha o que vigiar. Ditado avulso nao tem estudo no aparelho, e a espera
   pode estar desligada — a frase saia igual nos dois casos, afirmando o que nao ia
   acontecer. O proprio `if(x._estudoId)` logo acima ja sabia disso; a frase, nao. */
ok(/var _vigia=\(x\._estudoId && \(typeof capOrtWatching/.test(reabrir),
   'a frase das imagens so sai quando ha estudo no aparelho E a espera esta ligada');
ok(/sem estudo no aparelho para vigiar/.test(reabrir),
   'e o diario registra o caso em que nao ha o que vigiar, em vez de repetir a promessa');
const iBt = HTML.indexOf('onclick="diaReabrir(');
const tituloBt = /title="([^"]*)"/.exec(HTML.slice(iBt - 200, iBt + 300)) || [];
ok(tituloBt[1] && !/ditado/i.test(tituloBt[1]),
   'e o title do proprio botao tambem  [' + (tituloBt[1] || 'sem title') + ']');
const doc = HTML.slice(Math.max(0, HTML.indexOf('function diaReabrir(') - 400),
                       HTML.indexOf('function diaReabrir('));
ok(/NÃO traz ditado de volta/.test(doc),
   'e o comentario da funcao registra que ditado NAO volta, para ninguem reprometer');

console.log('\n=== o cartao nao se contradiz depois de reabrir ===');
// O selo de liberado saia do banco OU da sessao. Reabrir muda a sessao, nunca o banco:
// o mesmo cartao dizia "aguarda revisao" e mostrava "liberado" ao lado.
const item = grab('repoItem');
ok(/liberado: \(ex && ex\.laudo\) \? !!ex\._liberado/.test(item),
   'exame COM LAUDO nesta sessao manda sobre o banco');
/* E O CONTRARIO TAMBEM TEM DE VALER. A 1a versao desta correcao fez a sessao mandar
   SEMPRE, e criou a mentira ao contrario: exame trazido do aparelho nasce sem `_liberado`
   (capOrtProcessar), e o cartao passou a dizer "○ a liberar" num exame ja assinado noutro
   dia. Sem laudo aqui, quem sabe e o banco. */
ok(/_repo\.liberados\[eid\]/.test(item),
   'e exame SEM laudo aqui continua ouvindo o banco');
ok(/TRÊS casos/.test(item),
   'e o comentario registra que a regra tem tres casos, nao dois');

console.log('\n=== nenhuma outra saida da telaDia cai na interface antiga ===');
/* Varre os botoes da telaDia — os ESCRITOS na marcacao E os GERADOS em JS por
   diaRenderLista, que sao justamente os que importam (Revisar, Reabrir, Abrir na pasta).
   A 1a versao desta varredura so olhava a marcacao estatica: os tres botoes de trabalho
   do cartao nem entravam na conta, e ela dava verde sem ter olhado o que quebrou. */
const iDia = HTML.indexOf('<div id="telaDia">');
const iFim = HTML.indexOf('<!-- ======================= TELA 4', iDia);
const marcacaoDia = HTML.slice(iDia, iFim > 0 ? iFim : iDia + 6000);
const chamadas = [...marcacaoDia.matchAll(/onclick="([a-zA-Z0-9_]+)\(/g)].map(m => m[1]);
// os gerados dentro de diaRenderLista, escritos como onclick="nome(...)" em template
const gerados = [...semComentarios(grab('diaRenderLista'))
  .matchAll(/onclick="([a-zA-Z0-9_]+)\(/g)].map(m => m[1]);
const todos = [...new Set(chamadas.concat(gerados))];
ok(todos.length >= 6, 'achei os botoes do painel do dia  [' + todos.join(', ') + ']');
ok(todos.indexOf('diaReabrir') >= 0 && todos.indexOf('diaRevisar') >= 0,
   'incluindo os do cartao, que sao gerados em JS');
/* A pergunta certa nao e "chama mostrarAba?" e sim "deixa o medico sem tela?". Uma tela
   nova em cima (telaRev2, telaAntigos) nao prende; fechar a telaDia e mostrar aba antiga,
   sim. Por isso a condicao e: saiu do painel do dia SEM abrir outra tela nova. */
const NOVAS = /telaRev2|telaAbertura|telaAntigos|telaHistorico|rev2Abrir|abVoltarInicio|diaAbrir|antAbrir|hisAbrir/;
const presas = todos.filter(nome => {
  let corpo; try { corpo = semComentarios(grab(nome)); } catch (e) { return false; }
  const saiu = /diaFechar\(\)/.test(corpo) || /telaDia'\)[^\n]*display='none'/.test(corpo);
  return saiu && !NOVAS.test(corpo);
});
ok(!presas.length,
   'nenhum botao do painel do dia sai dele sem abrir outra tela nova  [' + presas.join(', ') + ']');
const usamAba = todos.filter(nome => {
  let corpo; try { corpo = semComentarios(grab(nome)); } catch (e) { return false; }
  return /mostrarAba\(/.test(corpo);
});
ok(!usamAba.length,
   'e nenhum deles abre uma aba da interface antiga  [' + usamAba.join(', ') + ']');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
