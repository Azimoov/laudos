// Caixa-preta da gravacao: o audio vai para o disco em fatias, enquanto grava.
// Antes o MediaRecorder segurava a gravacao INTEIRA na memoria ate o "parar" —
// fechar a janela no meio do exame perdia o ditado completo, nao um pedaco.
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

// ---- caixa de areia: funcoes puras + um cpFatias() de mentira no lugar do banco ----
const PURAS = ['cpNovaSessao', 'cpMarcaDaSessao', 'cpQuandoDaSessao', 'cpOrfas', 'cpMontarBlob',
  'cpRotulo', 'cpQuandoTexto', 'cpDuracaoTexto', 'cpGravandoAgora'];
const CP_ROTULOS = (HTML.match(/const CP_ROTULOS = \{[\s\S]*?\};/) || [])[0];
const CP_FATIA = (HTML.match(/const CP_FATIA_MS = \d+;/) || [])[0];
let fatiasFalsas = [];
const app = new Function('cpFatias', 'Blob',
  CP_FATIA + '\nvar _cpAtivas={};\n' + CP_ROTULOS + '\n' + PURAS.map(grab).join('\n')
  + '\n return {CP_FATIA_MS, _cpAtivas, ' + PURAS.join(',') + '};')(
  async () => fatiasFalsas, Blob);
const { CP_FATIA_MS, _cpAtivas, cpNovaSessao, cpMarcaDaSessao, cpQuandoDaSessao, cpOrfas,
        cpMontarBlob, cpRotulo, cpQuandoTexto, cpDuracaoTexto, cpGravandoAgora } = app;

