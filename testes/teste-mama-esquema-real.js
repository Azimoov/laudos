// O ESQUEMA DA MAMA COM O LAUDO DE VERDADE — 24/08/2026.
//
// POR QUE ESTA SUITE EXISTE, e e a licao mais cara do dia: o esquema foi consertado DUAS
// vezes, as suites passaram verdes das duas, e o medico continuou vendo o laudo sem imagem.
// As suites montavam o laudo A MAO, com `birads` na raiz do objeto. O app NAO monta assim:
// o que a IA devolveu e guardado em `_classifBruto.birads`. Entao `mamaLesoes` lia
// `L.birads`, achava undefined, e devolvia lista vazia — o desenho NUNCA funcionou com
// dado real, e nenhum teste percebia porque nenhum teste usava dado real.
//
// Por isso esta suite le um laudo REAL, exportado do banco (testes/material/), com a mesma
// forma que o app guarda. Se o formato do laudo mudar de novo, aqui quebra.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'material', 'laudo-mama-real.json'), 'utf8'));
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
const nomes = ['mamaCmInteiro','mamaMm','mamaLocalDoTexto','_mamaFraseDo','mamaCasoEspecialDoTexto','_mamaCatDoAchado','mamaLesoes'];
const api = new Function(
  (HTML.match(/const MAMA_RAIO_CM = \d+;/) || [''])[0] + '\n'
  + (HTML.match(/const MAMA_DIST_INDEF_CM = [^;]+;/) || [''])[0] + '\n'
  + (HTML.match(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/) || [''])[0] + '\n'
  + nomes.map(grab).join('\n')
  + '\nreturn {mamaLesoes};')();

console.log('=== o laudo real NAO tem birads na raiz (era isto que quebrava) ===');
ok(!Array.isArray(REAL.birads), 'o material de teste e do formato REAL: sem `birads` na raiz');
ok(Array.isArray(REAL._classifBruto.birads) && REAL._classifBruto.birads.length === 2,
   'os achados vivem em _classifBruto.birads (2 neste laudo)');

console.log('\n=== e mesmo assim o desenho acontece ===');
const r = api.mamaLesoes(REAL);
ok(r.plot.length === 2, 'os DOIS achados sao plotados (antes: zero, e o esquema saia vazio)');
ok(r.semPos.length === 0, 'e nenhum ficou de fora');
const lados = r.plot.map(x => x.lado).sort().join(',');
ok(lados === 'D,E', 'um em cada mama: ' + lados);
ok(r.plot.every(x => x.hora != null), 'a hora foi lida em ambos — inclusive do ROTULO, quando a frase nao a tinha');
ok(r.plot.every(x => x.mm && x.mm.length), 'e as medidas tambem');
// 24/08, mesma tarde: neste laudo SO o achado da direita esta sem distancia — o da
// esquerda tem "distando 5 cm da papila" escrito, e passou a ser LIDO quando o casamento
// achado↔frase foi corrigido (antes casava com o cabecalho da mama, que nao fala dele).
// Esta suite guardava "os dois sem distancia", que era o defeito, nao a regra.
const dir = r.plot.filter(x => x.lado === 'D')[0];
const esq = r.plot.filter(x => x.lado === 'E')[0];
ok(dir.distIgnorada === true && dir.distCm === null,
   'o da DIREITA nao tem distancia no texto: marcado como nao informada, dado NULO');
ok(esq.distCm === 5 && !esq.distIgnorada,
   'e o da ESQUERDA tem "distando 5 cm da papila" no laudo — e foi lido: ' + esq.distCm + ' cm');

console.log('\n=== a leitura cobre os DOIS formatos ===');
const fn = grab('mamaLesoes');
ok(/Array\.isArray\(L\.birads\)\?L\.birads/.test(fn), 'a raiz continua valendo (laudos antigos)');
ok(/L\._classifBruto\|\|\{\}\)\.birads/.test(fn), 'e o _classifBruto tambem (formato de hoje)');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
