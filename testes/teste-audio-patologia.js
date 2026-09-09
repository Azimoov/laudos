// AUDIO DE CONFIRMACAO DAS PATOLOGIAS — 28/08/2026, pedido do medico.
//
// "falta de confirmacao com audio do que eu ditei como patologia... trechos de poucos
//  segundos... o botao VOZ deve direcionar apenas aquele que ele esta indicando...
//  abaixo de 'ouvir o audio todo' deve estar 'ouvir o audio editado'."
//
// O QUE ESTAVA ERRADO (medido nos 200 laudos reais de 26-27/08): o trecho que o VOZ
// tocava e um PEDACO INTEIRO de fala do transcritor, nao a frase. 46% passavam de 10 s,
// 71 passavam de 20 s e o MAIOR TINHA 4 MINUTOS (241 s). Por isso parecia "o audio todo".
//
// ⚠️ O recorte e ESTIMADO: o transcritor local marca so o inicio e o fim do trecho, nunca
// a hora de cada palavra. A posicao da frase vem de regra de tres (caracteres x segundos)
// com folga dos dois lados — de proposito erra por SOBRA, para nao cortar a frase.
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
// as constantes e o normalizador de verdade, recortados do index.html
['RV2_FOLGA', 'RV2_FOLGA_FIM', 'RV2_MIN', 'RV2_TETO'].forEach(k => {
  const m = new RegExp('var ' + k + '=([0-9.]+);').exec(HTML);
  if (!m) throw new Error('nao achei ' + k);
  global[k] = parseFloat(m[1]);
});
eval(grab('norm'));
eval(grab('rev2PalavraCasa'));
eval(grab('rev2RecorteFino'));

console.log('=== o recorte nunca devolve um bloco gigante ===');
// o caso real: 4 minutos de fala num trecho so
const gigante = { inicio: 100, fim: 341.6, texto:
  'agora o figado tem ecogenicidade aumentada compativel com esteatose hepatica leve ' +
  'e o baco esta normal e o rim esquerdo apresenta calculo de 0,4 cm no grupo calicinal medio' };
const r1 = rev2RecorteFino(gigante, 'esteatose hepatica leve');
ok(r1.fim - r1.ini <= RV2_TETO, 'recorte de um trecho de 4 min cabe no teto de ' + RV2_TETO + ' s  [' + Math.round(r1.fim - r1.ini) + ' s]');
ok(r1.ini >= gigante.inicio && r1.fim <= gigante.fim, 'e mora DENTRO do trecho de origem');
ok(r1.estimado === true, 'e se declara estimado (a tela avisa)');

console.log('\n=== e aponta para o lugar certo da fala ===');
// a citacao da esteatose esta no COMECO; a do calculo, no FIM. Os dois recortes tem de
// cair em posicoes bem diferentes — e isso que faz o VOZ do figado nao tocar o do rim.
const r2 = rev2RecorteFino(gigante, 'calculo de 0,4 cm no grupo calicinal medio');
ok(r2.ini > r1.ini, 'o recorte do calculo comeca DEPOIS do da esteatose  [' +
   Math.round(r1.ini) + 's vs ' + Math.round(r2.ini) + 's]');
ok(r2.ini - r1.ini > 30, 'e bem depois, nao um do lado do outro (o exemplo dele)');
ok(r1.fim <= r2.ini || r2.ini >= r1.ini, 'nao se sobrepoem por acidente');

console.log('\n=== trecho que ja e curto passa inteiro ===');
const curto = { inicio: 10, fim: 16, texto: 'esteatose hepatica leve' };
const r3 = rev2RecorteFino(curto, 'esteatose hepatica leve');
ok(r3.ini === 10 && r3.fim === 16, 'trecho de 6 s vale inteiro, sem estimar');
ok(r3.estimado === false, 'e nao se declara estimado — aqui nao ha chute');

