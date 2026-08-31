// VER O LAUDO FINAL, EDITAVEL, COM "SALVAR E LIBERAR" — 24/08/2026, pedido do medico.
//
// Na tela de liberar laudos ele quer ver o documento COMO SAI na entrega (timbrado,
// assinatura, rodape), poder corrigir ali mesmo, e salvar/liberar do lado.
//
// A DECISAO QUE SUSTENTA TUDO: a tela mostra o #areaImpressao DE VERDADE, emprestado da
// tela de revisao — nao uma copia. Salvar na pasta (salvarLaudoPasta) e guardar no
// historico (salvarLaudoHistorico) leem os DOIS esse mesmo no. Uma copia seria um segundo
// texto para divergir: ele corrigiria na copia e o papel sairia com o texto velho.
//
// E o par perigoso: rev2Preparar() REMONTA o #areaImpressao a partir do objeto do laudo, e
// edicao feita a mao vive so no DOM (revMarcarEditado marca que houve edicao, nao copia o
// texto de volta). Por isso "Salvar e liberar" passa jaPreparado=true — remontar ali
// apagaria exatamente o que ele acabou de digitar.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  let i = HTML.indexOf('async function ' + nome + '(');
  if (i < 0) i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== o caminho existe de ponta a ponta ===');
ok(/onclick="rev2VerFinal\(\)"/.test(HTML), 'ha um botao na tela de liberar que abre a visualizacao');
ok(/id="rv2Final"/.test(HTML), 'e a tela existe');
// indexOf, e nao RegExp montada em string: os parenteses de getElementById(...) viravam
// GRUPO de regex e a busca nunca casava — reprovava um codigo que estava certo.
['rv2Final', 'rv2FinalHost', 'rv2FinalQuem'].forEach(id =>
  ok(HTML.indexOf("getElementById('" + id + "')") >= 0, 'o codigo alcanca #' + id));
ok(/onclick="rev2FinalSalvarLiberar\(\)"/.test(HTML), 'ha o botao "Salvar e liberar" ao lado');
ok(/onclick="rev2FinalFechar\(\)"/.test(HTML), 'e um jeito de voltar sem liberar');

console.log('\n=== mostra o no DE VERDADE, nao uma copia ===');
const ver = grab('rev2VerFinal');
ok(/host\.appendChild\(area\)/.test(ver),
   'o #areaImpressao e MOVIDO para dentro da tela (nao clonado)');
ok(!/innerHTML\s*=/.test(ver), 'nada de copiar HTML para outro lugar — copia divergiria do que e salvo');
ok(/_rv2FinalVolta=\{pai:area\.parentNode, irmao:area\.nextSibling\}/.test(ver),
   'guarda de onde o no veio, para devolver no lugar exato');

console.log('\n=== e devolve o no ao sair (senao o PROXIMO laudo quebra) ===');
const fechar = grab('rev2FinalFechar');
ok(/_rv2FinalVolta\.pai\.insertBefore\(area, _rv2FinalVolta\.irmao\|\|null\)/.test(fechar),
   'devolve o #areaImpressao para a tela de revisao');
ok(/_rv2FinalVolta=null/.test(fechar), 'e limpa a marca, para nao devolver duas vezes');

console.log('\n=== a EDICAO sobrevive ao salvar (o ponto que faz a feature valer) ===');
const salvarLib = grab('rev2FinalSalvarLiberar');
ok(/rev2FinalFechar\(\)/.test(salvarLib),
   'devolve o no ANTES de aprovar — o proximo laudo precisa acha-lo no lugar de sempre');
ok(/rev2Aprovar\(false, true\)/.test(salvarLib),
   'e aprova com jaPreparado=true — sem isso rev2Preparar remontaria e APAGARIA a edicao');
