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
ok(/onclick="capForcarAbrir\(\)"/.test(HTML), 'existe o botao de trazer na mao');
ok(/Trazer exame do aparelho/.test(HTML), 'com nome que diz o que faz');
ok(/id="capForcarLista"/.test(HTML), 'e um lugar na tela para a lista aparecer');

console.log('\n=== e ele esta na tela que ELE USA ===');
// 03/09/2026 — ESTA VERIFICACAO NASCEU DE UM ERRO MEU. Pus o botao ao lado do "Aguardar
// exame do aparelho", que vive na telaExames — a interface ANTIGA, que ele nao abre. O
// codigo compilou, a suite passou inteira, e ele respondeu: "tenho certeza que tu
// colocou aqui, porque eu nao estou achando".
// O index.html tem DUAS interfaces vivas: a nova (telaAbertura/telaDia/telaRev2) e a
// velha (telaExames/telaRevisao/telaAntigos), e a velha continua no arquivo inteira. Um
// comentario de 31/08 no proprio codigo registra o MESMO engano com o contador do dia.
// Testar que o botao existe nao basta: tem de estar na tela certa.
function telaDe(marca) {
  const i = HTML.indexOf(marca);
  if (i < 0) return 'NAO ACHEI';
  const m = [...HTML.slice(0, i).matchAll(/<div id="(tela[A-Za-z0-9]+)"/g)];
  return m.length ? m[m.length - 1][1] : '(fora de tela)';
}
const NOVAS = ['telaDia', 'telaAbertura', 'telaRev2'];
const telaBotao = telaDe('onclick="capForcarAbrir()"');
ok(NOVAS.indexOf(telaBotao) >= 0,
   'o botao vive numa tela da interface NOVA  [' + telaBotao + ']');
ok(telaBotao === 'telaDia',
   'e especificamente no painel do dia, que e o que ele olha enquanto atende');
ok(telaDe('id="capForcarLista"') === telaBotao,
   'a lista abre na MESMA tela do botao  [' + telaDe('id="capForcarLista"') + ']');
ok((HTML.match(/id="capForcarLista"/g) || []).length === 1,
   'e ha um so lugar com esse id — dois iguais fariam a lista abrir na tela errada');
ok(/function capForcarAbrir\(/.test(HTML) && /function capForcarTrazer\(/.test(HTML),
   'as duas funcoes existem');

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
