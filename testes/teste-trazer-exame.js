// TRAZER UM EXAME QUE O APARELHO JA TEM — 03/09/2026, pedido do Dr. Daniel.
//
// "Eu mando um exame pro dia de atendimento, nao deu certo, ai eu tento mandar de novo
// e ele nao vai... eu gosto da trava, mas gostaria de ter a possibilidade de
// sobrepuja-la."
//
// POR QUE REENVIAR DO APARELHO NAO RESOLVIA: ao ligar a espera, tudo o que ja estava no
// recebedor e anotado como ANTIGO (capOrtSeen), para o historico inteiro nao cair na
// lista do dia. Esse conjunto e ignorado no laco da varredura SEM UMA PALAVRA na tela; e
// o reenvio do ultrassom manda as MESMAS imagens, que o recebedor guarda sob o mesmo
// numero. Para o programa nada mudou — foi por isso que ele viu "nao vem, e nao diz nada".
// Confirmado por ele: "nao ha mensagem, so nao vem".
//
// O QUE ESTA SUITE PROTEGE: a trava CONTINUA (ele gosta dela), e a porta de saida existe,
// e nenhuma das duas anula a outra. Em especial: forcar nunca duplica em silencio.
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

console.log('=== a trava continua de pe ===');
const proc = grab('capOrtProcessar');
ok(/if\(capOrtSeen\.has\(e\.id\)\) continue;/.test(HTML),
   'exame que ja estava no aparelho segue tratado como antigo na varredura');
ok(/if\(repetido && !forcar\)/.test(proc),
   'e exame que ja esta na lista continua NAO sendo duplicado sozinho');
ok(/nao dupliquei/.test(proc) || /não dupliquei/.test(proc),
   'com a mensagem de sempre quando a varredura o encontra');

console.log('\n=== e agora ha uma porta ===');
/* ⚠️ 09/09/2026 — A PORTA MUDOU DE LUGAR, E O TESTE FOI ATRAS DELA.
   Ate hoje esta secao cobrava o BOTAO "⤵ Trazer exame do aparelho…" dentro do painel do
   dia. Ele nasceu em 03/09 como valvula de escape da trava de exames repetidos, e havia
   ate uma secao inteira aqui embaixo conferindo em QUAL tela ele morava — porque na 1a
   tentativa eu o pus na interface antiga e ele respondeu "tenho certeza que tu colocou,
   porque eu nao estou achando".

   Em 09/09 o Dr. Daniel pediu a reconstrucao do layout e, com todas as palavras: "o
   botao 'Trazer exame do aparelho' deve ser removido". Nao e descuido, e decisao — e
   remover um botao a pedido nao pode deixar a suite vermelha para sempre.

   O QUE NAO PODE MUDAR, e e o que se cobra agora: a CAPACIDADE continua alcancavel. O
   exame que esta no aparelho aparece na lista de trabalho com os botoes ⤵, e eles chamam
   `capForcarTrazer` -- a MESMA funcao que o botao removido usava. Se alguem cortar esse
   fio, o medico perde o unico jeito de passar por cima da trava, e cai aqui. */
