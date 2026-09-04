// O MAIOR DIAMETRO DO O-RADS — 04/09/2026, defeito relatado pelo Dr. Daniel.
//
// "Quando fui realizar um exame [transvaginal] o programa disse que o O-RADS nao foi
// calculado porque faltou o descritor 'maior diametro' — mas existe o maior diametro na
// imagem e inclusive ta no texto."
//
// ERAM DOIS DEFEITOS, e o segundo e pior que o primeiro:
//
//   1. A medida so era aceita pelo campo `tamanho_cm` que a IA preenche. Escrevendo o
//      numero na frase e deixando o campo em zero — que e o que ela fez —, o programa
//      cobrava dele um dado que ele JA tinha ditado e que estava escrito no laudo. E o
//      mesmo defeito que o BI-RADS teve em 24/08, e a mesma correcao.
//
//   2. E NAO HAVIA COMO RESPONDER. O cartao da pendencia desenha "fichas" a partir das
//      OPCOES do descritor, e medida nao tem opcoes: a caixa abria VAZIA. O botao
//      "falar" passava o que fosse dito por classifCasar, que compara com as opcoes —
//      entao recusava todo numero, inclusive o certo. O programa pedia um dado e nao
//      aceitava a resposta.
//
// A GUARDA QUE ESTA SUITE PROTEGE ACIMA DE TUDO: num exame pelvico o laudo e cheio de
// medidas que NAO sao da lesao (utero, endometrio, os dois ovarios). Ler a medida errada
// seria pior que nao ler: a categoria O-RADS muda em 10 cm, e um utero passa perto disso.
// Por isso a leitura corta no SUBSTANTIVO DO ACHADO e, sem substantivo, NAO le.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + nome);
}
function bloco(re, oque) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei o bloco ' + oque);
  return m[0];
}

const src = [
  bloco(/const CLASSIF = \{[\s\S]*?\n\};/, 'CLASSIF'),
  bloco(/const CLASSIF_ACHADO_RE = .*;/, 'CLASSIF_ACHADO_RE'),
  grab('norm'), grab('classifVale'), grab('classifCasar'), grab('classifCasarNoTexto'),
  grab('_negadoAntesDe'), grab('classifLerDescritores'), grab('classifExigir'),
  grab('mamaMm'), grab('classifMedidaDoTexto'), grab('classifNumeroEmCm'),
  grab('_mamaFraseDo'), grab('oradsAvaliar'),
  grab('classifCategoriaDitada'), grab('classifConferir'), grab('processarOrads'),
].join('\n');
const A = new Function(src + '\nreturn {classifMedidaDoTexto, classifNumeroEmCm, processarOrads};')();
const { classifMedidaDoTexto, classifNumeroEmCm, processarOrads } = A;

console.log('=== a medida sai da frase do achado ===');
ok(classifMedidaDoTexto('formação cística medindo 4,5 x 3,2 x 2,8 cm') === 4.5,
   'tres dimensoes: vale a MAIOR  [' + classifMedidaDoTexto('formação cística medindo 4,5 x 3,2 x 2,8 cm') + ']');
ok(classifMedidaDoTexto('cisto medindo 2,0 x 3,7 cm') === 3.7,
   'a maior nao e sempre a primeira');
ok(classifMedidaDoTexto('formação cística medindo 45 x 32 mm') === 4.5,
   'milimetro vira centimetro');
ok(classifMedidaDoTexto('imagem cística medindo 3,4 cm') === 3.4, 'uma dimensao so');
ok(classifMedidaDoTexto('nódulo sólido com 2,6 cm') === 2.6, '"com" tambem apresenta a medida');
ok(classifMedidaDoTexto('lesão medindo cerca de 5,5 cm') === 5.5, '"cerca de" nao atrapalha');
ok(classifMedidaDoTexto('endometrioma medindo 6,0 cm') === 6,
   'os achados classicos tambem sao reconhecidos pelo nome');

