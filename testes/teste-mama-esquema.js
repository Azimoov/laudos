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
// O MÓDULO INTEIRO de uma vez, em vez de constante por constante. Listar cada uma à mão
// quebrava a suíte toda vez que o módulo ganhava um ajudante novo — e quebrava com um
// "não está definido" que não diz nada sobre o que se queria testar.
const MODULO = (function () {
  const i = HTML.indexOf('/* ============ ESQUEMA ANATÔMICO DA MAMA ============');
  const f = HTML.indexOf('/* ============ Categoria BI-RADS por extenso', i);
  if (i < 0 || f < 0) throw new Error('não achei o módulo do esquema no index.html');
  return HTML.slice(i, f);
})();
const api = new Function('esc', MODULO +
  '\nreturn {mamaMm, mamaCmInteiro, mamaLocalDoTexto, mamaLesoes, mamaEsquemaHTML,'
  + ' _mamaXY, _mamaRaioPx, _mamaContorno};'
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
// 21/08: faltava ler UMA dimensão só, e a falta não era inofensiva — cisto pequeno costuma
// ser descrito com um número só, e sem lê-lo a lista de achados múltiplos dizia "medida não
// informada" e a detecção de achado DOMINANTE nunca rodava (ela compara tamanhos).
ok(String(api.mamaLocalDoTexto('medindo 4 mm').mm) === '4', 'uma dimensão só também é lida');
ok(String(api.mamaLocalDoTexto('medindo 0,9 cm').mm) === '9', 'e convertida quando vem em cm');
ok(String(api.mamaLocalDoTexto('medindo 12 x 8 mm').mm) === '12,8',
   'e a de duas dimensões continua vencendo a de uma');
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

console.log('\n=== 21/08: o TAMANHO desenhado é proporcional ao medido ===');
// Pedido do médico. A primeira versão errava de um jeito bobo e invisível: a escala era
// INVERSA (14/maior), o que normalizava tudo para o mesmo tamanho na tela — 2 mm e 12 mm
// saíam iguais, e o desenho perdia a única informação de calibre que dava de graça.
const r2 = api._mamaRaioPx(2), r8 = api._mamaRaioPx(8), r20 = api._mamaRaioPx(20);
ok(r2 < r8 && r8 < r20, 'raio cresce com a medida: 2 mm (' + r2.toFixed(1) + ') < 8 mm ('
   + r8.toFixed(1) + ') < 20 mm (' + r20.toFixed(1) + ')');
ok(r20 / r2 > 2.5, 'e a diferença é VISÍVEL, não decorativa (' + (r20 / r2).toFixed(1) + '×)');
ok(api._mamaRaioPx(0.2) >= 2.6, 'lesão minúscula ainda aparece — tem piso');
ok(api._mamaRaioPx(400) <= 32, 'e lesão enorme não estoura a caixa — tem teto');
ok(api._mamaRaioPx(null) > 0 && api._mamaRaioPx('x') > 0, 'sem medida não quebra o desenho');

console.log('\n=== 21/08: forma irregular é DESENHADA irregular ===');
const oval = api._mamaContorno(50, 50, 20, 14, 'oval', 1, '');
const irreg = api._mamaContorno(50, 50, 20, 14, 'irregular', 1, '');
const lob = api._mamaContorno(50, 50, 20, 14, 'lobulada', 1, '');
ok(/^<ellipse/.test(oval), 'oval continua elipse lisa');
ok(/^<polygon/.test(irreg), 'irregular vira polígono de contorno quebrado');
ok(/^<polygon/.test(lob), 'lobulada também, mas com ondulação mais suave');
ok((irreg.match(/,/g) || []).length > (lob.match(/,/g) || []).length,
   'e a irregular tem mais vértices que a lobulada (' + (irreg.match(/,/g) || []).length
   + ' contra ' + (lob.match(/,/g) || []).length + ')');
// Determinístico: contorno que muda a cada redesenho assustaria quem confere um laudo.
ok(api._mamaContorno(50, 50, 20, 14, 'irregular', 1, '') === irreg,
   'o contorno é DETERMINÍSTICO — redesenhar dá exatamente o mesmo desenho');
ok(api._mamaContorno(50, 50, 20, 14, 'irregular', 2, '') !== irreg,
   'mas dois achados diferentes não saem com o contorno idêntico');

console.log('\n=== 21/08: linha pontilhada da pele até a lesão ===');
const comProf = api.mamaEsquemaHTML(laudo(
  [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' }],
  'Notou-se nódulo na mama direita, às 10 h, distando 3 cm da papila, a 1,5 cm da pele, medindo 14 x 10 mm.'));
// Recorta SÓ o desenho do corte lateral, para as asserções não acharem o que procuram na
// legenda de texto que vem depois. (A primeira versão desta asserção passava por acaso:
// procurava "profundidade média" e encontrava na LEGENDA, não no desenho.)
function lateralDe(html) {
  const marca = html.indexOf('aria-label="Corte lateral');
  if (marca < 0) return '';
  const i = html.lastIndexOf('<svg', marca);   // da tag INTEIRA, senão o viewBox fica de fora
  const f = html.indexOf('</svg>', marca);
  return html.slice(i, f);
}
ok(/stroke-dasharray/.test(lateralDe(comProf)), 'a linha existe, e é pontilhada');
ok(/15 mm da pele/.test(lateralDe(comProf)), 'com a distância ESCRITA, porque o laudo a informou');
const semProf = api.mamaEsquemaHTML(laudo(
  [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' }], f));
ok(/stroke-dasharray/.test(lateralDe(semProf)), 'a linha aparece mesmo sem a medida');
ok(!/mm da pele/.test(lateralDe(semProf)),
   'mas SEM número — laudo que não disse a distância não pode virar desenho com distância');
ok(/>Profundidade:/.test(lateralDe(semProf)) && /média/.test(lateralDe(semProf)),
   'traz a PALAVRA no lugar do número');

console.log('\n=== 21/08 (2ª volta): o texto da profundidade não sobrepõe nada ===');
// Com dois ou três nódulos na mesma mama, o rótulo escrito no MEIO da linha caía em
// alturas parecidas, atropelava o vizinho e cruzava as linhas — o médico viu na
// conferência. Saiu da linha e foi para faixa própria, numerada.
const tres = api.mamaEsquemaHTML(laudo(
  [{ localizacao: 'mama direita superior', forma: 'oval', orientacao: 'paralela' },
   { localizacao: 'mama direita lateral', forma: 'oval', orientacao: 'paralela' },
   { localizacao: 'mama direita inferior', forma: 'oval', orientacao: 'paralela' }],
  'Notou-se na mama direita superior, às 12 h, distando 2 cm da papila, nódulo medindo 20 x 14 mm. '
  + 'Notou-se na mama direita lateral, às 3 h, distando 5 cm da papila, nódulo medindo 8 x 6 mm, a 1,2 cm da pele. '
  + 'Notou-se na mama direita inferior, às 6 h, distando 7 cm da papila, nódulo medindo 2 x 2 mm.'));
const latTres = lateralDe(tres);
const textos = latTres.match(/<text[^>]*>[^<]*<\/text>/g) || [];
const daFaixa = textos.filter(t => /fill="#6A4FB6"[^>]*text-anchor="middle"/.test(t));
ok(daFaixa.length >= 1, 'a faixa de profundidade existe (' + daFaixa.length + ' linha(s))');
ok(daFaixa.join(' ').indexOf('Profundidade:') >= 0, 'rotulada, para saber o que ela é');
[1, 2, 3].forEach(n =>
  ok(daFaixa.join(' ').indexOf(n + ' — ') >= 0, 'o achado ' + n + ' aparece com o próprio número'));
ok(/2 — 12 mm da pele/.test(daFaixa.join(' ')),
   'e quem tem distância medida mostra a distância (o 2), enquanto os outros mostram a palavra');
// Sem texto solto no meio das linhas: é isso que garante que nada se atropela.
const ys = daFaixa.map(t => parseFloat(/y="([\d.]+)"/.exec(t)[1]));
ok(ys.every((y, i) => i === 0 || y - ys[i - 1] >= 9),
   'as linhas da faixa ficam separadas o bastante para não encostar uma na outra');
ok(ys.every(y => y > 158), 'e todas ficam ABAIXO das camadas, fora do desenho');
const alt = +/viewBox="0 0 250 (\d+)"/.exec(latTres)[1];
ok(alt > 210, 'a caixa CRESCE para caber a faixa (' + alt + '), em vez de cortar o texto');
ok(api.mamaLocalDoTexto('a 1,5 cm da pele').profMm === 15, 'lê "1,5 cm da pele" como 15 mm');
ok(api.mamaLocalDoTexto('a 8 mm da superfície').profMm === 8, 'e "8 mm da superfície" como 8 mm');
ok(api.mamaLocalDoTexto('nódulo profundo').profMm === null, 'sem número, sem número');

console.log('\n=== 21/08: os rótulos das camadas cabem no desenho ===');
// Estavam sendo cortados na borda esquerda. O desenho começa mais à direita e a caixa
// ficou mais larga; o rótulo mais longo é "Glândula".
const lat = semProf.slice(semProf.indexOf('CORTE LATERAL') - 3000, semProf.indexOf('CORTE LATERAL'));
const vb = /viewBox="0 0 (\d+) (\d+)"[^>]*aria-label="Corte lateral/.exec(semProf);
ok(!!vb && +vb[1] >= 240, 'a caixa do corte lateral tem largura ' + (vb ? vb[1] : '?') + ' (era 210)');
const xRot = /<text x="(\d+)" y="[\d.]+" font-size="8" fill="#5a6478" text-anchor="end"/.exec(semProf);
ok(!!xRot && +xRot[1] >= 55,
   'e os rótulos terminam em x=' + (xRot ? xRot[1] : '?') + ', com espaço à esquerda para caberem');
ok(/gap:22px/.test(HTML), 'e as duas vistas ficaram mais afastadas uma da outra');

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