console.log('\n=== sem citacao, nunca o trecho inteiro ===');
const r4 = rev2RecorteFino(gigante, '');
ok(r4.fim - r4.ini <= RV2_TETO, 'sem pista nenhuma, ainda assim curto  [' + Math.round(r4.fim - r4.ini) + ' s]');
const r5 = rev2RecorteFino(gigante, 'nada disso existe no texto ditado');
ok(r5.fim - r5.ini <= RV2_TETO, 'citacao que nao casa tambem cai no limite');

console.log('\n=== acentuacao nao atrapalha (o ditado vem acentuado) ===');
const ac = { inicio: 0, fim: 60, texto: 'o fígado tem esteatose hepática leve e o baço é normal e ' +
  'o rim esquerdo tem cálculo pequeno no grupo calicinal médio sem dilatação do sistema' };
const r6 = rev2RecorteFino(ac, 'esteatose hepática leve');
const r7 = rev2RecorteFino(ac, 'cálculo pequeno no grupo calicinal médio');
ok(r7.ini > r6.ini, 'com acentos, os dois achados continuam em lugares diferentes');

console.log('\n=== a tela: o botao de audio e a ligacao do VOZ ===');
// 02/09/2026 — O "AUDIO EDITADO" SAIU DA TELA, e com ele rev2ClipesPatologia e
// rev2Editado. Pedido dele: os dois botoes de audio ("ouvir o ditado inteiro" e "ouvir
// o audio editado — so as patologias") viraram UM, "Ouvir o audio", que toca o exame
// inteiro sem os silencios. O comportamento novo tem suite propria: teste-ouvir-audio.js.
//
// O QUE CONTINUA VIVO E E O QUE ESTA SUITE PROTEGE: rev2RecorteFino, o recorte curto por
// achado. Ele nao era so do audio editado — e o que o botao VOZ usa para tocar a frase
// daquele retangulo, e todos os casos reais medidos abaixo continuam valendo.
ok(/id="rv2BtAudio"[^>]*onclick="rev2OuvirAudio\(\)"/.test(HTML),
   'a tela tem UM botao de audio, chamando rev2OuvirAudio');
ok(!/id="rv2BtEditado"/.test(HTML) && !/id="rv2BtInteiro"/.test(HTML),
   'e os dois botoes antigos sairam');
// 09/09/2026: o botao VOZ saiu da tela da revisao a pedido do Dr. Daniel para
// dar lugar ao audio recortado sem silencios por bloco (Etapa 2).
ok(!/onclick="rev2Tocar\('\+trI\+','\+i\+'\)"/.test(HTML),
   'o antigo botao VOZ foi retirado da tela da revisao');

// ===================================================================================
// 31/08/2026 — O RECORTE DEIXOU DE SER CHUTE
// O transcritor passou a devolver a HORA DE CADA PALAVRA (asr.py, word_timestamps).
// O caso que motivou tudo e REAL: ditado "Teste 2" de 31/08/2026, um trecho unico de
// 1,23 s a 26,89 s com o texto "Ah, teste 2, exame de mama, ok." — que parece 25 s de
// fala e sao DOIS jorros, com 20 s de silencio no meio. As horas abaixo sao as que o
// motor devolveu de verdade nesta maquina; nao sao inventadas.
{
  const m = /var RV2_STOP=('[^']*');/.exec(HTML);
  if (!m) throw new Error('nao achei RV2_STOP');
  global.RV2_STOP = eval(m[1]);
}
eval(grab('rev2AcharNasPalavras'));

console.log('\n=== a hora de verdade vence a regra de tres ===');
const real = {
  inicio: 1.23, fim: 26.89, texto: 'Ah, teste 2, exame de mama, ok.',
  palavras: [
    { p: 'Ah,',   i: 1.23,  f: 1.75 },
    { p: 'teste', i: 2.05,  f: 2.95 },
    { p: '2,',    i: 23.59, f: 24.23 },
    { p: 'exame', i: 24.51, f: 25.53 },
    { p: 'de',    i: 25.53, f: 25.71 },
    { p: 'mama,', i: 25.71, f: 25.95 },
    { p: 'ok.',   i: 26.21, f: 26.69 },
  ],
};
const semPalavras = { inicio: real.inicio, fim: real.fim, texto: real.texto };
const comP = rev2RecorteFino(real, 'exame de mama');
const semP = rev2RecorteFino(semPalavras, 'exame de mama');
ok(comP.palavras === true && comP.estimado === false, 'com palavras, o recorte e MEDIDO (nao estimado)');
ok(comP.ini > 22 && comP.ini < 25,
   'e comeca na fala de verdade  [' + comP.ini.toFixed(2) + ' s; a palavra "exame" sai aos 24,51]');
