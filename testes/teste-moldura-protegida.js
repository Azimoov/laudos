// A LINHA DE MOLDURA ("DESCRIÇÃO:") NAO PODE SUMIR DO LAUDO — 27/08/2026.
//
// CASO REAL (Jacilene, 26/08): o laudo de mama saiu na pasta com "DESCRIÇÃO:" embaixo de
// MAMA DIREITA e SEM ele embaixo de MAMA ESQUERDA. O arquivo salvo era copia fiel do
// objeto do laudo — ou seja, a linha ja tinha sumido ANTES de salvar, durante a edicao.
//
// Conferido na investigacao (com o laudo REAL, que carrega o proprio molde):
//   - o caminho dos retangulos preserva a estrutura;
//   - digitar na folha + a absorcao da tela final preservam;
//   - nao houve corrupcao no salvar.
// Sobrou o acidente humano: a linha VIVIA DENTRO da area editavel do retangulo e uma
// tecla a apagava em silencio. A correcao tira a moldura de dentro do editavel e a poe
// no cabecalho PROTEGIDO, junto com o titulo (que ja era protegido) e a linha em branco.
//
// ⚠️ ATENCAO ao alterar rev2CorpoVisivel: o cabecalho protegido e recolocado por
// rev2Editou (b.texto = cab + novo). Se o 'cab' parar de trazer as quebras de linha do
// fim, o titulo cola no texto ("MAMA ESQUERDADESCRIÇÃO:").
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  let i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}

// recorta as duas funcoes de verdade do index.html e roda aqui
const REV2_MOLDURA = eval('(' + (HTML.match(/const REV2_MOLDURA\s*=\s*(\/[^\n]+?\/[a-z]*)\s*;/) || [])[1] + ')');
eval(grab('rev2TituloDeMoldura'));
eval(grab('rev2CorpoVisivel'));

const CORPO_ESQ =
  '**MAMA ESQUERDA**\n**DESCRIÇÃO:**\n\nMama simétrica.\n' +
  'Pele e tecido celular subcutâneo sem alterações.\n' +
  '**• às 12 h, a ..... cm da papila, medindo 0,6 x 0,3 x 0,4 cm;**\n' +
  'Região axilar livre.';

console.log('=== a moldura entra no cabecalho PROTEGIDO ===');
const b = { titulo: 'MAMA ESQUERDA', texto: CORPO_ESQ };
const vis = rev2CorpoVisivel(b);
ok(vis.cab.indexOf('DESCRIÇÃO:') >= 0, '"DESCRIÇÃO:" fica no cabecalho, fora do que se digita');
ok(vis.txt.indexOf('DESCRIÇÃO:') < 0, 'e nao aparece mais na area editavel (era ali que sumia)');
ok(/\n\n$/.test(vis.cab), 'o cabecalho leva junto a linha em branco (ela tambem sumiu no caso real)');
ok(vis.txt.indexOf('Mama simétrica.') === 0, 'o texto clinico comeca onde tem de comecar');

console.log('\n=== o pior acidente: apagar o retangulo INTEIRO ===');
// e o que rev2Editou faz: b.texto = cab + novo
const depois = vis.cab + 'Mama simétrica.';
ok(depois.indexOf('**MAMA ESQUERDA**') === 0, 'o titulo volta');
ok(depois.indexOf('**DESCRIÇÃO:**') > 0, 'e a moldura volta — o laudo nao perde a estrutura');
ok(!/\*\*MAMA ESQUERDA\*\*\*\*/.test(depois), 'sem colar o titulo na moldura');

console.log('\n=== o que NAO pode virar cabecalho protegido ===');
const clin = { titulo: 'MAMA DIREITA', texto: '**MAMA DIREITA**\n**Nódulo suspeito de 1,2 cm**\n\nRestante sem alterações.' };
const visC = rev2CorpoVisivel(clin);
ok(visC.cab.indexOf('Nódulo') < 0, 'achado clinico em negrito CONTINUA editavel (so moldura e protegida)');
ok(visC.txt.indexOf('Nódulo') >= 0, 'e segue aparecendo no retangulo, para ele corrigir');

console.log('\n=== bloco sem moldura segue como sempre ===');
const semMold = { titulo: 'TIREOIDE', texto: '**TIREOIDE**\n\nLobos simétricos.' };
const visS = rev2CorpoVisivel(semMold);
// sem moldura, o 'cab' e so o titulo e o txt entra com as quebras de linha dele —
// exatamente como era antes desta correcao (nao mexer aqui sem motivo)
ok(visS.cab === '**TIREOIDE**' && visS.txt === '\n\nLobos simétricos.',
   'titulo protegido, corpo editavel — comportamento antigo intacto');

console.log('\n=== linha inteiramente em negrito nao pode esvaziar o editavel ===');
const soNeg = { titulo: 'PESO', texto: '**Peso: 25 g (Normal até 30 g)**' };
const visP = rev2CorpoVisivel(soNeg);
ok(visP.txt.trim().length > 0, 'guarda antiga preservada: o campo editavel nunca fica vazio');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
