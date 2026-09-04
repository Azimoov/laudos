// Tela "Fazer laudos com fotos e audios antigos" (18/08/2026).
//
// Desenhada pelo Dr. Daniel e construida no mesmo dia. E a porta nova para o que
// a aba "Arquivos acumulados" do 1.0 fazia.
//
// A TRAVA QUE IMPORTA: esta tela e uma PORTA, nao um encanamento novo. O material
// escolhido aqui vai para as MESMAS entradas de arquivo da aba antiga e quem
// processa continua sendo `processar()` — a esteira que le a legenda, identifica o
// paciente, casa o ditado e gera o laudo. Se um dia alguem duplicar essa esteira
// aqui dentro, passam a existir duas verdades e so uma esta testada.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
  return '';
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

console.log('=== a tela existe e o botao da abertura leva a ela ===');
ok(/<div id="telaAntigos">/.test(HTML), 'a tela esta no arquivo');
ok(/onclick="antAbrir\(\)"/.test(HTML), 'o botao "Fazer laudos com fotos e audios antigos" abre ela');
ok(!/onclick="abEscolher\('acumulados'\)"/.test(HTML),
   'e nao cai mais na aba antiga do 1.0');
ok(/#telaAntigos\{[^}]*display:none/.test(HTML), 'nasce escondida (so aparece quando chamada)');

console.log('=== o desenho do medico, secao por secao ===');
/* 04/09/2026 — A PERGUNTA "DE ONDE VEM O MATERIAL?" E OS DOIS CARTOES SAIRAM, a pedido
   dele. Um deles nao fazia nada ("Laudo novo em branco" era o estado em que a tela ja
   nasce); o outro, "Exames arquivados", chamava capRecuperar — que so olha os exames de
   HOJE e os despeja na fila de "Liberar laudos", outra tela. Numa tela de fotos e audios
   ANTIGOS isso nao e inutil, e enganoso. */
/* SEM OS COMENTARIOS. O proprio comentario que registra a remocao CITA os nomes dos
   botoes removidos — sem isto, a explicacao do conserto faria o teste do conserto falhar,
   e a saida seria apagar a explicacao. */
const VIVO = HTML.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
ok(!/DE ONDE VEM O MATERIAL/.test(VIVO), 'a pergunta "de onde vem o material?" saiu');
ok(!/Exames arquivados/.test(VIVO) && !/id="antGuardados"/.test(VIVO),
   'e o cartao "Exames arquivados", que so alcancava hoje, saiu junto');
ok(!/Laudo novo em branco/.test(VIVO), 'e o "Laudo novo em branco", que nao fazia nada');
ok(!/antFonte\(/.test(HTML), 'a funcao dos dois botoes saiu — nao ficou codigo sem porta');
ok(!/function antContarArquivados\(/.test(HTML), 'nem o contador do selo que nao existe mais');
ok(/>MATERIAL DO EXAME</.test(HTML), 'a secao do material continua, agora sem numero');
ok(/arraste as imagens de ultrassom aqui/.test(HTML), 'area de arrastar as imagens');
ok(/JPG · PNG · DICOM/.test(HTML), 'com os formatos aceitos escritos');
/* 04/09/2026, pedido dele: uma caixa de arrastar AUDIO, igual a das imagens. Antes o
   audio so entrava por um link de texto, que nao se parecia com nada e nao aceitava
   arrastar. Arrastar imagem e arrastar audio sao o mesmo gesto. */
ok(/id="antSoltaAud"/.test(HTML), 'ha uma caixa PROPRIA de arrastar audios');
ok(/arraste os áudios do ditado aqui/.test(HTML), 'com o mesmo convite da de imagens');
ok(/MP3 · M4A · WAV · WEBM/.test(HTML), 'e os formatos de som escritos');
const _iImg = HTML.indexOf('id="antSolta"'), _iAud = HTML.indexOf('id="antSoltaAud"');
ok(_iImg >= 0 && _iAud > _iImg, 'a de audios vem depois da de imagens, na mesma coluna');
ok(/LISTA DE EXAMES/.test(HTML), 'e a coluna da direita passou a se chamar "lista de exames"');
ok(/MODELO DO EXAME/.test(HTML) && /PACIENTE/.test(HTML), 'os dois campos de baixo');
ok(/Gerar laudo → enviar para Liberar laudos/.test(HTML), 'o botao principal, com o texto do desenho');
ok(/mesmos alertas coloridos da revisão/.test(HTML), 'e a nota de rodape');

console.log('=== a ordem da tela: primeiro o trabalho, depois a estante ===');
/* 04/09/2026, pedido dele: "o material do exame fica acima da lista de datas". As duas
   metades olham para lados opostos — MATERIAL → LISTA DE EXAMES → Gerar laudo e um caminho
   que termina num botao; EXAMES GUARDADOS e uma estante que se consulta. Com a estante em
   cima, quem abria a tela para FAZER um laudo tinha de rolar por ela antes de comecar. */
const _iMat = HTML.indexOf('>MATERIAL DO EXAME<');
const _iBot = HTML.indexOf('id="antGerar"');
const _iRepo = HTML.indexOf('id="antRepo"');
ok(_iMat >= 0 && _iRepo > _iMat, 'o material do exame vem ANTES da lista de datas');
ok(_iBot >= 0 && _iRepo > _iBot, 'e o botao "Gerar laudo" tambem — a estante fica no pe');

console.log('=== a porta usa a esteira que ja existe (nao uma nova) ===');
const gerar = grab('antGerar');
ok(/antParaInput\('inpExames'/.test(gerar) && /antParaInput\('inpAudios'/.test(gerar),
   'o material vai para as MESMAS entradas de arquivo da aba antiga');
ok(/await processar\(\)/.test(gerar), 'e quem processa continua sendo processar()');
ok(!/openai\(|gerarLaudo\(|classifAplicar\(/.test(gerar),
   'a tela NAO tem esteira propria — se tiver, passam a existir duas verdades');
ok(/abLiberarLaudos\(\)/.test(gerar), 'no fim, leva para a fila de "Liberar laudos"');

console.log('=== o que o medico escolhe a mao manda no que a IA deduziu ===');
const aplicar = grab('antAplicarEscolhas');
ok(/if\(f\.tipo\) ex\.tipo=f\.tipo/.test(aplicar), 'o modelo escolhido vale para os exames');
ok(/if\(f\.paciente\) ex\.paciente=f\.paciente/.test(aplicar), 'o nome digitado tambem');
ok(/if\(f\.tipo \|\| f\.paciente\)|if\(!f\.tipo && !f\.paciente\) return/.test(aplicar),
   'mas campo VAZIO nao apaga o que foi lido da imagem');
ok(/Detectar pelo ditado/.test(HTML), 'e o padrao do modelo e deixar o ditado decidir');

console.log('=== o material escolhido e visivel e reversivel ===');
const pintar = grab('antPintar');
ok(/imagens adicionadas/.test(pintar) && /imagem adicionada/.test(pintar),
   'o contador de imagens escreve certo no singular e no plural');
ok(!/imagemns/.test(HTML), 'e nao escreve "imagemns" (erro de 18/08, achado no teste)');
ok(/antTirarImg\(/.test(pintar) && /antTirarAud\(/.test(pintar),
   'da para tirar uma imagem ou um audio que entrou por engano');
ok(/b\.disabled=!\(_antImgs\.length \|\| _antAuds\.length \|\| _naLista\)/.test(pintar),
   'o botao de gerar so liga quando ha material');
/* 04/09/2026 — O DEFEITO: ele buscou um exame no aparelho, gravou o ditado na linha e o
   botao "Gerar laudo" seguiu apagado. `antPintar` contava so as duas caixas de arrastar e
   ignorava a LISTA DE EXAMES; `antGerar`, do outro lado, ja contava `dicomProntos`. Duas
   contas para a mesma pergunta ("ha material?") — e a que ele VE era a errada. */
ok(/dicomProntos!=='undefined'\) \? dicomProntos\.length/.test(pintar),
   'e o exame vindo do aparelho CONTA como material (o defeito de 04/09)');
ok(/typeof dicomProntos!=='undefined'/.test(pintar),
   'sem quebrar se a lista do aparelho nao existir nesta pagina');
const rend = grab('dicomProntosRender');
ok(/antPintar\(\)/.test(rend),
   'e toda mudanca na lista repinta o botao — importar, tirar, gravar, apagar ditado');
ok(rend.indexOf('antPintar()') < rend.indexOf('if(!dicomProntos.length)'),
   'inclusive quando a lista fica VAZIA (o botao tem de apagar de novo)');

console.log('=== o microfone mora na LINHA do exame ===');
/* 04/09/2026, pedido dele: "cada um deles tenha um microfonezinho para gravar o audio.
   Dessa forma, o audio fica vinculado especificamente a aquele exame."
   O QUE ISSO EVITA: ate aqui todo audio desta tela era AVULSO, e quem decidia de quem ele
   era foi sempre o casamento por nome/tipo (vincularAudios) — um bom palpite, mas palpite,
   e o preco de errar e o ditado de um paciente entrar no laudo de outro. */
ok(!/function antGravar\(/.test(HTML),
   'o microfone AVULSO saiu — gravador sem botao e codigo que parece vivo e nao e');
ok(!/Gravar ditado agora/.test(VIVO), 'e o botao redondo dele tambem');
const grava = grab('antGravarNoExame');
ok(/MediaRecorder/.test(grava), 'o microfone da linha grava pelo navegador');
ok(/dicomProntos\[i\]/.test(grava), 'e sabe de QUAL exame esta gravando');
ok(/d\.audios=d\.audios\|\|\[\]/.test(grava),
   'o arquivo entra na lista DAQUELE exame, nao numa lista geral');
ok(/parar/.test(grava) && /gravando /.test(grava),
   'diz como parar e mostra o tempo enquanto grava');
ok(/NotAllowedError/.test(grava), 'permissao negada explica, em vez de so falhar');
ok(/antAvisar\(/.test(grava), 'e os avisos aparecem NA TELA — o diario fica atras dela');
/* Duas gravacoes ao mesmo tempo dariam duas fitas do mesmo minuto, e ele nao teria como
   saber qual e de quem. */
ok(/_antMrEx\.state==='recording'/.test(grava) && /_antMrEx\.stop\(\)/.test(grava),
   'tocar noutro microfone enquanto um grava PARA o que grava, e nao abre um segundo');
ok(/antMicExSub/.test(HTML), 'cada linha tem onde dizer se ja tem ditado');
ok(/function antOuvirDoExame\(/.test(HTML) && /function antTirarAudDoExame\(/.test(HTML),
   'e da para ouvir e tirar o ditado de um exame');

console.log('=== e o vinculo sobrevive ate virar laudo ===');
/* Nao adianta prender o audio ao exame na tela e solta-lo no meio do caminho. */
ok(/_audiosProprios:\(d\.audios\|\|\[\]\)\.slice\(\)/.test(HTML),
   'o exame criado a partir da lista leva os ditados dele junto');
const vinc = grab('antVincularAudiosProprios');
ok(/exameId:ex\.id/.test(vinc),
   'e ao transcrever, o audio ja nasce com dono — sem passar pelo casamento por nome');
ok(/ex\.audios\.push\(idx\)/.test(vinc), 'o exame passa a apontar para ele');
ok(/transcreverAudio\(f\)/.test(vinc), 'usa a mesma transcricao do resto do programa');
ok(/catch\(e\)/.test(vinc) && /continua guardado no exame/.test(vinc),
   'falha de transcricao NAO perde o vinculo, e avisa');
ok(gerar.indexOf('antVincularAudiosProprios') > gerar.indexOf('await processar()'),
   'roda DEPOIS de processar (que e quem cria os exames) e antes de gerar');

console.log('=== avisos e volta ===');
ok(/function antAvisar/.test(HTML), 'a tela tem aviso proprio');
ok(/function antFechar/.test(HTML) && /_antMr\.state==='recording'/.test(grab('antFechar')),
   'sair da tela para a gravacao em curso (senao o microfone ficaria aberto)');
ok(/_antMrEx\.state==='recording'/.test(grab('antFechar')),
   'e para TAMBEM a gravacao da linha do exame — sao dois gravadores agora');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
