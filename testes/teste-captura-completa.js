// Captura ao vivo: exame que chega em partes nao pode ficar pela metade.
//
// 17/08/2026, dia de atendimento: exames capturados com 1 imagem quando o Orthanc
// tinha 6. Causa: a varredura fechava o exame quando a contagem ficava parada por
// UM ciclo (~4-8 s), e as pausas reais do envio do aparelho sao maiores (mediana
// 18-25 s ate chegar inteiro, maximo medido 523 s). Conserto em duas camadas:
//   1. fecha so depois de DOIS ciclos parados;
//   2. o exame lembra QUAIS imagens baixou (_instIds) e a varredura continua
//      vigiando os feitos: chegou imagem atrasada, baixa so o que falta e
//      reencaixa na ordem do estudo (capOrtCompletar).
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, started = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; started = true; }
    else if (HTML[j] === '}') { d--; if (started && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + name);
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const capOrtFaltantes = new Function(grab('capOrtFaltantes') + '\nreturn capOrtFaltantes;')();

console.log('=== o mapa do que falta ===');
const ex = { _instIds: ['a', 'b', 'c'] };
ok(capOrtFaltantes(ex, { instancias: ['a', 'b', 'c', 'd', 'e'] }).join(',') === 'd,e',
   'estudo cresceu: aponta exatamente as imagens que faltam');
ok(capOrtFaltantes(ex, { instancias: ['a', 'b', 'c'] }).length === 0,
   'nada cresceu: nada a baixar');
ok(capOrtFaltantes(ex, { instancias: ['d', 'a', 'b', 'c'] }).join(',') === 'd',
   'imagem atrasada que pertence ao COMECO tambem e vista');
ok(capOrtFaltantes({ _instIds: [] }, { instancias: ['a'] }).join(',') === 'a',
   'exame que nasceu vazio: tudo falta');
ok(capOrtFaltantes({}, { instancias: ['a'] }).join(',') === 'a',
   'sem mapa nenhum nao quebra');
ok(capOrtFaltantes(ex, {}).length === 0, 'estudo sem lista nao quebra');

console.log('=== as amarras no codigo-fonte ===');
ok(/st\.ciclos>=2/.test(HTML) && !/st\.ciclos>=1/.test(HTML),
   'a captura espera DOIS ciclos parados (nao um) antes de fechar');
ok(/capOrtFeitos\.has\(e\.id\)\)\{ try\{ await capOrtCompletar\(e\); \}/.test(HTML),
   'exame ja capturado continua vigiado (capOrtCompletar na varredura)');
ok(/_instIds:instIds/.test(HTML),
   'o exame nasce lembrando QUAIS imagens baixou (o mapa do completar)');
const completar = grab('capOrtCompletar');
ok(/est\.instancias\|\|\[\]\)\.filter/.test(completar) && /ids\.map/.test(completar),
   'a imagem atrasada entra NA ORDEM do estudo, nao no fim');
ok(/gere de novo/.test(completar),
   'se o laudo ja tinha saido, o medico e avisado para gerar de novo');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
