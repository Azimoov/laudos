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
// Sai da propria localizacao deste arquivo, nunca de um caminho gravado a mao.
// Em 17/08/2026 o projeto MUDOU DE ENDERECO (o medico desligou a sincronizacao
// da Area de Trabalho com o OneDrive e o Windows devolveu o Desktop ao lugar
// original). O caminho fixo daqui apontava para uma pasta que nem existia mais,
// e as suites de Python passaram a ser PULADAS em silencio — verde por ausencia,
// que e o pior tipo de verde.
const PY = path.join(AQUI, '..', '..', 'ditado-local', '.venv', 'Scripts', 'python.exe');

const SUITE = [
  { arq: 'checar-sintaxe.js', o: 'sintaxe do index.html' },
  { arq: 'teste-auditoria.js', o: 'XSS, JSON da IA, registro de consumo' },
  { arq: 'teste-fila.js', o: 'fila de reprocessamento' },
  { arq: 'teste-captura-completa.js', o: 'captura ao vivo: exame que chega em partes nao fica pela metade' },
  { arq: 'teste-historico-indice.js', o: 'busca do exame anterior pelo indice leve' },
  { arq: 'teste-onda.js', o: 'grafico do microfone' },
  { arq: 'teste-bipe.js', o: 'aviso sonoro' },
  { arq: 'teste-birads.js', o: 'calculadora BI-RADS (lexico v2025 conferido no manual)' },
  { arq: 'teste-classif.js', o: 'classificacao automatica TI-RADS/BI-RADS/O-RADS' },
  { arq: 'teste-voz-img.js', o: 'ponte VOZ/IMG da tela de revisao (procedencia conferida)' },
  { arq: 'teste-formatacao.js', o: 'barra de formatacao da tela de revisao (ida e volta)' },
  { arq: 'teste-tela-revisao.js', o: 'tela de revisao: descritor recalcula e assinar registra' },
  { arq: 'teste-visual-revisao.js', o: 'aparencia da tela de revisao (cores, destaque, mouse)' },
  { arq: 'teste-tela-antigos.js', o: 'tela de fotos e audios antigos (porta nova, esteira de sempre)' },
  { arq: 'teste-conferente.js', o: 'conferente: segunda leitura do laudo antes de entregar' },
  { arq: 'teste-bizus-guarda.js', o: 'dizeres padrao (BIZUS): guarda contra valor salvo ilegivel' },
  { arq: 'teste-rede.js', o: 'rede debaixo da transcricao (placa->CPU->nuvem)' },
  { arq: 'teste-provedor.js', o: 'endereco do provedor de IA configuravel' },
  { arq: 'teste-referencia.js', o: 'medidas de referencia por idade (pediatrico)' },
  { arq: 'teste-rede.py', o: 'queda da placa para a CPU, exercitada de verdade', py: true },
  { arq: 'teste-placa.py', o: 'reserva da placa: dois agentes nao carregam juntos', py: true },
  { arq: 'teste-reiniciar.js', o: 'botao de reiniciar o agente (lado do app)' },
  { arq: 'teste-reiniciar.py', o: 'reiniciar o agente: recusa, espera e sucessor', py: true },
  { arq: 'teste-anterior.js', o: 'comparacao com o exame anterior (F2b)' },
  { arq: 'teste-alertas.js', o: 'painel de alertas por categoria' },
  { arq: 'teste-faltando.js', o: 'medidas em branco no laudo (F2e)' },
  { arq: 'teste-caixapreta.js', o: 'caixa-preta da gravacao (janela fechou)' },
  { arq: 'teste-gravagente.js', o: 'gravacao continua pelo agente' },
  { arq: 'teste-obstetrico.js', o: 'idade gestacional (AUA x GA) do obstetrico' },
  { arq: 'teste-doppler-arterial.js', o: 'Doppler arterial de MMII: modelo, dizeres e velocidade ausente' },
  { arq: 'teste-salvar-pasta.js', o: 'salvar na pasta do dia: permissao antes do PDF, e plano B que avisa' },
  { arq: 'teste-historico-tela.js', o: 'tela de Historico (pastas do dia) e a porta de Liberar laudos' },
  { arq: 'teste-blocos-revisao.js', o: 'retangulos da revisao: negrito de medida x titulo x achado' },
  { arq: 'teste-correcoes-1908.js', o: 'leva de correcoes de 19/08: audio, fotos, fila e botoes' },
  { arq: 'teste-fila-banco.js', o: 'banco estruturado - lado do app (payload e fila)' },
  { arq: 'teste-buffer.py', o: 'fita de audio do agente', py: true },
  { arq: 'teste-cache.py', o: 'cache da listagem DICOM', py: true },
  { arq: 'teste-banco.py', o: 'banco estruturado - modulo SQLite do agente', py: true },
  { arq: 'teste-backup.js', o: 'backup externo (precisa do agente no ar)', agente: true },
  { arq: 'teste-chave.js', o: 'chave da OpenAI no agente (precisa do agente no ar)', agente: true },
  // Esta abre o programa INTEIRO num Chrome de verdade. As de cima testam funcoes soltas e
  // por isso deixaram passar, com tudo verde, as falhas de montagem de 04-05/08.
  { arq: 'teste-navegador.js', o: 'programa rodando no navegador (ponta a ponta)' },
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
