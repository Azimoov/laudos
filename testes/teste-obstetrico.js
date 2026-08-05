// Obstetrico 2o/3o trimestre: QUAL idade gestacional vai na conclusao.
//   paciente NAO trouxe o USG de 1o trimestre -> AUA  (biometria de hoje)
//   paciente TROUXE                           -> GA   (datacao ja corrigida)
// A data provavel do parto acompanha o mesmo par: EDD(AUA) com AUA, EDD(EDD) com GA.
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

const MARGEM = (HTML.match(/const MARGEM_IG = \[[\s\S]*?\n\];/) || [])[0];
const app = new Function(MARGEM + '\n'
  + ['margemErroIG', 'obstParseIG', 'obstIgTexto', 'processarObstetrico', 'obstAplicarNaConclusao'].map(grab).join('\n')
  + '\n return {margemErroIG, obstParseIG, obstIgTexto, processarObstetrico, obstAplicarNaConclusao};')();
const { obstParseIG, obstIgTexto, processarObstetrico, obstAplicarNaConclusao } = app;

// conclusao como o modelo do medico entrega, com os pontilhados
const MODELO = 'Foi observado Gravidez de feto único, com vitalidade normal.\n'
  + 'A biometria fetal estima que a idade gestacional média seja de ..... semanas e ..... dias.\n'
  + 'A data ecográfica média provável do parto é aproximada para: .......... (com variação de até +/- ..... dias).\n'
  + 'Peso no percentil ..... (Hadlock).';
// numeros da worksheet da foto de 05/08
const FOTO = { aua: '34w2d', ga: '35w3d', edd_aua: '25/07/2026', edd_ga: '17/07/2026' };

console.log('=== ler a idade gestacional como o aparelho escreve ===');
ok(JSON.stringify(obstParseIG('34w2d')) === '{"sem":34,"dias":2}', 'le "34w2d"');
ok(JSON.stringify(obstParseIG('35w3d')) === '{"sem":35,"dias":3}', 'le "35w3d"');
ok(JSON.stringify(obstParseIG('34w')) === '{"sem":34,"dias":0}', 'le "34w" (sem os dias)');
ok(JSON.stringify(obstParseIG('34s2d')) === '{"sem":34,"dias":2}', 'le "34s2d"');
ok(JSON.stringify(obstParseIG('34 semanas e 2 dias')) === '{"sem":34,"dias":2}', 'le por extenso');
ok(obstParseIG('') === null && obstParseIG(null) === null, 'campo vazio nao vira idade gestacional');
ok(obstParseIG('abc') === null, 'texto sem numero nao vira idade gestacional');
ok(obstParseIG('99w2d') === null, 'numero absurdo e recusado em vez de virar laudo');
ok(obstParseIG('2w1d') === null, 'semanas abaixo do possivel sao recusadas');
ok(obstIgTexto({ sem: 34, dias: 2 }) === '34 semanas e 2 dias', 'texto em portugues');
ok(obstIgTexto({ sem: 34, dias: 1 }) === '34 semanas e 1 dia', 'um dia no singular');
ok(obstIgTexto({ sem: 34, dias: 0 }) === '34 semanas', 'zero dia nao vira "e 0 dias"');

console.log('=== NAO trouxe o USG de primeiro trimestre -> AUA ===');
let r = processarObstetrico(Object.assign({ trouxe_usg_primeiro_trimestre: false }, FOTO));
ok(/34 semanas e 2 dias/.test(r.frase), 'usa o AUA (34w2d), nao o GA');
ok(!/35 semanas/.test(r.frase), 'nao deixa o GA vazar para a conclusao');
ok(/^A biometria fetal estima/.test(r.frase), 'frase da biometria');
ok(r.edd === null, 'NAO informa data provavel do parto — sem datacao de 1o trimestre ela nao e confiavel');
ok(r.eddFrase === 'Não contamos com ultrassonografia de primeiro trimestre para correta datação da gestação.',
   'a linha da data do parto da lugar a frase que diz por que ela nao esta la');
