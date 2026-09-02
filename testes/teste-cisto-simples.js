// CISTO SIMPLES NAO PASSA PELO CHECKLIST BI-RADS (pedido do medico, 25/08/2026).
//
// Por que esta suite existe: a 1a versao da correcao foi derrubada DUAS vezes pela
// auditoria dinamica do ciclo 2 —
//   1. "formacao cistica simples" NO SINGULAR (a frase n. 1 do dizer padrao do medico)
//      nao casava com a regex, e o defeito original continuava vivo;
//   2. pior, o contrario: um nodulo ESPICULADO "adjacente a pequeno cisto simples" era
//      sequestrado pela palavra 'cisto' e saia BI-RADS 2 SEM checklist.
// Cada caso abaixo e um desses tombos, congelado. Roda contra as FRASES REAIS, nao
// contra dados montados a mao — a licao de 24/08.
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, started = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; started = true; }
    else if (HTML[j] === '}') { d--; if (started && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('chaves desbalanceadas em ' + name);
}
function bloco(re, nome) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei o bloco ' + nome);
  return m[0];
}

console.log('=== o reconhecedor, frase a frase ===');
const fn = new Function(grab('mamaCasoEspecialDoTexto') + '\nreturn mamaCasoEspecialDoTexto;')();
[
  // o furo n. 1 do ciclo 2: o SINGULAR do dizer padrao
  ['Notou-se formação cística simples, anecoica, de contornos regulares e reforço acústico posterior, localizada às 9 h.', 'cistoSimples', 'o SINGULAR do dizer padrao — o furo que manteve o defeito vivo'],
  ['apresentando formações císticas simples, anecoicas.', 'cistoSimples', 'e o plural continua valendo'],
  ['Notou-se cisto simples na mama direita, às 2 h.', 'cistoSimples', '"cisto simples" direto'],
  ['imagem cística simples, anecoica.', 'cistoSimples', '"imagem cística" no singular'],
  ['lesão cística simples no QSE.', 'cistoSimples', '"lesão cística" no singular'],
  ['formacao cistica simples sem acento.', 'cistoSimples', 'sem acentos (transcricao crua)'],
  ['Notou-se microcistos agrupados às 3 h.', 'microcistos', 'microcistos agrupados'],
  ['Parênquima mamário heterogêneo, apresentando formação cística simples às 9h.', 'cistoSimples', 'heterogêneo ANTES do substantivo descreve a MAMA, nao derruba'],
  // os que NAO podem virar BI-RADS 2:
  ['cisto de aspecto não simples, com debris.', null, '"não simples" continua no checklist'],
  ['cisto de aspecto não-simples.', null, 'com hifen tambem (furo do ciclo 2)'],
  ['Notou-se cisto complicado com debris, sem componente sólido.', null, 'cisto complicado nao e simples'],
  ['imagem nodular sólida, de forma irregular e margens espiculadas, adjacente a pequeno cisto simples, medindo 12 x 9 mm.', null, 'o SEQUESTRO do ciclo 2: nodulo espiculado nao vira 2 por citar um cisto'],
  ['nódulo hipoecogênico às 10h, próximo a cisto simples.', null, 'o substantivo do achado e o NODULO, nao o cisto'],
  ['massa sólido-cística simples?', null, 'solido-cistica nao e cisto simples'],
  ['cisto septado simples.', null, 'septo derruba o atalho ("septado" incluido)'],
  ['Pele e tecido celular subcutâneo sem alterações.', null, 'frase sem achado'],
].forEach(([frase, esperado, rot]) => {
  const r = fn(frase);
  ok(r === esperado, rot + ' -> ' + JSON.stringify(r));
});

console.log('\n=== e dentro do processarBirads, com o laudo inteiro ===');
const src = [
  bloco(/const CLASSIF = \{[\s\S]*?\n\};/, 'CLASSIF'),
  bloco(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/, 'BIRADS_ESPECIAIS'),
  bloco(/const BIRADS_CAT = \{[\s\S]*?\n\};/, 'BIRADS_CAT'),
  bloco(/const BIRADS_GRAVIDADE = \{[^}]*\};/, 'BIRADS_GRAVIDADE'),
  bloco(/const BIRADS_PADRAO = \{[^}]*\};/, 'BIRADS_PADRAO'),
  grab('biradsCategoria'), grab('biradsLinhaCategoria'), grab('biradsDoExame'),
  grab('norm'), grab('classifCasar'), grab('classifLerDescritores'),
  grab('classifCategoriaDitada'), grab('classifConferir'), grab('biradsAvaliar'),
  grab('_negadoAntesDe'), grab('classifCasarNoTexto'), grab('_mamaFraseDo'),
  grab('mamaCasoEspecialDoTexto'), grab('processarBirads'),
].join('\n');
const proc = new Function(src + '\nreturn processarBirads;')();

// 1. so o cisto (a frase real do dizer, SINGULAR, caso_especial vazio)
const CORPO_CISTO = '**MAMA DIREITA**\n**DESCRIÇÃO:**\n\nMama simétrica.\n'
  + 'Parênquima mamário de ecotextura habitual, apresentando formação cística simples, '
  + 'anecoica, de contornos regulares e reforço acústico posterior, localizada às 9 h, '
  + 'medindo 0,8 cm.\n';