(async function () {

console.log('=== a fatia ===');
ok(CP_FATIA_MS > 0 && CP_FATIA_MS <= 10000,
   'a gravacao e cortada em fatias curtas (' + (CP_FATIA_MS / 1000) + 's) — e o maximo que se perde');
ok(/\.start\(CP_FATIA_MS\)/.test(HTML), 'o gravador entrega o audio em fatias');
ok((HTML.match(/\.start\(CP_FATIA_MS\)/g) || []).length === 4,
   'os QUATRO gravadores do app usam fatia (exame, ditado avulso, laudo rapido, captura)');
ok(!/mediaRec\w*\.start\(\);|capMR\.start\(\);/.test(HTML), 'nenhum gravador ficou com o start sem fatia');

console.log('=== a sessao carrega o que precisa para se explicar depois ===');
const s1 = cpNovaSessao('exame');
ok(/^G\d+_[a-z0-9]+\|exame$/.test(s1), 'o nome da sessao guarda o momento e a origem');
ok(cpMarcaDaSessao(s1) === 'exame', 'da para saber de que gravacao veio');
ok(Math.abs(cpQuandoDaSessao(s1) - Date.now()) < 5000, 'da para saber quando comecou');
ok(cpNovaSessao('exame') !== cpNovaSessao('exame'), 'duas gravacoes no mesmo instante nao se misturam');
ok(cpMarcaDaSessao('') === 'ditado' && cpQuandoDaSessao('lixo') === 0, 'nome estranho nao quebra');

console.log('=== ordem das fatias (o audio tem que sair na ordem certa) ===');
const ses = 'G1700000000000_abcd|ditado';
fatiasFalsas = [
  { sessao: ses, i: 2, blob: new Blob(['CCC']), mime: 'audio/webm' },
  { sessao: ses, i: 0, blob: new Blob(['AAA']), mime: 'audio/webm' },
  { sessao: ses, i: 10, blob: new Blob(['EEE']), mime: 'audio/webm' },
  { sessao: ses, i: 1, blob: new Blob(['BBB']), mime: 'audio/webm' }
];
let orfas = await cpOrfas();
ok(orfas.length === 1 && orfas[0].n === 4, 'as fatias soltas viram UMA gravacao (4 fatias)');
ok(orfas[0].fatias.map(f => f.i).join(',') === '0,1,2,10', 'fatias reordenadas por numero, nao por chegada');
ok((await cpMontarBlob(orfas[0]).text()) === 'AAABBBCCCEEE', 'o audio e remontado na ordem certa');
ok(/000010/.test(HTML) === false && /'000000'\+i\)\.slice\(-6\)/.test(HTML),
   'a chave no banco leva zeros a esquerda — senao a fatia 10 viria antes da 2');
ok(orfas[0].mime === 'audio/webm', 'o formato do audio e preservado');
ok(orfas[0].segundos === 4 * CP_FATIA_MS / 1000, 'a duracao estimada bate com o numero de fatias');

console.log('=== varias gravacoes interrompidas ===');
fatiasFalsas = [
  { sessao: 'G1000_aa|exame', i: 0, blob: new Blob(['x']), mime: 'audio/webm' },
  { sessao: 'G3000_bb|ditado', i: 0, blob: new Blob(['y']), mime: 'audio/webm' },
  { sessao: 'G3000_bb|ditado', i: 1, blob: new Blob(['z']), mime: 'audio/webm' },
  { sessao: 'G2000_cc|captura', i: 0, blob: new Blob(['w']), mime: 'audio/webm' }
];
orfas = await cpOrfas();
ok(orfas.length === 3, 'tres gravacoes distintas, nao uma so');
ok(orfas.map(o => o.marca).join(',') === 'ditado,captura,exame', 'a mais recente aparece primeiro');
ok(orfas.find(o => o.marca === 'ditado').n === 2, 'cada gravacao fica com as fatias dela');

console.log('=== a gravacao EM CURSO nao e oferecida como perdida ===');
_cpAtivas['G3000_bb|ditado'] = true;
orfas = await cpOrfas();
ok(orfas.length === 2 && !orfas.some(o => o.sessao === 'G3000_bb|ditado'),
   'quem ainda esta gravando nesta aba nao aparece como interrompida');
ok(cpGravandoAgora() === true, 'o app sabe que ha gravacao em curso');
delete _cpAtivas['G3000_bb|ditado'];
ok(cpGravandoAgora() === false, 'e sabe quando nao ha');

console.log('=== nada guardado ===');
fatiasFalsas = [];
ok((await cpOrfas()).length === 0, 'sem fatias, nada a recuperar');

console.log('=== como isso e mostrado ao medico ===');
ok(cpRotulo('exame') === 'Nova gravação de um exame' && cpRotulo('ditado') === 'Ditado avulso',
   'cada origem tem um nome que o medico entende');
ok(cpRotulo('sei la') === 'Gravação', 'origem desconhecida ainda mostra alguma coisa');
ok(cpDuracaoTexto(45) === '45 s', 'duracao curta em segundos');
ok(/^3 min/.test(cpDuracaoTexto(200)), 'duracao longa em minutos');
ok(cpQuandoTexto(0) === 'momento não registrado', 'sem horario nao inventa horario');
ok(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(cpQuandoTexto(Date.UTC(2026, 7, 3, 15, 30))),
   'horario em formato brasileiro');

console.log('=== ligacao no app ===');
ok(/indexedDB\.open\('laudosDB',4\)/.test(HTML), 'o banco do navegador subiu de versao');
ok(/objectStoreNames\.contains\('caixaPreta'\)\)db\.createObjectStore\('caixaPreta'/.test(HTML),
   'a caixa-preta tem lugar proprio no banco');
ok((HTML.match(/cpLigar\(/g) || []).length === 5, 'os 4 gravadores ligam a caixa-preta (+1 definicao)');
ok((HTML.match(/cpApagarSessao\(cpSes/g) || []).length >= 4,
   'gravacao que termina em paz limpa a caixa-preta (nao fica lixo pedindo recuperacao)');
ok(/catch\(e\)\{[\s\S]{0,200}Não consegui guardar a gravação no disco do navegador/.test(HTML),
   'se o disco do navegador falhar, avisa em vez de morrer calado');
ok(/if\(!cpGravarFatia\._avisou\)/.test(HTML), 'esse aviso sai uma vez, nao a cada 5 segundos');

console.log('=== fechar a janela ===');
ok(/addEventListener\('beforeunload'/.test(HTML), 'o app se despede antes de fechar');
ok(/if\(!cpGravandoAgora\(\)\) return;/.test(HTML), 'so pergunta se houver gravacao em curso — nao atrapalha o resto');
ok(/ev\.preventDefault\(\); ev\.returnValue=''/.test(HTML), 'pede confirmacao ao navegador');

console.log('=== recuperacao ao reabrir ===');
ok(/id="cpRecuperar"/.test(HTML), 'a faixa de recuperacao existe');
ok(HTML.indexOf('id="cpRecuperar"') < HTML.indexOf('<div id="abas">'), 'fica no TOPO, acima das abas');
ok(/DOMContentLoaded[\s\S]{0,120}cpRenderRecuperacao\(\)/.test(HTML), 'e conferida assim que o app abre');
ok(/cpRecuperarSessao\(/.test(HTML) && /cpBaixarSessao\(/.test(HTML) && /cpDescartarSessao\(/.test(HTML),
   'tres saidas: recuperar e transcrever, so baixar o audio, ou descartar');
ok(/if\(!confirm\('Descartar de vez esta gravação/.test(HTML), 'descartar pede confirmacao');
const recuperar = grab('cpRecuperarSessao');
ok(/catch\(e\)\{[\s\S]*?Recuperei o áudio, mas a transcrição falhou/.test(recuperar),
   'se a transcricao falhar, o AUDIO ainda e salvo — e ele que nao pode se perder');
ok(recuperar.indexOf('gravSalvar(blob') > recuperar.indexOf('catch'),
   'o audio e guardado depois do try da transcricao, dentro ou fora dela');
ok(!/cpApagarSessao[\s\S]{0,80}transcreverAudio/.test(recuperar),
   'a caixa-preta so e limpa DEPOIS de guardar, nunca antes');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);

})();
