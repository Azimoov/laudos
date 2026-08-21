// GRÁFICO DE EVOLUÇÃO DO ACHADO — especificação 04 (21/08/2026).
//
// Desenhar é a parte fácil. A difícil é AFIRMAR QUE O NÓDULO DE HOJE É O MESMO DE DOIS
// ANOS ATRÁS, e isso é afirmação clínica, não conta. Errar o pareamento produz gráfico
// mostrando crescimento onde não houve — com aparência de dado conferido.
//
// Esta suíte cobra as duas coisas: que o pareamento RECUSE tudo que não bate exatamente
// nos critérios, e que o desenho siga as regras que não são estéticas (eixo Y no zero,
// eixo X em tempo real, cor neutra, nota de variabilidade).
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}
const ESQ = (function () {
  const i = HTML.indexOf('/* ============ ESQUEMA ANATÔMICO DA MAMA ============');
  const f = HTML.indexOf('/* ============ GRÁFICO DE EVOLUÇÃO DO ACHADO ============', i);
  return HTML.slice(i, f);
})();
const EVO = (function () {
  const i = HTML.indexOf('/* ============ GRÁFICO DE EVOLUÇÃO DO ACHADO ============');
  const f = HTML.indexOf('/* ============ Categoria BI-RADS por extenso', i);
  return HTML.slice(i, f);
})();
const api = new Function('esc', 'norm', 'document', 'log',
  ESQ + '\n' + EVO +
  '\nreturn {mamaLesoesDeTexto, mamaCandidatos, mamaFraseComparacao, mamaGraficoSVG, _mamaTipoDe,'
  + ' MAMA_PAR_HORA_TOL, MAMA_PAR_DIST_TOL};'
)(s => String(s == null ? '' : s),
  s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  { getElementById: () => null, addEventListener: () => {} }, () => {});

console.log('=== ler achados de um laudo ANTIGO, que chega como texto ===');
const antigo = 'ACHADOS: MAMA DIREITA. Notou-se nódulo sólido na mama direita, às 10 h, '
  + 'distando 3 cm da papila, medindo 11 x 8 mm. Notou-se cisto simples na mama esquerda, '
  + 'às 4 h, distando 6 cm da papila, medindo 5 x 4 mm. Pele sem alterações.';
const lidos = api.mamaLesoesDeTexto(antigo);
ok(lidos.length === 2, 'leu os 2 achados localizados (' + lidos.length + ')');
ok(lidos[0].lado === 'D' && lidos[0].hora === 10 && lidos[0].distCm === 3, 'o primeiro, com posição certa');
ok(lidos[0].mm[0] === 11, 'e com a medida em mm');
ok(lidos[0].tipo === 'nodulo' && lidos[1].tipo === 'cisto', 'e cada um com o seu tipo');
ok(api.mamaLesoesDeTexto('Pele e tecido subcutâneo sem alterações.').length === 0,
   'frase sem localização não vira achado');
ok(api.mamaLesoesDeTexto('').length === 0, 'texto vazio não inventa achado');

console.log('\n=== §2.1 — a candidatura RECUSA tudo que não bate ===');
const hoje = { lado: 'D', hora: 10, distCm: 3, tipo: 'nodulo' };
const base = { lado: 'D', hora: 10, distCm: 3, tipo: 'nodulo', mm: [11] };
ok(api.mamaCandidatos(hoje, [base]).length === 1, 'igual em tudo: é candidato');
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { hora: 11 })]).length === 1, '1 hora de diferença: aceita');
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { hora: 12 })]).length === 0, '2 horas: RECUSA');
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { distCm: 4 })]).length === 1, '1 cm de diferença: aceita');
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { distCm: 5 })]).length === 0, '2 cm: RECUSA');
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { lado: 'E' })]).length === 0,
   'lado diferente: RECUSA, sem tolerância nenhuma');
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { tipo: 'cisto' })]).length === 0,
   'tipo diferente: RECUSA (cisto com cisto, nódulo com nódulo)');
