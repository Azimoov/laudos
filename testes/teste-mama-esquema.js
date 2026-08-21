// ESQUEMA ANATÔMICO DA MAMA — especificação 03 do pacote (20-21/08/2026).
//
// O princípio inegociável da especificação é que desenho e texto nunca divirjam. Aqui isso
// é garantido pela via mais simples: o desenho NÃO é guardado, é redesenhado do texto toda
// vez. Não há cópia para envelhecer.
//
// E a regra de segurança que esta suíte cobra mais que qualquer outra: NÃO CONSEGUIU LER A
// POSIÇÃO, NÃO DESENHA. Marcador em posição inventada é risco médico-legal direto;
// marcador ausente, com a razão dita na legenda, não é.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + nome);
}
const api = new Function('esc',
  HTML.match(/const MAMA_RAIO_CM = [^\n]*/)[0] + '\n' +
  grab('mamaMm') + grab('mamaCmInteiro') + grab('mamaLocalDoTexto') + grab('mamaLesoes') +
  grab('_mamaXY') + grab('_mamaFrontal') + grab('_mamaLateral') + grab('mamaEsquemaHTML') +
  '\nreturn {mamaMm, mamaCmInteiro, mamaLocalDoTexto, mamaLesoes, mamaEsquemaHTML, _mamaXY};'
)(s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

console.log('=== unidade: lê o número E a unidade, nunca adivinha ===');
// Pedido explícito do médico (20/08): o aparelho mede em cm, o laudo de mama passou a
// falar mm. O programa tem de ler os dois e saber a diferença.
ok(api.mamaMm(12, 'mm') === 12, '12 mm -> 12 mm');
ok(api.mamaMm(1.2, 'cm') === 12, '1,2 cm -> 12 mm');
ok(api.mamaMm('1,2', 'cm') === 12, 'aceita vírgula decimal, que é como se escreve aqui');
ok(api.mamaMm('0,9', 'cm') === 9, '0,9 cm -> 9 mm');
ok(api.mamaMm(12, '') === null, 'SEM unidade devolve nulo — 12 pode ser 12 mm ou 12 cm');
ok(api.mamaMm(12, 'polegada') === null, 'unidade que não conhece também é nulo');
ok(api.mamaMm('abc', 'mm') === null, 'texto que não é número é nulo');
ok(api.mamaMm(-5, 'mm') === null, 'medida negativa é nulo');
ok(api.mamaCmInteiro(28, 'mm') === 3, 'distância 28 mm -> 3 cm INTEIRO (ACR não usa fração)');
ok(api.mamaCmInteiro('2,3', 'cm') === 2, '2,3 cm -> 2 cm, como o manual manda registrar');

console.log('\n=== lê a localização da frase que o bloco 1 padronizou ===');
const f = 'Notou-se imagem nodular sólida, de forma oval, orientação paralela à pele e '
        + 'margens circunscritas, localizada na mama direita, às 10 h, distando 3 cm da '
        + 'papila até o centro do achado, medindo 12 x 8 x 9 mm.';
const loc = api.mamaLocalDoTexto(f);
ok(loc.lado === 'D', 'lado: direita');
ok(loc.hora === 10, 'hora: 10');
ok(loc.distCm === 3, 'distância: 3 cm');
ok(String(loc.mm) === '12,8,9', 'medidas: 12, 8 e 9 mm');
ok(api.mamaLocalDoTexto('na mama esquerda, às 2h, distando 4 cm').lado === 'E', 'mama esquerda');
ok(api.mamaLocalDoTexto('às 2h').hora === 2, 'aceita "2h" colado');
ok(api.mamaLocalDoTexto('às 2 horas').hora === 2, 'e "2 horas" por extenso');
ok(api.mamaLocalDoTexto('medindo 1,4 x 0,7 cm').mm[0] === 14,
   'medida em CENTÍMETRO no texto é convertida (1,4 cm -> 14 mm)');
ok(api.mamaLocalDoTexto('lesão retroareolar').distCm === 0, 'retroareolar é distância zero');
ok(api.mamaLocalDoTexto('às 25 h').hora === null, 'hora fora de 1–12 é recusada');
ok(api.mamaLocalDoTexto('texto sem nada disso').hora === null, 'frase sem hora não inventa hora');

console.log('\n=== NÃO CONSEGUIU LER, NÃO DESENHA ===');
function laudo(bir, corpo) { return { birads: bir, corpo: corpo || '', dados_estruturados: {} }; }
const completo = api.mamaLesoes(laudo(
  [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' }], f));
ok(completo.plot.length === 1, 'achado com lado, hora e distância É desenhado');
ok(completo.plot[0].n === 1, 'e recebe o número 1');

// O motivo tem de ser o motivo CERTO, não um qualquer. A primeira versão desta suíte
// passou dizendo "lado não identificado" para um laudo onde o lado estava escrito — o
// achado não casava com nenhuma frase do corpo e a leitura acontecia sobre o rótulo
// sozinho. Passar pelo motivo errado é passar por acaso.
[['sem hora', 'Notou-se nódulo localizado na mama direita, distando 3 cm da papila.', /hora/],
 ['sem distância', 'Notou-se nódulo localizado na mama direita, às 10 h.', /dist/i],
 ['sem lado', 'Notou-se nódulo às 10 h, distando 3 cm da papila.', /lado/]].forEach(([oque, txt, esperado]) => {
  const r = api.mamaLesoes(laudo([{ localizacao: 'nódulo', forma: 'oval', orientacao: 'paralela' }], txt));
  ok(r.plot.length === 0, oque + ': não é desenhado');
  ok(esperado.test(r.semPos[0].porque),
     '   e a legenda diz o motivo CERTO: "' + r.semPos[0].porque + '"');
});

console.log('\n=== com DOIS achados e frase não identificada, não se chuta ===');
// Aqui a saída do "corpo inteiro" é desligada de propósito: com dois achados, ler o corpo
// todo casaria a hora de um com a distância do outro. Pior que não desenhar.
const ambiguo = api.mamaLesoes(laudo(
  [{ localizacao: 'primeiro', forma: 'oval', orientacao: 'paralela' },
   { localizacao: 'segundo', forma: 'oval', orientacao: 'paralela' }],
  'Notaram-se dois nódulos: na mama direita às 10 h distando 3 cm; e às 4 h distando 2 cm.'));
ok(ambiguo.plot.length === 0, 'nenhum dos dois é desenhado quando não dá para saber qual é qual');
ok(ambiguo.semPos.length === 2, 'e os dois aparecem declarados na legenda');

console.log('\n=== a contradição do BI-RADS §2.1 bloqueia o desenho ===');
// Massa REDONDA é, por definição do manual, NÃO paralela. Redonda + paralela é
// contraditória por dentro; desenhar daria ao erro a aparência de dado conferido.
const contra = api.mamaLesoes(laudo(
  [{ localizacao: 'mama direita', forma: 'redonda', orientacao: 'paralela' }], f));
ok(contra.plot.length === 0, 'redonda + paralela não é desenhada');
ok(/redonda/.test(contra.semPos[0].porque) && /paralela/.test(contra.semPos[0].porque),
   'e a razão é dita por extenso: "' + contra.semPos[0].porque + '"');
const coerente = api.mamaLesoes(laudo(
  [{ localizacao: 'mama direita', forma: 'redonda', orientacao: 'nao' }], f));
ok(coerente.plot.length === 1, 'redonda + NÃO paralela é coerente e desenha normalmente');

console.log('\n=== o desenho ===');
const svgHtml = api.mamaEsquemaHTML(laudo(
  [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' }], f));
ok(svgHtml.indexOf('<svg') >= 0, 'sai SVG');
ok((svgHtml.match(/<svg/g) || []).length === 2, 'duas vistas: frontal e corte lateral');
ok(/MAMA DIREITA/.test(svgHtml), 'com o lado escrito por extenso — nunca só a posição na página');
ok(!/MAMA ESQUERDA/.test(svgHtml), 'e a mama sem lesão NÃO é desenhada');
ok(/Representação esquemática, sem escala anatômica real/.test(svgHtml), 'com o aviso obrigatório');
ok(/10h, a 3 cm da papila/.test(svgHtml), 'e a legenda repete a localização em texto');
ok(/12 × 8 × 9 mm/.test(svgHtml), 'com as medidas em mm');
ok(svgHtml.indexOf('style="') >= 0 && svgHtml.indexOf('class="mamaEsq"') >= 0,
   'estilos inline, sem depender de CSS externo (some na impressão)');
ok(api.mamaEsquemaHTML(laudo([], '')) === '', 'exame NORMAL não ganha esquema nenhum');

console.log('\n=== as duas mamas, com numeração contínua ===');
const duas = api.mamaEsquemaHTML(laudo(
  [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' },
   { localizacao: 'mama esquerda', forma: 'oval', orientacao: 'paralela' }],
  f + ' Notou-se nódulo na mama esquerda, às 4 h, distando 2 cm da papila, medindo 6 x 5 mm.'));
ok(/MAMA DIREITA/.test(duas) && /MAMA ESQUERDA/.test(duas), 'as duas mamas desenhadas');
ok((duas.match(/<svg/g) || []).length === 4, 'quatro vistas (duas por mama)');
ok(/<b>1<\/b> — Mama direita/.test(duas) && /<b>2<\/b> — Mama esquerda/.test(duas),
   'numeração CONTÍNUA entre as mamas, não reiniciada por lado');

console.log('\n=== geometria: 12h em cima, 3h à direita da tela, nas DUAS mamas ===');
// Confirmado na fonte primária: "Clock face is oriented based on the patient facing the
// observer... 3:00 is in the lateral left breast and the medial right breast."
const cx = 105, cy = 105, R = 78;
const p12 = api._mamaXY(12, 8, cx, cy, R), p3 = api._mamaXY(3, 8, cx, cy, R);
const p6 = api._mamaXY(6, 8, cx, cy, R), p9 = api._mamaXY(9, 8, cx, cy, R);
ok(Math.abs(p12[0] - cx) < 0.5 && p12[1] < cy, '12h no topo');
ok(p3[0] > cx && Math.abs(p3[1] - cy) < 0.5, '3h à direita da tela');
ok(Math.abs(p6[0] - cx) < 0.5 && p6[1] > cy, '6h embaixo');
ok(p9[0] < cx && Math.abs(p9[1] - cy) < 0.5, '9h à esquerda da tela');
const perto = api._mamaXY(12, 2, cx, cy, R), longe = api._mamaXY(12, 8, cx, cy, R);
ok(Math.abs(perto[1] - cy) < Math.abs(longe[1] - cy), 'quanto maior a distância, mais longe da papila');
const alem = api._mamaXY(12, 40, cx, cy, R);
ok(Math.abs(alem[1] - cy) <= R + 0.01, 'distância maior que o raio fica NA BORDA, não fora do desenho');

console.log('\n=== o esquema entra no lugar que o BI-RADS §16.4 fixa ===');
const bloco = HTML.slice(HTML.indexOf("negrito((L.corpo||'')"), HTML.indexOf("+'<br><br><b>CONCLUSÃO: "));
ok(/mamaEsquemaHTML\(L\)/.test(bloco), 'entre a descrição dos achados e a conclusão');
ok(/ex\.tipo==='mama'/.test(bloco), 'e só em exame de mama');
ok(/contenteditable="false"/.test(bloco),
   'o desenho não se edita digitando — ele nasce do texto');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
