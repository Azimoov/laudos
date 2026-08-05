/* Roda a bateria inteira de testes. Use ANTES de publicar.
 *
 *   node testes/rodar-tudo.js
 *
 * Os testes de agente (buffer, cache) e o de backup precisam do Python do
 * ditado-local e do agente no ar; se faltarem, sao PULADOS, nao contados como falha.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const PY = 'C:/Users/serru/OneDrive/Desktop/Claude code/ditado-local/.venv/Scripts/python.exe';

const SUITE = [
  { arq: 'checar-sintaxe.js', o: 'sintaxe do index.html' },
  { arq: 'teste-auditoria.js', o: 'XSS, JSON da IA, registro de consumo' },
  { arq: 'teste-fila.js', o: 'fila de reprocessamento' },
  { arq: 'teste-onda.js', o: 'grafico do microfone' },
  { arq: 'teste-bipe.js', o: 'aviso sonoro' },
  { arq: 'teste-birads.js', o: 'calculadora BI-RADS' },
  { arq: 'teste-anterior.js', o: 'comparacao com o exame anterior (F2b)' },
  { arq: 'teste-alertas.js', o: 'painel de alertas por categoria' },
  { arq: 'teste-caixapreta.js', o: 'caixa-preta da gravacao (janela fechou)' },
  { arq: 'teste-gravagente.js', o: 'gravacao continua pelo agente' },
  { arq: 'teste-obstetrico.js', o: 'idade gestacional (AUA x GA) do obstetrico' },
  { arq: 'teste-buffer.py', o: 'fita de audio do agente', py: true },
  { arq: 'teste-cache.py', o: 'cache da listagem DICOM', py: true },
  { arq: 'teste-backup.js', o: 'backup externo (precisa do agente no ar)', agente: true },
  { arq: 'teste-chave.js', o: 'chave da OpenAI no agente (precisa do agente no ar)', agente: true },
];

let ok = 0, falhou = 0, pulou = 0;
const problemas = [];

function agenteNoAr() {
  try { execFileSync('node', ['-e', "require('http').get('http://127.0.0.1:8977/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"], { timeout: 5000 }); return true; }
  catch (e) { return false; }
}
const temPy = fs.existsSync(PY);
const temAgente = agenteNoAr();

console.log('='.repeat(64));
console.log('  BATERIA DE TESTES — Laudos USG');
console.log('  Python do ditado-local: ' + (temPy ? 'ok' : 'AUSENTE (testes do agente serao pulados)'));
console.log('  Agente no ar: ' + (temAgente ? 'sim' : 'nao (teste de backup sera pulado)'));
console.log('='.repeat(64));

for (const t of SUITE) {
  const caminho = path.join(AQUI, t.arq);
  if (!fs.existsSync(caminho)) { console.log('  --   ' + t.o + ' (arquivo ausente)'); pulou++; continue; }
  if (t.py && !temPy) { console.log('  --   ' + t.o + ' (sem Python)'); pulou++; continue; }
  if (t.agente && !temAgente) { console.log('  --   ' + t.o + ' (agente fora do ar)'); pulou++; continue; }
  try {
    const saida = t.py ? execFileSync(PY, [caminho], { encoding: 'utf8', timeout: 120000 })
                       : execFileSync('node', [caminho], { encoding: 'utf8', timeout: 120000 });
    const n = (saida.match(/^\s*ok\s/gm) || []).length;
    console.log('  OK   ' + t.o + (n ? '  (' + n + ' verificacoes)' : ''));
    ok++;
  } catch (e) {
    console.log('  X    ' + t.o);
    const saida = ((e.stdout || '') + (e.stderr || '')).split('\n')
      .filter(l => /FALHA|Error|erro/i.test(l)).slice(0, 4);
    saida.forEach(l => console.log('         ' + l.trim()));
    problemas.push(t.o);
    falhou++;
  }
}

console.log('='.repeat(64));
console.log('  ' + ok + ' suite(s) passaram · ' + falhou + ' falharam · ' + pulou + ' puladas');
if (falhou) { console.log('  NAO PUBLIQUE: ' + problemas.join(', ')); }
else if (pulou) { console.log('  Tudo que rodou passou. Suba o agente para cobrir o resto.'); }
else { console.log('  Tudo verde.'); }
console.log('='.repeat(64));
process.exit(falhou ? 1 : 0);
