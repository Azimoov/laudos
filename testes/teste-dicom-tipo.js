// O EXAME IMPORTADO DO APARELHO NASCIA SEM TIPO — 24/08/2026, defeito visto em atendimento.
//
// O que o medico via: importava o exame, gravava o ditado, tocava em "Gerar laudo", e a
// tela respondia "O material foi processado, mas nenhum laudo saiu pronto" — com o exame
// SUMINDO do painel da direita (processar() consome os importados). Tres tentativas assim.
//
// A causa: o exame importado nascia com `tipo:''`. `gerarLaudo` para na primeira linha
// quando nao ha tipo ("Escolha o tipo de exame"), entao nenhum laudo saia — e a IA nem
// chegava a ser chamada (contador parado em 22 durante toda a tentativa, foi assim que
// isolei). A regiao ja vinha do aparelho e virava so um RoTULO de tela ("Mama"): a
// informacao existia e era jogada fora.
//
// Regra: mapear so o INEQUIVOCO. Onde a regiao serve a mais de um modelo, fica vazio de
// proposito e o medico escolhe — um modelo chutado escreveria o laudo com a estrutura
// errada, que e pior que nao gerar.
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
}
// MODELOS de mentira, com as chaves reais que interessam
const MODELOS = { mama:{}, tireoide:{}, abdominal:{}, transvaginal:{}, obst23:{}, partes_moles:{} };
const api = new Function('MODELOS',
  (HTML.match(/const DICOM_REGIAO = \{[\s\S]*?\n\};/) || [''])[0] + '\n'
  + (HTML.match(/const DICOM_TIPO = \{[\s\S]*?\n\};/) || [''])[0] + '\n'
  + grab('dicomRegiao') + '\n' + grab('dicomTipo')
  + '\nreturn {dicomTipo, dicomRegiao};')(MODELOS);

console.log('=== as regioes REAIS do aparelho dele (lidas do Orthanc em 24/08) ===');
// SMP 136 · GYN 64 · URO 46 · BREAST 41 · OB 30 · ABD 8 · Nerve Blocks 2
ok(api.dicomTipo('BREAST') === 'mama', 'BREAST -> mama (o exame da Regiane, que nao gerava)');
ok(api.dicomTipo('ABD') === 'abdominal', 'ABD -> abdominal');
ok(api.dicomTipo('THYROID') === 'tireoide', 'THYROID -> tireoide');

console.log('\n=== o AMBIGUO fica vazio, e o medico escolhe ===');
// Chutar aqui escreveria um laudo com a estrutura de outro exame.
[['GYN', 'pode ser transvaginal OU pelvica'],
 ['OB', 'nao distingue 1o de 2o/3o trimestre nem gemelar'],
 ['URO', 'pode ser rins, prostata ou bolsa escrotal'],
 ['SMP', 'partes moles cobre meia duzia de modelos'],
 ['Nerve Blocks', 'idem']
].forEach(function (c) {
  ok(api.dicomTipo(c[0]) === '', c[0] + ' -> vazio (' + c[1] + ')');
  ok(api.dicomRegiao(c[0]) !== '', '   mas o ROTULO da tela continua saindo: "' + api.dicomRegiao(c[0]) + '"');
});

console.log('\n=== a regiao dentro de um texto maior, e as armadilhas ===');
ok(api.dicomTipo('BREAST20260824135523') === 'mama' || api.dicomTipo('BREAST 20260824-172604') === 'mama',
   'a regiao e reconhecida mesmo com o carimbo de data grudado');
ok(api.dicomTipo('ABDOMEN') === '', '"ABDOMEN" NAO vira "ABD" — casa palavra inteira');
ok(api.dicomTipo('') === '', 'descricao vazia -> vazio');
ok(api.dicomTipo(null) === '', 'descricao nula nao quebra');

console.log('\n=== o tipo chega ao exame, e a escolha do medico ainda manda ===');
ok(/tipo:dicomTipo\(e\.descricao\)/.test(HTML),
   'o importado guarda o tipo junto com a regiao');
ok((HTML.match(/tipo:dicomTipo\(e\.descricao\)/g) || []).length === 2,
   'nos DOIS caminhos de importacao (a tela de antigos e a captura ao vivo)');
ok(/tipo:d\.tipo\|\|''/.test(HTML),
   'e o exame nasce com ele (antes nascia sempre com o tipo vazio)');
const aplicar = grab('antAplicarEscolhas');
ok(/if\(f\.tipo\) ex\.tipo=f\.tipo;/.test(aplicar),
   'e "Modelo do exame" continua sobrescrevendo — a regiao e so o padrao');

console.log('\n=== e quando o tipo falta, a tela DIZ o que fazer ===');
// Some com o exame da tela + frase generica era o pior par possivel: ele passou tres
// tentativas sem saber o que faltava.
const gerar = grab('antGerar');
ok(/var _semTipo=exames\.filter\(function\(x\)\{ return !x\.tipo; \}\)/.test(gerar),
   'o aviso olha QUAIS exames ficaram sem tipo');
ok(/Falta dizer QUAL exame é/.test(gerar), 'e diz isso, com o nome do paciente');
ok(/Escolha em "Modelo do exame"/.test(gerar), 'apontando o campo que resolve');
ok(/confira os avisos no diário/.test(gerar),
   'a frase antiga fica para os outros motivos (nao era errada, era generica demais)');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