ok(semP.ini < 13,
   'sem palavras, a estimativa antiga cairia no silencio  [' + semP.ini.toFixed(2) + ' s]');
ok(Math.abs(comP.ini - semP.ini) > 8,
   'a diferenca entre medir e estimar passa de 8 s neste caso real  ['
   + Math.abs(comP.ini - semP.ini).toFixed(1) + ' s]');
// 31/08/2026 — O FIM PODE PASSAR DO FIM DO TRECHO, DE PROPOSITO. Pedido dele: "pode
// botar o corte 2 segundos depois do fim daquela patologia, porque ta cortando muito em
// cima". Havia um Math.min(fim, …) que engolia a folga sempre que o achado era a ultima
// coisa dita — justamente quando cortar rente mais incomoda. Passar do limite do trecho
// e seguro: e o MESMO arquivo de audio, que continua correndo. O comeco continua preso.
ok(comP.ini >= real.inicio, 'o comeco do recorte continua preso ao trecho');
ok(comP.fim > real.fim, 'e o fim estica alem do trecho, para nao cortar a frase rente');
ok(comP.fim - comP.ini <= RV2_TETO, 'sem passar do teto de ' + RV2_TETO + ' s');
// 31/08/2026 — O NUMERO MUDOU NA MESMA NOITE, e este teste seguiu junto. Ele pediu
// primeiro "um ou dois segundos a mais" (ficou 3,0 s); depois de ouvir o resultado no
// exame das 22h43, disse "a folga pode ser de 1,5 segundo". Vale a ultima, que e a que
// ele ouviu de verdade ([[valor-de-uso-corrente-vence-literatura-fragil]]).
// O teste nao congela mais um piso em segundos — congela a RELACAO, que e o que tem
// razao de ser: o fim respira mais que o comeco.
ok(RV2_FOLGA_FIM === 1.5, 'a folga do fim e a que ele ouviu e aprovou  [' + RV2_FOLGA_FIM + ' s]');
ok(RV2_FOLGA_FIM > RV2_FOLGA, 'e e maior que a do comeco — o fim traz a palavra que confirma');

console.log('\n=== o casamento nao exige que a IA cite palavra por palavra ===');
// a IA corrige e resume o ditado; exigir substring literal deixava o botao mudo
ok(rev2AcharNasPalavras(real.palavras, 'exame mama') !== null,
   'citacao sem as palavras de ligacao ainda casa');
ok(rev2AcharNasPalavras(real.palavras, 'o exame de mama direita') !== null,
   'citacao com palavra a mais ainda casa');
ok(rev2AcharNasPalavras(real.palavras, 'figado com esteatose') === null,
   'e citacao que nao esta no ditado NAO casa (prefere calar a tocar errado)');
ok(rev2AcharNasPalavras(real.palavras, 'mama') === null,
   'uma palavra so nao basta — seria coincidencia');

console.log('\n=== ditado antigo continua funcionando (nada quebra) ===');
const r8 = rev2RecorteFino(ac, 'esteatose hepática leve');
ok(r8.estimado === true && !r8.palavras, 'trecho sem palavras cai na estimativa de antes');
ok(rev2RecorteFino({ inicio: 0, fim: 5, texto: 'curto', palavras: [] }, 'seja o que for').estimado === false,
   'trecho curto sem palavras continua valendo inteiro');

