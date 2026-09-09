// ÁUDIO POR BLOCO: O TRECHO DO ÓRGÃO, SEM OS SILÊNCIOS — 09/09/2026, Etapa 2 (Dr. Daniel).
//
// O antigo botão VOZ tentava adivinhar por heurística uma frase de poucos segundos e
// falhava frequentemente (tocava silêncio ou trechos de outros órgãos).
//
// Na Etapa 2, simplificamos: cada bloco/órgão do laudo estruturado ganha seu botão ÁUDIO,
// tocando os trechos de fala correspondentes àquele órgão, mas OMITINDO os silêncios
// (pausas > 1,0 s são cortadas; respiração natural <= 1,0 s é preservada; 0,25 s de folga
// nas pontas para não engolir sílabas).
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}

// Constantes do próprio index.html
const RV2_PAUSA_MAX = parseFloat(/var RV2_PAUSA_MAX *= *([\d.]+)/.exec(HTML)[1]);
const RV2_FOLGA_FALA = parseFloat(/var RV2_FOLGA_FALA *= *([\d.]+)/.exec(HTML)[1]);

// Funções auxiliares do index.html
eval(grab('norm'));
eval(grab('rev2ClipesDoBloco'));

console.log('=== as regras de silêncio são as mesmas consagradas do exame inteiro ===');
ok(RV2_PAUSA_MAX === 1.0, 'corta silêncios acima de 1,0 s no bloco [' + RV2_PAUSA_MAX + ']');
ok(RV2_FOLGA_FALA === 0.25, 'e reserva 0,25 s de folga de fala nas pontas [' + RV2_FOLGA_FALA + ']');

console.log('\n=== identificação dos trechos do órgão específico ===');
const exMult = {
  id: 101,
  laudo: {
    trechos: [
      { inicio: 5, fim: 12, texto: 'fígado com contornos regulares e dimensões normais' },
      { inicio: 13, fim: 18, texto: 'ecotextura hepática preservada sem lesões focais' }, // pausa de 1s (preservada)
      { inicio: 35, fim: 42, texto: 'vesícula biliar distendida de paredes finas e conteúdo anecoico' }, // 17s de silêncio antes
      { inicio: 70, fim: 80, texto: 'rins tópicos com espessura do parênquima mantida' } // 28s de silêncio antes
    ]
  }
};
global.audios = [{ exameId: 101, url: 'exame_101.wav' }];
global.rev2AudioDoTrecho = () => ({ url: 'exame_101.wav' });
global.rev2RecortePorFaixa = () => null;
global.rev2TrechoDoBloco = () => null;

const bFigado = { titulo: 'Fígado', texto: 'Fígado com dimensões normais e ecotextura preservada.' };
const cFigado = rev2ClipesDoBloco(exMult, bFigado);
ok(cFigado.length === 1, 'os dois trechos contíguos do fígado (com pausa <= 1s) fundem em 1 clipe [' + cFigado.length + ']');
ok(cFigado[0].ini <= 5 && cFigado[0].fim >= 18, 'cobre do início do fígado (5s) ao fim (18s)');
ok(cFigado[0].fim < 34, 'e não invade a vesícula biliar (que só começa aos 35s)');

const bVesicula = { titulo: 'Vesícula biliar', texto: 'Vesícula biliar de paredes finas.' };
const cVesicula = rev2ClipesDoBloco(exMult, bVesicula);
ok(cVesicula.length === 1, 'vesícula biliar isolada em 1 clipe [' + cVesicula.length + ']');
ok(cVesicula[0].ini >= 34.75 && cVesicula[0].fim <= 42.25, 'compreendido entre ~34.75s e ~42.25s [' + cVesicula[0].ini + ' a ' + cVesicula[0].fim + ']');

console.log('\n=== silêncio longo dentro do mesmo órgão vira corte ===');
const exSilencioLongo = {
  id: 102,
  laudo: {
    trechos: [
      { inicio: 10, fim: 15, texto: 'mama direita quadrante superior externo com nódulo' },
      { inicio: 40, fim: 46, texto: 'mama direita medindo 8 mm no maior diâmetro' } // 25s examinando no meio
    ]
  }
};
global.audios = [{ exameId: 102, url: 'exame_102.wav' }];
const bMama = { titulo: 'MAMA DIREITA', texto: 'Nódulo no quadrante superior externo.' };
const cMama = rev2ClipesDoBloco(exSilencioLongo, bMama);
ok(cMama.length === 2, 'pausa de 25s no mesmo órgão vira DOIS clipes separados [' + cMama.length + ']');
const tempoOuvido = cMama.reduce((s, x) => s + (x.fim - x.ini), 0);
ok(tempoOuvido < 15, 'o médico ouve ~11s de fala no lugar de 36s de gravação [' + tempoOuvido.toFixed(1) + 's]');

console.log('\n=== tolerância e segurança ===');
ok(rev2ClipesDoBloco(null, bMama).length === 0, 'exame nulo devolve array vazio sem estourar erro');
ok(rev2ClipesDoBloco(exMult, null).length === 0, 'bloco nulo devolve array vazio');
ok(rev2ClipesDoBloco({ laudo: { trechos: [] } }, bMama).length === 0, 'exame sem trechos devolve vazio');

console.log('\n=== presença na interface do index.html ===');
ok(/rev2ClipesDoBloco/.test(HTML), 'função rev2ClipesDoBloco declarada no index.html');
ok(/rev2TocarAudioBloco/.test(HTML), 'controlador rev2TocarAudioBloco declarado no index.html');
ok(/class="audio"[^>]*onclick="rev2TocarAudioBloco\(/.test(HTML), 'botão ÁUDIO gerado nas caixas de texto com áudio');
ok(/class="img"[^>]*onclick="rev2VerImagem\(/.test(HTML), 'botão IMG continua intacto para fotos');
ok(!/<button class="voz"[^>]*>VOZ<\/button>/.test(HTML), 'antigo botão VOZ não existe mais');

console.log('\n' + (falhas ? ('FALHAS: ' + falhas) : 'tudo certo'));
process.exit(falhas ? 1 : 0);
