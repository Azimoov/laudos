// Painel de alertas da revisao: um quadro por categoria, sempre na tela.
// Apagado = nada a relatar naquele assunto (e diz o que foi conferido).
// Aceso na cor da categoria = tem aviso, com o texto dentro.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function grab(n) {
  let i = HTML.indexOf('async function ' + n + '(');
  if (i < 0) i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('nao achei ' + n);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// ---- caixa de areia: as funcoes do painel + um getElementById de mentira ----
const listaAlertas = (HTML.match(/const ALERTAS = \[[\s\S]*?\n\];/) || [])[0];
if (!listaAlertas) { console.log('  FALHA nao achei a lista ALERTAS'); process.exit(1); }
const painel = { innerHTML: '' };
const document = { getElementById: id => (id === 'painelAlertas' ? painel : null) };
const app = new Function('document',
  listaAlertas + '\n' + grab('esc') + '\n' + grab('alertaTipoValido') + '\n'
  + grab('alertasDoLaudo') + '\n' + grab('montarAlertas')
  + '\n return {ALERTAS, alertaTipoValido, alertasDoLaudo, montarAlertas};')(document);
const { ALERTAS, alertaTipoValido, alertasDoLaudo, montarAlertas } = app;
const caixas = h => (h.match(/class="alerta( aceso)?"/g) || []).length;
const acesas = h => (h.match(/class="alerta aceso"/g) || []).length;
// devolve o pedaco HTML da caixa de uma categoria
function caixaDe(h, chave) {
  const A = ALERTAS.find(x => x.k === chave);
  const i = h.indexOf('--corAlerta:' + A.cor);
  return i < 0 ? '' : h.slice(h.lastIndexOf('<div class="alerta', i), h.indexOf('</div></div>', i) + 12);
}

