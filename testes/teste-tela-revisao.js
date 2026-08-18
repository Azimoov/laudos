// Tela de revisao 2.0: o que ela PROMETE tem de acontecer (17/08/2026).
//
// Dois buracos achados na auditoria desta data, os dois do tipo "parece que
// funciona":
//
// 1. CARTAO DE DESCRITOR FALTANDO. O medico tocava a opcao que faltava, o app
//    dizia "regenere para recalcular" e guardava a escolha em ex.laudo._descritores
//    — um lugar que NINGUEM lia. Regenerar refazia o pedido a IA, que continua sem
//    aquele descritor no ditado: a pendencia voltava igual. A categoria nunca saia.
//
// 2. ASSINAR NAO REGISTRAVA. rev2Aprovar salvava o arquivo e marcava _liberado,
//    mas nao chamava salvarLaudoHistorico. Tres perdas caladas: o laudo nao entrava
//    no historico (nao seria achado como EXAME ANTERIOR depois), a versao assinada
//    nao chegava ao banco (laudo_versoes perdia a correcao do medico) e o exame nao
//    entrava na lista de liberados (o estrago de 12/08 de volta).
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, started = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; started = true; }
    else if (HTML[j] === '}') { d--; if (started && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + name);
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

console.log('=== o descritor escolhido pelo medico RECALCULA de verdade ===');
const escolher = grab('rev2Escolher');
const recalc = grab('rev2RecalcularClassif');
ok(/rev2RecalcularClassif\(\)/.test(escolher),
   'tocar a opcao dispara o recalculo (antes so escrevia num canto)');
ok(/classifAplicar\(/.test(recalc), 'o recalculo usa a MESMA conta do laudo automatico');
ok(!/await|openai|gerarLaudo/.test(recalc),
   'e NAO chama a IA: o ditado continua sem o descritor, pedir de novo traria a mesma falta');
ok(/_classifBruto/.test(recalc) && /_classifBruto:\{tirads:/.test(HTML),
   'o que a IA anotou fica guardado, para poder recalcular sem ela');
ok(/_conclusaoBase/.test(recalc) && /_conclusaoBase:\(resp\.conclusao/.test(HTML),
   'a conclusao e remontada da BASE (senao empilharia duas categorias)');
ok(/classifPendencias=r\.pendencias/.test(recalc.replace(/\s/g, '')) ||
   /ex\.laudo\.classifPendencias\s*=\s*r\.pendencias/.test(recalc),
   'a pendencia resolvida some da tela');
ok(/laudo é anterior a 17\/08/.test(escolher),
   'laudo antigo (sem o bruto guardado) avisa em vez de fingir que recalculou');

console.log('=== a escolha sobrevive a uma regeneracao ===');
ok(/_escAntes=\(ex\.laudo&&ex\.laudo\._descritores\)/.test(HTML),
   'gerarLaudo recupera os descritores que o medico ja escolheu');
ok(/_descritores:_escAntes/.test(HTML), 'e os leva para o laudo novo');

console.log('=== a pendencia sabe de QUAL achado ela e ===');
ok((HTML.match(/achado:rot, idx:i/g) || []).length === 3,
   'os tres sistemas (TI-RADS, BI-RADS, O-RADS) marcam o indice do achado');
ok(/p\.sistema\+'\|'\+\(p\.idx==null\?p\.achado:p\.idx\)/.test(escolher),
   'a escolha e guardada pelo indice, nao por um nome que pode repetir');

console.log('=== assinar REGISTRA o laudo (historico + banco + liberados) ===');
const aprovar = grab('rev2Aprovar');
ok(/salvarLaudoHistorico\(window\.__revAtual\)/.test(aprovar),
   'aprovar e assinar registra no historico');
ok(/FALHA AO GUARDAR NO HISTORICO/.test(aprovar),
   'e falhar nisso e BARULHENTO (o laudo pode nao estar salvo)');
ok(/salvarLaudoPasta/.test(aprovar), 'continua salvando o arquivo na pasta');
const salvarApenas = grab('rev2SalvarApenas');
ok(/salvarLaudoHistorico\(window\.__revAtual\)/.test(salvarApenas),
   '"Salvar apenas" tambem registra — salvar sem assinar continua sendo salvar');
// o registro e quem manda a versao assinada para o banco
const hist = grab('salvarLaudoHistorico');
ok(/bancoEnviarFinal/.test(hist),
   'e e o registro que leva a versao assinada ao banco (laudo_versoes)');

console.log('=== os botoes do rodape existem e apontam para funcao de verdade ===');
['rev2Aprovar', 'rev2Depois', 'rev2SalvarApenas', 'rev2Aprender', 'rev2Regerar',
 'rev2Calculadoras', 'rev2Voltar', 'rev2CopiarFmt'].forEach(function (f) {
  ok(HTML.indexOf('function ' + f + '(') >= 0, f + ' existe');
});
ok(/_rev2Fim\[ex\.id\]=1/.test(grab('rev2Depois')),
   '"Deixar para depois" manda o laudo para o FIM da fila, nao para o topo');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
