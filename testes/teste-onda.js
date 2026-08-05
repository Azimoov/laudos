// Extrai as funcoes do grafico do index.html e testa a matemática do traço rolante,
// com um canvas de mentira que so anota o que foi desenhado.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}

const W = 320, H = 44;
const traco = [];              // pontos desenhados na cor do traço
let corAtual = '';
const ctx = {
  set strokeStyle(v) { corAtual = v; }, get strokeStyle() { return corAtual; },
  fillStyle: '', lineWidth: 1,
  clearRect() {}, fillRect() {}, beginPath() { }, stroke() {},
  moveTo(x, y) { if (corAtual === '#3ddc84' || corAtual === '#e05c4b') traco.push([x, y, corAtual]); },
  lineTo(x, y) { if (corAtual === '#3ddc84' || corAtual === '#e05c4b') traco.push([x, y, corAtual]); }
};
const canvas = { width: W, height: H, getContext: () => ctx };
const document = { getElementById: id => (id === 'vuAgente' ? canvas : null) };

const src = [grab('micAgoraAgente'), grab('micUltAmostra'), grab('micDesenhar')].join('\n');
const api = new Function('document', 'Date', 'estado', src +
  ';return {d:micDesenhar, ult:micUltAmostra, agora:micAgoraAgente, set:function(o){' +
  'micNiveis=o.micNiveis; micRelAgente=o.micRelAgente; micRecebidoEm=o.micRecebidoEm;}};');

let falhas = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; }

// --- cenario 1: microfone vivo, som chegando ---
const T0 = 1000;
const niveis = [];
for (let t = T0 - 6; t <= T0; t += 0.08) niveis.push([t, 0.3 + 0.2 * Math.sin(t * 3)]);
let mock = { micNiveis: niveis, micRelAgente: T0, micRecebidoEm: Date.now() };
let a = api(document, Date, null); a.set(mock);
traco.length = 0; a.d();
console.log('=== 1. microfone vivo (amostras ate agora) ===');
ok(traco.length > 100, 'desenhou o traço (' + traco.length + ' pontos)');
ok(traco.every(p => p[2] === '#3ddc84'), 'traço VERDE = vivo');
const xs = traco.map(p => p[0]);
ok(Math.max(...xs) > W - 12, 'traço chega na borda direita (x max=' + Math.max(...xs).toFixed(0) + ' de ' + W + ')');
ok(Math.min(...xs) < 12, 'traço começa na borda esquerda (x min=' + Math.min(...xs).toFixed(0) + ')');
ok(xs.every(x => x >= -1 && x <= W + 1), 'nenhum ponto fora do canvas');

// --- cenario 2: microfone morto ha 10 s (amostras param, relogio anda) ---
console.log('\n=== 2. microfone morto ha 10 s ===');
const niveis2 = [];
for (let t = T0 - 16; t <= T0 - 10; t += 0.08) niveis2.push([t, 0.4]);
a.set({ micNiveis: niveis2, micRelAgente: T0, micRecebidoEm: Date.now() });
traco.length = 0; a.d();
ok(traco.length === 0, 'nada desenhado: as amostras sao velhas demais p/ a janela de 6 s');

// --- cenario 3: morreu ha 4 s (parte das amostras ainda visivel) ---
console.log('\n=== 3. morreu ha 4 s (traço deve ficar VERMELHO) ===');
const niveis3 = [];
for (let t = T0 - 10; t <= T0 - 4; t += 0.08) niveis3.push([t, 0.4]);
a.set({ micNiveis: niveis3, micRelAgente: T0, micRecebidoEm: Date.now() });
traco.length = 0; a.d();
ok(traco.length > 0, 'ainda desenha o que sobrou (' + traco.length + ' pontos)');
ok(traco.every(p => p[2] === '#e05c4b'), 'traço VERMELHO = parado ha mais de 3 s');
ok(Math.max(...traco.map(p => p[0])) < W * 0.75, 'traço NAO chega na direita: o vazio a direita mostra o tempo morto');

// --- cenario 4: o traço anda sozinho com o relogio ---
console.log('\n=== 4. o traço ROLA (prova de vida mesmo em silencio) ===');
const silencio = [];
for (let t = T0 - 6; t <= T0; t += 0.08) silencio.push([t, 0.0]);   // sala muda
a.set({ micNiveis: silencio, micRelAgente: T0, micRecebidoEm: Date.now() - 2000 }); // 2 s depois
traco.length = 0; a.d();
const dir1 = Math.max(...traco.map(p => p[0]));
a.set({ micNiveis: silencio, micRelAgente: T0, micRecebidoEm: Date.now() - 4000 }); // 4 s depois
traco.length = 0; a.d();
const dir2 = Math.max(...traco.map(p => p[0]));
ok(dir2 < dir1 - 50, 'com o tempo passando, o traço anda p/ a esquerda (' +
  dir1.toFixed(0) + ' -> ' + dir2.toFixed(0) + ') mesmo com nivel zero');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