console.log('=== as categorias ===');
ok(ALERTAS.length >= 5, 'ha varias categorias (' + ALERTAS.length + ')');
ok(new Set(ALERTAS.map(a => a.k)).size === ALERTAS.length, 'nenhuma categoria repetida');
ok(new Set(ALERTAS.map(a => a.cor)).size === ALERTAS.length, 'cada categoria tem uma COR propria');
ok(ALERTAS.every(a => a.nome && a.vazio && /^#[0-9a-f]{6}$/i.test(a.cor)),
   'toda categoria tem nome, cor valida e a frase de quando esta apagada');
ok(ALERTAS.some(a => a.k === 'identificacao') && ALERTAS.some(a => a.k === 'anterior')
   && ALERTAS.some(a => a.k === 'faltando') && ALERTAS.some(a => a.k === 'outros'),
   'tem as categorias pedidas: identificacao, exame anterior, dados faltando, e um "outros"');

console.log('=== nenhum aviso: tudo apagado, mas TUDO na tela ===');
montarAlertas([]);
const vazio = painel.innerHTML;
ok(caixas(vazio) === ALERTAS.length, 'as ' + ALERTAS.length + ' caixas aparecem mesmo sem aviso nenhum');
ok(acesas(vazio) === 0, 'nenhuma acesa');
ok(ALERTAS.every(A => vazio.includes(A.vazio)), 'cada caixa apagada diz o que foi conferido');
ok(ALERTAS.every(A => vazio.includes('--corAlerta:' + A.cor)), 'cada caixa carrega a sua cor mesmo apagada');
montarAlertas(null);
ok(caixas(painel.innerHTML) === ALERTAS.length, 'lista nula tambem desenha o painel inteiro');

console.log('=== um aviso: so a caixa dele acende ===');
montarAlertas([{ tipo: 'identificacao', texto: 'O nome nas imagens nao confere com o ditado.' }]);
const um = painel.innerHTML;
ok(caixas(um) === ALERTAS.length, 'o painel continua com todas as caixas');
ok(acesas(um) === 1, 'exatamente uma caixa acesa');
ok(/class="alerta aceso"[\s\S]{0,80}--corAlerta:#e5534b/.test(um) || caixaDe(um, 'identificacao').includes('aceso'),
   'a caixa acesa e a da categoria certa');
ok(caixaDe(um, 'identificacao').includes('O nome nas imagens nao confere'), 'a mensagem aparece dentro da caixa');
ok(!caixaDe(um, 'anterior').includes('aceso'), 'as outras seguem apagadas');
ok(caixaDe(um, 'anterior').includes(ALERTAS.find(a => a.k === 'anterior').vazio), 'a apagada continua com a frase dela');
ok(!um.includes(ALERTAS.find(a => a.k === 'identificacao').vazio), 'a caixa acesa troca a frase de "nada a relatar" pelo aviso');

console.log('=== varios avisos ===');
montarAlertas([
  { tipo: 'anterior', texto: 'Comparado com o exame de 10/02/2026.' },
  { tipo: 'faltando', texto: 'Medida do nodulo nao ditada.' },
  { tipo: 'faltando', texto: 'Data ilegivel na imagem 3.' }
]);
const varios = painel.innerHTML;
ok(acesas(varios) === 2, 'duas categorias acesas, nao tres (dois avisos caem na mesma caixa)');
ok(caixaDe(varios, 'faltando').includes('Medida do nodulo') && caixaDe(varios, 'faltando').includes('Data ilegivel'),
   'os dois avisos da mesma categoria aparecem juntos');

console.log('=== nenhum aviso se perde ===');
montarAlertas([{ tipo: 'categoria_que_nao_existe', texto: 'aviso estranho' }]);
ok(caixaDe(painel.innerHTML, 'outros').includes('aviso estranho'), 'categoria desconhecida cai em "outros" em vez de sumir');
ok(alertaTipoValido('') === 'outros' && alertaTipoValido(null) === 'outros' && alertaTipoValido(undefined) === 'outros',
   'tipo vazio/nulo vira "outros"');
ok(alertaTipoValido('faltando') === 'faltando', 'tipo conhecido e respeitado');
montarAlertas([{ tipo: 'faltando', texto: '   ' }, { tipo: 'anterior' }]);
ok(acesas(painel.innerHTML) === 0, 'aviso sem texto nao acende caixa a toa');

console.log('=== o texto do aviso nao pode virar codigo ===');
montarAlertas([{ tipo: 'outros', texto: '<img src=x onerror=alert(1)>' }]);
ok(!painel.innerHTML.includes('<img src=x'), 'texto do aviso e escapado (barreira XSS)');
ok(painel.innerHTML.includes('&lt;img src=x'), 'aparece como texto, nao como tag');

console.log('=== laudo antigo (guardado antes das categorias) ===');
ok(alertasDoLaudo(null).length === 0, 'laudo inexistente nao gera alerta');
ok(alertasDoLaudo({}).length === 0, 'laudo sem aviso nenhum nao gera alerta');
const velho = alertasDoLaudo({ obs: 'medidas ausentes e nome divergente' });
ok(velho.length === 1 && velho[0].tipo === 'outros' && velho[0].texto.includes('medidas ausentes'),
   'aviso antigo em texto corrido nao se perde: vira "outros"');
const novo = alertasDoLaudo({ alertas: [{ tipo: 'faltando', texto: 'x' }], obs: 'texto velho' });
ok(novo.length === 1 && novo[0].tipo === 'faltando', 'tendo categorias, elas mandam');

console.log('=== ligacao no app ===');
ok(!/obsBanner/.test(HTML), 'a faixa ambar unica foi removida de vez');
ok(/id="painelAlertas"/.test(HTML), 'o painel esta no HTML');
// 13/08/2026: passaram a ser TRES caminhos — o terceiro repinta o painel quando o
// medico digita no laudo (revMarcarEditado), senao o "✓" do conferente fica de pe
// depois de o texto mudar. Conferir os caminhos vale mais que contar as chamadas.
ok((HTML.match(/montarAlertas\(alertasDoLaudo\(/g) || []).length >= 2,
   'painel montado nos dois caminhos: laudo novo e laudo reaberto do historico');
ok(/function revMarcarEditado\(\)[\s\S]{0,400}montarAlertas\(alertasDoLaudo\(/.test(HTML),
   'e repintado tambem quando o medico digita no laudo');
ok(/alertas:alertas/.test(HTML), 'os alertas ficam guardados no laudo');
ok(/alertas:meta\.alertas\|\|null/.test(HTML), 'e vao para o historico, para valer ao reabrir');
ok(/if\(!alertas\.length && obsFinal\)/.test(HTML), 'se a IA so mandar texto corrido, ele ainda aparece');

console.log('=== o que o APP preenche sozinho ===');
// 12/08/2026: o TI-RADS deixou de ter caminho proprio — TI-RADS, BI-RADS e O-RADS passam
// todos por classifAplicar, que devolve os avisos ja com a categoria certa.
ok(/tipo:'calculo', texto:t/.test(HTML) && /classifAplicar/.test(HTML),
   'a classificacao calculada pelo app acende a caixa de calculo');
ok(/out\.alertas\.push\(\{tipo:'faltando'/.test(HTML),
   'descritor que faltou acende a caixa de dados faltando');
ok(/CONFLITO de classificacao|CONFLITO de classifica/.test(HTML),
   'ditado x calculo em conflito vira aviso');
ok(/alertas\.push\(\{tipo:'calculo', texto:ob\.obs\.join/.test(HTML),
   'o que o app decidiu no obstetrico (idade gestacional, data do parto, margem) acende a caixa de calculo');
ok(/alertas\.push\(\{tipo:'faltando', texto:ob\.faltando\.join/.test(HTML),
   'e o que faltou ler na worksheet acende a caixa de dados faltando');
ok(/tipo:'anterior', texto:'Comparado com o exame de '/.test(HTML), 'comparacao feita acende a caixa azul');
ok(/tipo:'identificacao', texto:'Falta confirmar se o exame de '/.test(HTML), 'identidade em aberto acende a caixa VERMELHA');
ok(/tipo:'anterior', texto:'Busca incompleta \('/.test(HTML), 'busca incompleta acende a caixa do exame anterior');

console.log('=== o que a IA preenche ===');
ok(/AVISOS SEPARADOS POR ASSUNTO/.test(HTML), 'o pedido a IA explica as categorias');
ok(/"avisos":\[\{\\"tipo\\":\\"\\",\\"texto\\":\\"\\"\}\]/.test(HTML) || /avisos\\":\[\{\\"tipo/.test(HTML),
   'o formato de resposta inclui os avisos separados');
['identificacao', 'divergencia', 'faltando', 'iacriou', 'outros'].forEach(t =>
  ok(new RegExp('- ' + t + ':').test(HTML), 'a IA sabe o que e "' + t + '"'));
ok(/NUNCA use os tipos 'anterior' nem 'calculo'/.test(HTML), 'a IA nao invade o que o app preenche');

console.log('=== apagada e menor que acesa ===');
const css = HTML.slice(HTML.indexOf('#painelAlertas{'), HTML.indexOf('/* ===== calculadoras'));
const esq = s => s.replace(/[.#]/g, c => '\\' + c);
const regra = sel => (css.match(new RegExp(esq(sel) + '\\{[^}]*\\}')) || [''])[0];
const num = (r, prop) => { const m = r.match(new RegExp(prop + ':\\s*(\\d+)')); return m ? +m[1] : null; };
const apagada = regra('.alerta'), acesa = regra('.alerta.aceso');
ok(apagada && acesa, 'existem as duas regras: apagada e acesa');
ok(num(acesa, 'min-width') > num(apagada, 'min-width'),
   'a acesa e mais larga (' + num(apagada, 'min-width') + 'px -> ' + num(acesa, 'min-width') + 'px)');
ok(/flex:0 1 auto/.test(apagada) && /flex:1 1 \d+px/.test(acesa),
   'a apagada encolhe ate o conteudo; a acesa cresce e toma o espaco');
ok(num(acesa, 'padding') > num(apagada, 'padding'), 'a acesa tem mais respiro por dentro');
ok(/max-width:212px/.test(apagada) && /max-width:none/.test(acesa), 'a apagada tem teto de largura; a acesa nao');
ok(num(regra('.alerta.aceso .alertaLed'), 'width') > num(regra('.alertaLed'), 'width'), 'o LED da acesa e maior');
ok(/font-size:10px/.test(regra('.alertaTit')) && /font-size:var\(--fs-0\)/.test(regra('.alerta.aceso .alertaTit')),
   'o titulo da acesa e maior que o da apagada');
ok(/font-size:var\(--fs-0\)/.test(regra('.alertaTxt')) && /font-size:var\(--fs-1\)/.test(regra('.alerta.aceso .alertaTxt')),
   'o texto da acesa e maior que o da apagada');
ok(/align-items:flex-start/.test(regra('#painelAlertas')),
   'as caixas nao se esticam para a altura da vizinha — senao a apagada ficaria do tamanho da acesa');
ok(/\.alerta\{flex:1 1 42%/.test(css.replace(/\s+/g, ' ').replace(/ \{/g, '{')) || /flex:1 1 42%/.test(css),
   'no celular as apagadas ficam duas por linha e a acesa toma a linha inteira');

console.log('=== nada disso sai no papel ===');
// #areaImpressao e um <div></div> VAZIO no HTML (o laudo e injetado nele em tempo de
// execucao): logo, tudo que esta escrito no arquivo esta necessariamente fora dele.
ok(/<div id="areaImpressao"[^>]*><\/div>/.test(HTML), 'a area de impressao continua vazia no HTML');
ok(/<div id="painelAlertas"><\/div>\s*<div id="revLayout"/.test(HTML),
   'o painel fica ACIMA do laudo e fora do #areaImpressao');
const print = HTML.slice(HTML.indexOf('@media print'), HTML.indexOf('@page'));
ok(/body \*\{visibility:hidden;\}/.test(print) && /#areaImpressao,#areaImpressao \*\{visibility:visible;\}/.test(print),
   'a regra de impressao continua intocada');
ok(!/painelAlertas|\.alerta/.test(print), 'a regra de impressao nem cita o painel');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
