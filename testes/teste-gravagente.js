// Gravacao continua pelo AGENTE, com o navegador so comandando.
// O agente e um programa nativo: fechar o Chrome nao o interrompe. O que se perdia
// era a nocao de que ele estava gravando - ao reabrir, o app achava que nao havia nada.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
function grab(n) {
  let i = HTML.indexOf('async function ' + n + '(');
  if (i < 0) i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('nao achei ' + n);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// ---- a marca que sobrevive ao navegador fechar ----
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
  removeItem: k => { delete store[k]; }
};
const marca = new Function('localStorage',
  grab('agMarcarAtiva') + '\n' + grab('agLimparAtiva') + '\n' + grab('agAtiva')
  + '\n return {agMarcarAtiva, agLimparAtiva, agAtiva};')(localStorage);

console.log('=== a marca de "o agente esta gravando" ===');
ok(marca.agAtiva() === null, 'sem gravacao, nao ha marca');
marca.agMarcarAtiva();
ok(!!marca.agAtiva(), 'iniciar a gravacao deixa a marca');
ok(Math.abs(marca.agAtiva().desde - Date.now()) < 5000, 'a marca guarda DESDE QUANDO grava');
ok(store.gravag && JSON.parse(store.gravag).desde > 0, 'a marca vive no armazenamento, nao na memoria da aba');
marca.agLimparAtiva();
ok(marca.agAtiva() === null, 'parar a gravacao apaga a marca');
store.gravag = 'isso nao e json';
ok(marca.agAtiva() === null, 'marca corrompida nao quebra o app');
store.gravag = '{"outracoisa":1}';
ok(marca.agAtiva() === null, 'marca sem o "desde" e ignorada');

console.log('=== quem grava: o agente e o plano A ===');
const toggle = grab('capToggleRec');
ok(/var est=await capAgenteEstado\(\);\s*if\(est\)\{/.test(toggle),
   'a condicao passou a ser "o agente esta no ar", nao "o microfone dele ja esta aberto"');
ok(!/if\(capAgenteMic\)\{[\s\S]{0,120}capAgenteIniciar/.test(toggle),
   'nao depende mais do microfone ja estar aberto pelo modo de espera');
ok(toggle.indexOf('capAgenteIniciar()') < toggle.indexOf('navigator.mediaDevices.getUserMedia'),
   'o agente e tentado ANTES do microfone do navegador');
ok(/agMarcarAtiva\(\)/.test(toggle), 'ao iniciar pelo agente, deixa a marca');
ok(/agLimparAtiva\(\)/.test(toggle), 'ao parar pelo agente, apaga a marca');
ok(/O agente está no ar mas NÃO está gravando/.test(toggle),
   'se o agente falhar, o navegador assume — mas dizendo o porque');
ok(/gravacao\/prebuffer[\s\S]{0,140}ligar:true/.test(toggle) &&
   toggle.indexOf('prebuffer') < toggle.indexOf('capAgenteIniciar()'),
   'abre o microfone do agente ANTES de mandar gravar (fora do modo de espera ele fica fechado)');
ok(/for\(var tent=0; tent<3 && !chegou/.test(toggle) && /st2 && st2\.capturando/.test(toggle),
   'NAO acredita na promessa: confere que o audio esta chegando antes de dizer "pode fechar"');
ok(/if\(!chegou\)\{[\s\S]{0,300}throw new Error/.test(toggle),
   'audio nao chegando = falha declarada, nunca promessa vazia (o furo do teste de 05/08)');
ok(toggle.indexOf('agMarcarAtiva()') > toggle.indexOf('if(!chegou)'),
   'a marca de "gravando" so e deixada DEPOIS da conferencia');
ok(/if\(!capOrtWatching\)\{[\s\S]{0,160}ligar:false/.test(toggle),
   'ao parar, fecha o microfone que abriu — sem derrubar o modo de espera se ele estiver ligado');
ok(/Agente fora do ar: quem vai gravar é o NAVEGADOR/.test(toggle),
   'sem agente, avisa que a janela nao pode ser fechada');

console.log('=== reabrir o navegador reencontra a gravacao ===');
const reatar = grab('agReatar');
ok(/var marca=agAtiva\(\); if\(!marca\) return;/.test(reatar), 'so age se havia gravacao em curso');
ok(/await capAgenteEstado\(\)/.test(reatar), 'confere com o agente antes de afirmar qualquer coisa');
ok(/capEstado='agente'/.test(reatar), 'a tela volta a mostrar a gravacao em curso');
ok(/capSeg=Math\.max\(0, Math\.round\(\(Date\.now\(\)-marca\.desde\)\/1000\)\)/.test(reatar),
   'o cronometro continua de onde estava, contando desde o inicio de verdade');
ok(/não consigo falar com ele agora/.test(reatar),
   'agente fora do ar na volta: avisa em vez de fingir que nao havia nada');
ok(/Não comece outra gravação antes de conferir/.test(reatar),
   'e orienta a nao gravar por cima');
ok(/if\(!est\.capturando\)/.test(reatar),
   'se o audio nao esta chegando no agente, a gravacao e dada como parada (marca limpa)');
ok(/Confira em "Ditados guardados"/.test(reatar), 'nesse caso, aponta onde procurar o que foi gravado');
ok(/DOMContentLoaded[\s\S]{0,120}agReatar\(\)/.test(HTML), 'isso roda assim que o app abre');

console.log('=== a tela diz QUEM esta com o microfone ===');
const ui = grab('capSetRecUI');
ok(/Gravando pelo AGENTE[\s\S]{0,80}pode fechar o navegador/.test(ui),
   'gravando pelo agente: diz que pode fechar a janela');
ok(/Gravando pelo NAVEGADOR[\s\S]{0,60}NÃO feche esta janela/.test(ui),
   'gravando pelo navegador: diz que NAO pode fechar a janela');
ok(/\(navegador\)/.test(ui), 'ate o estado pausado diz de quem e o microfone');

console.log('=== fim do exame ===');
ok(/capAgenteFecharExame\(est\);\s*\/\/[^\n]*\n\s*agLimparAtiva\(\);/.test(HTML),
   'quando o agente fecha o trecho do exame, a marca e limpa');
ok(/if\(capEstado==='agente'\)\{ capEstado='idle'/.test(HTML),
   'e a tela volta ao estado parado, sem cronometro fantasma');

console.log('=== o aviso de fechar a janela nao atrapalha ===');
const antes = grab('cpGravandoAgora');
ok(/_cpAtivas/.test(antes) && !/capEstado/.test(antes),
   'o aviso de "nao feche" olha so as gravacoes do NAVEGADOR');
ok(/if\(!cpGravandoAgora\(\)\) return;/.test(HTML),
   'gravando pelo agente, o navegador fecha sem perguntar nada — nao ha o que perder');

console.log('=== o caminho antigo continua inteiro ===');
ok(/gravacao\/iniciar/.test(HTML) && /gravacao\/parar/.test(HTML) && /exame\/fechar/.test(HTML),
   'os comandos do agente que ja existiam seguem sendo usados');
ok(/capMR\.start\(CP_FATIA_MS\)/.test(HTML),
   'o plano B (navegador) continua com a caixa-preta ligada');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