// 12h e 1h distam 1 hora, não 11 — o relógio dá a volta
ok(api.mamaCandidatos({ lado: 'D', hora: 12, distCm: 3, tipo: 'nodulo' },
                      [Object.assign({}, base, { hora: 1 })]).length === 1,
   'o relógio dá a volta: 12h e 1h distam 1 hora, não 11');

console.log('\n=== achado biopsiado NUNCA é candidato (especificação 07 §3) ===');
// O original foi retirado ou tratado; o que existe ali hoje é, por definição, evento novo.
// Compará-lo como se ainda estivesse em vigilância é erro de ESTADO, não dado faltando.
['biopsiado_benigno', 'biopsiado_maligno', 'biopsiado_inconclusivo'].forEach(st =>
  ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { status: st })]).length === 0,
     'status "' + st + '": fora do pareamento'));
ok(api.mamaCandidatos(hoje, [Object.assign({}, base, { status: 'ativo' })]).length === 1,
   'e o que segue ativo continua sendo candidato');

console.log('\n=== vários candidatos: todos listados, nenhum escolhido ===');
const varios = api.mamaCandidatos(hoje, [base,
  Object.assign({}, base, { hora: 11, mm: [9] }),
  Object.assign({}, base, { distCm: 4, mm: [13] })]);
ok(varios.length === 3, 'os três candidatos voltam (' + varios.length + ')');
ok(!/mais próximo|maisProximo|melhor/.test(grab('mamaCandidatos')),
   'e a função NÃO tem noção de "o mais próximo" — quem decide é o médico');

console.log('\n=== §6 — a frase diz o FATO, não o julgamento ===');
// A leitura da fonte primária foi explícita: o manual não dá percentual de crescimento que
// mude conduta. Inventar um corte repetiria o defeito da auditoria — número sem fonte.
const fr = api.mamaFraseComparacao(12, 11, '20/02/2025');
ok(/mede 12 mm \(havia 11 mm\)/.test(fr), 'traz as duas medidas: "' + fr + '"');
ok(/20\/02\/2025/.test(fr), 'e a data do exame anterior');
ok(!/cresceu|aumentou|estável|estavel|manteve|reduziu/i.test(fr),
   'e NÃO rotula a variação — a leitura clínica fica com o médico');
ok(!/%/.test(EVO.replace(/[^]*mamaFraseComparacao/, '')) || !/\d+%/.test(fr),
   'nenhum percentual de corte inventado');
ok(api.mamaFraseComparacao(null, 11, 'x') === '', 'sem medida atual, sem frase');
ok(api.mamaFraseComparacao(12, null, 'x') === '', 'sem medida anterior, sem frase');

console.log('\n=== §4 — quando o gráfico aparece ===');
const D = (a, m, s, atual) => ({ t: Date.UTC(a, m, 1), mm: s, rot: '0' + (m + 1) + '/' + a, atual: !!atual });
ok(api.mamaGraficoSVG([D(2025, 1, 11)]) === '',
   'um ponto só NÃO gera gráfico — gráfico de um ponto é enfeite');
ok(api.mamaGraficoSVG([]) === '', 'nenhum ponto, nenhum gráfico');
const g = api.mamaGraficoSVG([D(2023, 1, 9), D(2025, 1, 11), D(2026, 7, 12, true)]);
ok(g.indexOf('<svg') === 0, 'com 2 ou mais pontos, sai o gráfico');