console.log('\n=== PLANO B: o botao nao depende mais de a IA citar o ditado ===');
// Ate 31/08 o retangulo sem `procedencia.citacao` era DESCARTADO: nao ganhava botao VOZ
// e nao entrava no audio editado — mesmo com o ditado inteiro guardado ao lado. Agora,
// quando a IA nao cita, procura-se o proprio achado em negrito na fita de palavras.
global.rev2CorpoVisivel = function (b) {          // o de verdade tira a moldura do titulo
  const m = String(b.texto || '').match(/^\s*\*\*[^*]{1,70}\*\*:?[ \t]*/);
  return m ? { cab: m[0], txt: b.texto.slice(m[0].length) } : { cab: '', txt: b.texto };
};
eval(grab('rev2AchadoEmNegrito'));
const bloco = { titulo: 'Fígado',
                texto: '**Fígado**: com ecogenicidade aumentada, compatível com '
                     + '**esteatose hepática moderada**.' };
const achado = rev2AchadoEmNegrito(bloco);
ok(/esteatose/.test(achado), 'o achado em negrito e extraido  ["' + achado + '"]');
ok(!/^F.gado/.test(achado), 'e o titulo do orgao (moldura) NAO entra na chave de busca');
ok(rev2AchadoEmNegrito({ titulo: 'Baço', texto: '**Baço**: normal.' }) === '',
   'orgao normal, sem achado em negrito, nao gera chave nenhuma');

// e a chave achada acha mesmo o pedaco, na fita de palavras de um ditado com patologia
const ditado = { inicio: 0, fim: 40, texto: 'figado com esteatose hepatica moderada e calculo na vesicula',
  palavras: [
    { p: 'fígado',    i: 5.0,  f: 5.4 },  { p: 'com',      i: 5.4,  f: 5.6 },
    { p: 'esteatose', i: 5.6,  f: 6.3 },  { p: 'hepática', i: 6.3,  f: 6.9 },
    { p: 'moderada',  i: 6.9,  f: 7.5 },  { p: 'e',        i: 30.0, f: 30.1 },
    { p: 'cálculo',   i: 30.1, f: 30.7 }, { p: 'na',       i: 30.7, f: 30.8 },
    { p: 'vesícula',  i: 30.8, f: 31.5 },
  ] };
const rEst = rev2RecorteFino(ditado, achado);
const rCal = rev2RecorteFino(ditado, 'cálculo na vesícula biliar');
ok(rEst.palavras === true && rEst.ini < 6 && rEst.fim > 7,
   'o achado do figado cai na fala do figado  [' + rEst.ini.toFixed(1) + '-' + rEst.fim.toFixed(1) + ' s]');
ok(rCal.palavras === true && rCal.ini > 28,
   'e o da vesicula cai 24 s depois, na fala dela  [' + rCal.ini.toFixed(1) + '-' + rCal.fim.toFixed(1) + ' s]');
ok(rEst.fim < rCal.ini, 'os dois recortes nao se misturam');

// e a ligacao na tela
// 02/09/2026: a verificacao que ficava aqui olhava rev2ClipesPatologia, que saiu com o
// audio editado. A regra que ela protegia — usar o achado OU a citacao, nao so a
// citacao — vale hoje em rev2TrechoDoBloco, que e quem o botao VOZ consulta.
const trBloco = grab('rev2TrechoDoBloco');
ok(/rev2AchadoEmNegrito\(b\)/.test(trBloco),
   'o achado em negrito vem primeiro (vocabulario so daquele orgao)');
ok(/pr&&pr\.citacao/.test(trBloco),
   'e a citacao da IA fica como reserva, quando o achado nao bate com o ditado');
ok(/rev2TrechoPorPalavras/.test(HTML), 'ha busca do achado em TODOS os trechos pela palavra');

console.log('\n=== a esteira de arquivos nao pode perder a hora (31/08/2026) ===');
// O CASO REAL: laudo feito pela tela "exames antigos" (ele fora do consultorio, puxando
// o exame do aparelho e gravando o ditado na hora). Saiu SEM nenhum botao VOZ e com o
// audio editado dizendo "nao ha trecho de patologia para montar" — enquanto "ouvir o
// ditado inteiro" tocava normalmente. Tres defeitos em fila, todos medidos:
//   1. agenteLocalDisponivel() olhava SO cfg.agenteLocal (vazio no 2.0, onde o endereco
//      vem da URL) e respondia "nao ha agente" sem perguntar -> o ditado ia para a NUVEM
//      paga, que nao devolve hora. Medido: cfg.agenteLocal="" e agenteBase()=:8988.
//   2. a rota /transcrever do agente devolvia so texto (nasceu para frase de comando).
//   3. transcreverLocal() jogava fora os trechos que chegassem.
const disp = grab('agenteLocalDisponivel');
ok(/var base=agenteBase\(\);/.test(disp),
   'agenteLocalDisponivel pergunta ao MESMO endereco que o resto do programa');