// Sem os comentarios: o comentario da funcao CITA rev2Aprovar antes da chamada de
// rev2FinalFechar, e a primeira versao deste teste comparou as posicoes no texto cru.
const salvarLibCodigo = salvarLib.replace(/\/\*[\s\S]*?\*\//g, '');
ok(salvarLibCodigo.indexOf('rev2FinalFechar') < salvarLibCodigo.indexOf('rev2Aprovar'),
   'nessa ordem: devolver o no, depois aprovar');
const aprovar = grab('rev2Aprovar');
ok(/async function rev2Aprovar\(comImpressao, jaPreparado\)/.test(HTML),
   'rev2Aprovar aceita o aviso de que o laudo ja esta montado');
ok(/if\(!jaPreparado\) rev2Preparar\(\);/.test(aprovar),
   'e so remonta quando NAO veio da tela final');
ok(/salvarLaudoPasta\(\)/.test(aprovar) && /salvarLaudoHistorico\(/.test(aprovar),
   'o resto do caminho (salvar na pasta + historico) continua o mesmo, ja testado');

console.log('\n=== os dois destinos leem o MESMO no ===');
// E isto que garante que o que ele ve e o que e entregue E o que fica arquivado.
ok(/const area=document\.getElementById\('areaImpressao'\)/.test(grab('salvarLaudoPasta')),
   'salvar na pasta le o #areaImpressao');
// 25/08: o historico passou a ler pela folhaHtmlLimpo — que le o MESMO no, mas sem a
// mobilia da paginacao de tela (vaos e mascaras extras nao podem ir para o guardado)
ok(/folhaHtmlLimpo\(\)/.test(grab('salvarLaudoHistorico')),
   'e o historico tambem — pela versao limpa da folha');
ok(/getElementById\('areaImpressao'\)/.test(grab('folhaHtmlLimpo')),
   'e a versao limpa le o MESMO #areaImpressao');

console.log('\n=== a tela por cima das outras, mas por baixo da pergunta do fundo ===');
const css = (HTML.match(/#rv2Final\{[^}]*\}/) || [''])[0];
ok(/z-index:9500/.test(css), 'z-index 9500: acima das telas cheias (9000)');
ok(/z-index:100000/.test(HTML),
   'e abaixo do modal do fundo (100000) — a pergunta do timbrado tem de aparecer por cima');
ok(/position:fixed;inset:0/.test(css), 'ocupa a tela toda');

console.log('\n=== a edicao VOLTA para o objeto do laudo (26/08, noite) ===');
// "salvar e liberar nao esta salvando" — dele. A edicao vivia so no DOM: pasta e
// historico saiam certos, mas o OBJETO do laudo ficava velho e a remontagem (reabrir
// a tela final, recuperar a sessao) devolvia o texto sem as correcoes.
const absorver = grab('rev2FinalAbsorver');
ok(/contenteditable="false"/.test(absorver),
   'os blocos que nao sao texto dele (esquema, evolucao, vaos) ficam de fora da leitura');
ok(/L\.conclusao=/.test(absorver) && /L\.corpo=/.test(absorver) && /L\.extra=/.test(absorver),
   'regrava corpo, conclusao e texto final no objeto');
ok(/agendarSalvarSessao/.test(absorver), 'e a sessao do dia leva o laudo ja corrigido');
const fechar2 = grab('rev2FinalFechar');
ok(/rev2FinalAbsorver\(\)/.test(fechar2),
   'o fechar absorve ANTES de devolver o no — vale para "Voltar" E para "Salvar e liberar"');
const rvTexto = grab('_rvTexto');
ok(/\*\*/.test(rvTexto) && /__/.test(rvTexto),
   'negrito e sublinhado viram os marcadores de texto que a remontagem entende');

console.log('\n=== a barra de formatacao acompanha a tela final (26/08, noite) ===');
const ver2 = grab('rev2VerFinal');
ok(ver2.indexOf("getElementById('barraFormato')") >= 0,
   'a tela final pega a MESMA barra da revisao (no emprestado, nao copia)');
ok(fechar2.indexOf("getElementById('barraFormato')") >= 0, 'e o fechar devolve a barra para casa');
ok(/#barraFormato\{display:none;\}/.test(HTML), 'a barra nunca sai na impressao');

console.log('\n=== os botoes de formatacao funcionam de verdade (31/08, item 7) ===');
// "os botoes de edicao de texto na tela de visualizar o laudo nao estao funcionando
// direito" — dele. Eram DUAS coisas:
// 1. o <button> ROUBAVA O FOCO: ao ser pressionado tira o cursor de dentro do texto, e
//    quando o clique termina a selecao ja nao e a que ele fez — o comando cai no vazio.
//    A cura e impedir o padrao do MOUSEDOWN (nao do click).
// 2. falhava CALADO: sem selecao nao acontecia nada, e botao que nao faz nada e
//    indistinguivel de botao quebrado.
const barraFmt = HTML.slice(HTML.indexOf('<div id="barraFormato">'),
                            HTML.indexOf('</div>', HTML.indexOf('<div id="barraFormato">')) + 6);
const botoes = barraFmt.match(/<button[^>]*>/g) || [];
ok(botoes.length >= 8, 'a barra tem os botoes de sempre  [' + botoes.length + ']');
ok(botoes.every(b => /onmousedown="event\.preventDefault\(\)"/.test(b)),
   'TODO botao impede o mousedown — sem isso o foco sai do texto e o comando se perde');
const fcmd = grab('fmtCmd');
ok(/fmtEditavelDaSelecao\(\)/.test(fcmd), 'fmtCmd confere se a selecao esta num campo editavel');
ok(/fmtAvisar\(/.test(fcmd), 'e avisa quando nao esta (em vez de falhar calado)');
ok(/revMarcarEditado/.test(fcmd), 'formatar conta como edicao do laudo');
const fonte = grab('ajustarFonte');
ok(/fmtAvisar\(/.test(fonte), 'mudar o tamanho da letra tambem avisa se falta selecao');
const avisar = grab('fmtAvisar');
ok(/rv2fDica/.test(avisar),
   'e o aviso aparece NA TELA FINAL (o diario fica atras dela e passaria despercebido)');
const alvo = grab('fmtEditavelDaSelecao');
ok(/closest\('\[contenteditable="true"\]'\)/.test(alvo),
   'o alvo valido e qualquer campo editavel do laudo');

console.log('\n=== impressao: so a folha, como sempre ===');
const printBlock = HTML.slice(HTML.indexOf('@media print{\n  /* Na impressão vale a mesma regra'),
                              HTML.indexOf('#rv2Lupa{position:fixed'));
ok(/#rv2Final \.rv2fTopo,#rv2Final \.rv2fDica\{display:none\}/.test(printBlock),
   'a barra de botoes e a dica nao entram no papel');
ok(/box-shadow:none/.test(printBlock), 'e a sombra do palco tambem nao');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
