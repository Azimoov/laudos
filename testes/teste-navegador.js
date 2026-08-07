// Testes que abrem o programa DE VERDADE num navegador.
//
// POR QUE ISTO EXISTE: as outras suites recortam funcoes soltas do index.html e testam
// cada uma na bancada. Isso deixou passar, com tudo verde, falhas graves de 04-05/08:
//   - toda chamada de IA pelo agente morria antes de sair (variavel usada antes de existir)
//   - exames entravam duplicados ao recarregar a pagina
//   - faltava o botao de apagar laudo na tela de revisao
//   - apagar o ultimo laudo nao colava: ele voltava ao recarregar
// Nenhuma dessas aparece testando funcao isolada: sao falhas de MONTAGEM. Aqui a pagina
// e carregada inteira num Chrome de verdade e as funcoes rodam como rodam no dia a dia.
//
// SEM DEPENDENCIA NENHUMA: usa o Chrome ja instalado, falando o protocolo do DevTools por
// WebSocket (embutido no Node 22+). Nao instala pacote, nao baixa navegador.
// Nao faz chamada de IA nem toca no agente: tudo que sai para a rede e interceptado.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function acharChrome() {
  const cands = [
    process.env.CHROME_BIN,
    path.join(process.env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean);
  return cands.find(c => { try { return fs.statSync(c).isFile(); } catch (e) { return false; } });
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
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + porta + '/json/list');
      const alvos = await r.json();
      const p = alvos.find(a => a.type === 'page' && a.webSocketDebuggerUrl);
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
  const enviar = (method, params) => new Promise(res => {
    const id = ++n; pend.set(id, res);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  return { pronto, enviar, fechar: () => ws.close() };
}

async function rodarNaPagina(cdp, expr) {
  const r = await cdp.enviar('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  const res = r.result && r.result.result;
  if (r.result && r.result.exceptionDetails) throw new Error('erro na pagina');
  return res && res.value;
}

// ---- as verificacoes, escritas para rodar DENTRO da pagina ----
const VERIFICACOES = `(async () => {
  const R = [];
  const diz = (nome, cond, visto) => R.push({ nome, ok: !!cond, visto: visto === undefined ? '' : String(visto) });

  // Nada pode sair para a rede: trocamos fetch por um dublê que responde o que o teste quer.
  const respostas = { estado: { ok: true, configurada: true }, chat: null };
  let ultimoCorpo = null;
  window.fetch = async (url, opt) => {
    const u = String(url);
    if (u.includes('/ia/estado')) return new Response(JSON.stringify(respostas.estado));
    if (u.includes('/ia/chat')) {
      ultimoCorpo = JSON.parse((opt && opt.body) || '{}');
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"resposta":"ok"}' } }], usage: {} }));
    }
    if (u.includes('/dicom/estudos')) return new Response(JSON.stringify({ ok: true, estudos: [], relogio: { desvioSeg: 0, suspeito: false, limiteSeg: 900 } }));
    return new Response('{}');
  };
  cfg.chave = '';                    // a chave mora no AGENTE: e o cenario real
  _iaAgente = { ok: null, quando: 0 };

  // 1) A IA pelo agente funciona? (a falha de 05/08: variavel usada antes de existir)
  try {
    const r = await openai([{ type: 'text', text: 'oi' }]);
    diz('IA pelo agente responde (sem chave no navegador)', r && r.resposta === 'ok');
    diz('o pedido enviado ao agente tem modelo e mensagens', !!(ultimoCorpo && ultimoCorpo.model && ultimoCorpo.messages));
    diz('pedido de JSON viaja com response_format', !!(ultimoCorpo && ultimoCorpo.response_format));
  } catch (e) {
    diz('IA pelo agente responde (sem chave no navegador)', false, e.constructor.name + ': ' + e.message);
    diz('o pedido enviado ao agente tem modelo e mensagens', false);
    diz('pedido de JSON viaja com response_format', false);
  }

  // 2) temIA aceita a chave no agente
  diz('temIA aceita a chave morando no agente', (await temIA()) === true);
  respostas.estado = { ok: true, configurada: false };
  _iaAgente = { ok: null, quando: 0 };
  diz('sem agente e sem chave local, temIA diz nao', (await temIA()) === false);
  respostas.estado = { ok: true, configurada: true };
  _iaAgente = { ok: null, quando: 0 };

  // 3) Exame do aparelho nao pode duplicar
  // ATENCAO: as imagens precisam BAIXAR de mentira. Sem isso, capOrtProcessar desiste por
  // "exame sem imagens legiveis" e o teste passaria mesmo com a trava de duplicado removida
  // — foi o que aconteceu quando testei o proprio teste quebrando o codigo de proposito.
  const baixarOrig = window.capOrtBaixar;
  window.capOrtBaixar = async () => 'data:image/png;base64,iVBORw0KGgo=';
  window.capAutoVincular = async () => {};        // nao interessa aqui
  exames = [{ id: 0, paciente: 'X', tipo: '', laudo: null, imagens: ['i'], audios: [], _estudoId: 'EST-1', _preset: 'GYN' }];
  audios = []; capOrtWatching = false;
  await capOrtProcessar({ id: 'EST-1', paciente: 'X', nImagens: 2, instancias: ['a', 'b'] });
  diz('exame do aparelho que ja esta na lista nao entra de novo', exames.length === 1, 'exames: 1 -> ' + exames.length);
  // e o controle: um exame NOVO tem de entrar normalmente
  await capOrtProcessar({ id: 'EST-2', paciente: 'OUTRO', nImagens: 2, instancias: ['a'] });
  diz('exame novo do aparelho entra na lista', exames.length === 2, 'exames: 1 -> ' + exames.length);
  window.capOrtBaixar = baixarOrig;

  // 4) A sessao guarda o que identifica o exame do aparelho
  const db = await dbOpen();
  const lerSess = () => new Promise(r => { const q = db.transaction('sessoes').objectStore('sessoes').getAll(); q.onsuccess = () => r(q.result || []); });
  await new Promise(r => { const t = db.transaction('sessoes', 'readwrite'); t.objectStore('sessoes').clear(); t.oncomplete = r; });
  _sessaoViva = false;
  exames = [{ id: 0, paciente: 'Y', tipo: 'mama', subExame: '', lateralidade: '', laudo: '<p>l</p>', imagens: [], audios: [], _liberado: false, _estudoId: 'EST-9', _preset: 'GYN' }];
  await salvarSessao();
  let s = await lerSess();
  diz('a sessao guarda o numero do exame do aparelho', s.length === 1 && s[0].exames[0]._estudoId === 'EST-9', s.length ? s[0].exames[0]._estudoId : '(nada)');
  diz('a sessao guarda o preset do aparelho', s.length === 1 && s[0].exames[0]._preset === 'GYN');

  // 5) Apagar laudo: botao na revisao + o apagado nao volta
  renderRevisao();
  diz('a tela de revisao tem botao de apagar', !!document.querySelector('button[data-act="excluir"]'));
  const confAntes = window.confirm; window.confirm = () => true;
  excluirExameRev(0);
  await new Promise(r => setTimeout(r, 300));
  s = await lerSess();
  diz('apagar o ultimo laudo cola (nao volta ao recarregar)', s.length === 0, 'sessoes guardadas: ' + s.length);
  window.confirm = confAntes;

  // 6) Abrir a pagina nao pode apagar a sessao guardada
  exames = [{ id: 0, paciente: 'Z', tipo: 'mama', subExame: '', lateralidade: '', laudo: '<p>l</p>', imagens: [], audios: [], _liberado: false, _estudoId: 'EST-3' }];
  await salvarSessao();
  const guardadas = (await lerSess()).length;
  _sessaoViva = false; exames = []; audios = [];      // simula recarregar a pagina
  await salvarSessao();
  diz('abrir a pagina NAO apaga a sessao guardada', guardadas === 1 && (await lerSess()).length === 1);
  await new Promise(r => { const t = db.transaction('sessoes', 'readwrite'); t.objectStore('sessoes').clear(); t.oncomplete = r; });

  // 7) Preset do aparelho: familias conhecidas e desconhecida
  diz('preset GYN vira familia ginecologica', !!presetInfo('GYN') && presetInfo('GYN').tipos.indexOf('transvaginal') >= 0);
  diz('preset URO vira familia urinaria', !!presetInfo('URO') && presetInfo('URO').tipos.indexOf('prostata') >= 0);
  diz('preset desconhecido nao inventa familia', presetInfo('ZZZ') === null);

  // 8) Aviso de "o ditado cita mais de um exame"
  exames = [{ id: 0, paciente: 'W', tipo: 'rins', subExame: '', lateralidade: '', laudo: null, imagens: ['i'], audios: [], _estudoId: 'E', _preset: 'URO', _tipoDuvida: ['rins', 'prostata'] }];
  audios = []; renderExames();
  const txt = document.body.textContent.replace(/\\s+/g, ' ');
  diz('cartao avisa quando o ditado cita mais de um exame', txt.indexOf('cita mais de um exame') >= 0);
  diz('cartao mostra o preset do aparelho', txt.indexOf('URO') >= 0);

  // 9) Desempate por imagem nao pode chutar
  diz('sem imagem, o desempate devolve vazio', (await capDesempatarPelaImagem('', ['rins', 'prostata'])) === '');
  diz('sem candidatos, o desempate devolve vazio', (await capDesempatarPelaImagem('data:image/png;base64,AA', [])) === '');

  // 10) Vizinhos: quem nao tem exame irmao nao manda limite de corte
  window.fetch = async (url) => {
    if (String(url).includes('/dicom/estudos')) return new Response(JSON.stringify({ ok: true, relogio: { desvioSeg: 0, suspeito: false }, estudos: [
      { id: 'A', paciente: 'MARIA SILVA', imgData: '20260805', imgHora: '100000', imgDataFim: '20260805', imgHoraFim: '100500', nImagens: 3 },
      { id: 'B', paciente: 'MARIA SILVA', imgData: '20260805', imgHora: '101000', imgDataFim: '20260805', imgHoraFim: '101500', nImagens: 3 },
      { id: 'C', paciente: 'JOAO SOZINHO', imgData: '20260805', imgHora: '110000', imgDataFim: '20260805', imgHoraFim: '110500', nImagens: 3 } ] }));
    return new Response('{}');
  };
  const vA = await capVizinhosDoExame({ id: 'A', paciente: 'MARIA SILVA', imgData: '20260805', imgHora: '100000' });
  const vB = await capVizinhosDoExame({ id: 'B', paciente: 'MARIA SILVA', imgData: '20260805', imgHora: '101000' });
  const vC = await capVizinhosDoExame({ id: 'C', paciente: 'JOAO SOZINHO', imgData: '20260805', imgHora: '110000' });
  diz('1o exame manda cortar o fim no comeco do 2o', vA.proxHora === '101000', vA.proxHora || '(nenhum)');
  diz('2o exame manda cortar o inicio no fim do 1o', vB.antHora === '100500', vB.antHora || '(nenhum)');
  diz('paciente com um exame so nao manda corte nenhum', !vC.proxHora && !vC.antHora);

  // 11) Aviso de relogio do aparelho fora de hora
  _relogioAparelho = { desvioSeg: 20770, suspeito: true, limiteSeg: 900 };
  relogioBanner();
  const bR = document.getElementById('bannerRelogio');
  diz('avisa quando o relogio do aparelho esta fora', !!bR && bR.textContent.indexOf('horas') >= 0, bR ? bR.textContent.slice(0, 70) : '(sem aviso)');
  _relogioAparelho = { desvioSeg: 23, suspeito: false, limiteSeg: 900 };
  relogioBanner();
  diz('relogio certo nao mostra aviso', !document.getElementById('bannerRelogio'));

  // 12) Faixa de espera desligada
  capOrtWatching = false; exames = []; _esperaDispensados = new Set(); _esperaAvisou = true;
  const agora = new Date();
  const dd = agora.getFullYear() + String(agora.getMonth() + 1).padStart(2, '0') + String(agora.getDate()).padStart(2, '0');
  const hh = String(agora.getHours()).padStart(2, '0') + String(agora.getMinutes()).padStart(2, '0') + '00';
  window.fetch = async (url) => {
    if (String(url).includes('/dicom/estudos')) return new Response(JSON.stringify({ ok: true, relogio: { suspeito: false },
      estudos: [{ id: 'N1', paciente: 'NOVO', imgData: dd, imgHora: hh, nImagens: 4 }] }));
    return new Response('{}');
  };
  await esperaVigiar();
  diz('avisa quando chega exame com a espera desligada', !!document.getElementById('bannerEspera'));
  capOrtWatching = true; await esperaVigiar();
  diz('com a espera ligada o aviso some', !document.getElementById('bannerEspera'));

  return R;
})()`;

(async () => {
  const chrome = acharChrome();
  if (!chrome) { console.log('  PULADO: nao achei Chrome nem Edge nesta maquina'); process.exit(0); }
  const { srv, porta } = await servir();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'laudos-teste-'));
  const portaCDP = 9222 + Math.floor(Math.random() * 700);
  const flags = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + portaCDP, '--user-data-dir=' + perfil,
  ];
  // Como root (maquina de teste em nuvem, nunca o Windows do consultorio) o Chrome
  // se recusa a abrir sem --no-sandbox; process.getuid nem existe no Windows.
  if (process.getuid && process.getuid() === 0) flags.push('--no-sandbox');
  const proc = spawn(chrome, flags.concat('http://127.0.0.1:' + porta + '/index.html'), { stdio: 'ignore' });

  let cdp = null;
  try {
    const ws = await alvoDoChrome(portaCDP);
    cdp = conectar(ws);
    await cdp.pronto;
    await cdp.enviar('Runtime.enable');
    // espera o script da pagina terminar de montar tudo
    for (let i = 0; i < 40; i++) {
      const pronto = await rodarNaPagina(cdp, "typeof openai==='function' && typeof renderExames==='function' && typeof esperaVigiar==='function'");
      if (pronto) break;
      await esperar(250);
    }
    const res = await rodarNaPagina(cdp, VERIFICACOES);
    if (!Array.isArray(res)) throw new Error('a pagina nao devolveu os resultados');
    res.forEach(r => ok(r.ok, r.nome + (r.visto ? '  [' + r.visto + ']' : '')));
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
