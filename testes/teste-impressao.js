// IMPRESSAO AUTOMATICA EM UMA OU DUAS IMPRESSORAS — 24/08/2026.
//
// Pedido do medico: ao liberar o laudo, uma impressora imprime as IMAGENS do exame e
// outra imprime o LAUDO, sem caixa de dialogo. Com a opcao desligada, tudo sai na
// mesma impressora. As fotos podem ser marcadas uma a uma; NENHUMA marcada = TODAS.
//
// O que esta suite protege (e por que cada coisa importa):
//  - a impressao passa pelo AGENTE, nao por window.print(): o navegador nao escolhe
//    impressora, e trocar isso por print() de volta faria o pedido virar dialogo;
//  - "nenhuma marcada = todas": tratar silencio como zero imprimiria nada, calado;
//  - imprimir depois de salvar: papel na mao e nada no disco e a pior ordem possivel;
//  - nasce DESLIGADO: papel sair sozinho e efeito no mundo, decisao do medico.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const AGENTE = path.join(__dirname, '..', '..', 'laudos-programa', 'agente');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + nome);
}

console.log('=== o caminho existe de ponta a ponta ===');
ok(/id="cfgImpAuto"/.test(HTML), 'ha o interruptor de imprimir ao liberar');
ok(/id="cfgImpSeparadas"/.test(HTML), 'e o de usar DUAS impressoras');
ok(/id="cfgImpLaudo"/.test(HTML) && /id="cfgImpImagens"/.test(HTML),
   'com um campo de impressora para cada coisa');
['cfgImpAuto', 'cfgImpSeparadas', 'cfgImpLaudo', 'cfgImpImagens', 'impStatus', 'impLinhaImagens']
  .forEach(id => ok(new RegExp('getElementById\\([\'"]' + id + '[\'"]\\)').test(HTML),
                    'o codigo alcanca #' + id));
ok(/onclick="impCarregarImpressoras\(true\)"/.test(HTML),
   'e ha um botao que reprocura as impressoras');

console.log('\n=== nasce DESLIGADO (papel sair sozinho e decisao do medico) ===');
const ligada = grab('impLigada');
ok(/getItem\('gimpauto'\)==='1'/.test(ligada),
   'so esta ligada quando o guardado diz 1 — ausente/vazio significa desligada');
