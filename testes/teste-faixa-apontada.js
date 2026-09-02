// A FAIXA APONTADA PELA IA — 01/09/2026.
//
// POR QUE ESTA SUITE EXISTE. Em 31/08 o recorte do audio por patologia foi consertado
// CINCO vezes seguidas, e cada conserto revelava um caso de borda novo: citacao de uma
// palavra so, palavra repetida em dois achados, pausa de 15 s no meio da frase, palavra
// colada na borda do trecho, folga de um recorte invadindo o outro. O medico resumiu:
// "foi mais caotico; pensa num plano pra isso ser mais confiavel".
//
// A causa era estrutural: a IA JA SABE de onde tirou cada paragrafo — ela leu o ditado —
// mas contava isso em PROSA (uma citacao), e o programa tinha de reconstruir por BUSCA.
// Busca tem infinitos casos de borda; apontar nao tem nenhum.
//
// Agora o ditado vai NUMERADO e ela devolve palavra_ini/palavra_fim. Medido em 37 faixas
// de laudos reais, com o modelo que ele usa: a IA NUNCA apontou errado — ou acertou
// (20 de 20, quase sempre dentro de uma palavra) ou respondeu 0-0 ("nao veio do ditado"),
// que aqui e tratado como invalido e cai na busca de antes.
// A busca continua existindo como rede: laudo antigo, ditado da nuvem (sem hora de
// palavra) e faixa reprovada na conferencia.
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
['RV2_FOLGA', 'RV2_FOLGA_FIM', 'RV2_MIN', 'RV2_TETO'].forEach(k => {
  global[k] = parseFloat(new RegExp('var ' + k + '=([0-9.]+);').exec(HTML)[1]);
});
global.RV2_STOP = eval(/var RV2_STOP=('[^']*');/.exec(HTML)[1]);
eval(grab('norm'));
eval(grab('rev2PalavraCasa'));
eval(grab('fitaDeTrechos'));
eval(grab('fitaNumeradaTexto'));
eval(grab('rev2SeloDoRecorte'));
eval(grab('rev2Fita'));
// rev2Proc de verdade casa a secao com o titulo do retangulo, e tem suite propria
// (teste-voz-img). Aqui interessa a FAIXA, entao entra um dublê que devolve o item direto.
global.rev2Proc = function (ex, titulo) {
  return ((ex.laudo.procedencia || []).filter(p => p.secao === titulo)[0]) || null;
};
eval(grab('rev2RecortePorFaixa'));
const REV2_MOLDURA = eval(/const REV2_MOLDURA = (.*);/.exec(HTML)[1]);
eval(grab('rev2TituloDeMoldura'));
eval(grab('rev2CorpoVisivel'));
eval(grab('rev2AchadoEmNegrito'));
eval(grab('rev2AcharNasPalavras'));
eval(grab('rev2Trecho'));
eval(grab('rev2TrechoPorPalavras'));
eval(grab('rev2TrechoDoBloco'));

// ---------- a fita: ditado real de 31/08 22h43, nome do paciente trocado ----------
const TRECHOS = [
  { inicio: 1.42, fim: 4.30, audioUrl: 'a.wav', palavras: [
    { p: 'Paciente', i: 1.42, f: 2.04 }, { p: 'Teste', i: 2.04, f: 2.50 },
    { p: 'abdome', i: 3.74, f: 4.06 }, { p: 'total.', i: 4.06, f: 4.30 } ] },
  { inicio: 18.24, fim: 35.74, audioUrl: 'a.wav', palavras: [
    { p: 'Esteatose', i: 18.24, f: 18.80 }, { p: '3,', i: 18.80, f: 19.36 },
    { p: 'cálculo', i: 20.12, f: 21.04 },   { p: 'no', i: 28.56, f: 28.76 },
    { p: 'rim', i: 28.76, f: 28.98 },       { p: 'direito,', i: 28.98, f: 29.82 },
    { p: 'grupo', i: 29.96, f: 30.30 },     { p: 'calicial', i: 30.30, f: 30.96 },
    { p: 'médio', i: 30.96, f: 31.56 },     { p: 'e', i: 31.56, f: 32.58 },
    { p: 'esplenomegalia.', i: 34.02, f: 35.74 } ] },
];
const fita = fitaDeTrechos(TRECHOS);

console.log('=== a fita numerada que vai no pedido (Parte 1) ===');
ok(fita.length === 15, 'a fita junta as palavras de TODOS os trechos, em ordem  [' + fita.length + ']');
ok(fita[0].p === 'Paciente' && fita[4].p === 'Esteatose', 'na ordem em que foram ditas');
ok(fita[0].t === 0 && fita[4].t === 1, 'cada palavra lembra de qual trecho veio');
const num = fitaNumeradaTexto(fita);
ok(/^\[1\]Paciente \[2\]Teste/.test(num), 'a numeracao comeca em 1  [' + num.slice(0, 28) + '…]');
ok(num.indexOf('[5]Esteatose') >= 0, 'e cada palavra leva o seu numero');

console.log('\n=== o pedido a IA (Parte 1) ===');
ok(/const fitaNum = fitaEx\.length \? fitaNumeradaTexto\(fitaEx\) : '';/.test(HTML),
   'a fita numerada so e montada quando o ditado tem hora de palavra');
ok(/DITADO DO MÉDICO \(transcrição\), com cada palavra NUMERADA/.test(HTML),
   'e entra no pedido no lugar do texto corrido');
ok(/NUNCA devem aparecer no laudo/.test(HTML),
   'com o aviso de que os numeros nao sao fala e nao entram no laudo');
ok(/palavra_ini e palavra_fim/.test(HTML), 'a procedencia passa a pedir a POSICAO');
// o trecho vive dentro de uma string JS cheia de barras invertidas; comparar por pedaco
// literal e mais honesto (e mais legivel) do que montar a expressao com escapes de escapes
const _esq = HTML.indexOf('palavra_ini');
const _linhaEsq = HTML.slice(HTML.lastIndexOf('\n', HTML.indexOf('"procedencia\\":[{')) + 1,
                             HTML.indexOf('\n', HTML.indexOf('"procedencia\\":[{')));
ok(_linhaEsq.indexOf('fitaNum?') >= 0 && _linhaEsq.indexOf('palavra_ini') >= 0
   && _linhaEsq.indexOf('palavra_fim') >= 0,
   'e os campos entram no formato da resposta SO quando ha fita');
ok(HTML.indexOf('DITADO DO MÉDICO (transcrição):\\n"+(trans') >= 0,
   'sem fita, o pedido segue com o texto corrido de sempre (nada quebra)');

// ---------- consumo: numeros viram tempo ----------
const exBase = (proc) => ({ id: 1, laudo: { trechos: TRECHOS, procedencia: proc } });
const bloco = { titulo: 'Fígado', texto: '**Fígado**: com **esteatose hepática leve**.' };

console.log('\n=== os numeros viram tempo, sem busca nenhuma ===');
const rec = rev2RecortePorFaixa(
  exBase([{ secao: 'Fígado', citacao: 'Esteatose 3', palavra_ini: 5, palavra_fim: 6 }]), bloco);
ok(!!rec, 'faixa valida vira recorte');
ok(rec.apontado === true, 'e ele se declara APONTADO (nao casado, nao estimado)');
ok(Math.abs(rec.falaIni - 18.24) < 0.001 && Math.abs(rec.falaFim - 19.36) < 0.001,
   'a fala e exatamente a das palavras 5 e 6  [' + rec.falaIni + '-' + rec.falaFim + ']');
ok(Math.abs(rec.ini - (18.24 - RV2_FOLGA)) < 0.001, 'com a folga do comeco inteira');
ok(Math.abs(rec.fim - (19.36 + RV2_FOLGA_FIM)) < 0.001, 'e a do fim');
ok(rec.trecho === 1, 'e sabe de qual trecho (gravacao) veio');

console.log('\n=== a conferencia: numero da IA nao entra sem passar por ela ===');
const mau = (proc) => rev2RecortePorFaixa(exBase([Object.assign(
  { secao: 'Fígado', citacao: 'Esteatose 3' }, proc)]), bloco);
ok(mau({ palavra_ini: 0, palavra_fim: 0 }) === null,
   '0-0 ("nao veio do ditado") e recusado — cai na busca');
ok(mau({ palavra_ini: 9, palavra_fim: 4 }) === null, 'faixa invertida e recusada');
ok(mau({ palavra_ini: 5, palavra_fim: 99 }) === null, 'faixa fora da fita e recusada');
ok(mau({ palavra_ini: 1, palavra_fim: 6 }) === null,
   'faixa que cruza duas gravacoes e recusada (as horas sao de fitas diferentes)');
ok(mau({ palavra_ini: 8, palavra_fim: 10 }) === null,
   'faixa longe da propria citacao e recusada — e o erro que faria tocar o achado errado');
ok(mau({ palavra_ini: 5, palavra_fim: 7 }) !== null,
   'mas faixa um pouco maior que a citacao passa (ela nao precisa ser exata ao caractere)');

console.log('\n=== a faixa de ENCHIMENTO (medido em 01/09) ===');
// Num exame REAL sem achado ditado, a IA preencheu as DOZE secoes com a MESMA faixa, e ela
// apontava "tudo bem, ta?" — a despedida. O medico apertaria o botao do figado e ouviria
// isso. O pedido agora manda usar zero nesses casos, mas instrucao e conselho; isto e trava.
const encheu = [];
'Fígado Vesícula Vias Pâncreas Rim Baço'.split(' ').forEach(s =>
  encheu.push({ secao: s, citacao: 'Esteatose 3', palavra_ini: 5, palavra_fim: 6 }));
ok(rev2RecortePorFaixa({ id: 1, laudo: { trechos: TRECHOS, procedencia: encheu } },
                       { titulo: 'Fígado', texto: '**Fígado**: **esteatose**.' }) === null,
   'a mesma faixa em 6 secoes e recusada — e enchimento, nao achado');
const doisRins = [
  { secao: 'Rim direito', citacao: 'Esteatose 3', palavra_ini: 5, palavra_fim: 6 },
  { secao: 'Rim esquerdo', citacao: 'Esteatose 3', palavra_ini: 5, palavra_fim: 6 },
];
ok(rev2RecortePorFaixa({ id: 1, laudo: { trechos: TRECHOS, procedencia: doisRins } },
                       { titulo: 'Rim direito', texto: '**Rim direito**: **cálculo**.' }) !== null,
   'mas a MESMA faixa em duas secoes passa — ele diz "pedra no rim" uma vez para os dois');
ok(/ZERO NÃO É FALHA SUA/.test(HTML),
   'e o pedido diz com todas as letras que zero e a resposta certa na maioria das secoes');
ok(/NUNCA aponte fala de cortesia/.test(HTML),
   'proibindo apontar cumprimento e despedida so para nao deixar o campo em zero');

console.log('\n=== o teto e o piso valem tambem para a faixa ===');
const longo = rev2RecortePorFaixa(
  exBase([{ secao: 'Fígado', citacao: 'Esteatose 3', palavra_ini: 5, palavra_fim: 15 }]), bloco);
ok(longo && longo.fim - longo.ini <= RV2_TETO,
   'faixa larga ainda cabe no teto de ' + RV2_TETO + ' s  [' + (longo.fim - longo.ini).toFixed(1) + ' s]');
const curtinho = rev2RecortePorFaixa(
  exBase([{ secao: 'Fígado', citacao: 'Esteatose 3', palavra_ini: 5, palavra_fim: 5 }]), bloco);
ok(curtinho && curtinho.fim - curtinho.ini >= RV2_MIN, 'e uma palavra so ainda rende o minimo de contexto');

console.log('\n=== as tres pontas usam a MESMA faixa ===');
// VOZ, audio editado e o desenho da tela tem de mostrar o mesmo pedaco do mesmo achado
const clipes = grab('rev2ClipesPatologia');
ok(/rev2RecortePorFaixa\(ex,b\)/.test(clipes), 'o audio editado tenta a faixa primeiro');
// 01/09/2026: a busca de trás passou a chamar rev2TrechoDoBloco (achado primeiro,
// citação depois), não mais rev2ChaveDoBloco direto — ver o comentário da função.
ok(/else\{/.test(clipes) && /rev2TrechoDoBloco\(ex,b\)/.test(clipes),
   'e so cai na busca quando ela nao vem');
const tocar = grab('rev2Tocar');
ok(/rev2RecortePorFaixa\(ex, bl\)/.test(tocar), 'o botao VOZ tenta a mesma faixa');
ok(/_fx=rev2RecortePorFaixa\(ex,b\)/.test(HTML),
   'e o desenho da tela faz o botao nascer tambem quando so a faixa existe');

console.log('\n=== o selo: a tela diz em qual caminho ele esta pisando (Parte 2) ===');
ok(/a IA apontou as palavras/.test(rev2SeloDoRecorte({ apontado: true, palavras: true })),
   'apontado pela IA: o selo diz isso');
ok(/hora exata da fala/.test(rev2SeloDoRecorte({ palavras: true })), 'casado na fita: hora exata');
ok(/recorte estimado/.test(rev2SeloDoRecorte({ estimado: true })), 'estimado: avisa que pode sair deslocado');
ok(rev2SeloDoRecorte(null) === '', 'sem recorte, sem selo');
ok(/class="aviso"/.test(rev2SeloDoRecorte({ estimado: true })),
   'e SO o estimado leva a cor de aviso — os outros dois sao informacao, nao alarme');
ok(/rev2SeloDoRecorte\(rec\)/.test(HTML), 'e a tela do tocador usa o selo');

// ===================================================================================
// O EXAME REAL DE 01/09/2026, 07h55 — citacao CONTAMINADA por uma frase vizinha.
// Ele ditou: "Dados clínicos, rotina. Esteatose hepática leve, cálculo no rim direito,
// grupo calicial médio... Esplenomegalia." Relato: "o que ficou no botão voz foi
// dados clínicos/rotina, que não tem nada a ver".
// A IA (correta na letra, contaminada no recorte) citou para o Fígado:
// "Dados clínicos, rotina. Esteatose hepática leve" — juntando a frase de ENTRADA do
// exame (assunto: rotina) com o achado de verdade (assunto: esteatose), e apontou
// palavra_ini=20, palavra_fim=25 — uma faixa que CRUZA dois trechos (a pausa de
// 17,59 a 22,20 nem é tão longa: 2,8 s. VAD cortou ali mesmo assim).
// Os numeros de palavra e o texto sao os DE VERDADE (banco de dados), so o nome do
// paciente foi trocado. O bold do Fígado tem 95 caracteres — mais que os 90 do teto
// antigo, e é exatamente esse teto que escondia o achado certo.
console.log('\n=== o exame real de 01/09, 07h55: citacao contaminada por frase vizinha ===');
const TRECHOS_0755 = [
  { inicio: 2.29, fim: 7.27, audioUrl: 'a.wav', palavras: [
    { p: 'Paciente', i: 2.29, f: 3.05 }, { p: 'de', i: 3.05, f: 3.25 },
    { p: 'Teste,', i: 3.25, f: 3.91 },   { p: 'Norberto', i: 4.11, f: 5.25 },
    { p: 'Pereira,', i: 5.25, f: 5.87 }, { p: 'abdome', i: 5.93, f: 7.01 },
    { p: 'total.', i: 7.01, f: 7.27 } ] },
  { inicio: 8.95, fim: 11.99, audioUrl: 'a.wav', palavras: [
    { p: 'O', i: 8.95, f: 9.61 },       { p: 'que', i: 9.61, f: 9.75 },
    { p: 'houve,', i: 9.75, f: 10.13 }, { p: 'querida?', i: 10.13, f: 10.47 },
    { p: 'O', i: 10.55, f: 10.65 },     { p: 'que', i: 10.65, f: 10.71 },
    { p: 'a', i: 10.71, f: 10.77 },     { p: 'senhora', i: 10.77, f: 10.97 },
    { p: 'veio', i: 10.97, f: 11.15 },  { p: 'fazer', i: 11.15, f: 11.41 },
    { p: 'esse', i: 11.41, f: 11.61 },  { p: 'exame?', i: 11.61, f: 11.99 } ] },
  { inicio: 17.59, fim: 19.39, audioUrl: 'a.wav', palavras: [
    { p: 'Dados', i: 17.59, f: 18.23 }, { p: 'clínicos,', i: 18.23, f: 18.73 },
    { p: 'rotina.', i: 18.83, f: 19.39 } ] },
  { inicio: 22.20, fim: 35.36, audioUrl: 'a.wav', palavras: [
    { p: 'Esteatose', i: 22.20, f: 22.86 }, { p: 'hepática', i: 22.86, f: 23.46 },
    { p: 'leve,', i: 23.46, f: 23.80 },     { p: 'cálculo', i: 24.30, f: 25.36 },
    { p: 'no', i: 32.66, f: 32.96 },        { p: 'rim', i: 32.96, f: 33.12 },
    { p: 'direito,', i: 33.12, f: 33.64 },  { p: 'grupo', i: 33.72, f: 34.06 },
    { p: 'calicial', i: 34.06, f: 34.70 },  { p: 'médio.', i: 34.70, f: 35.36 } ] },
  { inicio: 39.42, fim: 40.50, audioUrl: 'a.wav', palavras: [
    { p: 'Entendi,', i: 39.42, f: 40.08 }, { p: 'querida.', i: 40.18, f: 40.50 } ] },
  { inicio: 46.19, fim: 51.56, audioUrl: 'a.wav', palavras: [
    { p: 'Esplenomegalia.', i: 46.19, f: 46.85 }, { p: 'Pode', i: 46.99, f: 47.47 },
    { p: 'se', i: 50.86, f: 51.02 },              { p: 'levantar.', i: 51.02, f: 51.56 } ] },
];
const PROC_0755 = [
  { secao: 'Fígado', citacao: 'Dados clínicos, rotina. Esteatose hepática leve',
    palavra_ini: 20, palavra_fim: 25 },
  { secao: 'Rim direito', citacao: 'cálculo no rim direito, grupo calicial médio',
    palavra_ini: 26, palavra_fim: 32 },
  { secao: 'Baço', citacao: 'Esplenomegalia', palavra_ini: 35, palavra_fim: 35 },
];
// 95 caracteres — o achado de verdade daquele laudo, palavra por palavra igual ao banco.
const ACHADO_LONGO = 'discreto aumento difuso da ecogenicidade do parênquima, ' +
  'compatível com esteatose hepática leve';
const blocoFigado0755 = { titulo: 'Fígado',
  texto: '**Fígado** com dimensões normais, contornos regulares, ecotextura homogênea, ' +
    'vascularização preservada, com **' + ACHADO_LONGO + '**.' };
const ex0755 = { id: 1, laudo: { trechos: TRECHOS_0755, procedencia: PROC_0755 } };

ok(ACHADO_LONGO.length > 90, 'o achado de verdade passa dos 90 caracteres  [' + ACHADO_LONGO.length + ']');
ok(rev2AchadoEmNegrito(blocoFigado0755) === ACHADO_LONGO,
   'sem teto, o achado inteiro e extraido — nao mais truncado em silencio nos 90');

ok(rev2RecortePorFaixa(ex0755, blocoFigado0755) === null,
   'a faixa apontada (20-25) cruza dois trechos — rejeitada, cai na busca');

const _td0755 = rev2TrechoDoBloco(ex0755, blocoFigado0755);
ok(!!_td0755, 'a busca acha um trecho');
ok(_td0755 && _td0755.tr === TRECHOS_0755[3],
   'e e o trecho da ESTEATOSE (índice 3) — não mais o da rotina (índice 2), ' +
   'que era o que ele ouvia no botão VOZ');
ok(_td0755 && _td0755.chave === ACHADO_LONGO,
   'a chave usada e o ACHADO em negrito, não a citação contaminada');

// o vizinho continua correto: nada regrediu no rim nem no baço
const blocoRim0755 = { titulo: 'Rim direito',
  texto: '**Rim direito** tópico, com forma, contornos e dimensões normais. ' +
    'Sistema pielocalicial sem dilatações, apresentando **imagem hiperecogênica, ' +
    'provida de sombra acústica posterior, localizada no grupo calicial médio**.' };
const _tdRim = rev2TrechoDoBloco(ex0755, blocoRim0755);
ok(_tdRim && _tdRim.tr === TRECHOS_0755[3], 'o rim continua achando o trecho certo');

const blocoBaco0755 = { titulo: 'Baço', texto: '**Baço** com **dimensões aumentadas**.' };
const _tdBaco = rev2TrechoDoBloco(ex0755, blocoBaco0755);
ok(_tdBaco && _tdBaco.tr === TRECHOS_0755[5], 'e o baco tambem, sem ambiguidade');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
