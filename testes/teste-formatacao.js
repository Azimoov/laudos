// Barra de formatacao da tela de revisao (17/08/2026).
//
// O desenho diz que ela "tem de funcionar de verdade". Ate 17/08 ela nao
// funcionava: o medico tocava Italico ou Sublinhado, via o texto mudar na tela,
// e PERDIA tudo ao salvar - rev2ParaTexto so sabia guardar o negrito e apagava
// o resto calado. E o "copiar formatacao" MENTIA: dizia "Formatacao copiada" e,
// no segundo toque, apenas apagava a formatacao do destino.
//
// O que este teste tranca: o ida-e-volta (texto -> tela -> texto) nao pode
// perder nem inventar formatacao. Um laudo que muda sozinho ao ser salvo e a
// pior falha possivel num documento assinado.
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

const negrito = new Function(grab('negrito') + '\nreturn negrito;')();

// rev2ParaTexto usa um <textarea> do navegador para decodificar &amp; e cia.
// Fora do navegador, damos um de mentira que faz a mesma decodificacao.
const documentFalso = {
  createElement() {
    const el = {};
    Object.defineProperty(el, 'innerHTML', {
      set(v) {
        el.value = String(v)
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&amp;/g, '&');
      },
      get() { return el.value; }
    });
    return el;
  }
};
const paraTexto = new Function('document',
  grab('rev2ParaTexto') +
  '\nreturn function(h){ return rev2ParaTexto({innerHTML:h}); };')(documentFalso);

console.log('=== o que a tela desenha a partir do texto do laudo ===');
ok(negrito('**achado**') === '<b>achado</b>', 'negrito vira <b>');
ok(negrito('__assinado__') === '<u>assinado</u>', 'sublinhado vira <u>');
ok(negrito('*termo*') === '<i>termo</i>', 'italico vira <i>');
ok(negrito('**Nodulo** no *QSE*') === '<b>Nodulo</b> no <i>QSE</i>',
   'negrito e italico convivem na mesma linha');
ok(negrito('a **b** c') === 'a <b>b</b> c', 'texto ao redor e preservado');
ok(!/<i>/.test(negrito('**forte**')),
   'o ** NAO e comido pelo italico (a ordem importa: ** antes de *)');
ok(negrito('3 * 4 * 5') === '3 * 4 * 5',
   'asterisco solto entre espacos continua asterisco (nao vira italico)');
ok(negrito('<script>') === '&lt;script&gt;', 'HTML continua escapado (XSS)');

console.log('=== e o que volta para o laudo quando o medico edita ===');
ok(paraTexto('<b>x</b>') === '**x**', '<b> volta como **');
ok(paraTexto('<strong>x</strong>') === '**x**', '<strong> tambem');
ok(paraTexto('<i>x</i>') === '*x*', '<i> volta como * (antes era APAGADO)');
ok(paraTexto('<em>x</em>') === '*x*', '<em> tambem');
ok(paraTexto('<u>x</u>') === '__x__', '<u> volta como __ (antes era APAGADO)');
ok(paraTexto('<span style="color:red">x</span>') === 'x',
   'formatacao que o laudo nao sabe guardar e descartada, nao inventada');

console.log('=== IDA E VOLTA: o laudo nao pode mudar sozinho ===');
[
  '**Notou-se imagem nodular.**',
  'Parenquima habitual. **Nodulo de 8 mm.**',
  'Achado *provavel* na mama',
  'Trecho __sublinhado__ pelo medico',
  '**Tudo** junto: *italico* e __sublinhado__',
  'Texto sem formatacao nenhuma.'
].forEach(function (t) {
  ok(paraTexto(negrito(t)) === t, 'volta identico: ' + t.slice(0, 44));
});

console.log('=== o pincel de formatacao (que antes mentia) ===');
const pincel = grab('rev2CopiarFmt');
ok(/queryCommandState/.test(pincel), 'ele LE a formatacao da origem de verdade');
ok(/execCommand/.test(pincel), 'e aplica no destino');
ok(!/removeFormat/.test(pincel),
   'e NAO limpa mais o destino fingindo que copiou');
ok(/DESTINO/.test(pincel) && /ORIGEM/.test(pincel),
   'diz ao medico qual selecao ele deve fazer em cada toque');

console.log('=== o tamanho da letra fica guardado ===');
const fonte = grab('rev2Fonte');
ok(/localStorage\.setItem\('grev2Fonte'/.test(fonte), 'a escolha e guardada');
ok(/rev2FonteGuardada\(\)/.test(HTML) && /_fsel\.value=String\(_fpx\)/.test(HTML),
   'e volta aplicada (e no seletor) toda vez que a tela e desenhada');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