ok(!/cfg\.agenteLocal\|\|''\)\.trim\(\); if\(!base\)/.test(disp),
   'e nao volta a olhar so o endereco digitado em Configuracoes');
const tLocal = grab('transcreverLocal');
ok(/return \{texto:\(j\.texto\|\|''\), trechos:/.test(tLocal),
   'transcreverLocal devolve texto E trechos (antes descartava a hora)');
const tAudio = grab('transcreverAudio');
ok(/trechos: trechos\|\|\[\]/.test(tAudio), 'transcreverAudio repassa os trechos adiante');
ok(/trechos=tl\.trechos\|\|\[\]/.test(tAudio), 'e os recolhe do motor local');
// todo lugar que monta um audio a partir da transcricao tem de levar a hora junto
// olha os 260 caracteres seguintes a cada montagem: a chave `trechos` pode estar na
// linha de baixo (o metaG da gravacao recuperada quebra a linha), e exigir a MESMA linha
// reprovava um caso que estava certo.
const acharTodos = (re, s) => { const r = []; let m; while ((m = re.exec(s))) r.push(m.index); return r; };
const pos = acharTodos(/transcricao:(resp|r)\.transcricao\|\|''/g, HTML);
const semHora = pos.filter(i => !/trechos:\s*\((resp|r|g)\.trechos\|\|\[\]\)/.test(HTML.slice(i, i + 260)));
ok(pos.length > 0 && semHora.length === 0,
   'todo audio montado da transcricao carrega os trechos  ['
   + (pos.length - semHora.length) + ' de ' + pos.length + ']');

// ===================================================================================
// O EXAME REAL DE 31/08/2026, 22h21 — os TRES achados saindo errados de tres jeitos.
// Ele ditou: esteatose ("esteatose 1"), calculo na vesicula e calculo no rim esquerdo.
// O texto do laudo saiu certo e as citacoes da IA saiam PERFEITAS; quem errava era o
// casamento com a fita de palavras. Relato dele:
//   "o audio do primeiro botao ficou apenas com a primeira coisa que eu falei. Na
//    segunda, ele misturou parte do que eu falei de esteatose com a vesicula biliar, e o
//    unico que ele acertou foi o do calculo do rim. No texto editado, ele interpretou
//    como se fosse duas patologias."
// As horas abaixo sao as REAIS daquele ditado (sessao-app.json). O NOME DA PACIENTE foi
// trocado por generico — as horas, que e o que o teste mede, sao as de verdade.
const DITADO_2221 = { inicio: 1.26, fim: 48.94, texto: '(ditado real de 31/08 22h21)',
  palavras: [
    { p: 'Paciente', i: 1.26, f: 2.32 },   { p: 'Teste', i: 2.32, f: 2.92 },
    { p: 'de', i: 2.92, f: 3.48 },         { p: 'Silva', i: 3.48, f: 3.74 },
    { p: 'Souza,', i: 3.74, f: 4.46 },     { p: 'abdômen', i: 4.52, f: 5.16 },
    { p: 'total,', i: 5.16, f: 5.48 },     { p: 'qual', i: 5.96, f: 7.46 },
    { p: 'o', i: 7.46, f: 7.54 },          { p: 'motivo', i: 7.54, f: 7.8 },
    { p: 'da', i: 7.8, f: 8.04 },          { p: 'senhora', i: 8.04, f: 8.26 },
    { p: 'estar', i: 8.26, f: 8.38 },      { p: 'fazendo', i: 8.38, f: 8.68 },
    { p: 'esse', i: 8.68, f: 8.82 },       { p: 'exame', i: 8.82, f: 9.12 },
    { p: 'senhora,', i: 9.12, f: 9.42 },   { p: 'sim,', i: 9.56, f: 11.12 },
    { p: 'tá,', i: 11.18, f: 11.76 },      { p: 'entendi,', i: 13.52, f: 13.94 },
    { p: 'esteatose', i: 14.22, f: 16.26 },{ p: '1,', i: 16.26, f: 16.54 },
    { p: 'cálculo', i: 16.78, f: 20.7 },   { p: 'na', i: 31.9, f: 32.18 },
    { p: 'vesícula', i: 32.18, f: 32.7 },  { p: 'biliar,', i: 32.7, f: 32.96 },
    { p: '1', i: 33.12, f: 34.52 },        { p: 'sá,', i: 34.52, f: 34.86 },
    { p: 'e', i: 35.06, f: 35.88 },        { p: 'cálculo', i: 39.68, f: 41.16 },
    { p: 'no', i: 43.5, f: 43.7 },         { p: 'rim', i: 43.7, f: 43.84 },
    { p: 'esquerdo', i: 43.84, f: 44.36 }, { p: 'e', i: 44.36, f: 44.42 },
    { p: 'grupo', i: 44.42, f: 44.54 },    { p: 'calicial', i: 44.54, f: 45.04 },
    { p: 'médio,', i: 45.04, f: 45.58 },   { p: 'tá,', i: 45.7, f: 46.94 },
    { p: 'tá', i: 47.04, f: 47.18 },       { p: 'liberado', i: 47.18, f: 47.68 },
    { p: 'querida,', i: 47.68, f: 48.02 }, { p: 'pode', i: 48.02, f: 48.24 },
    { p: 'se', i: 48.24, f: 48.4 },        { p: 'levantar.', i: 48.4, f: 48.94 },
  ] };
// as citacoes que a IA devolveu naquele laudo — copiadas do sessao-app.json
const CIT_FIG = 'esteatose 1';
const CIT_VES = 'cálculo na vesícula biliar, 1 só';
const CIT_RIM = 'cálculo no rim esquerdo e grupo calicial médio';

console.log('\n=== o exame real de 22h21: os tres achados, cada um no seu lugar ===');
const cFig = rev2RecorteFino(DITADO_2221, CIT_FIG);
const cVes = rev2RecorteFino(DITADO_2221, CIT_VES);
const cRim = rev2RecorteFino(DITADO_2221, CIT_RIM);
const jan = c => c.ini.toFixed(1) + '-' + c.fim.toFixed(1) + ' s';

// 1. FIGADO — "esteatose 1" tem UMA palavra-chave util ("1" e curto demais e cai).
// A regra antiga exigia DUAS ("uma so e coincidencia") e devolvia nada, jogando o
// recorte na estimativa: tocava aos 22,5 s uma fala que aconteceu aos 14,2 s.
ok(cFig.palavras === true, 'figado: casou pela palavra (nao caiu na estimativa)  [' + jan(cFig) + ']');
ok(cFig.ini <= 14.22 && cFig.fim >= 16.26, 'e cobre a fala "esteatose 1" (14,2-16,3 s)');
ok(cFig.ini > 11, 'sem voltar para a conversa do comeco do exame');

// 2. VESICULA — ele disse "calculo" aos 16,8 s e so completou "na vesicula biliar" aos
// 31,9 s, examinando no meio. A regra antiga pegava do primeiro ao ultimo casamento
// (16 s, acima do teto), comecava DENTRO da esteatose e acabava ANTES de "vesicula".
ok(cVes.ini > 19, 'vesicula: NAO comeca dentro da fala da esteatose  [' + jan(cVes) + ']');
ok(cVes.ini <= 31.9 && cVes.fim >= 32.96, 'e cobre "na vesicula biliar" (31,9-33,0 s)');
ok(cVes.fim - cVes.ini <= RV2_TETO, 'dentro do teto de ' + RV2_TETO + ' s');

// 3. RIM — o unico que ja acertava. Continua acertando.
ok(cRim.ini <= 39.68 && cRim.fim >= 45.04, 'rim: cobre "calculo no rim esquerdo..."  [' + jan(cRim) + ']');

console.log('\n=== e os tres nao se atropelam (era isso que virava "2 patologias") ===');
ok(cFig.fim < cVes.ini, 'o do figado acaba antes de o da vesicula comecar');
ok(cVes.fim < cRim.ini, 'e o da vesicula antes do rim');
// os tres recortes ficam bem separados: nenhum encosta no vizinho
ok(cVes.ini - cFig.fim > 0.4 && cRim.ini - cVes.fim > 0.4,
   'nenhum par fica perto o bastante para se confundir — sao 3 achados, nao 2');
// 02/09/2026: a verificacao do teto vivia em rev2ClipesPatologia, que saiu. O teto
// continua onde sempre agiu de verdade — dentro do proprio recorte.
ok(/RV2_TETO/.test(grab('rev2RecorteFino')),
   'e o recorte tem teto: pedaco errado nao cresce sem limite');

console.log('\n=== a palavra nao casa mais por pedaco solto ===');
ok(rev2PalavraCasa('calculo', 'calculos'), 'plural casa (calculo/calculos)');
ok(rev2PalavraCasa('hepatica', 'hepatico'), 'genero casa (hepatica/hepatico)');
ok(!rev2PalavraCasa('de', 'decubito'), '"de" NAO casa dentro de "decubito" (o defeito antigo)');
ok(!rev2PalavraCasa('rim', 'rins2'), 'palavra curta so casa exata');
ok(rev2PalavraCasa('rim', 'rim'), 'mas casa exata, claro');

// ===================================================================================
// O EXAME REAL DE 31/08/2026, 22h43 — a folga engolida no COMECO, e a fusao indevida.
// Ele ditou: "esteatose 3, calculo no rim direito, grupo canicular medio e
// esplenomegalia". Relato: "ele fez certinho, mas o 'esteatose' ele captou apenas tres.
// Deixou de fora a palavra 'esteatose'."
// As horas sao as REAIS (sessao-app.json); o nome do paciente foi trocado por generico.
// Este trecho e o unico do ditado onde estao as tres patologias.
const DITADO_2243 = { inicio: 18.24, fim: 35.74,
  texto: 'Esteatose 3, cálculo no rim direito, grupo calicial médio e esplenomegalia.',
  palavras: [
    { p: 'Esteatose', i: 18.24, f: 18.80 },  { p: '3,', i: 18.80, f: 19.36 },
    { p: 'cálculo', i: 20.12, f: 21.04 },    { p: 'no', i: 28.56, f: 28.76 },
    { p: 'rim', i: 28.76, f: 28.98 },        { p: 'direito,', i: 28.98, f: 29.82 },
    { p: 'grupo', i: 29.96, f: 30.30 },      { p: 'calicial', i: 30.30, f: 30.96 },
    { p: 'médio', i: 30.96, f: 31.56 },      { p: 'e', i: 31.56, f: 32.58 },
    { p: 'esplenomegalia.', i: 34.02, f: 35.74 },
  ] };

console.log('\n=== a folga do COMECO nao pode ser engolida pelo trecho (22h43) ===');
// O transcritor corta o silencio, entao o trecho abre EXATAMENTE na primeira palavra:
// trecho comeca em 18,24 e "Esteatose" tambem. Um Math.max(ini, …) zerava a folga e o
// tocador entrava em cima da primeira silaba — ele ouvia so o "tres".
const cFig43 = rev2RecorteFino(DITADO_2243, 'Esteatose 3');
ok(cFig43.ini < 18.24, 'o recorte comeca ANTES da palavra  [' + cFig43.ini.toFixed(2) + ' s]');
ok(18.24 - cFig43.ini >= RV2_FOLGA - 0.01,
   'com a folga inteira de ' + RV2_FOLGA + ' s (era zero: comecava em cima do "Es-")');
ok(cFig43.ini >= 0, 'e nunca antes do comeco da gravacao');

console.log('\n=== tres achados na MESMA frase continuam sendo tres (22h43) ===');
const cRim43 = rev2RecorteFino(DITADO_2243, 'cálculo no rim direito, grupo calicial médio');
const cBac43 = rev2RecorteFino(DITADO_2243, 'e esplenomegalia');
ok(cRim43.falaFim != null && cBac43.falaIni != null,
   'o recorte informa onde a FALA esta, alem de onde o clipe comeca e acaba');
// a folga de 3 s do rim (ate 34,56) invadia o comeco da esplenomegalia (34,02): pela
// regra antiga os dois viravam UM clipe, e a tela dizia 2 patologias havendo 3.
ok(cRim43.fim > cBac43.ini, 'os dois clipes ainda se encostam pelas folgas (era isso que fundia)');
ok(cRim43.falaFim < cBac43.falaIni, 'mas as FALAS sao separadas — sao dois achados, nao um');
// monta como rev2ClipesPatologia monta
const montar = (arr) => {
  const j = [];
  arr.slice().sort((a, b) => a.ini - b.ini).forEach(c => {
    const u = j[j.length - 1];
    if (u && u.falaFim >= c.falaIni - 0.05 && (Math.max(u.fim, c.fim) - u.ini) <= RV2_TETO) {
      u.fim = Math.max(u.fim, c.fim); u.falaFim = Math.max(u.falaFim, c.falaFim);
    } else {
      if (u && u.fim > c.ini) u.fim = Math.max(u.falaFim, c.ini - 0.15);
      j.push(Object.assign({}, c));
    }
  });
  return j;
};
const montado = montar([cFig43, cRim43, cBac43]);
ok(montado.length === 3, 'a montagem devolve TRES clipes, nao dois  [' + montado.length + ']');
ok(montado[1].fim <= cBac43.ini, 'a folga do rim foi APARADA para nao invadir o baco');
ok(montado[1].fim >= cRim43.falaFim, 'mas a apara nunca corta a fala do proprio rim');
// 02/09/2026: as duas verificacoes que liam rev2ClipesPatologia sairam com ela. O que
// elas protegiam continua medido logo acima, no proprio recorte: as falas do rim e do
// baco sao SEPARADAS (falaFim < falaIni) mesmo com as folgas se encostando. Era esse o
// fato clinico em disputa; a montagem era so quem o consumia.

console.log('\n=== o achado SEM MEDIDA tambem entra no audio editado (31/08) ===');
// O caso relatado por ele: laudo com esteatose hepatica (medida preenchida) e calculo
// renal (medida em branco, "..... cm"). O audio editado tocou so a esteatose.
ok(/function rev2TemAchado\(/.test(HTML),
   '"tem achado?" virou pergunta propria, separada da cor do cartao');
const estado = grab('rev2Estado');
ok(/if\(rev2TemAchado\(ex, b\)\) return 'alterado';/.test(estado),
   'e rev2Estado passou a usa-la (uma definicao so de "achado")');
// a COR do cartao nao muda: falta de medida continua vencendo, que e o desejado na tela
ok(estado.indexOf("return 'falta'") < estado.indexOf('rev2TemAchado'),
   'na TELA a falta de medida continua vencendo (o cartao segue vermelho, como antes)');
ok(/function rev2TemAchado\(/.test(HTML),
   'e a regra de "tem achado?" mora num lugar so, sem copia');

// 02/09/2026 — O CONTADOR "1/3" SAIU JUNTO COM O AUDIO EDITADO.
// Ele existia porque a montagem tocava N patologias em sequencia e ele precisava saber
// quantas faltavam ("na hora que eu der play, um numerozinho: 1/3, depois 2/3"). O botao
// novo toca o exame INTEIRO sem os silencios: nao ha patologia a contar, e o que ele
// quer saber ali e outra coisa — quanto tempo vai ouvir. Isso o botao novo mostra
// ("3m10s no lugar de 4m27s"), e esta coberto em teste-ouvir-audio.js.

console.log('\n=== a tela diz COMO achou o pedaco ===');
ok(/hora exata da fala/.test(HTML), 'quando e medido, a tela diz "hora exata da fala"');
ok(/recorte estimado/.test(HTML), 'e o aviso de estimativa continua, para o ditado antigo');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