console.log('\n=== e NAO sai de outra estrutura ===');
// Esta e a razao de ser das guardas. Um laudo transvaginal real descreve utero,
// endometrio e os dois ovarios antes de chegar na lesao.
const PELVICO = 'Útero em anteversoflexão, medindo 8,4 x 4,6 x 3,9 cm. '
  + 'Endométrio medindo 0,7 cm. Ovário direito com 3,1 x 2,0 cm. '
  + 'Ovário esquerdo com 3,4 x 2,2 cm, apresentando formação cística anecoica, '
  + 'de paredes lisas, medindo 4,5 x 3,2 cm.';
ok(classifMedidaDoTexto(PELVICO) === 4.5,
   'no laudo pelvico inteiro, a medida lida e a da LESAO, nao a do utero  ['
   + classifMedidaDoTexto(PELVICO) + ']');
ok(classifMedidaDoTexto('Útero em anteversoflexão, medindo 8,4 x 4,6 x 3,9 cm.') === null,
   'frase que so descreve o utero nao devolve medida nenhuma');
ok(classifMedidaDoTexto('Ovário esquerdo com 3,4 x 2,2 cm.') === null,
   'nem a frase que so mede o ovario — ovario nao e achado');
ok(classifMedidaDoTexto('') === null && classifMedidaDoTexto(null) === null,
   'texto vazio nao inventa medida');
ok(classifMedidaDoTexto('formação cística de paredes lisas, anecoica.') === null,
   'achado SEM medida escrita continua sem medida — nao se chuta');

console.log('\n=== o O-RADS calcula com a medida que estava escrita ===');
const CORPO = PELVICO;
const LESAO = [{ localizacao: 'ovário esquerdo', tipo: 'uniSimples',
                 escore_cor: '1', tamanho_cm: 0, papilas: 0, ascite: 'nao' }];
const r1 = processarOrads(LESAO, '', CORPO);
ok(!r1.pendencias.length,
   'nao pede mais o maior diametro — ele estava no texto  ['
   + r1.pendencias.map(p => p.rotulo).join(', ') + ']');
ok(r1.linhas.length === 1 && /O-RADS US 2/.test(r1.linhas[0]),
   'e a categoria sai  [' + (r1.linhas[0] || 'nenhuma') + ']');
ok((r1.lidos || []).length === 1 && r1.lidos[0].chave === 'tamanho_cm'
   && r1.lidos[0].origem === 'texto',
   'a medida lida aparece como "lido do texto", para ele poder trocar');
ok(r1.lidos[0].tipo === 'numero' && r1.lidos[0].valor === 4.5,
   'com o valor certo e marcada como NUMERO (e o que desenha o campo)  ['
   + r1.lidos[0].valor + ']');

console.log('\n=== sem nada escrito, continua pedindo — e agora da para responder ===');
const r2 = processarOrads(
  [{ localizacao: 'ovário direito', tipo: 'uniSimples', escore_cor: '1', tamanho_cm: 0 }],
  '', 'Ovário direito com 3,1 x 2,0 cm.');
ok(r2.pendencias.length === 1 && r2.pendencias[0].chave === 'tamanho_cm',
   'medida que nao existe em lugar nenhum continua sendo pedida');
ok(r2.pendencias[0].tipo === 'numero',
   'MAS a pendencia agora diz que e numero — sem isso a caixa abria vazia');
ok(!r2.linhas.length, 'e nenhuma categoria e inventada no lugar dela');

console.log('\n=== a medida da IA continua mandando ===');
// O que a IA anotou e o que o medico ditou. O texto e o plano B, nunca o contrario.
const r3 = processarOrads(
  [{ localizacao: 'ovário esquerdo', tipo: 'uniSimples', escore_cor: '1', tamanho_cm: 11 }],
  '', CORPO);
ok(!(r3.lidos || []).length, 'com o campo preenchido, nada e lido do texto');
ok(/O-RADS US 3/.test(r3.linhas[0] || ''),
   'e a conta usa o valor da IA (11 cm -> categoria 3)  [' + (r3.linhas[0] || '') + ']');