console.log('\n=== §5.1 — as regras que NÃO são estéticas ===');
// Eixo Y cortado transforma 1 mm de variação em subida dramática. É o jeito mais fácil de
// mentir com gráfico, e aqui a mentira mudaria conduta.
ok(/>0<\/text>/.test(g), 'o eixo Y começa em ZERO, e o zero está escrito');
ok(!/verde|#0a0|#00ff00|red|#f00|#e00/i.test(g), 'sem verde e sem vermelho');
ok(!/seta|arrow|marker-end/i.test(g), 'sem seta de tendência — seria um 2º diagnóstico, visual');
ok(/varia entre examinadores/.test(g), 'com a nota de variabilidade fixa no rodapé');
ok(/este exame/.test(g), 'e o ponto do exame atual marcado');
ok((g.match(/<circle/g) || []).length === 3, 'um ponto por exame (3)');
ok(/>9</.test(g) && />11</.test(g) && />12</.test(g), 'cada ponto rotulado com o valor');
// Eixo X em tempo REAL: 2023->2025 são 2 anos e 2025->2026 é ~1,5 ano; o espaçamento na
// tela tem de refletir isso, senão o gráfico esconde que um intervalo foi muito maior.
const xs = (g.match(/<circle cx="([\d.]+)"/g) || []).map(s => parseFloat(/"([\d.]+)"/.exec(s)[1]));
ok(xs.length === 3 && (xs[1] - xs[0]) > (xs[2] - xs[1]),
   'eixo X em escala real de tempo: o intervalo de 2 anos ocupa mais que o de 1,5');

console.log('\n=== o gráfico não inventa ponto ===');
const comBuraco = api.mamaGraficoSVG([D(2023, 1, 9), { t: Date.UTC(2024, 1, 1), mm: null, rot: '02/2024' }, D(2026, 7, 12, true)]);
ok((comBuraco.match(/<circle/g) || []).length === 2,
   'exame anterior sem a medida daquele achado é ausência de dado — não vira zero nem interpolação');

console.log('\n=== a pergunta de confirmação, lida no código (§2.2) ===');
// Candidato NÃO vira par sozinho. Esta é a regra que separa "gráfico útil" de "gráfico que
// mostra crescimento onde não houve, com cara de dado conferido".
const EVOUI = HTML.slice(HTML.indexOf('function mamaEvolucaoHTML('),
                         HTML.indexOf('function _mamaData('));
ok(/não sei — não comparar/.test(EVOUI),
   '"não sei" é oferecido como resposta, não só "é o mesmo"/"é outro"');
ok(/é outro achado/.test(EVOUI) && /é o mesmo/.test(EVOUI), 'as três respostas existem');
ok(/Sem a sua confirmação não há/.test(EVOUI),
   'e a tela diz POR QUE não há gráfico antes de confirmar');
ok(/perguntas\.forEach/.test(EVOUI) && !/perguntas\[0\]/.test(EVOUI),
   'TODOS os candidatos são listados — nenhum vem pré-escolhido');
ok(/if\(!perguntas\.length\) return;/.test(EVOUI),
   'achado sem candidato nenhum é achado NOVO: nem pergunta, nem gráfico (§2.3)');
const DEC = HTML.slice(HTML.indexOf('function mamaEvolucaoDecidir('), HTML.indexOf('/* O bloco inteiro da evolução'));
ok(/L\.evolucao\[lesaoId\]=\{decisao:decisao\}/.test(DEC),
   'a resposta fica GRAVADA no laudo — no próximo exame o par já vem resolvido');
ok(/decisao==='outro' \|\| decisao==='naosei'/.test(DEC),
   '"outro" e "não sei" são guardados também, para a pergunta não voltar a cada abertura');
ok(/revMarcarEditado/.test(DEC), 'e a decisão marca o laudo como editado, como qualquer edição');

console.log('\n=== a data vira tempo de verdade, ou o ponto não entra ===');
const dt = new Function('return ' + HTML.slice(HTML.indexOf('function _mamaData('),
  HTML.indexOf('/* ============ Categoria BI-RADS por extenso')).trim())();
ok(dt('20/02/2025') === Date.UTC(2025, 1, 20), 'lê data no formato brasileiro');
ok(dt('') === null && dt('sem data') === null,
   'data ilegível devolve nulo — e ponto sem data não entra num eixo X de tempo real');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
