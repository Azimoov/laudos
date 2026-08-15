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
  // 15/08: a mensagem era so "Uncaught", que nao diz nada. O detalhe (mensagem, linha e
  // pilha) vem em exception.description — sem ele, achar o erro vira adivinhacao.
  const ex = r.result && r.result.exceptionDetails;
  if (ex) {
    const det = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text;
    const onde = ex.lineNumber != null ? (' [linha ' + (ex.lineNumber + 1) + ']') : '';
    throw new Error(String(det) + onde);
  }
  const res = r.result && r.result.result;
  return res && res.value;
}

// ---- as verificacoes, escritas para rodar DENTRO da pagina ----
//
// ⚠️⚠️ ARMADILHA DAS CRASES — ja mordeu DUAS vezes em 15/08/2026. LEIA ANTES DE ESCREVER.
// Tudo daqui para baixo vive dentro de uma template string. A barra invertida e consumida
// por ela ANTES de o codigo chegar ao navegador:
//     escrito aqui        vira na pagina        resultado
//     /\w+/               /w+/                  regex que nao casa nada — passa VAZIO
//     /\n/g               / <quebra real> /g    SyntaxError: invalid regular expression
// Em regex, DOBRE a barra: escreva  /\\w+/  e  /\\s+/  para obter  /\w+/  e  /\s+/.
// O primeiro caso e o pior: nao quebra, so faz o teste passar sem testar nada.
// Na duvida, prefira metodos sem regex (indexOf, split, querySelector, cssRules).
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

  // 13) Aba Arquivos acumulados enxuta (2026-08-07): so os 4 botoes de selecao,
  // cada um abrindo um input escondido. Se a poluicao voltar, isto acusa.
  const idsAcum = ['inpAudios', 'inpPastaAudios', 'inpExames', 'inpPasta'];
  const btnsAcum = Array.from(document.querySelectorAll('#pane-acumulados button'));
  const temBotao = id => btnsAcum.some(b => ((b.getAttribute('onclick') || '').indexOf("'" + id + "'") >= 0));
  diz('aba acumulados tem exatamente 4 botoes', btnsAcum.length === 4, 'botoes: ' + btnsAcum.length);
  diz('cada seletor tem seu botao (pasta e avulsos, audio e imagem)', idsAcum.every(temBotao));
  diz('os 4 seletores existem escondidos e aceitam varios arquivos',
    idsAcum.every(id => { const el = document.getElementById(id); return !!el && el.type === 'file' && el.style.display === 'none' && el.hasAttribute('multiple'); }));
  diz('os botoes de pasta selecionam pasta de verdade (webkitdirectory)',
    ['inpPastaAudios', 'inpPasta'].every(id => { const el = document.getElementById(id); return !!el && el.hasAttribute('webkitdirectory'); }));
  // escolher audios avulsos precisa avisar quantos entraram (o input sumiu da tela)
  const dtA = new DataTransfer();
  dtA.items.add(new File(['a'], 'dita1.m4a', { type: 'audio/mp4' }));
  dtA.items.add(new File(['b'], 'dita2.mp3', { type: 'audio/mpeg' }));
  const inpAud = document.getElementById('inpAudios');
  inpAud.files = dtA.files;
  inpAud.dispatchEvent(new Event('change'));
  const avisoAud = (document.getElementById('audiosInfo') || {}).textContent || '';
  diz('escolher audios avulsos mostra a contagem no aviso', avisoAud.indexOf('2') >= 0, avisoAud || '(vazio)');

  // 14) UMA BARRA DE ROLAGEM SO (2026-08-15): o medico viu duas na lateral direita da
  // tela inicial. As telas de tela cheia sao position:fixed e cobrem a janela, mas o app
  // continua POR BAIXO ocupando ~4.000 px — a janela mantinha a barra dela, rolando um
  // conteudo invisivel, ao lado da barra da propria tela.
  // So se pega num navegador de verdade: nenhuma funcao isolada mostra isso.
  const TELAS = ['telaAbertura', 'telaExames', 'telaDia', 'telaRev2'];
  const contarBarras = () => {
    const de = document.documentElement;
    let n = (window.innerWidth - de.clientWidth) > 2 ? 1 : 0;
    TELAS.forEach(id => {
      const el = document.getElementById(id);
      if (el && getComputedStyle(el).display !== 'none' && (el.offsetWidth - el.clientWidth) > 2) n++;
    });
    return n;
  };
  const mostrarSo = id => TELAS.forEach(t => {
    const el = document.getElementById(t);
    if (el) el.style.display = (t === id ? 'block' : 'none');
  });
  // o observador reage a mudanca de atributo, que e assincrona: da um tempinho a ele
  const respirar = () => new Promise(r => setTimeout(r, 60));

  mostrarSo('telaAbertura'); await respirar();
  diz('tela de abertura: no maximo UMA barra de rolagem', contarBarras() <= 1,
    'barras: ' + contarBarras());
  mostrarSo('telaExames'); await respirar();
  diz('tela Realizar exames: no maximo UMA barra', contarBarras() <= 1, 'barras: ' + contarBarras());
  // e o controle que importa: com as telas FECHADAS o app tem de voltar a rolar, senao
  // "consertamos" as duas barras deixando o programa preso
  mostrarSo(null); await respirar();
  diz('telas fechadas: o app volta a rolar normalmente',
    document.documentElement.style.overflow !== 'hidden',
    'overflow no html: ' + (document.documentElement.style.overflow || '(vazio)'));
  mostrarSo('telaAbertura'); await respirar();
  diz('e reabrir a tela trava o fundo de novo',
    document.documentElement.style.overflow === 'hidden');
  // Toda tela de tela cheia precisa estar na lista do observador — se alguem criar a
  // quinta e esquecer, o defeito volta calado.
  // ⚠️ Le as REGRAS de CSS, e nao o texto do HTML: este script inteiro vive dentro de uma
  // template string (crases), e ali "\\w" de um regex vira "w". A primeira versao deste
  // teste passou VAZIA por isso — nao achava nada, e ".every()" de lista vazia e sempre
  // verdadeiro. Passar sem testar nada e pior que falhar.
  const idsFixos = [];
  for (const folha of document.styleSheets) {
    try {
      for (const regra of folha.cssRules) {
        if (regra.selectorText && /^#tela/.test(regra.selectorText)
            && regra.style && regra.style.position === 'fixed'
            && parseInt(regra.style.inset || '99', 10) === 0) {
          idsFixos.push(regra.selectorText.slice(1));
        }
      }
    } catch (e) { /* folha de outra origem: nao ha nenhuma aqui, mas nao vale quebrar */ }
  }
  diz('achei as telas de tela cheia no CSS (se der 0, o teste esta cego)',
    idsFixos.length >= 4, 'achadas: ' + idsFixos.length);
  diz('todas as telas de tela cheia estao na lista do observador',
    idsFixos.length > 0 && idsFixos.every(id => TELAS.indexOf(id) >= 0),
    'no CSS: ' + idsFixos.join(', '));

  // 15) LIBERAR LAUDOS pela tela de abertura (2026-08-15). O botao caia na aba antiga do
  // 1.0; agora abre a fila de revisao da 2.0. O que estes testes protegem, em ordem:
  //   1. "Voltar ao painel" devolve a QUEM CHAMOU. Vindo da abertura, cair na tela 3
  //      ligaria os lacos da gravacao (relogio, onda, varredura) para quem so queria
  //      assinar laudos parados — ligar o consultorio sem paciente nenhum.
  //   2. Fila vazia NAO abre tela nenhuma, e muito menos a aba velha.
  const telaVisivel = () => TELAS.filter(id => {
    const el = document.getElementById(id);
    return el && getComputedStyle(el).display !== 'none';
  }).join(',') || '(nenhuma)';
  const laudoFalso = id => ({
    id, paciente: 'M.F.S.', tipo: '', audios: [], imagens: [], _quando: 1,
    laudo: { cab: {}, corpo: '**Utero** normal.', conclusao: 'Normal.', alertas: [] },
  });
  const examesAntes = exames;

  // fila vazia: fica na abertura, sem abrir nada
  exames = [];
  abLiberarLaudos();
  diz('sem laudo nenhum, "Liberar laudos" nao abre tela de revisao',
    telaVisivel() !== 'telaRev2', 'ficou em: ' + telaVisivel());
  // exame sem laudo tambem nao e coisa para assinar
  exames = [{ id: 1, paciente: 'A', laudo: null, audios: [], imagens: [], _quando: 1 }];
  abLiberarLaudos();
  diz('exame ainda sem laudo tambem nao abre a revisao',
    telaVisivel() !== 'telaRev2', 'ficou em: ' + telaVisivel());

  // com laudo pendente: abre a tela 4 da 2.0 — e NAO a aba antiga do 1.0
  exames = [laudoFalso(1)];
  abLiberarLaudos();
  diz('com laudo pendente, abre a tela de revisao da 2.0', telaVisivel() === 'telaRev2',
    'ficou em: ' + telaVisivel());
  diz('e a tela lembra que veio da abertura', _rev2Origem === 'abertura');

  // voltar: devolve para a ABERTURA, e sem ligar os lacos da tela 3
  rev2Voltar();
  diz('"Voltar ao painel" devolve para a tela de abertura', telaVisivel() === 'telaAbertura',
    'ficou em: ' + telaVisivel());
  diz('e NAO liga os lacos da gravacao da tela 3',
    !_diaTimer && !_diaSeg && !_ondaFeed,
    'relogio=' + !!_diaTimer + ' segundos=' + !!_diaSeg + ' onda=' + !!_ondaFeed);

  // o caminho de sempre — pela tela 3 — nao pode ter quebrado
  diaRevisar(1);
  diz('entrando pela tela 3, a revisao tambem abre', telaVisivel() === 'telaRev2',
    'ficou em: ' + telaVisivel());
  rev2Voltar();
  diz('e dali "Voltar ao painel" devolve para a tela 3, como sempre',
    telaVisivel() === 'telaDia', 'ficou em: ' + telaVisivel());
  try { diaFechar(); } catch (e) {}   // nao deixa laco rodando depois do teste
  exames = examesAntes;

  // A TELA NAO PODE PROMETER O QUE O PROGRAMA NAO FAZ (2026-08-15). O modo "Arquivar para
  // liberar depois" dizia "libere em lote", e lote nao existe: cada laudo e revisado e
  // assinado um por um. O medico organiza o dia contando com o que a tela promete.
  // Se um dia o lote for construido de verdade, este teste cai junto — de proposito.
  const btArquivo = document.querySelector('#telaExames .opt.modo[data-modo="arquivo"]');
  diz('o modo "arquivar para depois" existe na tela', !!btArquivo);
  const txtArquivo = btArquivo ? btArquivo.innerText : '';
  diz('e NAO promete liberar em lote, que o programa nao faz',
    txtArquivo.toLowerCase().indexOf('lote') < 0, txtArquivo.replace(/\\s+/g, ' ').trim());
  diz('mas diz para onde ir depois', txtArquivo.indexOf('Liberar laudos') >= 0);

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