console.log('\n=== o numero dito ou digitado vira centimetros ===');
ok(classifNumeroEmCm('4,5') === 4.5, 'com virgula');
ok(classifNumeroEmCm('4.5') === 4.5, 'com ponto');
ok(classifNumeroEmCm('4,5 cm') === 4.5, 'com a unidade junto');
ok(classifNumeroEmCm('45 mm') === 4.5, 'em milimetros');
ok(classifNumeroEmCm('45 milímetros') === 4.5, 'a unidade por extenso');
ok(classifNumeroEmCm('12 centímetros') === 12, 'centimetro por extenso');
ok(classifNumeroEmCm('') === null && classifNumeroEmCm('abacaxi') === null,
   'o que nao e numero nao vira medida');
ok(classifNumeroEmCm('0') === null && classifNumeroEmCm('-3') === null,
   'zero e negativo nao sao medida — zero era justamente o "nao ditado"');

console.log('\n=== o cartao da revisao aceita a resposta ===');
// Ate hoje o cartao do maior diametro abria uma caixa VAZIA (as fichas vem das opcoes) e
// o microfone recusava todo numero. Pedir um dado e nao aceitar a resposta e pior que
// nao pedir: ele nao tinha saida nenhuma dentro do programa.
ok(/function rev2CampoNumero\(/.test(HTML), 'existe um campo para digitar a medida');
ok(/function rev2EscolherNumero\(/.test(HTML), 'e um caminho para a pendencia');
ok(/function rev2TrocarLidoNumero\(/.test(HTML), 'e outro para trocar o que foi lido');
ok(/p\.tipo==='numero'/.test(HTML), 'o desenho separa o descritor que e numero');
ok(/rev2CampoNumero\('rv2pn'\+i/.test(HTML), 'a pendencia numerica desenha o campo');
ok(/rev2CampoNumero\('rv2ln'\+i/.test(HTML), 'e o lido do texto tambem');
ok(/\(p\.tipo==='numero'\?'informar':'escolher'\)/.test(HTML),
   'e o botao diz "informar" em vez de "escolher" — nao ha o que escolher numa medida');
const ditar = grab('rev2DitarDescritor');
ok(/classifNumeroEmCm\(txt\)/.test(ditar),
   'o microfone entende um numero falado — antes recusava ate o valor certo');
ok(/D&&D\.tipo==='numero'/.test(ditar) && ditar.indexOf('classifNumeroEmCm') < ditar.indexOf('classifCasar('),
   'e o desvio vem ANTES de classifCasar, que so sabe comparar com opcoes');
const rotulo = grab('rev2RotuloValor');
ok(/replace\('\.',','\)\+' cm'/.test(rotulo),
   'a medida escolhida e dita de volta com virgula e unidade, como ele le num laudo');
ok(/rv2num/.test(HTML) && /#telaRev2 \.caixa \.rv2num\{/.test(HTML),
   'e o campo tem a mesma aparencia das fichas da caixa');
// ACHADO NO TESTE DE NAVEGADOR, 04/09: com type="number" o campo RECUSAVA a virgula, e
// ele escreve "4,5". O valor sumia depois de ele digitar certo. So o Chrome pegou isso.
const campoSrc = grab('rev2CampoNumero');
ok(!/type="number"/.test(campoSrc), 'o campo NAO e type=number, que recusa a virgula');
ok(/inputmode="decimal"/.test(campoSrc),
   'mas o teclado do tablet continua abrindo em numeros (inputmode)');
ok(/replace\('\.',','\)/.test(campoSrc),
   'e o valor ja preenchido aparece com virgula, como ele escreve');
// as aspas vao escapadas dentro do template: event.key===\'Enter\'
ok(/event\.key===[\\']+Enter/.test(grab('rev2CampoNumero')),
   'Enter vale como o botao — a mao ja esta no teclado');

console.log('\n=== a leitura do texto nao mexe no que a IA mandou ===');
// _classifBruto e registro de procedencia: e por ele que o recalculo refaz a conta.
const original = { localizacao: 'ovário esquerdo', tipo: 'uniSimples', escore_cor: '1', tamanho_cm: 0 };
processarOrads([original], '', CORPO);
ok(original.tamanho_cm === 0,
   'o item que a IA mandou continua como veio  [' + original.tamanho_cm + ']');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