ok(r.margem === null, 'sem exame inicial nao ha margem de erro para calcular');
let saida = obstAplicarNaConclusao(MODELO, r);
ok(saida.includes('A biometria fetal estima que a idade gestacional média seja de 34 semanas e 2 dias.'),
   'a linha da idade gestacional sai preenchida');
ok(!saida.includes('..... semanas'), 'nao sobra pontilhado da idade gestacional');
ok(saida.includes('Não contamos com ultrassonografia de primeiro trimestre para correta datação da gestação.'),
   'a frase entra no lugar da data provavel do parto');
ok(!/data ecográfica|aproximada para/.test(saida), 'a linha antiga da data do parto sumiu de vez');
ok(!/variação de até/.test(saida),
   'a variacao em dias vai junto: sem datacao de 1o trimestre ela nao significa nada');
ok(!/\.{3,}/.test(saida.split('\n')[2]), 'nao sobra pontilhado nenhum nessa linha');
ok(saida.split('\n').length === MODELO.split('\n').length, 'nao criou nem perdeu linha da conclusao');
ok(obstAplicarNaConclusao(saida, r) === saida, 'refazer o laudo nao duplica a frase');

console.log('=== TROUXE o USG de primeiro trimestre -> GA ===');
r = processarObstetrico(Object.assign({ trouxe_usg_primeiro_trimestre: true, ig_primeiro_usg_semanas: 12 }, FOTO));
ok(/35 semanas e 3 dias/.test(r.frase), 'usa o GA (35w3d), nao o AUA');
ok(!/34 semanas/.test(r.frase), 'nao deixa o AUA vazar para a conclusao');
ok(/^A idade gestacional corrigida pela ultrassonografia de primeiro trimestre é de/.test(r.frase),
   'frase da idade corrigida');
ok(r.edd === '17/07/2026', 'data provavel do parto vem do EDD(EDD), casando com o GA');
ok(r.margem === 7, 'margem de +/- 7 dias pela IG de 12 semanas no exame inicial');
saida = obstAplicarNaConclusao(MODELO, r);
ok(saida.includes('A idade gestacional corrigida pela ultrassonografia de primeiro trimestre é de 35 semanas e 3 dias.'),
   'a linha certa substituiu a do modelo');
ok(!saida.includes('A biometria fetal estima'), 'a frase da biometria nao ficou junto');
ok(saida.includes('aproximada para: 17/07/2026') && saida.includes('+/- 7 dias'), 'data e variacao preenchidas');
ok(saida.split('\n').length === MODELO.split('\n').length, 'nao criou nem perdeu linha');

console.log('=== a IA nao consegue mais escolher errado ===');
// mesmo que a IA ja tenha escrito a frase com o numero trocado, o app manda
const iaErrada = MODELO.replace('A biometria fetal estima que a idade gestacional média seja de ..... semanas e ..... dias.',
                                'A biometria fetal estima que a idade gestacional média seja de 35 semanas e 3 dias.');
saida = obstAplicarNaConclusao(iaErrada, processarObstetrico(Object.assign({ trouxe_usg_primeiro_trimestre: false }, FOTO)));
ok(saida.includes('34 semanas e 2 dias') && !saida.includes('35 semanas'),
   'numero errado escrito pela IA e trocado pelo certo (era o erro do exame de 05/08)');
const iaCorrigidaAToa = MODELO.replace(/A biometria fetal estima.*/,
  'A idade gestacional corrigida pela ultrassonografia de primeiro trimestre é de 30 semanas.');
saida = obstAplicarNaConclusao(iaCorrigidaAToa, processarObstetrico(Object.assign({ trouxe_usg_primeiro_trimestre: false }, FOTO)));
ok(saida.includes('A biometria fetal estima que a idade gestacional média seja de 34 semanas e 2 dias.')
   && !saida.includes('corrigida pela ultrassonografia'),
   'frase errada escrita pela IA tambem e trocada, nao so o numero');

