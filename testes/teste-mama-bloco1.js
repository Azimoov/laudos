// PACOTE DE MAMA — BLOCO 1 (modelo + dizeres padrão), 20/08/2026.
//
// Fonte: manual ACR BI-RADS v2025 + AUDITORIA-CBR.md (30/07/2026), pelas especificações
// 01-MODELO-MAMA e 02-BIZUS-MAMA que o Dr. Daniel entregou.
//
// Esta suíte guarda o conteúdo CLÍNICO, que é o que não pode regredir sem alguém ver:
// categoria certa, nenhuma medida de paciente sobrevivendo, nenhum lado escrito na pedra,
// unidade por tipo de exame, e categoria sempre acompanhada de probabilidade e conduta.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');
const { MODELOS, BIZUS } = new Function(src + '; return {MODELOS, BIZUS};')();

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const modelo = MODELOS.mama;
const mama = (function () {
  const a = /(^|\n)MAMA:?[ \t]*\n/.exec(BIZUS);
  const z = /(^|\n)ABDOMINAL TOTAL:?[ \t]*\n/.exec(BIZUS);
  return BIZUS.slice(a.index + a[0].length, z.index);
})();
// O texto é quebrado em linhas para caber na tela; a frase é uma só coisa lógica.
// Achatar antes de procurar evita o falso negativo bobo de a quebra cair no meio.
const plano = mama.replace(/\s+/g, ' ');

console.log('=== o modelo de mama ===');
ok(modelo.titulo === 'RELATÓRIO ULTRASSONOGRÁFICO DE MAMAS', 'título no plural, como o exame é');
ok(!/multifrequêncial/.test(modelo.tecnica) && /multifrequencial/.test(modelo.tecnica),
   'técnica sem o erro de grafia que a auditoria apontou');
['INDICAÇÃO', 'COMPARAÇÃO', 'COMPOSIÇÃO TECIDUAL', 'ACHADOS'].forEach(s =>
  ok(modelo.corpo.indexOf(s) >= 0, 'corpo traz a seção obrigatória ' + s + ' (BI-RADS §16.4)'));
ok((modelo.corpo.match(/Não se identificaram lesões focais/g) || []).length === 2,
   'as DUAS mamas são descritas por extenso — nunca "idem"');
ok(!/axilar livre/.test(modelo.corpo),
   'a axila saiu do laudo de rotina (A.15 do CBR; decisão do médico em 20/08)');
ok(!/semestral/.test(modelo.extra), '"Sugestão: exame ecográfico semestral" removida');
ok(/Federação Brasileira das Associações de Ginecologia e Obstetrícia/.test(modelo.extra),
   'FEBRASGO com o nome por extenso correto');
ok(/BI-RADS 1 — Negativo/.test(modelo.conclusao) && /Rastreamento de rotina/.test(modelo.conclusao),
   'a conclusão normal traz categoria E conduta');

console.log('\n=== nenhum dado de paciente sobreviveu nos dizeres ===');
// Era o risco mais grave da auditoria (§3.4): medida de um paciente saindo no laudo de
// outro. Com o esquema anatômico (bloco 2) fica pior — o número vira desenho, e desenho
// passa impressão de dado conferido.
ok(!/\d,\d\s*x\s*\d/.test(mama), 'nenhuma medida de caso real');
ok(!/às \d+\s*h/.test(mama), 'nenhuma hora de relógio fixa');
ok(mama.indexOf('XxX') < 0 && mama.toLowerCase().indexOf('xxxx') < 0, 'nenhum marcador antigo XxX');
ok(mama.split('.....').length - 1 > 60, 'e o marcador do projeto (.....) é o único usado');

console.log('\n=== nenhum LADO escrito na pedra numa conclusão ===');
// Não estava em spec nenhuma: os dizeres antigos diziam "compatível com nódulos à
// direita", "linfonodo intramamário à direita", "rotura à esquerda". Mesmo gênero de risco
// das medidas fixas — laudo saindo com o lado errado.
const concs = mama.match(/CONCLUSÃO:[\s\S]*?(?=\n\n)/g) || [];
ok(concs.length >= 12, concs.length + ' conclusões conferidas');
const comLado = concs.filter(c => /à (direita|esquerda)/.test(c));
ok(comLado.length === 0, 'nenhuma conclusão traz o lado fixo');
ok(/medindo à direita \.\.\.\.\. x/.test(plano),
   'e a ginecomastia mantém os dois lados como RÓTULO de medida, que é legítimo');

