// MODELO NOVO DO PROGRAMA NAO PODE NASCER INVISIVEL — 02/09/2026.
//
// O QUE ACONTECIA: ao personalizar modelos, o programa guardava a lista INTEIRA daquele
// momento e, dali em diante, APAGAVA todos os modelos do codigo para usar so a salva.
// Todo modelo acrescentado ao dados.js depois disso nascia invisivel: existia, estava
// testado, tinha suite propria, e simplesmente nao chegava a tela.
//
// COMO APARECEU: em 02/09/2026 o Dr. Daniel pediu para "criarmos" o modelo de Doppler
// arterial de MMII — que ja existia pronto havia dias, com 90 verificacoes passando.
// Medido no agente dele: 25 modelos salvos, 26 no codigo, DOIS que ele nunca viu
// (`doppler_arterial_mmii` e `axila`).
//
// A REGRA QUE ESTA SUITE PROTEGE: a lista salva MESCLA com a do codigo, nunca a
// substitui. E o caso dificil — um modelo do codigo fora da lista salva pode ser um que
// ele APAGOU de proposito ou um que ainda NAO EXISTIA — se resolve pela `base`, a foto
// das chaves que o programa tinha na hora de salvar.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function acharChrome() {
  return [process.env.CHROME_BIN,
    path.join(process.env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean).find(c => { try { return fs.statSync(c).isFile(); } catch (e) { return false; } });
}
function servir() {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const srv = http.createServer((req, res) => {
    const nome = decodeURIComponent(req.url.split('?')[0]);
    const alvo = path.join(RAIZ, nome === '/' ? 'index.html' : nome);
    if (!alvo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    fs.readFile(alvo, (e, d) => {
      if (e) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': tipos[path.extname(alvo)] || 'application/octet-stream' });
      res.end(d);
    });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, porta: srv.address().port })));
}
const esperar = ms => new Promise(r => setTimeout(r, ms));
async function alvoDoChrome(porta) {
  for (let i = 0; i < 80; i++) {
    try {
      const a = await (await fetch('http://127.0.0.1:' + porta + '/json/list')).json();
      const p = a.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) { /* ainda subindo */ }
    await esperar(250);
  }
  throw new Error('o Chrome nao abriu a porta de depuracao');
}
function conectar(url) {
  const ws = new WebSocket(url);
  let n = 0; const pend = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  const pronto = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('nao consegui falar com o Chrome')));
  });
  const enviar = (m, p) => new Promise(res => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  return { pronto, enviar, fechar: () => ws.close() };
}
async function naPagina(cdp, expr) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const ex = r.result && r.result.exceptionDetails;
  if (ex) throw new Error(String((ex.exception && ex.exception.description) || ex.text));
  return r.result && r.result.result && r.result.result.value;
}

