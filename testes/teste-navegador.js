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
  // A lista VEM DO APP (window.__TELAS_CHEIAS). Antes era uma copia escrita aqui — e copia
  // nao vigia nada: ela envelhece junto e as duas divergem em silencio. Em 22/08 uma tela
  // nova entrou na lista do app e este teste continuou reclamando, porque olhava a propria.
  // Se a lista sumir do app, o fallback vazio derruba o teste — que e o certo.
  const TELAS = window.__TELAS_CHEIAS || [];
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

  // ---- REABRIR LAUDO ANTIGO: a reconstrução do desenho guardado (21/08/2026) ----
  // Aqui, e não numa suíte de bancada, porque hisLaudoDoHtml PRECISA de DOM de verdade: ela
  // desmonta o HTML já desenhado do histórico de volta em campos. Desmontar errado entrega
  // ao médico um laudo com pedaços trocados, para ele assinar.
  const desenhoGuardado =
    '<div class="laudoCab"><div>Nome do Paciente:MARIA DE SOUZA<br><b>Idade:</b> 49 anos<br>' +
    '<b>Realizado em:</b> 19/08/2026<br><b>Dados Clínicos:</b> rastreamento</div></div>' +
    '<div class="laudoCorpoBox"><div class="laudoTitulo">RELATÓRIO ULTRASSONOGRÁFICO DE MAMAS</div>' +
    '<div class="laudoTexto">Exame realizado com transdutor linear.<br><br><b><u>DESCRIÇÃO:</u></b><br><br>' +
    '<b>MAMA DIREITA</b><br>Pele sem alterações.<br>Notou-se nódulo às 10 h.<br><br>' +
    '<b>CONCLUSÃO: Nódulo sólido na mama direita.<br>Categoria: BI-RADS 3.</b>' +
    '<br><br><span style="font-size:11px">A ultrassonografia não substitui a mamografia.</span>' +
    '</div></div>';
  diz('hisLaudoDoHtml existe na pagina', typeof hisLaudoDoHtml === 'function');
  const LR = (typeof hisLaudoDoHtml === 'function') ? hisLaudoDoHtml(desenhoGuardado) : null;
  diz('o desenho guardado e reconhecido', !!LR);
  if (LR) {
    diz('titulo volta inteiro', /RELAT.RIO ULTRASSONOGR.FICO DE MAMAS/.test(LR.titulo), LR.titulo);
    diz('tecnica sai limpa, sem o rotulo DESCRICAO',
      /transdutor linear/.test(LR.tecnica) && LR.tecnica.indexOf('DESCRI') < 0, LR.tecnica.slice(0, 46));
    diz('corpo traz os achados', /MAMA DIREITA/.test(LR.corpo) && /n.dulo .s 10 h/.test(LR.corpo));
    diz('e o corpo NAO engole a conclusao', LR.corpo.indexOf('CONCLUS') < 0);
    diz('conclusao sai separada', /N.dulo s.lido na mama direita/.test(LR.conclusao), LR.conclusao.slice(0, 46));
    diz('com a categoria dentro dela', /BI-RADS 3/.test(LR.conclusao));
    diz('as ressalvas do fim viram extra', /n.o substitui a mamografia/.test(LR.extra));
    diz('e NAO ficam grudadas no fim da conclusao', !/substitui a mamografia/.test(LR.conclusao));
    diz('cabecalho: idade', LR.cab.idade === '49 anos', LR.cab.idade);
    diz('cabecalho: data do exame', /19.08.2026/.test(LR.cab.realizado_em), LR.cab.realizado_em);
    diz('as quebras do desenho viram quebras de verdade', LR.corpo.indexOf(String.fromCharCode(10)) >= 0);
  }
  // E RECUSA o que nao reconhece: devolver meio laudo para assinar e pior que nao reabrir.
  diz('HTML que nao e laudo: recusa', hisLaudoDoHtml('<div>qualquer coisa</div>') === null);
  diz('vazio: recusa', hisLaudoDoHtml('') === null);
  diz('caixa presente mas vazia: recusa, em vez de devolver laudo em branco',
    hisLaudoDoHtml('<div class="laudoTexto"></div>') === null);
  // o desenho NOVO (26/08, noite): conclusao + texto final embrulhados num bloco so
  // (.laudoFecho) e o texto final com classe (.laudoExtra) em vez de style cravado
  const desenhoNovo = desenhoGuardado
    .replace('<b>CONCLUSÃO:', '<div class="laudoFecho"><b>CONCLUSÃO:')
    .replace('<span style="font-size:11px">', '<span class="laudoExtra">')
    .replace('</span>', '</span></div>');
  const LN = hisLaudoDoHtml(desenhoNovo);
  diz('o desenho novo (bloco conclusao+texto final) tambem e reconhecido', !!LN);
  if (LN) {
    diz('conclusao sai separada tambem no desenho novo',
      /N.dulo s.lido/.test(LN.conclusao) && !/substitui a mamografia/.test(LN.conclusao));
    diz('e as ressalvas do fim viram extra tambem no desenho novo',
      /n.o substitui a mamografia/.test(LN.extra));
  }

  // ---- TELA 1: grade de modelos de laudo (22/08/2026) ----
  // Aqui, na pagina inteira, porque a contagem de textos de achado depende de VARIAS
  // constantes e funcoes conversando (BIZUS_SECOES, BIZUS_POR_TIPO, bizusParse,
  // bizusSplitRegiao). Um sandbox de bancada sem uma delas fez os 25 cartoes sairem com
  // "0 textos" e por um instante aquilo pareceu dado, nao falha.
  diz('a grade existe', typeof modCfgDados === 'function' && !!document.getElementById('mdGrade'));
  const GM = (typeof modCfgDados === 'function') ? modCfgDados() : [];
  diz('lista os modelos reais do dados.js', GM.length >= 20, GM.length + ' modelos');
  diz('e NAO inclui o pseudo-tipo "outro"', !GM.some(m => m.chave === 'outro'));
  const gMama = GM.filter(m => m.chave === 'mama')[0];
  const gTv = GM.filter(m => m.chave === 'transvaginal')[0];
  diz('mama tem sistema BI-RADS lido do CLASSIF', !!gMama && gMama.sistema === 'BI-RADS', gMama && gMama.sistema);
  diz('transvaginal tem O-RADS', !!gTv && gTv.sistema === 'O-RADS', gTv && gTv.sistema);
  diz('exame sem sistema fica sem etiqueta', GM.some(m => m.sistema === null));
  // A CONTAGEM: o defeito que este teste existe para pegar.
  diz('a contagem de textos de achado FUNCIONA (nao é 0 em todos)',
    GM.some(m => m.bizus > 0), 'mama=' + (gMama && gMama.bizus) + ' tv=' + (gTv && gTv.bizus));
  diz('e nenhuma contagem voltou nula (nula = a conta quebrou)',
    !GM.some(m => m.bizus === null));
  diz('mama tem mais de um texto de achado', !!gMama && gMama.bizus > 1, gMama && gMama.bizus);
  // Estado de auditoria: o unico dado que nao vem do dados.js
  diz('mama esta auditada (3)', !!gMama && gMama.auditoria === 3);
  diz('transvaditoria em curso (2)', !!gTv && gTv.auditoria === 2);
  diz('o resto nasce nao auditado', GM.filter(m => m.auditoria === 0).length >= 20);
  diz('auditados vem primeiro na grade', GM[0].auditoria >= GM[GM.length - 1].auditoria);
  // Desenho
  modCfgRender();
  const cards = document.querySelectorAll('#telaModelos .card');
  diz('a grade desenha um cartao por modelo, mais o "Novo modelo"',
    cards.length === GM.length + 1, cards.length + ' cartoes');
  diz('o ultimo cartao e o de criar', document.querySelector('#telaModelos .card.new') !== null);
  diz('cada cartao traz o setor de auditoria', document.querySelectorAll('#telaModelos .sector').length >= GM.length);
  const faixasMama = document.querySelectorAll('#telaModelos .card .sector .band.on');
  diz('e ha faixas preenchidas (o estado e visivel)', faixasMama.length > 0, faixasMama.length + ' faixas');
  diz('a contagem do topo bate', document.getElementById('mdConta').textContent.indexOf(String(GM.length)) === 0);
  // Regra de cor: status em cinza, nunca colorido
  const corBanda = getComputedStyle(document.querySelector('#telaModelos .sector .band.on')).stroke;
  diz('o estado de auditoria e CINZA, nao colorido', /60, ?76, ?90|#3C4C5A/i.test(corBanda), corBanda);

  // ---- A TELA E A DE CONFIGURACOES INTEIRA, nao um pedaco pendurado no painel antigo ----
  // O medico clicou em Configuracoes e caiu na tela velha: a grade estava atras de um botao
  // no meio do painel antigo. No desenho dele, Configuracoes E esta tela.
  diz('o botao Configuracoes abre a tela nova',
    /onclick="modCfgAbrir\(\)"/.test(document.body.innerHTML)
    || document.querySelectorAll('[onclick*="modCfgAbrir"]').length > 0);
  diz('nenhum botao de Configuracoes abre direto o painel antigo',
    document.querySelectorAll('[onclick="alternarConfig()"]').length === 0);
  diz('a tela tem barra lateral de navegacao', !!document.querySelector('#telaModelos .nav'));
  const navItens = document.querySelectorAll('#telaModelos .nav-item');
  diz('com os itens do desenho', navItens.length >= 9, navItens.length + ' itens');
  diz('e "Modelos de laudo" comeca selecionado',
    document.querySelector('#telaModelos .nav-item[data-pane="modelos"]').getAttribute('aria-current') === 'true');
  // O que ainda nao migrou DIZ que nao migrou, antes do clique.
  // 29/08/2026: era "antigas.length >= 5" — numero magico que envelhecia a cada tela
  // migrada (o Provedor de IA ganhou tela propria e derrubou o teste, sem nada quebrado).
  // A regra que NAO envelhece: leva etiqueta exatamente quem ainda cai no painel antigo.
  const comEtiqueta = Array.prototype.map.call(
    document.querySelectorAll('#telaModelos .nav-item'),
    b => b.querySelector('.antiga') ? b.getAttribute('data-pane') : null).filter(Boolean).sort();
  // 29/08 (2a leva): TODOS os itens migraram, MOD_PANE_ANCORA esvaziou. Sobrou etiqueta
  // so no item "Painel antigo", que e a saida de emergencia — e ele DIZ que e a antiga.
  const vaoProAntigo = Object.keys(MOD_PANE_ANCORA).concat(['antigo']).sort();
  diz('quem leva ao painel antigo avisa no proprio rotulo — e so quem leva',
    JSON.stringify(comEtiqueta) === JSON.stringify(vaoProAntigo),
    'etiqueta: [' + comEtiqueta + '] · painel antigo: [' + vaoProAntigo + ']');
  // e quem JA tem tela propria nao pode mentir dizendo "tela antiga"
  diz('os que tem tela propria nao levam etiqueta',
    Object.keys(MOD_PANES).every(p => {
      const b = document.querySelector('#telaModelos .nav-item[data-pane="' + p + '"]');
      return !b || !b.querySelector('.antiga');
    }), Object.keys(MOD_PANES).join(','));
  // E os ajustes de verdade continuam alcancaveis: cada ancora existe
  diz('cada item da navegacao aponta para algo que EXISTE',
    Object.keys(MOD_PANE_ANCORA).every(k => !!document.getElementById(MOD_PANE_ANCORA[k])),
    Object.keys(MOD_PANE_ANCORA).join(',') || '(nenhum: todos migraram)');

  // ---- AS TELAS MIGRADAS (29/08, 2a leva): o controle de VERDADE chega no painel ----
  // O risco de mover no e o no nao chegar — e ai o ajuste some da tela sem avisar.
  [['ditado', ['cfgAgenteLocal', 'btnReiniciarAgente']],
   ['impressao', ['cfgImpAuto', 'cfgImpSeparadas', 'cfgImpLaudo']],
   ['revisao', ['cfgPaciente', 'listaRegras', 'biopsiaLista']],
   ['assinatura', ['cfgMedico', 'cfgCrm', 'assPrev']],
   ['backup', ['cfgBackupPasta', 'backupEstado']]].forEach(([pane, ids]) => {
    modCfgIr(pane);
    const p = document.getElementById(MOD_PANES[pane]);
    const visivel = getComputedStyle(p).display !== 'none';
    const dentro = ids.filter(id => { const e = document.getElementById(id); return e && p.contains(e); });
    diz('"' + pane + '" abre em painel proprio com os controles de verdade dentro',
      visivel && dentro.length === ids.length, dentro.length + ' de ' + ids.length);
  });
  // e salvar pela tela nova chega no cfg (assinatura e o unico com campos do salvarConfig)
  modCfgIr('assinatura');
  const _med = cfg.medico, _crm = cfg.crm;
  const gravouAss = []; const _ds2 = window.dadoSalvar;
  window.dadoSalvar = (ch, v) => { gravouAss.push(ch + '=' + v); return true; };
  document.getElementById('cfgMedico').value = 'Dr. Teste Config';
  cfgSalvarSimples('assinatura');
  window.dadoSalvar = _ds2;
  diz('salvar na tela de assinatura chega no cfg e no disco',
    cfg.medico === 'Dr. Teste Config' && gravouAss.indexOf('gmedico=Dr. Teste Config') >= 0,
    gravouAss.filter(g => /gmedico/.test(g)).join(' '));
  cfg.medico = _med; cfg.crm = _crm;
  document.getElementById('cfgMedico').value = _med || '';
  modCfgIr('modelos');
  diz('o painel antigo continua no DOM (os ajustes de verdade vivem la)',
    !!document.getElementById('cardConfig'));

  // ---- PROVEDOR DE IA: TELA PROPRIA, MESMO SALVAR (29/08, pedido dele) ----
  // O risco desta tela e ter DOIS caminhos de gravacao: o novo e o antigo divergirem
  // e a chave/modelo cobrado virarem loteria. Aqui a prova de que e um caminho so.
  modCfgIr('ia');
  diz('o Provedor de IA abre painel proprio, sem cair no painel antigo',
    getComputedStyle(document.getElementById('paneIa')).display !== 'none'
    && getComputedStyle(document.getElementById('paneModelos')).display === 'none');
  document.getElementById('cfgModelo').value = 'gpt-5.5';
  document.getElementById('cfgModeloAux').value = 'gpt-5.5';
  modCfgIr('ia');   // re-render: a tela le dos campos antigos
  diz('a tela nasce com o que ja estava configurado',
    document.getElementById('iaNvModelo').value === 'gpt-5.5'
    && document.getElementById('iaNvAux').value === 'gpt-5.5');
  diz('e acende o aviso quando as tarefas simples usam o modelo caro',
    getComputedStyle(document.getElementById('iaAvisoCusto')).display !== 'none');
  // salvar pela tela nova tem de chegar no campo ANTIGO e no cfg
  const gravou = [];
  const _ds = window.dadoSalvar;
  window.dadoSalvar = (ch, v) => { gravou.push(ch + '=' + v); return true; };
  document.getElementById('iaNvAux').value = 'modelo-barato-teste';
  iaCfgSalvar();
  window.dadoSalvar = _ds;
  diz('salvar pela tela nova escreve no campo antigo',
    document.getElementById('cfgModeloAux').value === 'modelo-barato-teste');
  diz('e chega no cfg e no disco pelo caminho de sempre',
    cfg.modeloAux === 'modelo-barato-teste' && gravou.indexOf('gmodaux=modelo-barato-teste') >= 0,
    gravou.filter(g => /gmodaux/.test(g)).join(' '));
  diz('e o aviso apaga sozinho quando o auxiliar difere',
    getComputedStyle(document.getElementById('iaAvisoCusto')).display === 'none');
  diz('a chave nunca e reexibida na tela', document.getElementById('iaNvChave').value === '');
  modCfgIr('modelos');
  // A legenda do setor
  diz('a legenda do setor existe', !!document.getElementById('mdLeg0'));
  modCfgRender();
  diz('e e desenhada com o MESMO setor dos cartoes',
    document.querySelectorAll('#telaModelos .legend .sector').length === 3);
  diz('com os tres estados nomeados',
    /Nao auditado|Não auditado/.test(document.getElementById('mdLeg0').textContent)
    && /fonte prim/.test(document.getElementById('mdLeg2').textContent));
  // Voltar nao pode abrir o painel antigo por baixo
  const fecharSrc = String(modCfgFechar);
  diz('"Voltar ao programa" so fecha, nao abre o painel antigo',
    fecharSrc.indexOf('alternarConfig') < 0);
  diz('e existe funcao separada para quando a navegacao PRECISA do painel antigo',
    typeof modCfgAbrirAntigo === 'function' && String(modCfgAbrirAntigo).indexOf('cardConfig') > 0);

  // ---- O CARTAO ABRE O MODELO (25/08/2026) ----
  // O medico clicou num modelo de laudo e nao aconteceu nada util: so um aviso de "tela em
  // construcao". Um clique que nao faz nada e indistinguivel de programa quebrado.
  // Este bloco CLICA no cartao de verdade, em vez de chamar a funcao por dentro: era
  // justamente a LIGACAO entre o cartao e o editor que estava faltando.
  const mdSalvo = localStorage.getItem('gmodelos');
  const mdConfirmOrig = window.confirm;
  window.confirm = () => true;
  try {
    modCfgRender();
    const cartaoMama = Array.prototype.filter.call(
      document.querySelectorAll('#mdGrade .card'),
      c => (c.getAttribute('onclick') || '').indexOf("modCfgAbrirModelo('mama')") >= 0)[0];
    diz('o cartao do modelo chama o editor', !!cartaoMama);
    diz('e o cartao nao responde mais com "tela em construcao"',
      String(modCfgAbrirModelo).indexOf('sendo constru') < 0);
    if (cartaoMama) cartaoMama.click();
    const mdHost = document.getElementById('mdHost');
    diz('existe a caixa que hospeda o editor, embaixo da grade', !!mdHost);
    const caixa = mdHost && mdHost.querySelector('.modeloBox');
    diz('clicar no cartao ABRE o modelo', !!caixa);
    diz('e abre o modelo certo', !!caixa && caixa.getAttribute('data-key') === 'mama',
      caixa && caixa.getAttribute('data-key'));
    // Os campos trazem o texto REAL do dados.js, nao um exemplo de tela
    const corpoEl = caixa && caixa.querySelector('.mdCorpo');
    diz('o corpo vem do modelo de verdade, nao de exemplo',
      !!corpoEl && corpoEl.value === MODELOS.mama.corpo);
    diz('e os cinco campos do modelo estao na tela',
      !!caixa && ['mdNome','mdTitulo','mdTecnica','mdCorpo','mdConclusao'].every(c => !!caixa.querySelector('.' + c)));
    // A OPCAO DE EDITAR — foi exatamente isto que ele pediu.
    diz('abre TRAVADO (um toque no cartao nao pode virar letra perdida no laudo)',
      !!caixa && caixa.getAttribute('data-locked') === '1' && corpoEl.readOnly === true);
    const btEditar = caixa && Array.prototype.filter.call(caixa.querySelectorAll('button'),
      b => (b.getAttribute('onclick') || '').indexOf('editarModeloBox') >= 0)[0];
    diz('mas com a OPCAO DE EDITAR a vista', !!btEditar && /Editar/.test(btEditar.textContent));
    if (btEditar) btEditar.click();
    diz('e o botao destrava de verdade',
      !!corpoEl && corpoEl.readOnly === false && caixa.getAttribute('data-locked') === '0');
    // O X do editor antigo apaga o modelo da lista. Numa caixa so, seria armadilha.
    diz('o X de remover NAO vem junto (aqui ele apagaria o modelo)',
      !!caixa && caixa.querySelectorAll('[onclick^="removerModeloBox"]').length === 0);
    diz('e os tres botoes de acao estao la',
      !!mdHost && ['modCfgSalvarModelo','modCfgRestaurarModelo','modCfgFecharModelo']
        .every(f => mdHost.querySelectorAll('[onclick^="' + f + '"]').length > 0));
    // SALVAR: o teste que mais importa. Salvar UM modelo nao pode apagar os outros — a
    // caixa aberta e uma so, e gravar "o que esta na tela" varreria os outros 24.
    const quantosAntes = Object.keys(MODELOS).length;
    const abdomAntes = MODELOS.abdominal && MODELOS.abdominal.corpo;
    corpoEl.value = 'CORPO DE TESTE 25/08';
    modCfgSalvarModelo();
    diz('salvar guarda o texto novo', MODELOS.mama.corpo === 'CORPO DE TESTE 25/08');
    diz('e NAO apaga os outros modelos', Object.keys(MODELOS).length === quantosAntes,
      Object.keys(MODELOS).length + ' de ' + quantosAntes);
    const guardado = JSON.parse(localStorage.getItem('gmodelos') || '{}');
    diz('o que foi para o disco tem o conjunto INTEIRO, nao so o editado',
      Object.keys(guardado).length === quantosAntes, Object.keys(guardado).length + ' modelos');
    diz('com o texto editado dentro', !!guardado.mama && guardado.mama.corpo === 'CORPO DE TESTE 25/08');
    diz('e com o modelo vizinho intacto', !!guardado.abdominal && guardado.abdominal.corpo === abdomAntes);
    diz('a grade se redesenha depois de salvar (a contagem nao fica velha)',
      document.querySelectorAll('#mdGrade .card').length === quantosAntes,
      document.querySelectorAll('#mdGrade .card').length + ' cartoes');
    diz('e o modelo continua aberto para conferir o que ficou salvo',
      !!mdHost.querySelector('.modeloBox[data-key="mama"]'));
    // RESTAURAR: so este modelo volta ao original, os vizinhos ficam como estao
    modCfgRestaurarModelo();
    diz('restaurar devolve o texto original do programa',
      MODELOS.mama.corpo === MODELOS_PADRAO.mama.corpo);
    diz('e continua sem mexer nos vizinhos',
      Object.keys(MODELOS).length === quantosAntes && MODELOS.abdominal.corpo === abdomAntes);
    // FECHAR
    modCfgFecharModelo();
    diz('fechar limpa a caixa', !mdHost.querySelector('.modeloBox'));
    // E reabrir Configuracoes comeca na lista, nao dentro do ultimo modelo aberto
    modCfgAbrirModelo('mama');
    modCfgAbrir();
    diz('reabrir Configuracoes comeca na grade, nao dentro do ultimo modelo',
      !document.getElementById('mdHost').querySelector('.modeloBox'));
  } finally {
    // Devolve tudo como estava: este bloco escreve em MODELOS e no localStorage de verdade,
    // e as suites seguintes rodam na MESMA pagina.
    window.confirm = mdConfirmOrig;
    try { if (mdSalvo === null) localStorage.removeItem('gmodelos'); else localStorage.setItem('gmodelos', mdSalvo); } catch (e) {}
    Object.keys(MODELOS).forEach(k => { delete MODELOS[k]; });
    Object.assign(MODELOS, JSON.parse(JSON.stringify(MODELOS_PADRAO)));
    try { modCfgFecharModelo(); modCfgFechar(); } catch (e) {}
  }

  // ---- EXAME DE OUTRO DIA NAO E EXAME DE AGORA (23/08/2026) ----
  // A espera capturava qualquer estudo que chegasse, sem olhar a data. Um exame da semana
  // passada, empurrado do aparelho agora, virava exame de hoje: laudo com a data errada e
  // ditado casado pelo relogio da sala.
  const hoje = new Date();
  const aaaammdd = d => String(d.getFullYear()) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  const ontem = new Date(hoje.getTime() - 86400000);
  const amanha = new Date(hoje.getTime() + 86400000);
  diz('exame de HOJE nao e desviado', estudoDeOutroDia({ imgData: aaaammdd(hoje) }) === false, aaaammdd(hoje));
  diz('exame de ONTEM e reconhecido como de outro dia', estudoDeOutroDia({ imgData: aaaammdd(ontem) }) === true);
  diz('exame com data no FUTURO nao e desviado (relogio do aparelho adiantado)',
    estudoDeOutroDia({ imgData: aaaammdd(amanha) }) === false);
  diz('sem data legivel, NAO se decide nada — segue o caminho de sempre',
    estudoDeOutroDia({}) === false && estudoDeOutroDia({ imgData: 'xx' }) === false);
  // reserva: quando o campo cru do DICOM nao veio, le a data em texto
  const d1 = new Date(hoje.getTime() - 7 * 86400000);
  const txtBr = ('0' + d1.getDate()).slice(-2) + '/' + ('0' + (d1.getMonth() + 1)).slice(-2) + '/' + d1.getFullYear();
  diz('e a data em texto serve de reserva', estudoDeOutroDia({ data: txtBr }) === true, txtBr);
  // O desvio acontece ANTES de virar exame ao vivo
  const varrer = String(capOrtVarrer);
  diz('o desvio roda ANTES do capOrtProcessar (senao ja teria virado exame de hoje)',
    varrer.indexOf('estudoDeOutroDia') < varrer.indexOf('await capOrtProcessar'));
  diz('e o exame desviado NAO e descartado em silencio: e anunciado',
    varrer.indexOf('capAntigoOferecer') > 0 && typeof capAntigoOferecer === 'function');
  const levar = String(capAntigoLevar);
  diz('o atalho baixa as imagens DO APARELHO', levar.indexOf('dicomBaixarImagem') > 0);
  diz('e as poe na tela de exames antigos ja importadas',
    levar.indexOf('dicomProntos.push') > 0 && levar.indexOf('antAbrir()') > 0);
  diz('sem imagem nenhuma, avisa em vez de abrir a tela vazia', levar.indexOf('!imagens.length') > 0);

  // ---- PAGINACAO DA TELA (25/08/2026) ----
  // O medico mostrou o laudo ATRAVESSANDO a mascara do timbrado na tela: a folha era uma
  // so e crescia, a mascara esticava junto, e "pagina 2" nao existia. Este bloco monta um
  // laudo LONGO com timbrado, pagina, e mede LINHA A LINHA que nada invade o rodape de
  // uma folha nem o cabecalho da seguinte — tres vezes seguidas, porque a repaginacao
  // ja quebrou uma vez (nos de texto divididos perdiam o ponto de paragrafo).
  const pgFundoAntes = window.__fundo, pgPergAntes = window.__fundoPerguntado;
  try {
    window.__fundo = 'labita'; window.__fundoPerguntado = true;
    const pgCorpo = (MODELOS.abdominal.corpo + '\\n\\n') + (MODELOS.abdominal.corpo + '\\n\\n') + MODELOS.abdominal.corpo;
    exames.push({ id: 9901, tipo: 'abdominal', paciente: 'Teste Paginacao',
      laudo: { cab: { nome: 'Teste Paginacao', idade: '48', realizado_em: '25/08/2026', dados_clinicos: '' },
               titulo: MODELOS.abdominal.titulo, tecnica: MODELOS.abdominal.tecnica,
               corpo: pgCorpo, conclusao: 'Exame ecográfico compatível com a normalidade.', obs: '' } });
    abrirRevisao(9901);
    document.querySelector('main').style.display = '';
    document.getElementById('telaRevisao').style.display = 'block';
    const pgFolha = document.querySelector('#areaImpressao .laudoFolha');
    diz('a folha do laudo com timbrado existe', !!pgFolha && pgFolha.classList.contains('comFundo'));
    const pgTx = pgFolha.querySelector('.laudoTexto');
    const pgAntes = pgTx.textContent;
    const medir = () => {
      paginarLaudoTela();
      const pxmm = pgFolha.clientWidth / 210, pageH = 297 * pxmm;
      const cs = getComputedStyle(pgFolha);
      const topPx = parseFloat(cs.paddingTop), botPx = parseFloat(cs.paddingBottom);
      const fr = pgFolha.getBoundingClientRect();
      let cruza = 0, linhas = 0;
      const w = document.createTreeWalker(pgFolha, NodeFilter.SHOW_TEXT, null);
      let nn;
      while ((nn = w.nextNode())) {
        if (!nn.textContent.trim()) continue;
        const rr = document.createRange(); rr.selectNodeContents(nn);
        const rects = rr.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          if (rects[i].height < 2 || rects[i].width < 1) continue;
          linhas++;
          const t = rects[i].top - fr.top, b = rects[i].bottom - fr.top;
          const pag = Math.floor((t + b) / 2 / pageH);
          if (b > (pag + 1) * pageH - botPx + 2) cruza++;
          if (pag > 0 && t < pag * pageH + topPx - 2) cruza++;
        }
      }
      const paginas = Math.round(pgFolha.clientHeight / pageH);
      return { paginas, cruza, linhas,
               esp: pgFolha.querySelectorAll('.quebraFolha').length,
               masc: pgFolha.querySelectorAll('.fundoFolhaTela').length,
               mult: Math.abs(pgFolha.clientHeight - paginas * pageH) < 4 };
    };
    const m1 = medir(), m2 = medir(), m3 = medir();
    diz('o laudo longo vira MAIS DE UMA folha', m1.paginas >= 2, m1.paginas + ' folhas');
    diz('nenhuma linha de texto invade rodape ou cabecalho da mascara',
      m1.cruza === 0 && m1.linhas > 50, m1.linhas + ' linhas, ' + m1.cruza + ' invasoes');
    diz('ha vaos de quebra entre as folhas', m1.esp > 0, m1.esp + ' vaos');
    diz('a mascara aparece uma vez POR folha', m1.masc === m1.paginas - 1,
      m1.masc + ' extras para ' + m1.paginas + ' folhas');
    diz('a folha fecha em multiplos exatos de pagina', m1.mult);
    diz('REPAGINAR nao degrada (2a e 3a rodadas identicas)',
      m2.paginas === m1.paginas && m3.paginas === m1.paginas
      && m2.cruza === 0 && m3.cruza === 0 && m3.esp === m1.esp,
      'r2=' + m2.paginas + 'p/' + m2.esp + 'v r3=' + m3.paginas + 'p/' + m3.esp + 'v');
    const pgDepois = (() => { const c = pgTx.cloneNode(true);
      c.querySelectorAll('.quebraFolha').forEach(x => x.remove()); return c.textContent; })();
    diz('o CONTEUDO do laudo nao muda um caractere com a paginacao', pgAntes === pgDepois);
    // 25/08 (2a leva): os VAOS viajam com o laudo — no papel eles SAO as quebras de
    // pagina (a tela e o papel tem as mesmas medidas). So as mascaras repetidas ficam.
    diz('o que se salva leva os vaos (as quebras do papel) e nenhuma mascara extra',
      /quebraFolha/.test(folhaHtmlLimpo()) && !/fundoFolhaTela/.test(folhaHtmlLimpo()));
    diz('a foto da impressora e a propria tela (vaos sim, mascaras nao)',
      /quebraFolha/.test((impHtmlDoLaudo() || {}).html || '')
      && !/fundoFolhaTela|fundoLaudo/.test((impHtmlDoLaudo() || {}).html || ''));
    diz('e o pacote pede alinhamento pela borda fisica, com margens NA foto',
      (impHtmlDoLaudo() || {}).alinhar === true && (impHtmlDoLaudo() || {}).topoMm === 0);
    diz('o texto lido para o aprendizado nao ganha linhas fantasmas',
      !/\\n{4,}/.test(textoEditadoLaudo(true)));
    // ---- ASSINATURA NO PE DA ULTIMA FOLHA (pedido do medico, 25/08) ----
    // "A assinatura precisa obrigatoriamente estar na parte inferior da ultima folha."
    // E quando ela sobraria sozinha numa folha, o laudo inteiro aperta um degrau de
    // entrelinha/letra — MESMO padrao do inicio ao fim — ate ela voltar para a folha
    // do texto. Assinatura e rodape sao um bloco: separados, o rodape virava a orfa.
    const pgMede = () => {
      const f = document.querySelector('#areaImpressao .laudoFolha');
      const mm = f.clientWidth / 210, ph = 297 * mm;
      const c2 = getComputedStyle(f);
      const bot = parseFloat(c2.paddingBottom);
      const fr2 = f.getBoundingClientRect();
      const asn = f.querySelector('.assin'), rd = f.querySelector('.rodapeLaudo'),
            bx = f.querySelector('.laudoCorpoBox');
      const fimC = bx.getBoundingClientRect().bottom - fr2.top;
      const iniA = asn.getBoundingClientRect().top - fr2.top;
      const basR = rd.getBoundingClientRect().bottom - fr2.top;
      const pC = Math.floor((fimC - 2) / ph), pA = Math.floor((iniA + 2) / ph),
            pR = Math.floor((basR - 2) / ph);
      return { pags: Math.round(f.clientHeight / ph), nivel: f.getAttribute('data-nivel'),
               juntos: pA === pR, orfa: pA > pC,
               naBase: Math.abs(((pA + 1) * ph - bot) - basR) < 4 };
    };
    const mLongo = pgMede();
    diz('assinatura e rodape na MESMA folha', mLongo.juntos);
    diz('a assinatura NUNCA fica numa folha sem texto', !mLongo.orfa);
    diz('e ancora exatamente no pe da ultima folha', mLongo.naBase);
    // o cenario que forca a ESCADA: texto terminando rente ao fim da folha
    let pgLinhas = '';
    for (let li = 0; li < 8; li++) pgLinhas += 'Linha de ajuste fino do comprimento do laudo, numero ' + (li + 1) + ', escrita para empurrar o texto ate muito perto do fim da folha.\\n\\n';
    exames.push({ id: 9903, tipo: 'abdominal', paciente: 'Teste Escada',
      laudo: { cab: { nome: 'Teste Escada' }, titulo: MODELOS.abdominal.titulo,
               tecnica: MODELOS.abdominal.tecnica,
               corpo: (MODELOS.abdominal.corpo + '\\n\\n') + MODELOS.abdominal.corpo + '\\n\\n' + pgLinhas,
               conclusao: 'Exame ecográfico compatível com a normalidade.', obs: '' } });
    abrirRevisao(9903);
    paginarLaudoTela();
    const mRente = pgMede();
    diz('texto rente ao fim da folha: a ESCADA aperta a entrelinha (nivel ' + mRente.nivel + ')',
      +mRente.nivel > 0);
    diz('e a assinatura volta para a folha do texto, no pe dela',
      !mRente.orfa && mRente.naBase && mRente.juntos);
    const pgFolhaR = document.querySelector('#areaImpressao .laudoFolha');
    diz('a compactacao e UNIFORME: a entrelinha e da folha inteira (herdada)',
      getComputedStyle(pgFolhaR.querySelector('.laudoTexto')).lineHeight ===
      getComputedStyle(pgFolhaR).lineHeight);

    // ---- O LAUDO DE MAMA SAI SEM DESENHO POR PADRAO (27/08, pedido dele) ----
    // "vamos remover as imagens como padrao dos laudos de mama temporariamente ate a
    // gente conseguir ajustar". O interruptor e MAMA_DESENHOS; o desenho em si continua
    // inteiro, e as verificacoes dele (logo abaixo) ligam o interruptor de proposito.
    diz('o interruptor dos desenhos da mama nasce DESLIGADO', MAMA_DESENHOS === false, MAMA_DESENHOS);

    // ---- O DESENHO DA MAMA SE DIVIDE ENTRE AS FOLHAS (pedido do medico, 25/08) ----
    // A partir daqui o interruptor fica LIGADO: estas verificacoes existem para o dia em
    // que os desenhos voltarem, e ficariam verdes a toa se rodassem com eles desligados.
    MAMA_DESENHOS = true;
    // O laudo REAL dele gastava TRES folhas: o desenho das duas mamas era um bloco so,
    // nao cabia no fim da folha 1 e pulava inteiro, deixando meia folha em branco; a
    // terceira folha ficava quase vazia. Ele desenhou a solucao: uma mama fecha a folha 1,
    // a outra abre a folha 2, com a conclusao e a assinatura embaixo. Dois motivos passam
    // a apertar a entrelinha: assinatura orfa OU folha desperdicada.
    const NL = String.fromCharCode(10);
    const BUL = String.fromCharCode(8226);   // o bullet dos cistos, sem escape (ver a armadilha das crases)
    const mamaCorpo = [
      '**MAMA DIREITA**', '**DESCRICAO:**', '',
      'Mama simetrica.',
      'Pele e tecido celular subcutaneo sem alteracoes.',
      'Mamilo e areola sem alteracoes.',
      'Parenquima mamario com ecogenicidade habitual de padrao heterogeneo, apresentando formacao cistica simples, anecoica, de contornos regulares e reforco acustico posterior, localizada as 9 h, distando 3 cm da papila, medindo 6,1 x 3,6 mm.',
      'Tecido retro-mamario sem dilatacao ductal.',
      'Regiao axilar livre.', '',
      '**MAMA ESQUERDA**', '**DESCRICAO:**', '',
      'Mama simetrica.',
      'Pele e tecido celular subcutaneo sem alteracoes.',
      'Mamilo e areola sem alteracoes.',
      'Parenquima mamario com ecogenicidade habitual de padrao heterogeneo, apresentando imagem nodular solida, de forma oval, orientacao paralela a pele e margens circunscritas, localizada as 3 h, distando 4 cm da papila, medindo 4,0 x 4,4 mm.',
      'Tecido retro-mamario sem dilatacao ductal.',
      'Regiao axilar livre.'
    ].concat(Array.from({length: 6}, (_, i) =>
      '' + NL + 'Observacao complementar numero ' + (i + 1) + ' do exame, escrita para o laudo alcancar o comprimento em que a folha extra aparecia.')).join(NL);
    exames.push({ id: 9904, tipo: 'mama', paciente: 'Teste Esquema', imagens: [], audios: [],
      laudo: { cab: { nome: 'Teste Esquema', idade: '48', realizado_em: '25/08/2026' },
               titulo: 'RELATORIO ULTRASSONOGRAFICO MAMA', tecnica: MODELOS.mama.tecnica,
               corpo: mamaCorpo,
               conclusao: 'Exame ecografico compativel com cisto simples na mama direita e nodulo mamario na esquerda.',
               obs: '',
               _classifBruto: { birads: [
                 { localizacao: 'mama direita, as 9 h', caso_especial: 'cistoSimples' },
                 { localizacao: 'mama esquerda, as 3 h', forma: 'oval', orientacao: 'paralela',
                   margem: 'circ', eco: 'hipoecoico', posterior: 'nenhum' } ] } } });
    abrirRevisao(9904);
    paginarLaudoTela();
    const fE = document.querySelector('#areaImpressao .laudoFolha');
    const cards = fE.querySelectorAll('#mamaEsqBox .mamaEsq');
    diz('o desenho vem em UM CARTAO POR MAMA, nao num bloco so',
      cards.length === 2, cards.length + ' cartoes');
    diz('e cada cartao leva a legenda da SUA mama',
      cards.length === 2
      && /direita/i.test(cards[0].textContent) && !/esquerda/i.test(cards[0].textContent)
      && /esquerda/i.test(cards[1].textContent) && !/direita/i.test(cards[1].textContent));
    diz('com a ressalva de escala em cada um (folha sem ressalva engana)',
      cards.length === 2 && [].every.call(cards, c => /esquem[aá]tica/i.test(c.textContent)));
    const medE = () => {
      const mm = fE.clientWidth / 210, ph = 297 * mm, c2 = getComputedStyle(fE);
      const tp = parseFloat(c2.paddingTop), bt = parseFloat(c2.paddingBottom), ut = ph - tp - bt;
      const fr2 = fE.getBoundingClientRect();
      const pg = el => Math.floor(((el.getBoundingClientRect().top - fr2.top) + 2) / ph);
      const rd = fE.querySelector('.rodapeLaudo'), asn = fE.querySelector('.assin'),
            tx2 = fE.querySelector('.laudoTexto');
      const fim = rd.getBoundingClientRect().bottom - fr2.top;
      const pu = Math.floor((fim - 2) / ph);
      return { pags: Math.round(fE.clientHeight / ph),
               pagD: pg(cards[0]), pagE: pg(cards[1]), pagAssin: pg(asn),
               pagTxt: Math.floor(((tx2.getBoundingClientRect().bottom - fr2.top) - 2) / ph),
               naBase: Math.abs(((pu + 1) * ph - bt) - fim) < 5,
               usoUlt: (fim - (pu * ph + tp)) / ut };
    };
    const mE = medE();
    diz('o laudo que gastava TRES folhas passa a caber em DUAS', mE.pags === 2, mE.pags + ' folhas');
    // A quebra PODE cair entre as duas mamas — e isso que mata o vazio de meia folha.
    // (Em que folha cada uma cai depende do comprimento do laudo; o que se garante aqui
    // e que a paginacao enxerga os dois cartoes como pontos de quebra SEPARADOS.)
    const ptsE = _paginarPontos(fE.querySelector('.laudoTexto'));
    diz('a quebra pode cair ENTRE as duas mamas (um ponto por cartao)',
      [].every.call(cards, c => ptsE.some(p => p.node === c)),
      ptsE.length + ' pontos de quebra');
    diz('os dois cartoes ficam na ordem direita-esquerda',
      mE.pagD <= mE.pagE, 'D=f' + (mE.pagD + 1) + ' E=f' + (mE.pagE + 1));
    diz('a assinatura fica na folha do texto, no pe dela',
      mE.pagAssin <= mE.pagTxt && mE.naBase);
    diz('e nenhuma folha sai desperdicada', mE.usoUlt >= 0.6,
      Math.round(mE.usoUlt * 100) + '% de uso na ultima');
    diz('a compactacao, quando entra, e UNIFORME (a entrelinha e da folha inteira)',
      getComputedStyle(fE.querySelector('.laudoTexto')).lineHeight === getComputedStyle(fE).lineHeight);
    // laudo comprido de verdade: aqui a escada TEM de entrar, para nao gastar folha a toa
    exames.push({ id: 9906, tipo: 'abdominal', paciente: 'Teste Escada2', imagens: [], audios: [],
      laudo: { cab: { nome: 'Teste Escada2' }, titulo: MODELOS.abdominal.titulo,
               tecnica: MODELOS.abdominal.tecnica,
               corpo: [MODELOS.abdominal.corpo, MODELOS.abdominal.corpo, MODELOS.abdominal.corpo].join(NL + NL),
               conclusao: 'Exame ecografico compativel com a normalidade.', obs: '' } });
    abrirRevisao(9906);
    paginarLaudoTela();
    const fL = document.querySelector('#areaImpressao .laudoFolha');
    const phL = 297 * fL.clientWidth / 210;
    const csL = getComputedStyle(fL), frL = fL.getBoundingClientRect();
    const rdL = fL.querySelector('.rodapeLaudo');
    const fimL = rdL.getBoundingClientRect().bottom - frL.top;
    const puL = Math.floor((fimL - 2) / phL);
    const utL = phL - parseFloat(csL.paddingTop) - parseFloat(csL.paddingBottom);
    diz('laudo comprido: a escada aperta um degrau para nao gastar folha a toa',
      +fL.getAttribute('data-nivel') > 0, 'nivel ' + fL.getAttribute('data-nivel'));
    diz('e a ultima folha dele tambem sai aproveitada',
      (fimL - (puL * phL + parseFloat(csL.paddingTop))) / utL >= 0.6);
    // e o laudo que JA cabia nao e apertado a toa
    exames.push({ id: 9905, tipo: 'abdominal', paciente: 'Teste Curto', imagens: [], audios: [],
      laudo: { cab: { nome: 'Teste Curto' }, titulo: MODELOS.abdominal.titulo,
               tecnica: MODELOS.abdominal.tecnica, corpo: MODELOS.abdominal.corpo,
               conclusao: 'Exame ecografico compativel com a normalidade.', obs: '' } });
    abrirRevisao(9905);
    paginarLaudoTela();
    const fC = document.querySelector('#areaImpressao .laudoFolha');
    diz('laudo que cabe numa folha NAO e compactado (apertar sem ganhar folha e miudo a toa)',
      Math.round(fC.clientHeight / (297 * fC.clientWidth / 210)) === 1
      && (fC.getAttribute('data-nivel') === '0' || !fC.getAttribute('data-nivel')));

    // ---- A MOLDURA DA MAMA BILATERAL (26/08/2026, desenho do medico) ----
    // Duas mamas com desenho: folha 1 termina no cartao da DIREITA (cravado no pe),
    // folha 2 abre no da ESQUERDA, conclusao e assinatura fecham a 2. O texto se adapta
    // por dentro (so entrelinha; letra nunca menor que a padrao). Nao coube em 2 folhas:
    // plano B ditado por ele — o cartao desce e vale o fluxo. Um desenho ou nenhum: fluxo.
    const mCorpo = (fD, fE) => {
      const enc = NL + 'Tecido retro-mamario sem dilatacao ductal.' + NL + 'Regiao axilar livre.' + NL;
      return '**MAMA DIREITA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
        + 'Parenquima mamario heterogeneo, notando-se formacao cistica simples, anecoica, com reforco acustico posterior, localizada as 9 h, distando 3 cm da papila, medindo 0,6 x 0,3 x 0,4 cm.' + NL
        + (fD || '') + enc
        + NL + '**MAMA ESQUERDA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
        + 'Parenquima mamario heterogeneo, notando-se formacao cistica simples, anecoica, localizada as 3 h, distando 4 cm da papila, medindo 0,5 x 0,4 x 0,4 cm.' + NL
        + (fE || '') + enc;
    };
    const mCaso = (id, corpo, itens) => {
      exames.push({ id, tipo: 'mama', paciente: 'T' + id, imagens: [], audios: [],
        laudo: { cab: { nome: 'T' + id, idade: '48', realizado_em: '26/08/2026' },
                 titulo: 'RELATORIO ULTRASSONOGRAFICO MAMA', tecnica: MODELOS.mama.tecnica,
                 corpo, conclusao: 'Exame ecografico compativel com cistos simples.', obs: '',
                 _classifBruto: { birads: itens } } });
      abrirRevisao(id);
      paginarLaudoTela();
      const f2 = document.querySelector('#areaImpressao .laudoFolha');
      const ph2 = 297 * f2.clientWidth / 210, cs3 = getComputedStyle(f2);
      const tp2 = parseFloat(cs3.paddingTop), bp2 = parseFloat(cs3.paddingBottom);
      const fr3 = f2.getBoundingClientRect();
      const cds = f2.querySelectorAll('#mamaEsqBox .mamaEsq');
      const rd2 = f2.querySelector('.rodapeLaudo');
      const B2 = el => el ? el.getBoundingClientRect().bottom - fr3.top : null;
      const T2 = el => el ? el.getBoundingClientRect().top - fr3.top : null;
      const pg2 = Math.round(f2.clientHeight / ph2);
      // 26/08 (noite): a moldura fecha em cada folha e o texto guarda um respiro de 12px
      // (FRISO) da linha do retangulo — o cartao crava 12px acima do pe, o da esquerda
      // abre 12px abaixo do topo util
      return { mold: f2.getAttribute('data-moldura'), fonte: cs3.fontSize, pags: pg2,
               DnoPe: cds[0] ? Math.abs(B2(cds[0]) - (ph2 - bp2 - 12)) <= 3 : null,
               EnoTopo: cds[1] ? (T2(cds[1]) - (ph2 + tp2)) : null,
               assinPe: Math.abs(B2(rd2) - (pg2 * ph2 - bp2)) <= 3 };
    };
    const mIt2 = [{ localizacao: 'mama direita, as 9 h', caso_especial: 'cistoSimples' },
                  { localizacao: 'mama esquerda, as 3 h', caso_especial: 'cistoSimples' }];
    const mLin = 'Texto complementar do exame, escrito para alongar a descricao desta mama alem do habitual da clinica.' + NL;
    const mo1 = mCaso(9910, mCorpo('', ''), mIt2);
    diz('bilateral CURTO entra na moldura', mo1.mold === '1' && mo1.pags === 2, mo1.pags + ' folhas');
    diz('o cartao da direita CRAVA no pe da folha 1 (12px acima da moldura)', mo1.DnoPe === true);
    diz('o da esquerda abre a folha 2 (respiro da moldura + margem do cartao)',
      mo1.EnoTopo != null && mo1.EnoTopo >= 10 && mo1.EnoTopo <= 42, Math.round(mo1.EnoTopo) + 'px do topo util');
    diz('a letra segue a PADRAO (a 10 dele) — moldura nunca mia a letra', mo1.fonte === '13px');
    diz('conclusao e assinatura fecham a folha 2 no pe', mo1.assinPe === true);
    const mo3 = mCaso(9912, mCorpo(mLin.repeat(24), mLin.repeat(24)), mIt2);
    diz('bilateral LONGO cai no plano B dele: fluxo, sem moldura',
      mo3.mold == null && mo3.pags >= 3, mo3.pags + ' folhas');
    diz('e mesmo no fluxo a assinatura fecha a ultima folha', mo3.assinPe === true);
    const mo4 = mCaso(9913,
      '**MAMA DIREITA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
      + 'Notou-se formacao cistica simples, anecoica, localizada as 9 h, distando 3 cm da papila, medindo 0,6 x 0,3 x 0,4 cm.' + NL
      + 'Regiao axilar livre.' + NL + NL + '**MAMA ESQUERDA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL + 'Sem alteracoes.' + NL,
      [{ localizacao: 'mama direita, as 9 h', caso_especial: 'cistoSimples' }]);
    diz('UM desenho so: sem moldura, laudo de UMA folha (decisao dele, item 1)',
      mo4.mold == null && mo4.pags === 1, mo4.pags + ' folha(s)');
    diz('com a assinatura no pe dela', mo4.assinPe === true);
    exames = exames.filter(e => [9910, 9912, 9913].indexOf(e.id) < 0);
    MAMA_DESENHOS = false;   // volta ao padrao de amanha: mama sem desenho

    // ---- O LAUDO DE MAMA DE AMANHA, DE PONTA A PONTA, SEM DESENHO (27/08) ----
    // Este e o teste que ele pediu como ultimo: o laudo bilateral com cistos nos dois
    // lados, do jeito que vai sair na clinica, com os desenhos desligados.
    const mo5 = mCaso(9917,
      '**MAMA DIREITA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
      + 'Parenquima mamario heterogeneo, **notando-se formacoes cisticas simples:**' + NL
      + '**' + BUL + ' as 2 h, a 3 cm da papila, medindo 0,6 x 0,3 x 0,4 cm;**' + NL
      + '**' + BUL + ' as 8 h, a 2 cm da papila, medindo 0,6 x 0,7 x 0,4 cm.**' + NL
      + 'Regiao axilar livre.' + NL + NL
      + '**MAMA ESQUERDA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
      + 'Parenquima mamario heterogeneo, **notando-se formacoes cisticas simples:**' + NL
      + '**' + BUL + ' as 12 h, a 1 cm da papila, medindo 0,6 x 0,3 x 0,4 cm;**' + NL
      + '**' + BUL + ' as 3 h, a 2 cm da papila, medindo 1,0 x 1,1 x 0,4 cm.**' + NL
      + 'Regiao axilar livre.',
      [{ localizacao: 'mama direita, as 2 h', caso_especial: 'cistoSimples' },
       { localizacao: 'mama esquerda, as 12 h', caso_especial: 'cistoSimples' }]);
    const f5 = document.querySelector('#areaImpressao');
    diz('MAMA: nenhum desenho na folha (nem esquema, nem grafico)',
      !f5.querySelector('#mamaEsqBox') && !f5.querySelector('.mamaEvoBox'));
    diz('e o laudo fecha em UMA folha, no fluxo', mo5.pags === 1, mo5.pags + ' folha(s)');
    diz('com a assinatura no pe dela', mo5.assinPe === true);
    const t5 = f5.querySelector('.laudoTexto').innerText;
    // o cabecalho da montagem escreve DESCRICAO com acento e as do corpo do teste sao
    // sem acento de proposito (o arquivo e ASCII): por isso as duas contagens separadas
    diz('o texto clinico sai inteiro: os DOIS lados, com a moldura em cada um',
      (t5.split('DESCRICAO').length - 1) === 2, (t5.split('DESCRICAO').length - 1) + ' dos lados');
    diz('e o cabecalho DESCRICAO da montagem continua acima deles',
      t5.indexOf('MAMA DIREITA') > 0 && t5.indexOf('MAMA ESQUERDA') > t5.indexOf('MAMA DIREITA'));
    diz('e as quatro medidas continuam no laudo',
      (t5.match(/medindo/g) || []).length === 4, (t5.match(/medindo/g) || []).length);
    diz('a conclusao esta na folha', (f5.innerText || '').indexOf('CONCLUSAO') >= 0
      || (f5.innerText || '').indexOf('CONCLUS') >= 0);
    exames = exames.filter(e => e.id !== 9917);

    // ---- CONCLUSAO + TEXTO FINAL NUM BLOCO SO, E A MOLDURA FECHA POR FOLHA (26/08, noite) ----
    // Pedido dele, vindo do laudo real de Capanema: as observacoes finais nao podem se
    // separar da conclusao na virada de folha; e o retangulo preto fecha em CADA folha,
    // nunca segue de uma para a outra. A conclusao nunca desce de corpo; o texto final
    // pode (11 -> 10/9/8, EXTRA_PX).
    exames.push({ id: 9914, tipo: 'mama', paciente: 'T9914', imagens: [], audios: [],
      laudo: { cab: { nome: 'T9914', idade: '48', realizado_em: '26/08/2026' },
               titulo: 'RELATORIO ULTRASSONOGRAFICO MAMA', tecnica: MODELOS.mama.tecnica,
               corpo: mCorpo(mLin.repeat(6), mLin.repeat(6)),
               conclusao: 'Exame ecografico compativel com cistos simples bilateralmente.',
               extra: MODELOS.mama.extra, obs: '',
               _classifBruto: { birads: mIt2 } } });
    abrirRevisao(9914);
    paginarLaudoTela();
    const fF = document.querySelector('#areaImpressao .laudoFolha');
    const phF = 297 * fF.clientWidth / 210, frF = fF.getBoundingClientRect();
    const fecho = fF.querySelector('.laudoFecho');
    diz('conclusao e texto final moram num bloco so (.laudoFecho)', !!fecho);
    if (fecho) {
      const rF = fecho.getBoundingClientRect();
      const pIniF = Math.floor((rF.top - frF.top + 2) / phF), pFimF = Math.floor((rF.bottom - frF.top - 2) / phF);
      diz('e o bloco NUNCA se parte entre folhas', pIniF === pFimF, 'folhas ' + pIniF + '..' + pFimF);
      const bC = fecho.querySelector('b');
      diz('a conclusao nao desce de corpo (segue a letra do laudo)',
        !!bC && getComputedStyle(bC).fontSize === getComputedStyle(fF).fontSize,
        (bC ? getComputedStyle(bC).fontSize : '?') + ' vs ' + getComputedStyle(fF).fontSize);
      const spF = fecho.querySelector('.laudoExtra');
      const pxSp = spF ? parseFloat(getComputedStyle(spF).fontSize) : 0;
      // 26/08 (noite, 2a leva) — pedido dele: NA MAMA os dizeres finais saem na letra 8
      // e sem linha em branco entre eles ("o que esta abaixo da conclusao", nao ela)
      diz('NA MAMA os dizeres finais saem na letra 8 (so eles — a conclusao nao)',
        !!spF && pxSp === 8, pxSp + 'px');
      diz('e SEM linha em branco entre os dizeres',
        !!spF && spF.innerHTML.indexOf('<br><br>') < 0);
    }
    const cxF = fF.querySelector('.laudoCorpoBox');
    const molds = fF.querySelectorAll('.laudoMoldura');
    diz('a borda da caixa unica apaga (so a cor) e a moldura por folha assume',
      getComputedStyle(cxF).borderTopColor === 'rgba(0, 0, 0, 0)' && molds.length >= 1,
      molds.length + ' retangulo(s)');
    let mOk = molds.length > 0;
    Array.prototype.forEach.call(molds, m => {
      const rM = m.getBoundingClientRect();
      if (Math.floor((rM.top - frF.top + 2) / phF) !== Math.floor((rM.bottom - frF.top - 2) / phF)) mOk = false;
    });
    diz('cada retangulo mora INTEIRO numa folha (a moldura fecha a cada pagina)', mOk);
    const cxR = cxF.getBoundingClientRect();
    const pgCaixa = Math.floor((cxR.bottom - frF.top - 2) / phF) - Math.floor((cxR.top - frF.top + 2) / phF) + 1;
    diz('e ha exatamente um retangulo por folha que a caixa atravessa',
      molds.length === pgCaixa, molds.length + ' de ' + pgCaixa);
    exames = exames.filter(e => e.id !== 9914);

    // ---- CONTADOR E ORDEM EM "EXAMES DE HOJE" (31/08, itens 2 e 3) ----
    // ⚠️ ESTA e a tela que ele olha o dia inteiro (#telaDia). Na 1a tentativa os itens 2
    // e 3 foram para a aba antiga "Exames identificados", que e OUTRA lista — ele mandou
    // a foto da tela certa. As duas tem contador hoje; a que importa e esta.
    const _exDia = exames.slice();
    exames.length = 0;
    const agora = Date.now();
    [['Jose', 'prostata', true, true], ['Antonia', 'transvaginal', true, true],
     ['Marinete', 'abdominal', true, false], ['RecemChegado', 'mama', false, false]]
      .forEach(([nome, tipo, temLaudo, liberado], i) => {
        exames.push({ id: 9600 + i, tipo, paciente: nome, imagens: [], audios: [], _dicom: true,
          _quando: agora - (10 - i) * 60000,
          laudo: temLaudo ? { corpo: 'x', conclusao: 'y' } : null, _liberado: liberado });
      });
    document.getElementById('telaDia').style.display = 'block';
    diaRenderLista();
    const naTelaDia = () => Array.prototype.map.call(
      document.querySelectorAll('#diaLista .nm'), e => e.textContent.trim());
    diz('em EXAMES DE HOJE, o mais novo fica no TOPO',
      naTelaDia()[0] === 'RecemChegado', naTelaDia().join(' > '));
    diz('e o mais antigo desce para o pe da lista',
      naTelaDia()[naTelaDia().length - 1] === 'Jose');
    // ⚠️ a ordem de CHEGADA nao pode virar: "Revisar laudos pendentes" pega o PRIMEIRO
    // pendente, e tem de ser o mais ANTIGO — quem limpa fila comeca pelo comeco.
    diz('a ordem de chegada continua intacta por baixo',
      diaExamesDeHoje().map(x => x.paciente).join(',') === 'Jose,Antonia,Marinete,RecemChegado');
    const pend = diaExamesDeHoje().filter(x => x.laudo && !x._liberado);
    diz('e "Revisar pendentes" continua abrindo o mais ANTIGO que falta',
      pend[0] && pend[0].paciente === 'Marinete', pend[0] ? pend[0].paciente : '(nenhum)');
    const contDia = document.getElementById('diaConta').textContent;
    diz('o contador conta os exames do dia', contDia.indexOf('4 exames') >= 0, contDia);
    diz('e separa o que falta gerar do que falta assinar',
      contDia.indexOf('1 sem laudo') >= 0 && contDia.indexOf('2 a assinar') >= 0, contDia);
    exames.forEach(e => { e.laudo = e.laudo || { corpo: 'x' }; e._liberado = true; });
    diaRenderLista();
    diz('com tudo pronto, diz "todos assinados"',
      document.getElementById('diaConta').textContent.indexOf('todos assinados') >= 0,
      document.getElementById('diaConta').textContent);
    exames.length = 0; diaRenderLista();
    diz('dia sem exame nenhum nao mostra contador',
      document.getElementById('diaConta').textContent === '');
    document.getElementById('telaDia').style.display = 'none';
    _exDia.forEach(e => exames.push(e));

    // ---- CONTADOR E ORDEM DA LISTA ANTIGA "Exames identificados" (31/08) ----
    // Item 2: ele atende ~100 exames/dia e contava os cartoes na mao.
    // Item 3: o exame recem-chegado nascia no FIM da lista, fora da tela.
    const _examesAntes = exames.slice();
    exames.length = 0;
    ['Primeiro', 'Segundo', 'Terceiro'].forEach((n, i) =>
      exames.push({ id: 9700 + i, tipo: 'abdominal', paciente: n, imagens: [], audios: [] }));
    renderExames();
    const nomesTela = () => Array.prototype.map.call(
      document.querySelectorAll('#listaExames .nome'), e => e.textContent.split(' ')[0]);
    diz('o exame mais NOVO aparece no topo da lista',
      JSON.stringify(nomesTela()) === JSON.stringify(['Terceiro', 'Segundo', 'Primeiro']),
      nomesTela().join(' > '));
    exames.push({ id: 9799, tipo: 'mama', paciente: 'RecemChegado', imagens: [], audios: [] });
    renderExames();
    diz('e o que acaba de chegar do aparelho entra em cima', nomesTela()[0] === 'RecemChegado');
    // ⚠️ a ordem do ARRAY nao pode virar: fila de revisao, gerar todos e sessao do dia
    // dependem da ordem de chegada. So a vitrine inverte.
    diz('a ordem interna dos exames NAO foi invertida',
      exames[0].paciente === 'Primeiro' && exames[exames.length - 1].paciente === 'RecemChegado');
    diz('o contador conta os exames do dia',
      document.getElementById('exContador').textContent.indexOf('4 exames') >= 0,
      document.getElementById('exContador').textContent);
    exames[0].laudo = { corpo: 'x' }; exames[1].laudo = { corpo: 'y' }; exames[1]._liberado = true;
    renderExames();
    const cont = document.getElementById('exContador').textContent;
    diz('e separa o que falta gerar do que ja foi liberado',
      cont.indexOf('2 sem laudo') >= 0 && cont.indexOf('1 liberado') >= 0, cont);
    exames.length = 0; renderExames();
    diz('lista vazia nao mostra contador nenhum',
      document.getElementById('exContador').textContent === '');
    _examesAntes.forEach(e => exames.push(e));

    // ---- EDITAR O TITULO DO EXAME (31/08, pedido dele, item 1) ----
    // O titulo ja era editavel NA FOLHA, mas nao na tela de revisao, que e onde ele
    // trabalha. Entrou como retangulo para reusar o caminho de gravacao dos outros.
    // O risco: o titulo vazar para DENTRO do corpo (o filtro que monta o corpo tem de
    // exclui-lo, como ja exclui a conclusao e os dados clinicos).
    exames.push({ id: 9918, tipo: 'abdominal', paciente: 'Titulo', imagens: [], audios: [],
      laudo: { cab: { nome: 'Titulo' }, titulo: 'RELATORIO ULTRASSONOGRAFICO ABDOMINAL',
               tecnica: MODELOS.abdominal.tecnica,
               corpo: '**Figado:**' + NL + 'Dimensoes normais.' + NL + NL + '**Baco:**' + NL + 'Sem alteracoes.',
               conclusao: 'Exame ecografico compativel com a normalidade.', obs: '',
               _molde: rev2MoldeDoTexto(MODELOS.abdominal.corpo) } });
    _rev2Id = 9918; rev2Abrir(9918);
    const exT = exames.find(e => e.id === 9918);
    const corpoAntes = exT.laudo.corpo;
    const blocosT = rev2BlocosDaTela(exT.laudo);
    diz('o titulo e o PRIMEIRO retangulo da tela', !!blocosT[0] && blocosT[0]._titulo === true);
    diz('e nao e tratado como achado (nao pinta alarme de medida faltando)',
      rev2Estado(exT, blocosT[0]) === 'clinico', rev2Estado(exT, blocosT[0]));
    const elT = Array.prototype.find.call(document.querySelectorAll('#telaRev2 [data-bloco]'),
      e => (e.innerText || '').indexOf('ULTRASSONOGRAFICO') >= 0);
    diz('o retangulo do titulo aparece na tela', !!elT);
    if (elT) {
      elT.innerHTML = 'ULTRASSONOGRAFIA DE ABDOME TOTAL';
      rev2Editou(elT);
      diz('editar o retangulo muda o titulo do laudo',
        exT.laudo.titulo === 'ULTRASSONOGRAFIA DE ABDOME TOTAL', exT.laudo.titulo);
      diz('e o corpo NAO e tocado (o titulo nao vaza para dentro do laudo)',
        exT.laudo.corpo === corpoAntes);
      rev2Preparar();
      const fT = document.querySelector('#areaImpressao');
      diz('a folha impressa sai com o titulo novo',
        fT.querySelector('.laudoTitulo').innerText.trim() === 'ULTRASSONOGRAFIA DE ABDOME TOTAL');
      diz('e o titulo nao aparece duplicado no corpo',
        (fT.querySelector('.laudoTexto').innerText || '').indexOf('ABDOME TOTAL') < 0);
    }
    _rev2Id = null;
    exames = exames.filter(e => e.id !== 9918);

    // ---- A MOLDURA DO LAUDO SOBREVIVE A EDICAO (caso Jacilene, 26/08) ----
    // No laudo liberado, "DESCRIÇÃO:" estava sob MAMA DIREITA e faltava sob MAMA ESQUERDA.
    // A linha morava DENTRO da area editavel do retangulo e uma tecla a apagava calada.
    // Aqui o pior acidente possivel: apagar o retangulo inteiro e digitar uma frase so.
    const corpoMama = '**MAMA DIREITA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
      + '**' + BUL + ' as 2 h, a ..... cm da papila, medindo 0,6 x 0,3 x 0,4 cm;**' + NL + 'Regiao axilar livre.' + NL + NL
      + '**MAMA ESQUERDA**' + NL + '**DESCRICAO:**' + NL + NL + 'Mama simetrica.' + NL
      + '**' + BUL + ' as 12 h, a ..... cm da papila, medindo 0,6 x 0,3 x 0,4 cm;**' + NL + 'Regiao axilar livre.';
    exames.push({ id: 9916, tipo: 'mama', paciente: 'Moldura', imagens: [], audios: [],
      laudo: { cab: { nome: 'Moldura' }, titulo: MODELOS.mama.titulo, tecnica: MODELOS.mama.tecnica,
               corpo: corpoMama, conclusao: 'Exame ecografico compativel com cistos simples bilateralmente.',
               extra: '', obs: '',
               _molde: { titulos: { 'mama direita': 1, 'mama esquerda': 1, 'descricao': 1 }, medidas: {} } } });
    _rev2Id = 9916; rev2Abrir(9916); rev2Render();
    const exM = exames.find(e => e.id === 9916);
    const contD = () => (exM.laudo.corpo.split('DESCRICAO').length - 1);
    diz('o laudo de mama nasce com "DESCRICAO:" nos DOIS lados', contD() === 2, contD());
    const retEsq = Array.prototype.find.call(document.querySelectorAll('#telaRev2 [data-bloco]'),
      e => (e.innerText || '').indexOf('as 12 h') >= 0);
    diz('achou o retangulo da mama esquerda', !!retEsq);
    if (retEsq) {
      diz('e "DESCRICAO:" NAO esta mais na area que ele digita',
        (retEsq.innerText || '').indexOf('DESCRICAO') < 0);
      retEsq.innerHTML = 'Mama simetrica.';       // apaga tudo, o pior caso
      rev2Editou(retEsq);
      diz('mesmo apagando o retangulo inteiro, a moldura dos DOIS lados sobrevive',
        contD() === 2, exM.laudo.corpo.slice(exM.laudo.corpo.indexOf('MAMA ESQUERDA') - 2,
          exM.laudo.corpo.indexOf('MAMA ESQUERDA') + 40).split(NL).join('|'));
      diz('e o titulo nao cola na moldura',
        exM.laudo.corpo.indexOf('**MAMA ESQUERDA****') < 0);
    }
    _rev2Id = null;
    exames = exames.filter(e => e.id !== 9916);

    // ---- TELA "VER O LAUDO FINAL": A EDICAO SOBREVIVE, E COM FERRAMENTAS (26/08, noite) ----
    // O defeito relatado por ele: "salvar e liberar nao esta salvando". A edicao vivia
    // so na folha (DOM); o OBJETO do laudo ficava velho e reaparecia em toda remontagem.
    // Agora o fechar da tela final ABSORVE a edicao de volta para o objeto.
    exames.push({ id: 9915, tipo: 'abdominal', paciente: 'Teste Final', imagens: [], audios: [],
      laudo: { cab: { nome: 'Teste Final' }, titulo: MODELOS.abdominal.titulo,
               tecnica: MODELOS.abdominal.tecnica, corpo: MODELOS.abdominal.corpo,
               conclusao: 'Exame ecografico compativel com a normalidade.',
               extra: 'Dizer final um.' + NL + NL + 'Dizer final dois.', obs: '' } });
    _rev2Id = 9915;
    rev2VerFinal();
    diz('a tela final abre com a barra de formatacao da revisao (o mesmo no, emprestado)',
      !!document.querySelector('#rv2Final #barraFormato'));
    // a letra 8 sem linha em branco e regra SO da mama — fora dela, tudo como sempre
    const spN = document.querySelector('#areaImpressao .laudoExtra');
    diz('fora da mama o texto final segue em 11px', !!spN && getComputedStyle(spN).fontSize === '11px',
      spN ? getComputedStyle(spN).fontSize : 'sem span');
    diz('e com a linha em branco entre os dizeres', !!spN && spN.innerHTML.indexOf('<br><br>') >= 0);
    const txF = document.querySelector('#areaImpressao .laudoTexto');
    txF.appendChild(document.createTextNode(NL + NL + 'FRASE-EDITADA-NA-TELA-FINAL.'));
    rev2FinalFechar();
    const exF = exames.find(e => e.id === 9915);
    diz('fechar a tela final leva a edicao para o OBJETO do laudo',
      /FRASE-EDITADA-NA-TELA-FINAL/.test(exF.laudo.corpo || ''));
    diz('sem estragar a conclusao no caminho de volta',
      exF.laudo.conclusao === 'Exame ecografico compativel com a normalidade.', exF.laudo.conclusao);
    diz('e a barra de formatacao volta para a tela de revisao',
      !!document.querySelector('#telaRevisao #barraFormato'));
    rev2VerFinal();   // reabrir REMONTA a folha a partir do objeto — era aqui que a edicao sumia
    diz('reabrir a tela final NAO apaga mais a edicao',
      /FRASE-EDITADA-NA-TELA-FINAL/.test(document.querySelector('#areaImpressao .laudoTexto').innerText));
    rev2FinalFechar();
    _rev2Id = null;
    exames = exames.filter(e => e.id !== 9915);

    // folha BRANCA: sem mascara, sem paginacao — o comportamento de sempre
    window.__fundo = 'branco';
    exames.push({ id: 9902, tipo: 'abdominal', paciente: 'Teste Branco',
      laudo: { cab: { nome: 'Teste Branco' }, titulo: 't', tecnica: 't',
               corpo: pgCorpo, conclusao: 'c', obs: '' } });
    abrirRevisao(9902);
    paginarLaudoTela();
    const pgB = document.querySelector('#areaImpressao .laudoFolha');
    diz('folha branca continua corrida (sem vaos, sem mascara extra, altura livre)',
      pgB.querySelectorAll('.quebraFolha').length === 0
      && pgB.querySelectorAll('.fundoFolhaTela').length === 0
      && !pgB.style.height);
  } finally {
    window.__fundo = pgFundoAntes; window.__fundoPerguntado = pgPergAntes;
    exames = exames.filter(e => [9901, 9902, 9903, 9904, 9905, 9906, 9910, 9912, 9913].indexOf(e.id) < 0);
    document.getElementById('areaImpressao').innerHTML = '';
    try { document.getElementById('telaRevisao').style.display = 'none'; } catch (e) {}
  }

  // 04/09/2026 — O REPOSITORIO UNICO DE EXAMES, montado de verdade.
  // As outras verificacoes dele leem o codigo-fonte; esta o FAZ DESENHAR numa pagina
  // carregada inteira. Falha de montagem (id que nao existe, funcao chamada antes de
  // existir, selo que nao acha o item) so aparece aqui.
  try {
    const fetchAntes = window.fetch;
    const HOJE = new Date();
    const dd = n => ('0' + n).slice(-2);
    const hojeBr = dd(HOJE.getDate()) + '/' + dd(HOJE.getMonth() + 1) + '/' + HOJE.getFullYear();
    const hojeIso = HOJE.getFullYear() + '-' + dd(HOJE.getMonth() + 1) + '-' + dd(HOJE.getDate());
    const ESTUDOS = [
      // de outro dia, com imagens e com audio na pasta de consulta
      { id: 'R-ANTIGO', paciente: 'ANA^MARIA', data: '02/09/2026', hora: '09:15',
        dataOrdem: '202609020915', nImagens: 4, instancias: ['i1', 'i2', 'i3', 'i4'],
        descricao: 'ABDOME TOTAL' },
      // de outro dia, SEM audio nenhum: e o selo cinza
      { id: 'R-SEMAUDIO', paciente: 'JOAO^PEDRO', data: '02/09/2026', hora: '10:40',
        dataOrdem: '202609021040', nImagens: 2, instancias: ['j1', 'j2'], descricao: 'TIREOIDE' },
      // de HOJE: nao pode aparecer na lista de "outros dias"
      { id: 'R-HOJE', paciente: 'CARLA^SOUZA', data: hojeBr, hora: '08:00',
        dataOrdem: hojeIso.replace(/-/g, '') + '0800', nImagens: 1, instancias: ['c1'],
        descricao: 'MAMA' },
    ];
    window.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/dicom/estudos')) return new Response(JSON.stringify({ ok: true, estudos: ESTUDOS, relogio: { desvioSeg: 0, suspeito: false, limiteSeg: 900 } }));
      if (u.includes('/exame/ditados')) return new Response(JSON.stringify({ ok: true, ditados: {}, retencaoDias: 7 }));
      if (u.includes('/capturas')) return new Response(JSON.stringify({ ok: true, retencaoDias: 90, dias: { '2026-09-02': ['Ana Maria.wav'] } }));
      if (u.includes('/exames/liberados')) return new Response(JSON.stringify({ uids: ['R-ANTIGO'] }));
      return fetchAntes(url, opt);
    };
    exames = []; audios = [];
    _repo = { estudos: null, ditados: {}, capturas: {}, liberados: {}, quando: 0, erro: '', carregando: false, retAudio: 90 };
    _repoAberto = {}; _repoPainel = {}; _repoIndice = {}; _repoLeveQuando = 0;
    document.getElementById('telaAntigos').style.display = 'block';
    await repoPintar('antRepo', { abrirPrimeiro: true });
    const caixa = document.getElementById('antRepo');
    const linhasDia = caixa.querySelectorAll('details.repoDia');
    diz('a lista desenha linhas de data', linhasDia.length === 2, 'dias: ' + linhasDia.length);
    diz('o dia mais recente vem primeiro e ja aberto',
      linhasDia[0] && linhasDia[0].open && linhasDia[0].querySelector('summary').textContent.indexOf(hojeBr) >= 0,
      linhasDia[0] ? linhasDia[0].querySelector('summary').textContent : 'sem dia');
    diz('e o dia de hoje vem marcado como HOJE', !!caixa.querySelector('.repoDia .hoje'));
    diz('cada exame do aparelho virou uma linha', caixa.querySelectorAll('.repoLinha').length === 3,
      'linhas: ' + caixa.querySelectorAll('.repoLinha').length);
    diz('o nome do paciente sai legivel, nao no formato do DICOM',
      (caixa.textContent.indexOf('Ana Maria') >= 0) && caixa.textContent.indexOf('ANA^MARIA') < 0);

    const lAntigo = document.getElementById('repoL' + 'E' + 'R-ANTIGO');
    diz('a linha do exame existe com a chave dele', !!lAntigo);
    diz('o selo das imagens diz quantas sao',
      !!lAntigo && lAntigo.querySelector('button.repoSelo.img')
      && lAntigo.querySelector('button.repoSelo.img').textContent.indexOf('4 imagens') >= 0,
      lAntigo ? (lAntigo.querySelector('.repoSelo.img') || {}).textContent : '');
    diz('com audio na pasta de consulta, o selo de audio e BOTAO',
      !!lAntigo && !!lAntigo.querySelector('button.repoSelo.aud'));
    diz('e o exame assinado mostra o selo de liberado',
      !!lAntigo && !!lAntigo.querySelector('.repoSelo.lib'));

    const lSem = document.getElementById('repoL' + 'E' + 'R-SEMAUDIO');
    diz('sem audio guardado, o selo e cinza e NAO e botao',
      !!lSem && !!lSem.querySelector('span.repoSelo.vazio')
      && !lSem.querySelector('button.repoSelo.aud'));
    diz('e o exame sem laudo assinado mostra "a liberar"',
      !!lSem && !!lSem.querySelector('.repoSelo.falta'));
    // <audio src=""> nao fica mudo: aponta para a PROPRIA PAGINA e o navegador tenta
    // tocar o programa como se fosse som
    repoOuvir('E' + 'R-SEMAUDIO');
    diz('pedir audio de quem nao tem diz isso, em vez de abrir um tocador vazio',
      !document.querySelector('#repoP' + 'E' + 'R-SEMAUDIO audio')
      && document.getElementById('repoP' + 'E' + 'R-SEMAUDIO').textContent.indexOf('não tem áudio') >= 0);

    // o audio ABRE de verdade, e aponta para a rota da pasta de consulta
    repoOuvir('E' + 'R-ANTIGO');
    const tocador = document.querySelector('#repoP' + 'E' + 'R-ANTIGO audio');
    diz('tocar o selo de audio abre um tocador na propria linha', !!tocador);
    diz('e ele aponta para o audio daquele dia e daquele paciente',
      !!tocador && tocador.src.indexOf('dia=2026-09-02') >= 0
      && decodeURIComponent(tocador.src).indexOf('Ana Maria.wav') >= 0,
      tocador ? tocador.src.split('/').pop() : '');
    repoOuvir('E' + 'R-ANTIGO');
    diz('e tocar de novo fecha', !document.querySelector('#repoP' + 'E' + 'R-ANTIGO audio'));

    // as fotos, com o download de mentira
    const baixarAntes = window.dicomBaixarImagem;
    window.dicomBaixarImagem = async () => 'data:image/png;base64,iVBORw0KGgo=';
    await repoVerFotos('E' + 'R-ANTIGO');
    diz('o selo das imagens abre as fotos na propria linha',
      document.querySelectorAll('#repoP' + 'E' + 'R-ANTIGO img').length === 4,
      'fotos: ' + document.querySelectorAll('#repoP' + 'E' + 'R-ANTIGO img').length);
    window.dicomBaixarImagem = baixarAntes;

    // e no painel do dia: hoje NAO pode aparecer duas vezes
    document.getElementById('telaAntigos').style.display = 'none';
    _repoAberto = {};
    await repoPintar('diaOutrosDias', { excluirDia: repoHojeBr(), abrirPrimeiro: true });
    const outros = document.getElementById('diaOutrosDias');
    diz('no painel do dia, "outros dias" nao repete o dia de hoje',
      outros.textContent.indexOf(hojeBr) < 0 && outros.textContent.indexOf('02/09/2026') >= 0);
    diz('e mostra so os exames dos outros dias',
      outros.querySelectorAll('.repoLinha').length === 2,
      'linhas: ' + outros.querySelectorAll('.repoLinha').length);

    // agente fora do ar: mensagem, nao lista vazia
    window.fetch = async () => { throw new Error('sem agente'); };
    _repo = { estudos: null, ditados: {}, capturas: {}, liberados: {}, quando: 0, erro: '', carregando: false, retAudio: 90 };
    _repoLeveQuando = 0;
    await repoPintar('antRepo', {});
    diz('agente fora do ar vira mensagem, nao lista vazia',
      document.getElementById('antRepo').textContent.indexOf('agente') >= 0);
    // falhar nao e ter feito: senao a tela ficaria presa um minuto inteiro dizendo
    // "sem audio, nada liberado" com tudo intacto no disco
    diz('e uma carga que falhou NAO conta como feita',
      _repoLeveQuando === 0, 'marca: ' + _repoLeveQuando);

    window.fetch = fetchAntes;
    document.getElementById('antRepo').innerHTML = '';
    document.getElementById('diaOutrosDias').innerHTML = '';
  } catch (e) {
    diz('o repositorio unico de exames monta na pagina', false, e.constructor.name + ': ' + e.message);
  }

  // 04/09/2026 — O CARTAO DO "MAIOR DIAMETRO" TEM DE ACEITAR A RESPOSTA.
  // Ele fez um transvaginal e o O-RADS foi recusado por falta do maior diametro. Alem de a
  // medida ja estar escrita no laudo (corrigido em processarOrads), o cartao da pendencia
  // abria uma caixa VAZIA: as fichas vem das OPCOES do descritor, e medida nao tem opcoes.
  // O programa pedia um dado e nao tinha onde receber a resposta.
  try {
    const exN = { id: 9930, tipo: 'transvaginal', paciente: 'Teste O-RADS',
      laudo: { cab: { nome: 'Teste O-RADS' }, titulo: 't', tecnica: 't',
               corpo: 'Ovário esquerdo com 3,4 x 2,2 cm.', conclusao: 'c', obs: '',
               classifPendencias: [{ sistema: 'orads', achado: 'ovário esquerdo', idx: 0,
                 chave: 'tamanho_cm', rotulo: 'Maior diâmetro (cm)', ditado: '',
                 opcoes: [], tipo: 'numero', texto: 'Maior diâmetro (cm)' }],
               classifLidos: [{ sistema: 'orads', achado: 'ovário esquerdo', idx: 0,
                 chave: 'escore_cor', rotulo: 'Escore de cor', tipo: undefined,
                 valor: '1', rotValor: '1', origem: 'texto',
                 opcoes: [{ v: '1', rot: '1' }, { v: '2', rot: '2' }] }] } };
    exames.push(exN);
    const alvo = document.createElement('div');
    alvo.innerHTML = rev2Caixas(exN, { titulo: 'ovário esquerdo' });
    document.body.appendChild(alvo);
    const campo = alvo.querySelector('#rv2pn0');
    diz('o cartao do maior diametro traz um campo para a medida', !!campo);
    // type="number" RECUSA a virgula, e ele escreve "4,5". O campo tem de ser de texto,
    // com o teclado numerico do tablet vindo pelo inputmode.
    diz('o campo aceita virgula (nao e type=number)',
      !!campo && campo.type === 'text' && campo.getAttribute('inputmode') === 'decimal',
      campo ? (campo.type + '/' + campo.getAttribute('inputmode')) : 'sem campo');
    diz('o botao do cartao diz "informar", nao "escolher"',
      (alvo.querySelector('#rv2p0 .abrir') || {}).textContent === 'informar',
      (alvo.querySelector('#rv2p0 .abrir') || {}).textContent);
    diz('e o microfone continua ali, para ele so falar a medida',
      !!alvo.querySelector('.ficha.mic'));
    // o descritor com OPCOES continua com fichas — o campo nao pode ter comido o caso normal
    diz('descritor com opcoes continua desenhando fichas',
      alvo.querySelectorAll('#rv2lo0 .ficha').length === 2,
      'fichas: ' + alvo.querySelectorAll('#rv2lo0 .ficha').length);
    diz('e nao ganha campo de numero', !alvo.querySelector('#rv2ln0'));

    // responder de verdade: o valor tem de chegar em _descritores, que e o que o recalculo le
    campo.value = '4,5';
    document.body.appendChild(campo);          // rev2LerCampoNumero busca por id no documento
    _rev2Id = 9930;
    rev2EscolherNumero(0);
    const grav = ((exN.laudo._descritores || {})['orads|0'] || {}).tamanho_cm;
    diz('digitar a medida e tocar "usar" grava o valor em centimetros',
      grav === 4.5, 'gravado: ' + grav);
    _rev2Id = null;
    exames = exames.filter(e => e.id !== 9930);
    alvo.remove(); campo.remove();
  } catch (e) {
    diz('o cartao do maior diametro aceita a resposta', false, e.constructor.name + ': ' + e.message);
  }

  // 04/09/2026 — "REABRIR EXAME" NAO PODE SER UM BECO SEM SAIDA.
  // Ele apertava Reabrir no painel do dia e caia na aba "Captura ao vivo" da interface
  // ANTIGA, com o painel fechado e o botao de voltar apagado: sem saida nenhuma.
  try {
    const confAntes = window.confirm;
    window.confirm = () => true;
    // UM DIA DE VERDADE: ele atende perto de 100 exames. Com um so, "o aviso esta visivel"
    // passa a toa — a caixa vive DEPOIS da lista, e e a lista longa que a empurra para
    // fora da tela. Foi assim que a 1a versao desta correcao trocou "atras da tela" por
    // "abaixo da dobra" sem que o teste percebesse.
    exames = [{ id: 9940, paciente: 'Teste Reabrir', tipo: 'abdominal', laudo: { corpo: 'x' },
                imagens: [], audios: [], _liberado: true, _captura: true,
                _estudoId: 'EST-REAB', _instIds: [], _quando: Date.now() }];
    for (let k = 0; k < 24; k++) {
      exames.push({ id: 9950 + k, paciente: 'Enchimento ' + k, tipo: 'abdominal',
        laudo: { corpo: 'x' }, imagens: [], audios: [], _liberado: true, _captura: true,
        _estudoId: 'EST-' + k, _instIds: [], _quando: Date.now() - (k + 1) * 60000 });
    }
    _diaListaHtml = '';
    // o estado REAL da varredura: o exame ja visto (era so isso que a versao anterior
    // desta correcao nao desfazia, e por isso a promessa nao se cumpria)
    capOrtFeitos = new Set(); capOrtSeen = new Set(['EST-REAB']); capOrtWatching = true;
    // O BANCO TAMBEM DIZ QUE ESTE EXAME ESTA LIBERADO — e e so com ele preenchido que a
    // assercao do selo testa alguma coisa. Sem esta linha o "ou" antigo (sessao OU banco)
    // nunca era exercitado e a verificacao passava vazia.
    _repo.liberados = { 'EST-REAB': true };
    diaAbrir();
    const antesVisivel = document.getElementById('telaDia').style.display;
    diaReabrir(9940);
    const dia = document.getElementById('telaDia');
    diz('o painel do dia continua aberto depois de reabrir',
      getComputedStyle(dia).display === 'block',
      'antes: ' + antesVisivel + ' / depois: ' + getComputedStyle(dia).display);
    // a telaDia e position:fixed com fundo opaco: se ela esta na frente, o que a interface
    // antiga fizer atras nao prende ninguem. Mede-se pelo PONTO, nao por um id existir.
    const noMeio = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    diz('e e ELE que esta na frente da tela (nada da interface antiga por cima)',
      !!noMeio && !!noMeio.closest && !!noMeio.closest('#telaDia'),
      noMeio ? (noMeio.tagName + '#' + (noMeio.closest('[id]') || {}).id) : 'nada');
    diz('o exame voltou para a fila de laudos a liberar',
      exames[0]._liberado === false);
    const cartao = [...document.querySelectorAll('#diaLista .item')]
      .find(el => el.textContent.indexOf('Teste Reabrir') >= 0);
    diz('e continua na lista de hoje, com o cartao desenhado', !!cartao);
    // o selo NAO pode continuar dizendo "liberado" num exame que acabou de ser reaberto
    diz('o cartao nao se contradiz: some o selo "liberado", entra "a liberar"',
      !!cartao && !cartao.querySelector('.repoSelo.lib') && !!cartao.querySelector('.repoSelo.falta'),
      cartao ? (cartao.querySelector('.repoSelo.lib') ? 'ainda diz liberado' : 'ok') : 'sem cartao');
    diz('e a situacao escrita concorda com o selo',
      !!cartao && cartao.textContent.indexOf('revisado e assinado') < 0);
    // exame SEM laudo nesta sessao: a sessao nao sabe de nada e quem manda e o banco.
    // Deixar a sessao mandar poria "a liberar" num exame ja assinado — a mesma mentira
    // ao contrario. E o caso do exame trazido pelo "para hoje", que nasce sem _liberado.
    const semLaudo = repoItem({ id: 'EST-REAB', paciente: 'X', data: '01/01/2026', nImagens: 1,
                                instancias: ['i'], hora: '08:00', dataOrdem: '202601010800' },
                              { id: 9941, paciente: 'X', imagens: [], audios: [] });
    diz('exame trazido do aparelho, sem laudo aqui, ainda ouve o banco',
      semLaudo.liberado === true, 'liberado: ' + semLaudo.liberado);

    // o retorno tem de ser VISIVEL: log() escreve atras da telaDia
    const aviso = document.getElementById('capForcarLista');
    diz('o retorno aparece na propria telaDia, nao so no diario',
      !!aviso && aviso.style.display !== 'none' && aviso.textContent.indexOf('Teste Reabrir') >= 0,
      aviso ? aviso.textContent.slice(0, 60) : 'sem aviso');
    // "visivel" nao basta: a caixa vive DEPOIS da lista. Num dia de 25 exames ela nasce
    // a milhares de pixels do topo — visivel no papel do codigo, fora da tela na pratica.
    const rAviso = aviso.getBoundingClientRect();
    diz('e esta DENTRO da janela, nao abaixo da dobra',
      rAviso.top < innerHeight && rAviso.bottom > 0,
      'top ' + Math.round(rAviso.top) + ' de ' + innerHeight);
    diz('e o exame saiu das DUAS listas de controle da varredura',
      capOrtFeitos.has('EST-REAB') && !capOrtSeen.has('EST-REAB'),
      'feitos: ' + capOrtFeitos.has('EST-REAB') + ' / seen: ' + capOrtSeen.has('EST-REAB'));
    // exame que NAO estava assinado tambem tem de dar retorno — botao sem efeito visivel
    // ensina a nao confiar nos outros
    aviso.innerHTML = ''; aviso.style.display = 'none';
    diaReabrir(9940);
    diz('reabrir um exame que ja estava aberto tambem diz o que aconteceu',
      aviso.style.display !== 'none' && /já estava aberto/.test(aviso.textContent),
      aviso.textContent.slice(0, 60));
    diaFechar();
    window.confirm = confAntes;
    exames = [];
    _diaListaHtml = '';
    document.getElementById('capForcarLista').innerHTML = '';
  } catch (e) {
    diz('reabrir exame nao prende o medico numa tela antiga', false, e.constructor.name + ': ' + e.message);
  }

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
