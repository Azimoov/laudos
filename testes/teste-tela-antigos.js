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
ok(/1 · DE ONDE VEM O MATERIAL\?/.test(HTML), 'secao 1: de onde vem o material');
ok(/2 · MATERIAL DO EXAME/.test(HTML), 'secao 2: material do exame');
ok(/Exames arquivados/.test(HTML) && /id="antGuardados"/.test(HTML),
   'cartao "Exames arquivados" com o selo de quantos ha guardados');
ok(/Laudo novo em branco/.test(HTML), 'cartao "Laudo novo em branco"');
ok(/arraste as imagens de ultrassom aqui/.test(HTML), 'area de arrastar as imagens');
ok(/JPG · PNG · DICOM/.test(HTML), 'com os formatos aceitos escritos');
ok(/Gravar ditado agora/.test(HTML), 'botao redondo de gravar o ditado');
ok(/ou anexar um arquivo de áudio antigo/.test(HTML), 'e a opcao de anexar audio antigo');
ok(/MODELO DO EXAME/.test(HTML) && /PACIENTE/.test(HTML), 'os dois campos de baixo');
ok(/Gerar laudo → enviar para Liberar laudos/.test(HTML), 'o botao principal, com o texto do desenho');
ok(/mesmos alertas coloridos da revisão/.test(HTML), 'e a nota de rodape');

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
ok(/b\.disabled=!\(_antImgs\.length \|\| _antAuds\.length\)/.test(pintar),
   'o botao de gerar so liga quando ha material');

console.log('=== gravar o ditado aqui mesmo ===');
const grava = grab('antGravar');
ok(/MediaRecorder/.test(grava), 'grava pelo navegador');
ok(/toque de novo para parar/.test(grava), 'e diz como parar (nao e obvio)');
ok(/gravando /.test(grava), 'mostrando o tempo enquanto grava');
ok(/NotAllowedError/.test(grava) && /anexar um arquivo de áudio antigo/.test(grava),
   'permissao negada explica E oferece a saida (anexar arquivo), em vez de so falhar');
ok(/antAvisar\(/.test(grava) && !/^\s*log\(/m.test(grava),
   'os avisos aparecem NA TELA — o diario fica atras dela');

console.log('=== avisos e volta ===');
ok(/function antAvisar/.test(HTML), 'a tela tem aviso proprio');
ok(/function antFechar/.test(HTML) && /_antMr\.state==='recording'/.test(grab('antFechar')),
   'sair da tela para a gravacao em curso (senao o microfone ficaria aberto)');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