(async () => {
  const chrome = acharChrome();
  if (!chrome) { console.log('  PULADO: nao achei Chrome nem Edge nesta maquina'); process.exit(0); }
  const { srv, porta } = await servir();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'laudos-modelos-'));
  const portaCDP = 9222 + Math.floor(Math.random() * 700);
  const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + portaCDP, '--user-data-dir=' + perfil];
  if (process.getuid && process.getuid() === 0) flags.push('--no-sandbox');
  const proc = spawn(chrome, flags.concat('http://127.0.0.1:' + porta + '/index.html'), { stdio: 'ignore' });

  let cdp = null;
  try {
    cdp = conectar(await alvoDoChrome(portaCDP));
    await cdp.pronto;
    await cdp.enviar('Runtime.enable');
    for (let i = 0; i < 60; i++) {
      if (await naPagina(cdp, "typeof modelosMesclarSalvos==='function' && typeof MODELOS_PADRAO==='object'")) break;
      await esperar(250);
    }
    ok(await naPagina(cdp, "typeof modelosMesclarSalvos==='function'"), 'a mescla existe na pagina');
    ok(await naPagina(cdp, "typeof modelosMarcarBase==='function'"), 'e a marcacao da base tambem');

    console.log('\n=== o caso real do Dr. Daniel (02/09/2026) ===');
    // A lista salva dele: tudo o que o programa tinha, MENOS os dois modelos criados depois.
    const caso = await naPagina(cdp, `(() => {
      const salvos = {};
      Object.keys(MODELOS_PADRAO).forEach(k => {
        if (k === 'doppler_arterial_mmii' || k === 'axila') return;   // ainda nao existiam
        salvos[k] = JSON.parse(JSON.stringify(MODELOS_PADRAO[k]));
      });
      salvos.abdominal.titulo = 'TITULO QUE ELE MESMO ESCREVEU';      // uma personalizacao dele
      salvos['modelo_1782783339631'] = { nome: 'Um modelo so dele', titulo: 't', tecnica: 't', corpo: 'c', conclusao: 'c' };
      try { localStorage.removeItem('gmodelos__base'); } catch(e) {}  // lista salva ANTES desta mudanca
      modelosMesclarSalvos(salvos);
      return { temDoppler: !!MODELOS.doppler_arterial_mmii,
               temAxila: !!MODELOS.axila,
               tituloDele: (MODELOS.abdominal||{}).titulo,
               temOdele: !!MODELOS['modelo_1782783339631'],
               total: Object.keys(MODELOS).length };
    })()`);
    ok(caso.temDoppler, 'o Doppler arterial de MMII passa a aparecer');
    ok(caso.temAxila, 'e a Axila tambem — os dois que ele nunca viu');
    ok(caso.tituloDele === 'TITULO QUE ELE MESMO ESCREVEU',
       'a personalizacao dele continua valendo (nao foi sobrescrita pelo codigo)');
    ok(caso.temOdele, 'e o modelo que ele criou continua existindo');
    ok(caso.total === Object.keys(await naPagina(cdp, 'MODELOS_PADRAO')).length + 1,
       'total = os do programa + o dele  [' + caso.total + ']');

    console.log('\n=== apagado de proposito CONTINUA apagado (e para isso serve a base) ===');
    const apagado = await naPagina(cdp, `(() => {
      const salvos = {};
      Object.keys(MODELOS_PADRAO).forEach(k => {
        if (k === 'penis') return;                       // este ele apagou de proposito
        if (k === 'doppler_arterial_mmii') return;        // este ainda nao existia
        salvos[k] = JSON.parse(JSON.stringify(MODELOS_PADRAO[k]));
      });
      // a base diz o que o programa TINHA quando ele salvou: continha 'penis', nao continha o Doppler
      const base = Object.keys(MODELOS_PADRAO).filter(k => k !== 'doppler_arterial_mmii');
      localStorage.setItem('gmodelos__base', JSON.stringify(base));
      modelosMesclarSalvos(salvos);
      const r = { sumiuOApagado: !MODELOS.penis, voltouONovo: !!MODELOS.doppler_arterial_mmii };
      localStorage.removeItem('gmodelos__base');
      return r;
    })()`);
    ok(apagado.sumiuOApagado, 'o modelo que ele apagou de proposito NAO ressuscita');
    ok(apagado.voltouONovo, 'e o modelo novo do programa aparece na mesma passada');

    console.log('\n=== rodar duas vezes da o mesmo resultado ===');
    // A sincronizacao com o agente aplica a lista uma SEGUNDA vez. Sem voltar ao padrao
    // antes de mesclar, a segunda passada ressuscitaria o que a primeira apagou.
    const duas = await naPagina(cdp, `(() => {
      const salvos = {};
      Object.keys(MODELOS_PADRAO).forEach(k => { if (k !== 'penis') salvos[k] = MODELOS_PADRAO[k]; });
      localStorage.setItem('gmodelos__base', JSON.stringify(Object.keys(MODELOS_PADRAO)));
      modelosMesclarSalvos(salvos);
      const depoisDaPrimeira = !!MODELOS.penis;
      modelosMesclarSalvos(salvos);
      const depoisDaSegunda = !!MODELOS.penis;
      localStorage.removeItem('gmodelos__base');
      return { depoisDaPrimeira, depoisDaSegunda };
    })()`);
    ok(duas.depoisDaPrimeira === false && duas.depoisDaSegunda === false,
       'a segunda passada nao ressuscita o que a primeira tirou');

    console.log('\n=== sem lista salva, valem os modelos do programa ===');
    const semLista = await naPagina(cdp, `(() => {
      modelosMesclarSalvos(null);
      return { total: Object.keys(MODELOS).length, padrao: Object.keys(MODELOS_PADRAO).length };
    })()`);
    ok(semLista.total === semLista.padrao,
       'nada personalizado = exatamente os do codigo  [' + semLista.total + ']');

    console.log('\n=== a base viaja para o computador, nao so para o navegador ===');
    // Guardada so no navegador ela sumiria na proxima abertura (a porta e sorteada e
    // aquela memoria e por endereco), e o programa voltaria a adivinhar.
    ok(await naPagina(cdp, "DADOS_SINCRONIZADOS.indexOf('gmodelos__base')>=0"),
       'gmodelos__base esta na lista de dados sincronizados com o agente');
  } catch (e) {
    ok(false, 'nao consegui rodar no navegador: ' + e.message);
  } finally {
    if (cdp) try { cdp.fechar(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
    srv.close();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(falhas ? '\n  ' + falhas + ' FALHA(S)' : '\n  tudo ok');
  process.exit(falhas ? 1 : 0);
})();