const r1 = proc([{ localizacao: 'mama direita, às 9 h' }], '', CORPO_CISTO);
ok(r1.pendencias.length === 0, 'cisto simples: ZERO pendencias (' + r1.pendencias.length + ')');
ok(/BI-RADS 2/.test(r1.linhas.join(' ')), 'e a categoria do exame e 2');
ok(r1.obs.some(o => /reconhecid[oa] na própria frase/.test(o)),
   'com a origem declarada na observacao ("reconhecido na propria frase")');

// 2. cisto numa mama + nodulo suspeito na outra: a categoria do exame e a do nodulo
const CORPO_MISTO = CORPO_CISTO
  + '\n**MAMA ESQUERDA**\n**DESCRIÇÃO:**\n\n'
  + 'Notou-se imagem nodular sólida, de forma irregular, orientação não paralela à pele '
  + 'e margens espiculadas, hipoecogênica, com sombra acústica posterior, às 3 h, '
  + 'distando 4 cm da papila, medindo 1,4 x 1,1 cm.\n';
const r2 = proc([{ localizacao: 'mama direita, às 9 h' },
                 { localizacao: 'mama esquerda, às 3 h' }], '', CORPO_MISTO);
ok(/BI-RADS (4C|5)/.test(r2.linhas.join(' ')),
   'cisto D + nodulo espiculado E: a categoria do exame e a do NODULO (' +
   (r2.linhas.join(' ').match(/BI-RADS \S+/) || ['?'])[0] + ')');
ok(!r2.pendencias.some(p => /direita/.test(p.achado)), 'o cisto continua sem pendencia');

// 3. o sequestro do ciclo 2: nodulo espiculado com "cisto simples" NA MESMA frase
const CORPO_SEQ = '**MAMA DIREITA**\n**DESCRIÇÃO:**\n\n'
  + 'Notou-se imagem nodular sólida, de forma irregular e margens espiculadas, '
  + 'adjacente a pequeno cisto simples, às 10 h, medindo 12 x 9 mm.\n';
const r3 = proc([{ localizacao: 'mama direita, às 10 h' }], '', CORPO_SEQ);
ok(!r3.obs.some(o => /reconhecid[oa] na própria frase/.test(o)),
   'nodulo espiculado NAO vira caso especial por citar um cisto');
ok(!/BI-RADS 2/.test(r3.linhas.join(' ')),
   'e o exame NAO sai BI-RADS 2 por causa dele');

// 4. o caso especial DITADO continua com a redacao antiga
const r4 = proc([{ localizacao: 'mama direita', caso_especial: 'cistoSimples' }], '', CORPO_CISTO);
ok(r4.obs.some(o => /por caso especial ditado/.test(o)),
   'caso especial ditado continua declarado como ditado');

// ===================================================================================
// 31/08/2026 — CISTO SIMPLES NAO LEVA DISTANCIA DA PAPILA
// Pedido dele: "no exame de mama, quando o diagnostico for cisto simples, nao
// precisamos de distancia para a papila mamaria; tire isso do template dessa
// patologia especifica".
// O dizer padrao ja tinha sido limpo em 24/08. O que SOBROU — e que esta suite passa a
// travar — foi a regra dos cistos MULTIPLOS no pedido a IA, que mandava
// "• as X h, a Y cm da papila, medindo...". O mesmo achado pedia a distancia quando
// eram varios e nao pedia quando era um so: a contradicao morava em dois lugares
// diferentes do MESMO pedido, e por isso ninguem a via.
console.log('\n=== cisto simples: sem distancia da papila, um ou varios ===');
const regraMult = (HTML.match(/CISTOS SIMPLES MÚLTIPLOS[^"]*/) || [''])[0];
ok(regraMult.length > 80, 'achei a regra dos cistos multiplos');
ok(/• às X h, medindo A x B x C cm;/.test(regraMult),
   'o formato do bullet nao pede mais a distancia da papila');
ok(!/a Y cm da papila/.test(regraMult), 'e a frase antiga sumiu de vez');
ok(/BULLET POINTS/.test(regraMult), 'os bullets continuam (decisao de 26/08, nao foi desfeita)');
ok(/CISTO SIMPLES NÃO LEVA DISTÂNCIA DA PAPILA/.test(HTML),
   'e a regra e dita com todas as letras, nao so pela ausencia');
ok(/nódulo, microcistos agrupados e massa sólido-cística continuam obrigados/.test(HTML),
   'sem afrouxar os OUTROS achados, que continuam obrigados a informar a distancia');
// o dizer padrao do cisto simples (limpo em 24/08) tem de continuar limpo
const dadosJs = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');
const dizerCisto = (dadosJs.match(/Cisto simples:[\s\S]{0,400}?CONCLUS/) || [''])[0];
ok(dizerCisto.length > 60, 'achei o dizer padrao do cisto simples');
ok(!/papila/i.test(dizerCisto), 'e ele segue sem citar a papila');
// e o vizinho que DEVE citar continua citando — a limpeza nao pode ter vazado
const dizerMicro = (dadosJs.match(/Microcistos agrupados:[\s\S]{0,600}?CONCLUS/) || [''])[0];
ok(/papila/i.test(dizerMicro), 'microcistos agrupados continuam pedindo a distancia');

console.log(falhas ? ('\n' + falhas + ' FALHA(S)') : '\nTODOS OS TESTES PASSARAM');
process.exit(falhas ? 1 : 0);