ok(/function capForcarTrazer\(/.test(HTML),
   'a valvula de escape continua existindo (capForcarTrazer)');
ok(/function capForcarAbrir\(/.test(HTML),
   'e a lista de escolha tambem, para quem quiser religar o botao');
const acoes = grab('repoAcoesHtml');
ok(/repoTrazer\(/.test(acoes),
   'o cartao do exame na lista oferece os botoes ⤵ de trazer');
ok(/para hoje/.test(acoes) && /para antigos/.test(acoes),
   'com os dois destinos: para hoje e para a tela de antigos');
const trazerDoCartao = grab('repoTrazer');
ok(/capForcarTrazer\(/.test(trazerDoCartao),
   'e eles chamam a MESMA valvula de escape — a capacidade nao se perdeu com o botao');

/* Em que tela mora um trecho do arquivo. Nasceu em 03/09 de um erro meu: pus o botao na
   interface ANTIGA (telaExames), tudo compilou, a suite passou inteira, e ele respondeu
   "tenho certeza que tu colocou, porque eu nao estou achando". O index.html tem duas
   interfaces vivas e a velha continua no arquivo inteira — dizer que algo "existe" nao
   basta, tem de existir na tela que ele abre. Continua sendo usado mais abaixo. */
function telaDe(marca) {
  const i = HTML.indexOf(marca);
  if (i < 0) return 'NAO ACHEI';
  const m = [...HTML.slice(0, i).matchAll(/<div id="(tela[A-Za-z0-9]+)"/g)];
  return m.length ? m[m.length - 1][1] : '(fora de tela)';
}

console.log('\n=== forcar NUNCA duplica em silencio ===');
// Ele pediu para poder sobrepujar a trava, nao para a trava sumir: dois exames iguais na
// fila viram dois laudos do mesmo paciente, e ele so descobriria na hora de assinar.
ok(/if\(repetido && forcar\)/.test(proc), 'ha um caminho proprio para o exame ja presente');
ok(/confirm\(/.test(proc), 'que PERGUNTA antes de criar o segundo');
ok(/JÁ ESTÁ na lista de hoje/.test(proc), 'dizendo que ele ja esta la');
ok(/SEGUNDO exame igual/.test(proc), 'e o que vai acontecer se ele seguir');
const iCancel = proc.indexOf('Cancelar');
ok(iCancel > 0, 'com a saida oferecida na mesma pergunta');
ok(/log\('Exame do aparelho trazido DE NOVO/.test(proc),
   'e o diario registra que houve duplicacao pedida — nao e um exame que apareceu do nada');

console.log('\n=== trazer na mao tira o exame das duas listas de controle ===');
const trazer = grab('capForcarTrazer');
ok(/capOrtSeen\.delete\(est\.id\)/.test(trazer),
   'sai de capOrtSeen: sem isso a varredura seguinte o trataria como antigo de novo');
ok(/capOrtFeitos\.delete\(est\.id\)/.test(trazer), 'e de capOrtFeitos');
ok(trazer.indexOf('capOrtSeen.delete') < trazer.indexOf('capOrtProcessar'),
   'a limpeza vem ANTES de processar');
ok(/capOrtFeitos\.add\(est\.id\)/.test(trazer),
   'e depois ele volta a ser vigiado, como qualquer exame capturado');
ok(trazer.indexOf('capOrtProcessar') < trazer.lastIndexOf('capOrtFeitos.add'),
   'nessa ordem — vigiado DEPOIS de entrar, para as imagens atrasadas ainda o completarem');
ok(/capOrtProcessar\(est, true\)/.test(trazer), 'e processa com o forcar ligado');

console.log('\n=== a lista ajuda a escolher, em vez de pedir fe ===');
const abrir = grab('capForcarAbrir');
ok(/ja está na sua lista/.test(abrir) || /já está na sua lista/.test(abrir),
   'diz quais exames JA estao na lista de hoje');
ok(/ignorado como antigo/.test(abrir),
   'e quais foram ignorados por ja estarem no aparelho quando a espera ligou');
ok(/dataOrdem/.test(abrir) && /localeCompare/.test(abrir), 'os mais novos vem primeiro');
ok(/slice\(0,\s*12\)/.test(abrir),
   'e a lista para em 12: ele esta atendendo, procurando o exame que acabou de mandar');
ok(/nImagens/.test(abrir), 'cada linha mostra quantas imagens tem');
ok(/capForcarFechar\(\)/.test(abrir), 'da para fechar a lista');

console.log('\n=== DOIS destinos, escolhidos por ele (03/09/2026, 2a leva) ===');
// A 1a versao recusava o exame de outro dia com um aviso ("nao entra no painel de hoje").
// Ele pediu o contrario: dois botoes, e a decisao com ele. Melhor um caminho a escolher
// do que um aviso do que nao da.
ok(/Trazer para tela de hoje/.test(abrir), 'ha o botao "Trazer para tela de hoje"');
ok(/Trazer para tela de exames antigos/.test(abrir), 'e o "Trazer para tela de exames antigos"');
// as aspas do destino vao escapadas dentro do template: \'hoje\'
ok(/hoje\\'\)/.test(abrir), 'o botao de hoje manda o destino "hoje"');
ok(/antigos\\'\)/.test(abrir), 'e o de antigos manda "antigos"');
ok(!/de outro dia — não entra no painel de hoje/.test(HTML),
   'a etiqueta que recusava o exame de outro dia SAIU, como ele pediu');
ok(/destino==='antigos'/.test(trazer), 'o destino "antigos" tem caminho proprio');
ok(/capAntigoLevar\(/.test(trazer), 'e usa a tela de fotos e audios antigos que ja existia');

console.log('\n=== trazer para hoje NAO falsifica a data do exame ===');
// `_quando` e a hora REAL do aparelho, e e ela que casa o ditado com o exame. Mexer nela
// para o exame "caber no filtro" mandaria o audio para o exame errado — que e o erro mais
// caro que este programa pode cometer. A marca e so de exibicao.
ok(/_forcadoHoje=true/.test(trazer), 'marca o exame como trazido a mao para hoje');
ok(!/_quando *=/.test(trazer), 'e NAO mexe em _quando, a hora real do exame');
const deHoje = grab('diaExamesDeHoje');
ok(/x\._forcadoHoje/.test(deHoje), 'e o painel do dia aceita o exame por causa dessa marca');
ok(/_quando/.test(deHoje), 'sem deixar de filtrar os demais pela hora de sempre');

console.log('\n=== a tela de antigos aceita o estudo vindo daqui ===');
const levar = grab('capAntigoLevar');
ok(/function capAntigoLevar\(id, estudo\)/.test(HTML) || /estudo\|\|_capAntigos\[id\]/.test(levar),
   'capAntigoLevar aceita o estudo por parametro, nao so o que a varredura recusou');
ok(/antAbrir\(\)/.test(levar), 'e abre a tela de antigos com as imagens ja baixadas');

console.log('\n=== o retorno aparece na tela que ELE olha ===');
// capOrtStatusTxt escreve em #capOrtStatus, que vive na telaExames — a interface antiga.
// Era por ali que este caminho falava, e por isso ele clicou e a tela nao disse nada.
ok(/function capForcarAviso\(/.test(HTML), 'ha um aviso proprio, na lista da telaDia');
ok(telaDe('function capForcarAviso') !== 'telaExames', 'que nao usa o status da tela antiga');
ok(!/capOrtStatusTxt\(/.test(trazer),
   'e capForcarTrazer nao fala mais pelo status invisivel  [nenhuma chamada]');
ok(/capForcarAviso\(/.test(trazer), 'usa o aviso visivel');
ok(/Exame de <b>/.test(trazer), 'confirmando o sucesso com o nome do paciente');
ok(/exames\.length<=antes/.test(trazer),
   'e se o exame NAO entrar, diz isso — em vez de anunciar sucesso a toa');
ok(/diaRenderLista\(\)/.test(trazer),
   'a lista do dia se redesenha na hora, sem esperar os 5 s do ciclo');

console.log('\n=== nao trava nem mente quando algo falha ===');
ok(/nao consegui falar com o agente/.test(abrir) || /não consegui falar com o agente/.test(abrir),
   'agente fora do ar vira mensagem, nao lista vazia');
ok(/nao esta mais no aparelho/.test(trazer) || /não está mais no aparelho/.test(trazer),
   'exame que sumiu do aparelho entre listar e trazer e avisado');
ok(/sem imagens/.test(trazer), 'e exame sem imagem nao entra como exame vazio');
ok(/catch\(e\)/.test(trazer), 'falha ao trazer vira mensagem, nao silencio');

console.log('\n=== o botao nao fica preso aberto ===');
ok(/style\.display!=='none' && d\.innerHTML/.test(abrir),
   'tocar de novo no botao FECHA a lista, em vez de recarregar por baixo');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