console.log('\n=== unidade: a do BI-RADS para mama (decisão do médico, 20/08) ===');
ok((plano.match(/x \.\.\.\.\. mm/g) || []).length >= 12, 'tamanho de lesão em mm');
ok(!/medindo[^.]{0,80}\.\.\.\.\. cm/.test(plano), 'nenhum tamanho ficou em cm');
ok(!/distando \.\.\.\.\. mm/.test(plano), 'nenhuma distância ficou em mm');
ok((plano.match(/às \.\.\.\.\. h, distando \.\.\.\.\. cm da papila até o centro do achado/g) || []).length === 8,
   'os 8 achados focais têm hora + distância, em cm inteiro e até o CENTRO do achado (ACR)');

console.log('\n=== o que a auditoria mandou corrigir ===');
ok(/cisto complicado isolado[\s\S]{0,140}BI-RADS 3/.test(plano),
   'cisto complicado 2 -> 3 (confirmado na fonte primária, não só na auditoria)');
ok(/microcistos agrupados[\s\S]{0,140}BI-RADS 2/.test(plano),
   'microcistos agrupados 3 -> 2 (estavam invertidos entre si)');
ok(/linfonodo intramamário[\s\S]{0,160}BI-RADS 2/i.test(plano), 'linfonodo ganhou categoria');
ok(plano.indexOf('BI-RADS 4.....') >= 0 && /escolher a letra \(A, B ou C\)/.test(plano),
   'BI-RADS 4 pede a letra (as faixas saem da tabela local, não do texto — ver bloco 2)');
ok(/retroareolares até 3 mm/.test(plano) && /periféricos até/.test(plano),
   'ectasia ductal com a referência de calibre que sustenta a conclusão');
ok(mama.indexOf('TECIDO MAMÁRIO') < 0 && /tecido mamário ectópico/.test(plano),
   'a duplicidade do tecido mamário axilar foi consolidada num dizer só');
// A auditoria pedia um 4º descritor (ecotextura) no nódulo BR3; a leitura direta do manual
// ACR mostrou que ele exige TRÊS (margem circunscrita + forma oval + orientação paralela).
// Registrado aqui para ninguém "corrigir de volta" achando que ficou faltando.
ok(/forma oval, orientação paralela à pele e margens circunscritas/.test(plano),
   'nódulo BR3 com os TRÊS descritores do ACR — e não o 4º que a auditoria sugeria');

console.log('\n=== língua ===');
['multifrequêncial', 'anecóide', 'anecóico', 'anecogênico', 'polipóide',
 'Não identificou-se', 'Não notou-se', 'ecogenicidade habituais'].forEach(e =>
  ok(mama.indexOf(e) < 0, "sem '" + e + "'"));
ok(/Notaram-se/.test(mama), 'plural corrigido onde há mais de um achado');

console.log('\n=== categoria nos dizeres: enxuta, porque o resto sai da tabela local ===');
// 20/08: probabilidade e conduta SAÍRAM do texto e passaram para BIRADS_CAT, no código.
// Motivo de peso: o que está aqui viaja no pedido à IA em todo exame e é cobrado por
// token; ali não custa nada e não corre risco de ser parafraseado. Ver teste-birads-cat.js.
const cats = mama.match(/Categoria: BI-RADS [^\n]*/g) || [];
ok(cats.length >= 11, cats.length + ' categorias no arquivo');
ok(!/Probabilidade de malignidade/.test(mama),
   'a faixa de probabilidade NÃO se repete no texto — sai da tabela local');
ok(!/Recomendação de conduta/.test(mama),
   'a conduta também não — mesma razão');
ok(mama.length < 5300,
   'e a seção ficou em ' + mama.length + ' caracteres, na faixa do tamanho original (5087)');
ok(!/Categoria: BI-RADS/.test(mama.slice(mama.indexOf('Ginecomastia:'), mama.indexOf('Implante mamário íntegro:'))),
   'ginecomastia segue SEM categoria — não é lesão focal, não há o que classificar');

console.log('\n=== o resto do arquivo não foi tocado ===');
ok(Object.keys(MODELOS).length === 26, 'os 26 modelos continuam lá');
['abdominal', 'tireoide', 'prostata', 'obst23', 'doppler_arterial_mmii'].forEach(k =>
  ok(!!MODELOS[k], 'modelo ' + k + ' intacto'));
['ABDOMINAL TOTAL', 'TRANSVAGINAL', 'TIREOIDE', 'PROSTATA', 'DOPPLER ARTERIAL MMII'].forEach(n =>
  ok(BIZUS.indexOf('\n' + n + ':') >= 0, 'região de dizeres ' + n + ' intacta'));

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