console.log('=== worksheet ilegivel: pontilhado fica, nada e inventado ===');
r = processarObstetrico({ trouxe_usg_primeiro_trimestre: false, aua: '' });
ok(r.frase === null, 'sem o AUA, o app nao monta frase de idade gestacional nenhuma');
ok(r.faltando.some(t => /AUA/.test(t)), 'avisa que faltou o AUA');
ok(!r.faltando.some(t => /EDD/.test(t)),
   'nao cobra data provavel do parto: sem 1o trimestre ela nem entra no laudo');
saida = obstAplicarNaConclusao(MODELO, r);
ok(saida.includes('..... semanas e ..... dias'), 'a idade gestacional fica nos pontilhados — nada inventado');
ok(saida.includes('Não contamos com ultrassonografia de primeiro trimestre'),
   'mas a frase da data do parto entra do mesmo jeito: ela nao depende de ler a worksheet');
r = processarObstetrico({ trouxe_usg_primeiro_trimestre: true, ga: '', edd_ga: '' });
ok(r.faltando.some(t => /GA/.test(t) && /trouxe o primeiro exame/.test(t)),
   'quando trouxe, o campo cobrado e o GA — e o aviso explica por que');

console.log('=== avisos vao para as caixas certas do painel ===');
r = processarObstetrico(Object.assign({ trouxe_usg_primeiro_trimestre: true, ig_primeiro_usg_semanas: 12 }, FOTO));
ok(r.obs.some(t => /campo GA da worksheet/.test(t)), 'diz de onde tirou a idade gestacional');
ok(r.obs.some(t => /EDD\(EDD\)/.test(t)), 'diz de onde tirou a data do parto');
ok(r.obs.some(t => /Margem de erro de ±7 dias/.test(t)), 'diz como chegou na margem');
ok(r.faltando.length === 0, 'com tudo lido, nada em falta');
r = processarObstetrico(Object.assign({ trouxe_usg_primeiro_trimestre: true }, FOTO));
ok(r.faltando.some(t => /dite-a para eu calcular a margem/.test(t)),
   'trouxe mas nao ditou a IG do exame inicial: cobra o ditado');
ok(r.margem === null && obstAplicarNaConclusao(MODELO, r).includes('(com variação de até +/- ..... dias)'),
   'e a variacao continua nos pontilhados');
ok(/alertas\.push\(\{tipo:'faltando', texto:ob\.faltando/.test(HTML),
   'o que faltou acende a caixa AMBAR (dados faltando), nao a verde');
ok(/alertas\.push\(\{tipo:'calculo', texto:ob\.obs/.test(HTML),
   'o que o app calculou acende a caixa VERDE');

console.log('=== o pedido a IA ===');
ok(/- aua: leia da worksheet do aparelho o campo AUA/.test(HTML), 'a IA e mandada ler o AUA');
ok(/- ga: leia da worksheet o campo GA/.test(HTML), 'a IA e mandada ler o GA');
ok(/- edd_aua:/.test(HTML) && /- edd_ga:/.test(HTML), 'e as duas datas provaveis do parto');
ok(/AUA e GA são campos DIFERENTES da worksheet/.test(HTML), 'a IA e avisada para nao trocar um pelo outro');
ok(/NÃO escreva a idade gestacional, NÃO escreva a data provável do parto/.test(HTML),
   'a IA e proibida de escrever esses valores na conclusao');
ok(/\\"aua\\":\\"\\",\\"ga\\":\\"\\",\\"edd_aua\\":\\"\\",\\"edd_ga\\":\\"\\"/.test(HTML),
   'os quatro campos estao no formato de resposta');
ok(/obstAplicarNaConclusao\(conclusaoFinal, ob\)/.test(HTML), 'o app aplica a decisao dele na conclusao');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