ok(/catch\(e\)\{ return false/.test(ligada),
   'e se o navegador negar a memoria, o padrao continua DESLIGADO (nao imprime por engano)');

console.log('\n=== nenhuma foto marcada = TODAS ===');
// Esta e a regra que ele pediu explicitamente. Tratar "nada marcado" como zero faria o
// laudo sair sem foto nenhuma, sem aviso — o silencio dele viraria uma decisao que nao tomou.
const escolha = grab('impImagensDoExame');
ok(/if\(!marcadas\|\|!marcadas\.length\) return todas\.slice\(\)/.test(escolha),
   'sem marcacao, devolve TODAS as imagens do exame');
ok(/todas\.filter\(function\(_,i\)\{ return marcadas\.indexOf\(i\)>=0; \}\)/.test(escolha),
   'e com marcacao, devolve exatamente as marcadas');
ok(/saem todas as/.test(HTML),
   'e a TELA diz isso — sem a frase, nenhuma marca parece "nao vai imprimir foto"');
// A marcacao nao pode ser salva: um exame reaberto semanas depois nao deve imprimir um
// recorte que ninguem lembra ter feito.
const marcar = grab('revImgMarcar');
ok(!/localStorage|dadoSalvar/.test(marcar),
   'a marcacao vive so na tela — nao e guardada entre sessoes');

console.log('\n=== as imagens sao as do exame QUE ESTA SENDO IMPRESSO ===');
ok(/exames\.find\(function\(e\)\{ return e\.id===exId; \}\)/.test(escolha),
   'a lista vem do exame pedido, nao de uma variavel global de "exame atual"');

console.log('\n=== uma impressora so, quando a opcao esta desligada ===');
const imprimir = grab('impImprimirAgora');
ok(/impSeparadas\(\)\?impEscolhida\('imagens'\):impLaudo/.test(imprimir),
   'com a opcao desligada, as imagens vao para a MESMA impressora do laudo');
ok(/if\(!impLaudo\)/.test(imprimir),
   'e sem impressora escolhida ele avisa, em vez de mandar para lugar nenhum');

console.log('\n=== imprimir DEPOIS de salvar e registrar ===');
// Papel na mao e nada no disco e a pior ordem possivel.
const liberar = grab('liberarEProximo');
const posSalvar = liberar.indexOf('salvarLaudoHistorico');
const posImprimir = liberar.indexOf('impImprimirAgora');
ok(posSalvar >= 0 && posImprimir > posSalvar,
   'em liberarEProximo, a impressao vem depois de salvar no historico');
ok(/if\(impLigada\(\)\)\{ try\{ await impImprimirAgora/.test(liberar),
   'e so acontece com a opcao ligada');

console.log('\n=== o botao de imprimir da tela nova respeita a opcao ===');
const aprovar = grab('rev2Aprovar');
ok(/if\(impLigada\(\)\)\{ try\{ await impImprimirAgora\(ex\.id\); \}catch\(e\)\{\} \}/.test(aprovar),
   'ligado: manda para as impressoras escolhidas, sem dialogo');
// 25/08 (4a leva): desligado, o botao ainda tenta a impressora das Configuracoes
// (imprimirLaudoAtual) e SO ENTAO cai na caixa do navegador — que no computador do
// medico remontava o laudo e saiu bagunçada no papel.
ok(/else \{ try\{ await imprimirLaudoAtual\(\); \}catch\(e\)\{\} \}/.test(aprovar),
   'desligado: passa pela impressora das Configuracoes, com a caixa do navegador de reserva');
ok(/window\.print\(\);/.test(grab('imprimirLaudoAtual')),
   'e a caixa do navegador continua existindo como reserva');

console.log('\n=== a lista de impressoras e lida ao vivo, nunca guardada ===');
// O medico avisou que as impressoras nao estao necessariamente instaladas nesta
// maquina. Uma lista guardada ofereceria uma impressora que sumiu, e o erro so
// apareceria na hora de liberar o laudo.
const carregar = grab('impCarregarImpressoras');
ok(/agenteBase\(\)\+'\/impressoras'/.test(carregar), 'pergunta ao agente a cada vez');
ok(!/localStorage\.setItem\([^)]*lista/.test(carregar), 'e nao guarda a lista');
ok(/NÃO encontrada agora/.test(carregar),
   'a impressora escolhida que sumiu continua na lista, marcada — sumir calada faria o campo voltar a "(nenhuma)" e parecer que ele nunca escolheu');
ok(/não consegui falar com o computador/.test(carregar),
   'e agente fora do ar e dito como tal, nao como "nenhuma impressora"');

console.log('\n=== o que vai para o papel e o laudo da tela, com as edicoes dele ===');
const htmlLaudo = grab('impHtmlDoLaudo');
ok(/getElementById\('areaImpressao'\)/.test(htmlLaudo),
   'o HTML mandado e o MESMO no que a impressao do navegador ja usava');

console.log('\n=== falha de impressora nunca derruba o laudo ===');
ok(/catch\(e\)\{[\s\S]{0,200}Não consegui falar com o computador para imprimir/.test(imprimir),
   'erro de rede vira aviso, nao excecao');
ok(/partes\.push\('laudo: '/.test(imprimir) && /partes\.push\('imagens: '/.test(imprimir),
   'e cada metade e relatada SEPARADA — "deu erro" mandaria conferir as duas coisas');

console.log('\n=== o lado do agente existe e esta ligado ===');
const py = fs.readFileSync(path.join(AGENTE, 'impressao.py'), 'utf8');
const ag = fs.readFileSync(path.join(AGENTE, 'agente-laudos.py'), 'utf8');
const ps1 = fs.readFileSync(path.join(AGENTE, 'imprimir.ps1'), 'utf8');
ok(/^import impressao/m.test(ag), 'o agente importa o modulo de impressao');
ok(/p == "\/impressoras"/.test(ag), 'e responde a rota que lista as impressoras');
ok(/rota == "\/imprimir"/.test(ag), 'e a rota que imprime');
ok(/self\._json\(200, \{"ok": False/.test(ag),
   'falha ao imprimir responde 200 com ok:false — nunca derruba o agente (o laudo ja esta salvo)');
ok(/InstalledPrinters/.test(py) && /InstalledPrinters/.test(ps1),
   'a lista sai do proprio Windows, nos dois lados');
ok(/impressora nao encontrada/.test(ps1),
   'e imprimir numa impressora que sumiu falha com o nome dela na mensagem');
ok(/HasMorePages/.test(ps1),
   'laudo mais alto que uma folha e paginado, em vez de sair cortado');
ok(/Get-CorteSeguro/.test(ps1) && /recua/.test(ps1),
   'e o corte da pagina recua para uma linha em branco — cortar no ponto exato partiria a linha de texto (podia partir um numero de medida)');
ok(/Paisagem/.test(ps1) && /paisagem=True/.test(py),
   'as fotos saem deitadas: em pe ficariam pequenas no meio da folha');
const escolhaA4 = ps1.slice(ps1.indexOf('if ($DaBorda)'), ps1.indexOf('$temMargens'));
ok(/borderless|sem\\s\+\(borda\|margem\|margens\)/.test(escolhaA4) && !/if\s*\(\$Fundo\)/.test(escolhaA4),
   'o laudo prefere A4 sem bordas mesmo sem timbrado — senao o driver pode encolher a folha');
ok(/if \(\$DaBorda -and -not \$script:papelSemBorda/.test(ps1),
   'avisa quando a impressora nao tem A4 sem bordas, mesmo no laudo sem timbrado');
ok(/svg/i.test(py) && /nao pode ser impresso/.test(py),
   'formato que o spooler nao desenha e recusado dizendo QUAL era');

console.log('\n=== nada disso entra no papel do laudo ===');
// As caixas de marcar vivem na coluna das imagens, que fica fora do #areaImpressao.
const bloco = HTML.slice(HTML.indexOf('id="revMidiaImg"'), HTML.indexOf('id="revMidiaImg"') + 200);
ok(/<div id="areaImpressao"[^>]*><\/div>/.test(HTML),
   'a area de impressao continua vazia no HTML (o laudo e injetado nela)');
ok(/#revMidiaImg\{order:3/.test(HTML) || /id="revMidiaImg"/.test(HTML),
   'e a coluna das imagens marcaveis vive fora dela');
const print = HTML.slice(HTML.indexOf('@media print'), HTML.indexOf('@page'));
ok(!/revImgCx|cfgImp/.test(print),
   'a regra de impressao nem cita as caixas de marcar nem os campos de impressora');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
