// BANCO DE PROVAS, passo 2: medir o recorte contra a VERDADE, em centenas de casos reais.
//
// A verdade nao pode sair do mesmo casador que se quer medir — seria o aluno corrigindo a
// propria prova. Aqui ela sai de um alinhamento ESTRITO e independente: a citacao da IA e
// uma copia quase literal do ditado, entao procura-se a janela da fita que contem a maior
// parte das palavras da citacao, EM ORDEM e coladas. So vale como verdade quando essa
// janela e boa (>=80% das palavras) e claramente melhor que a segunda colocada — o resto
// e descartado da nota, em vez de virar acerto ou erro por chute.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
// ⚠️ FORA DO REPOSITORIO: a fita e as citacoes trazem ditado de paciente, e este
// repo vai para o GitHub. O caminho padrao aponta para fora de proposito.
const FORA = process.env.WBOT_BANCO || 'C:/Users/serru/Desktop/Projeto WBOT/_banco-de-provas';
const CACHE = path.join(FORA, 'fitas');

function grab(n) {
  let i = HTML.indexOf('function ' + n + '('); if (i < 0) throw new Error(n);
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
eval(grab('rev2AcharNasPalavras'));
eval(grab('rev2RecorteFino'));

// ---------- a VERDADE: onde a citacao esta, de fato ----------
function verdade(pals, citacao) {
  const alvo = norm(citacao).split(' ').filter(Boolean);
  if (alvo.length < 2) return null;              // curta demais para ancorar com seguranca
  const fita = pals.map(w => norm(w.p));
  const larg = Math.min(fita.length, alvo.length * 3 + 4);   // janela generosa
  let melhor = null, segundo = null; const cands = [];
  for (let s = 0; s + 1 <= fita.length; s++) {
    let k = 0, n = 0, ultimo = s;
    for (let j = s; j < Math.min(fita.length, s + larg) && k < alvo.length; j++) {
      if (fita[j] === alvo[k] || (fita[j].length > 3 && alvo[k].length > 3 &&
          fita[j].slice(0, 4) === alvo[k].slice(0, 4))) { k++; n++; ultimo = j; }
      else if (n > 0) { k++; j--; if (k >= alvo.length) break; }   // pula palavra da citacao
    }
    const cand = { ini: s, fim: ultimo, n: n, frac: n / alvo.length };
    // entre janelas com a mesma pontuacao, a mais APERTADA e a verdadeira
    if (!melhor || cand.n > melhor.n ||
        (cand.n === melhor.n && (cand.fim - cand.ini) < (melhor.fim - melhor.ini))) melhor = cand;
    cands.push(cand);
  }
  if (!melhor || melhor.frac < 0.8) return null;                 // nao achei bem: fora da nota
  /* AMBIGUIDADE de verdade e outra janela igualmente boa em OUTRO lugar da fita — nao a
     janela vizinha, que e a mesma frase deslocada de uma palavra. Sem esta distincao o
     medidor descartava metade dos casos como "ambiguos" sendo que nao eram. */
  segundo = cands.filter(c => c.fim < melhor.ini - 2 || c.ini > melhor.fim + 2)
                 .reduce((a, c) => (!a || c.n > a.n ? c : a), null);
  if (segundo && segundo.n >= melhor.n) return null;             // empate real: fora da nota
  return { ini: pals[melhor.ini].i, fim: pals[melhor.fim].f, frac: melhor.frac };
}

/* A REGUA. "Acerto" nao pode ser "o recorte cobre a fala inteira": a fala do achado pode
   passar dos 14 s do teto, e recorte curto e o proposito da coisa. O que ele precisa e
   OUVIR O ACHADO DESDE O COMECO — entao acerto e:
     · o recorte comeca na frase (ate 0,6 s depois do primeiro fonema; antes pode a vontade)
     · e entrega pelo menos 4 s dela, ou tudo se a frase for mais curta. */
function acertou(rec, v) {
  const comecaBem = rec.ini <= v.ini + 0.6;
  const precisaAte = Math.min(v.fim, v.ini + 4.0);
  return comecaBem && rec.fim >= precisaAte;
}

// ---------- roda ----------
const sqlite = (() => { try { return require('node:sqlite'); } catch (e) { return null; } })();
const CIT = JSON.parse(fs.readFileSync(path.join(FORA, 'citacoes.json'), 'utf8'));

let total = 0, comVerdade = 0, acerto = 0, erro = 0, parcial = 0, semFita = 0, estimado = 0;
const errosDetalhe = [], parcialDetalhe = [], compr = [];

for (const linha of CIT) {
  const arq = path.join(CACHE, linha.uid + '.json');
  if (!fs.existsSync(arq)) { semFita++; continue; }
  const fita = JSON.parse(fs.readFileSync(arq, 'utf8'));
  // o trecho onde a citacao mora: o que contiver mais palavras dela
  let melhorTr = null, melhorV = null;
  for (const tr of (fita.trechos || [])) {
    if (!(tr.palavras || []).length) continue;
    const v = verdade(tr.palavras, linha.citacao);
    if (v && (!melhorV || v.frac > melhorV.frac)) { melhorV = v; melhorTr = tr; }
  }
  total++;
  if (!melhorV) continue;              // sem verdade confiavel: fora da nota
  comVerdade++;
  const rec = rev2RecorteFino(melhorTr, linha.citacao);
  if (!rec.palavras) estimado++;
  compr.push(rec.fim - rec.ini);
  // ACERTO = o recorte cobre o miolo da fala verdadeira
  const meio = (melhorV.ini + melhorV.fim) / 2;
  const cobre = acertou(rec, melhorV);
  const pegaMeio = rec.ini <= meio && rec.fim >= meio;
  /* TRES BALDES, nao dois. "Nao comeca no comeco da fala" nao e a mesma coisa que
     "toca outro achado", e tratar os dois como erro esconde o que importa:
       · CERTO   — comeca na fala e entrega os primeiros segundos;
       · PARCIAL — cai DENTRO da fala, mas so no fim dela (ele ouve o achado, sem o
                   comeco onde ele o nomeia). Acontece quando a fala do achado e mais
                   longa que o teto do recorte — ai nenhum recorte curto cobriria tudo;
       · GRAVE   — nao encosta na fala (ou quase): ele ouve OUTRA COISA. E o unico que
                   engana de verdade. */
  const inter = Math.max(0, Math.min(rec.fim, melhorV.fim) - Math.max(rec.ini, melhorV.ini));
  const fracDentro = inter / Math.max(0.01, rec.fim - rec.ini);
  if (cobre) acerto++;
  else if (fracDentro >= 0.5) { parcial++; parcialDetalhe.push({ secao: linha.secao, cit: linha.citacao,
      verdadeLen: (melhorV.fim - melhorV.ini).toFixed(1) }); }
  else {
    erro++;
    errosDetalhe.push({ uid: linha.uid, secao: linha.secao, cit: linha.citacao,
      verdade: melhorV.ini.toFixed(1) + '-' + melhorV.fim.toFixed(1),
      recorte: rec.ini.toFixed(1) + '-' + rec.fim.toFixed(1),
      modo: rec.palavras ? 'palavra' : 'ESTIMADO', pegaMeio: pegaMeio });
  }
}

compr.sort((a, b) => a - b);
const med = compr.length ? compr[Math.floor(compr.length / 2)] : 0;
console.log('================ BANCO DE PROVAS ================');
console.log('citacoes com fita de palavras : ' + total + '   (sem fita ainda: ' + semFita + ')');
console.log('com VERDADE confiavel         : ' + comVerdade);
console.log('');
const pc = n => n + '  (' + (100 * n / Math.max(comVerdade, 1)).toFixed(1) + '%)';
console.log('  CERTO   (comeca na fala)        : ' + pc(acerto));
console.log('  PARCIAL (cai dentro, so no fim) : ' + pc(parcial));
console.log('  GRAVE   (toca outra coisa)      : ' + pc(erro));
console.log('  dos quais caidos na estimativa: ' + estimado);
console.log('  duracao mediana do recorte    : ' + med.toFixed(1) + ' s');
console.log('');
if (errosDetalhe.length) {
  console.log('--- primeiros 20 erros ---');
  errosDetalhe.slice(0, 20).forEach(e => {
    console.log('  [' + e.modo + '] ' + e.secao + '  verdade ' + e.verdade + '  recorte ' + e.recorte +
                (e.pegaMeio ? '  (pega o meio)' : '  (ERRA FEIO)'));
    console.log('        "' + e.cit + '"');
  });
  fs.writeFileSync(path.join(FORA, 'erros.json'), JSON.stringify(errosDetalhe, null, 1));
  console.log('  (todos em erros.json)');
}
