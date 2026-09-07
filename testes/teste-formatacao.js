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

console.log('=== o pincel de formatacao: copiar e colar sao DOIS botoes ===');
/* 04/09/2026, pedido dele: "existe o botao Copiar formatacao, mas nao existe o botao Colar
   formatacao. Precisa ter." Era um botao so, que copiava no 1o toque e colava no 2o — o que
   ele fazia dependia de uma coisa invisivel (se ja havia algo copiado), e o 2o toque GASTAVA
   a copia: repetir o mesmo negrito em cinco lugares dava dez toques e cinco viagens ate a
   origem. */
const copiar = grab('rev2CopiarFmt');
const colar = grab('rev2ColarFmt');
ok(colar.length > 0, 'a funcao de colar existe');
ok(/id="rv2BtColarFmt"/.test(HTML) && /onclick="rev2ColarFmt\(\)"/.test(HTML),
   'e ha um botao na barra da tela de liberacao que a chama');
ok(/id="rv2BtColarFmt"[^>]*disabled/.test(HTML),
   'que NASCE apagado — sem nada copiado, ele nao promete o que nao pode fazer');
ok(/#telaRev2 \.fmt button:disabled\{/.test(HTML),
   'e apagado ele PARECE apagado (senao o medico toca, nada acontece, e nao sabe por que)');
ok(/queryCommandState/.test(copiar), 'copiar LE a formatacao da origem de verdade');
ok(/execCommand/.test(colar), 'e colar aplica no destino');
ok(!/execCommand/.test(copiar),
   'copiar NAO mexe no texto — quem escreve e so o colar');
ok(!/removeFormat/.test(copiar) && !/removeFormat/.test(colar),
   'e NAO limpa mais o destino fingindo que copiou (o defeito de 17/08)');
ok(/ORIGEM/.test(copiar) && /DESTINO/.test(colar),
   'cada um diz qual selecao o medico precisa fazer');
/* O ganho que o botao novo traz junto: a copia nao se gasta. */
ok(!/_rev2Fmt=null/.test(colar),
   'colar NAO gasta a copia — da para colar o mesmo negrito em varios trechos');
ok(/_rev2Fmt===null/.test(colar),
   'e colar sem ter copiado explica, em vez de nao fazer nada');
const pintar = grab('rev2FmtPintar');
ok(/b\.colar\.disabled=!armado/.test(pintar),
   'um lugar so desenha o estado dos dois botoes');
ok(/function rev2FmtEsquecer\(\)/.test(HTML)
   && /rev2FmtEsquecer\(\)/.test(grab('rev2Abrir')),
   'e trocar de laudo esvazia o pincel — formatacao de um paciente nao segue armada no outro');

console.log('=== A ESCADA DE APERTO: o contrato (frente 3 do plano, 07/09/2026) ===');
/* Quando o laudo nao cabe, alguma coisa cede. QUAL cede primeiro e decisao dele, tomada
   de uma vez: entrelinha -> avisos de rodape -> corpo do laudo -> folha nova. E dois pisos
   que nao se negociam, porque abaixo deles o laudo deixa de ser legivel para quem mais
   precisa le-lo: 10 no laudo, 6 nos avisos (decisao dele, 06/09). */
ok(/var PISO_CORPO_PX=10, PISO_AVISO_PX=6;/.test(HTML),
   'os dois pisos estao escritos como numero, num lugar so');
const nivel = grab('_pagAplicarNivel');
ok(/Math\.max\(PISO_CORPO_PX, 13\*nv\[1\]\)/.test(nivel),
   'o corpo do laudo nunca desce abaixo de 10 — trava, nao conta');
ok(/\['\.rodapeLaudo',10,PISO_AVISO_PX\]/.test(nivel),
   'e o rodape legal e aviso: o chao dele e o dos avisos, nao o do laudo');
const extra = grab('_pagAplicarExtra');
ok(/if\(alvo<PISO_AVISO_PX\) alvo=PISO_AVISO_PX/.test(extra),
   'os avisos de rodape tem a trava deles');
/* A escada dos avisos ia ate 8; ele autorizou ate 6. Dois degraus a mais sao duas chances
   a mais de o laudo caber sem gastar uma folha — e e texto de apoio, nao o laudo. */
ok(/var EXTRA_PX=\[0,10,9,8,7,6\];/.test(HTML),
   'e a escada deles vai ate o piso que ele autorizou, nao para antes');
ok(/1º  A ENTRELINHA/.test(HTML) && /4º  SÓ DEPOIS DISSO, uma folha nova/.test(HTML),
   'e a ordem do que cede primeiro esta escrita, nao espalhada pelo codigo');
/* A escada mais apertada de hoje da 11,96 no corpo: a trava nunca dispara. Ela existe
   para o dia em que alguem acrescentar um degrau sem lembrar do piso — e esta conta
   guarda esse dia. */
const niveis = (HTML.match(/var PAG_NIVEIS=\[[\s\S]*?\];/) || [''])[0];
const fatores = (niveis.match(/,\s*([\d.]+)\]/g) || []).map(s => parseFloat(s.replace(/[,\]\s]/g, '')));
const menorFator = fatores.length ? Math.min.apply(null, fatores) : 1;
ok(13 * menorFator >= 10,
   'nenhum degrau da escada de hoje pede menos que o piso  [' + (13 * menorFator).toFixed(2) + ']');

console.log('=== o tamanho da letra fica guardado ===');
const fonte = grab('rev2Fonte');
/* 04/09/2026: passou a ser guardada no DISCO do computador, nao so no navegador. "Quem
   precisa de letra maior precisa dela todo dia" — e guardada so no navegador ela voltava
   ao 12 a cada abertura, porque a porta e sorteada e aquela memoria e por endereco. */
ok(/dadoSalvar\('grev2Fonte'/.test(fonte), 'a escolha e guardada');
ok(/'grev2Fonte'/.test((HTML.match(/const DADOS_SINCRONIZADOS = \[[\s\S]*?\];/) || [''])[0]),
   'e vai junto para o computador, para sobreviver a fechar o programa');
ok(/rev2FonteGuardada\(\)/.test(HTML) && /_fsel\.value=String\(_fpx\)/.test(HTML),
   'e volta aplicada (e no seletor) toda vez que a tela e desenhada');

console.log('=== a fonte do documento e obrigatoria ===');
ok(/\.laudoFolha,\.laudoFolha \*\{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif!important;\}/.test(HTML),
   'todo texto da folha usa Helvetica Neue, com reservas iguais para todos');
ok(/function laudoCssText\(\)[\s\S]*?laudo\|assin\|linha\|rodape/.test(HTML),
   'a regra da folha acompanha o arquivo salvo e a impressao');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
