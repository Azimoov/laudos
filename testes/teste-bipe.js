// Testa QUANDO o bipe toca, extraindo micPulso() do index.html com o resto dublado.
const fs = require('fs');
const HTML = fs.readFileSync('C:/Users/serru/OneDrive/Desktop/Projeto WBOT/_repo/index.html', 'utf8');
function grab(n) {
  let i = HTML.indexOf('async function ' + n + '(');       // preserva o "async"
  if (i < 0) i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('nao achei ' + n);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
const src = grab('micPulso') + '\n' + grab('micUltAmostra');

let tocou = [], logs = [];
const el = () => ({ textContent: '', style: {}, checked: false });
const document = { getElementById: () => el() };

function novo() {
  const ctx = {
    micNiveis: [], micRelAgente: 0, micRecebidoEm: 0, micUltAviso: 0, micUltBipMorto: 0,
    micUltReinicios: null, estado: null
  };
  const f = new Function('document', 'log', 'micSom', 'Date', 'ctx', 'capAgenteEstado',
    'var micNiveis=ctx.micNiveis, micRelAgente, micRecebidoEm, micUltAviso=ctx.micUltAviso,' +
    ' micUltBipMorto=ctx.micUltBipMorto, micUltReinicios=ctx.micUltReinicios;' +
    src + ';return {pulso:micPulso, ler:function(){return micUltReinicios;}};');
  return f(document, (m) => logs.push(m), (t) => tocou.push(t), Date,
    ctx, async () => ctx.estado);
}

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

(async () => {
  console.log('=== 1. abrir o app com reinicios ANTIGOS nao deve bipar ===');
  let ctxA = { estado: { ok: true, capturando: true, reinicios: 4, relogioAgente: 100, niveis: [], prebufferDisponivelSeg: 900 } };
  let a = (function () {
    const f = new Function('document', 'log', 'micSom', 'capAgenteEstado', 'window',
      'var micNiveis=[], micRelAgente, micRecebidoEm, micUltAviso=0, micUltBipMorto=0, micUltReinicios=null;' +
      src + ';return {pulso:micPulso};');
    return f(document, (m) => logs.push(m), (t) => tocou.push(t), async () => ctxA.estado, {});
  })();
  tocou = []; logs = [];
  await a.pulso();
  ok(tocou.length === 0, '1ª leitura só memoriza (' + tocou.length + ' bipes)');
  await a.pulso();
  ok(tocou.length === 0, '2ª leitura, mesmo número: silêncio');

  console.log('\n=== 2. o contador SOBE -> bipa uma vez ===');
  ctxA.estado = Object.assign({}, ctxA.estado, { reinicios: 5 });
  await a.pulso();
  ok(tocou.length === 1 && tocou[0] === 'reinicio', 'bipou "reinicio" (' + JSON.stringify(tocou) + ')');
  ok(logs.some(l => /reiniciado/i.test(l)), 'e escreveu no diário: "' + (logs.find(l => /reiniciado/i.test(l)) || '').slice(0, 60) + '…"');
  await a.pulso(); await a.pulso();
  ok(tocou.length === 1, 'não repete enquanto o número não subir de novo');

  console.log('\n=== 3. dois reinicios seguidos -> dois bipes ===');
  ctxA.estado = Object.assign({}, ctxA.estado, { reinicios: 6 });
  await a.pulso();
  ok(tocou.length === 2, 'bipou de novo (' + tocou.length + ')');

  console.log('\n=== 4. microfone PARADO -> som mais insistente, com intervalo ===');
  tocou = [];
  ctxA.estado = { ok: true, capturando: false, paradoHaSeg: 12, reinicios: 6, relogioAgente: 200, niveis: [] };
  await a.pulso();
  ok(tocou.length === 1 && tocou[0] === 'morto', 'bipou "morto" (' + JSON.stringify(tocou) + ')');
  await a.pulso(); await a.pulso();
  ok(tocou.length === 1, 'não martela: espera o intervalo antes de repetir');

  console.log('\n=== 5. agente fora do ar nao bipa ===');
  tocou = [];
  ctxA.estado = null;
  await a.pulso();
  ok(tocou.length === 0, 'sem contato com o agente = silêncio (' + tocou.length + ')');

  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
  process.exit(falhas ? 1 : 0);
})();
