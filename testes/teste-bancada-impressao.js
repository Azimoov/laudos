// BANCADA DE IMPRESSAO — as regras de layout do laudo, conferidas a cada mudanca.
//
// 06/09/2026. Nasceu do plano que o Dr. Daniel pediu, e da frase dele: a formatacao
// precisa ficar "de forma confiavel". As quatro regras que ele escreveu ja existiam no
// programa — o que nao existia era ALGUEM CONFERINDO. Elas valiam enquanto o codigo
// estivesse certo, e a gente so descobria que tinham quebrado quando saia no papel.
//
// AS REGRAS DELE, e como cada uma e conferida aqui:
//   1. a assinatura nunca sozinha na ultima folha
//      -> CAMADA A: a folha em que a assinatura cai tem de ser a MESMA em que a caixa do
//         texto termina. Medido no desenho, onde se sabe o que e cada bloco.
//   2. mesma fonte sempre; o tamanho pode variar, com piso
//      -> CAMADA A: nenhuma letra do corpo abaixo de 10; so os avisos de rodape (as
//         ressalvas, as referencias, o "adotamos o BI-RADS…") podem descer, ate 6.
//   3. o texto nunca sobre o desenho da mascara
//      -> CAMADA B: nenhuma tinta do laudo fora da area livre do timbrado, medida na
//         PAGINA COMPOSTA. (O brasao do meio e marca d'agua e o texto passa por cima —
//         decisao dele, 06/09.)
//   4. qualidade maxima
//      -> CAMADA B: a foto tem de chegar na resolucao alta ao papel.
//
// POR QUE DUAS CAMADAS. A do desenho (A) e exata e barata: ali se sabe que aquilo e a
// assinatura e aquilo e a caixa do texto. A dos pontos (B) e a verdade: e a folha pronta,
// desenhada pelo MESMO codigo que desenha no papel, so que na memoria — nenhuma folha e
// gasta. Uma sozinha nao basta: a do desenho nao ve o que a impressao faz com ele, e a
// dos pontos nao sabe dizer QUEM e cada mancha de tinta.
//
// OS CASOS SAO AJUSTADOS SOZINHOS. "Quase uma folha" e "uma linha alem" nao sao numeros
// cravados aqui: a bancada procura, por tentativa, quantos paragrafos fazem o laudo virar
// a folha, e usa esse numero e o seguinte. Se amanha a entrelinha mudar, os casos-limite
// se mudam junto — numero cravado envelhece calado, e um caso-limite que deixou de ser
// limite e uma verificacao que da verde sem olhar nada.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const PROGRAMA = path.join(RAIZ, '..', 'laudos-programa');
const COMPOR = path.join(PROGRAMA, 'testes', 'bancada-compor.py');

let falhas = 0;
const ok = (c, m, d) => {
  console.log((c ? '  ok   ' : '  FALHA ') + m + (d ? ('  [' + d + ']') : ''));
  if (!c) falhas++;
};

// ---- as medidas do timbrado de prova, em milimetros. Sao CONHECIDAS de proposito: a
// mascara e desenhada aqui, entao a area livre nao e chute nem medicao de imagem alheia.
const MASCARA = { cabecalhoAte: 26, rodapeDe: 278, reservaTopo: 30, reservaBase: 24 };
// piso do tamanho de letra (decisao dele, 06/09): 10 para o laudo, 6 para os avisos
const PISO_CORPO = 10, PISO_AVISO = 6;

function acharChrome() {
  return [process.env.CHROME_BIN,
    path.join(process.env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean).find(c => { try { return fs.statSync(c).isFile(); } catch (e) { return false; } });
}
function acharPython() {
  const v = path.join(RAIZ, '..', 'ditado-local', '.venv', 'Scripts', 'python.exe');
  for (const c of [process.env.PYTHON_LAUDOS, v, 'python']) {
    if (!c) continue;
    try {
      if (c !== 'python' && !fs.statSync(c).isFile()) continue;
      const r = spawnSync(c, ['-c', 'print(1)'], { encoding: 'utf8' });
      if (r.status === 0) return c;
    } catch (e) { /* proximo */ }
  }
  return null;
}
function servir() {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript' };
  const srv = http.createServer((req, res) => {
    const alvo = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html'
      : decodeURIComponent(req.url.split('?')[0]));
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
    } catch (e) { /* subindo */ }
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
  const enviar = (m, p) => new Promise(res => {
    const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p || {} }));
  });
  return { pronto, enviar, fechar: () => ws.close() };
}
async function naPagina(cdp, expr) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const ex = r.result && r.result.exceptionDetails;
  if (ex) throw new Error(String((ex.exception && ex.exception.description) || ex.text));
  return r.result && r.result.result && r.result.result.value;
}

// ---------------------------------------------------------------- dentro da pagina
// Instala um timbrado de prova com a area livre CONHECIDA e prepara a bancada.
const PREPARAR = `(() => {
  const c = document.createElement('canvas');
  c.width = 2480; c.height = 3508;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  // cabecalho ate ${MASCARA.cabecalhoAte} mm e rodape a partir de ${MASCARA.rodapeDe} mm
  const mm = c.height / 297;
  x.fillStyle = '#176b78';
  x.fillRect(0, 0, c.width, Math.round(${MASCARA.cabecalhoAte} * mm));
  x.fillRect(0, Math.round(${MASCARA.rodapeDe} * mm), c.width, c.height - Math.round(${MASCARA.rodapeDe} * mm));
  const img = c.toDataURL('image/png');
  localStorage.setItem('glocais', JSON.stringify([{ k: 'loc-bancada', nome: 'Bancada',
    img: img, padTopMm: ${MASCARA.reservaTopo}, padBottomMm: ${MASCARA.reservaBase} }]));
  exAplicarLocaisExtra();
  window.__fundo = 'loc-bancada'; window.__fundoPerguntado = true;
  return !!(FUNDOS['loc-bancada'] && FUNDOS['loc-bancada'].img);
})()`;

// Monta um laudo com N paragrafos, pagina, e devolve o que a CAMADA A precisa saber.
// A folha e medida DESTRAVANDO a tela o instante da medida (rev2PaginarMedindo), que e
// o que o proprio programa faz ao imprimir.
const MONTAR = (n) => `(() => {
  exames = exames.filter(e => e.id !== 7700);
  const ps = [];
  for (let i = 1; i <= ${n}; i++) ps.push('Paragrafo ' + i + ' do laudo de bancada, com texto suficiente para ocupar a largura da folha inteira e obrigar a quebra de linha.');
  exames.push({ id: 7700, tipo: 'abdominal', paciente: 'Bancada', imagens: [], audios: [],
    laudo: { cab: { nome: 'Bancada', idade: '60 anos', realizado_em: '06/09/2026', dados_clinicos: '' },
             titulo: 'ULTRASSONOGRAFIA DE BANCADA', tecnica: 'Tecnica do exame.',
             corpo: ps.join('\\n\\n'),
             conclusao: 'Conclusao do exame de bancada.',
             extra: 'Esclarecemos que a impressao diagnostica nao e absoluta.', obs: '' } });
  _rev2Id = 7700;
  const tela = document.getElementById('telaRevisao');
  tela.style.display = 'none';               // o cenario dele: a folha esta escondida
  rev2Preparar();
  const pacote = impHtmlDoLaudo();           // e ele quem pagina, destravando para medir
  /* E AGORA A BANCADA DESTRAVA PARA MEDIR — sem repaginar. Escondida, a folha devolve
     zero em tudo (getBoundingClientRect de elemento em display:none e todo zero), e a
     CAMADA A mediria um laudo de zero folha, com a assinatura na folha 1 e o texto
     terminando na folha 0. Foi o que a primeira versao desta bancada fez. */
  tela.style.display = 'block';
  const f = document.querySelector('#areaImpressao .laudoFolha');
  const larg = f.clientWidth || 794;
  const pageH = larg / 210 * 297;
  const fr = f.getBoundingClientRect();
  const pagDe = (v) => Math.floor((v - fr.top + 1) / pageH);
  const caixa = f.querySelector('.laudoCorpoBox');
  const assin = f.querySelector('.assin');
  const rod = f.querySelector('.rodapeLaudo');
  const fim = rod || assin;
  // o menor corpo de letra em uso, separando o laudo dos avisos de rodape
  let menorCorpo = 999, menorAviso = 999;
  Array.prototype.forEach.call(f.querySelectorAll('*'), (el) => {
    if (!(el.textContent || '').trim()) return;
    if (el.querySelector && el.querySelector('*')) return;      // so as folhas da arvore
    const px = parseFloat(getComputedStyle(el).fontSize) || 999;
    const aviso = !!(el.closest && (el.closest('.laudoExtra') || el.closest('.rodapeLaudo')));
    if (aviso) menorAviso = Math.min(menorAviso, px); else menorCorpo = Math.min(menorCorpo, px);
  });
  /* O QUE A FOLHA RESERVOU E ONDE OS VAOS CAIRAM. Nao e enfeite: quando a regra 3 cai, a
     pergunta seguinte e sempre "o vao foi para o lugar certo?", e sem estes numeros a
     resposta custa uma tarde de sonda. Em 06/09 custou. */
  const cs = getComputedStyle(f);
  const pxmm = larg / 210;
  const vaos = Array.prototype.map.call(f.querySelectorAll('.quebraFolha,.peDaFolha'), (n) => {
    const r = n.getBoundingClientRect();
    return { classe: String(n.className), deMm: +((r.top - fr.top) / pxmm).toFixed(1),
             ateMm: +((r.bottom - fr.top) / pxmm).toFixed(1) };
  });
  /* ONDE CADA BLOCO CAIU, na folha do app. Comparar isto com a mesma medida feita no
     desenho que vira FOTO e o unico jeito de achar uma diferenca entre as duas — foi
     assim que se achou, em 06/09, que a folha fotografada nao era a folha da tela. */
  const blocos = {};
  ['.laudoCab', '.laudoTitulo', '.laudoTexto', '.laudoCorpoBox', '.assin', '.rodapeLaudo']
    .forEach((sel) => {
      const el = f.querySelector(sel); if (!el) return;
      const r = el.getBoundingClientRect(), c2 = getComputedStyle(el);
      blocos[sel] = { deMm: +((r.top - fr.top) / pxmm).toFixed(1),
                      ateMm: +((r.bottom - fr.top) / pxmm).toFixed(1),
                      larguraPx: +r.width.toFixed(1), fonte: c2.fontSize,
                      entrelinha: c2.lineHeight, espacoBranco: c2.whiteSpace,
                      familia: (c2.fontFamily || '').slice(0, 22),
                      linhas: Math.round(r.height / (parseFloat(c2.lineHeight) || 1)) };
    });
  /* A REGUA DA LETRA. Largura, corpo e entrelinha podem bater e o texto ainda assim
     quebrar noutro lugar — basta a FONTE resolvida ser outra. Medir uma frase conhecida e
     o unico jeito de comparar duas paginas sem acreditar no que elas declaram. */
  let reguaPx = -1;
  try {
    const alvoR = f.querySelector('.laudoTexto');
    const sp = document.createElement('span');
    sp.style.cssText = 'white-space:pre;position:absolute;visibility:hidden';
    sp.textContent = 'Paragrafo 1 do laudo de bancada, com texto suficiente';
    alvoR.appendChild(sp);
    reguaPx = +sp.getBoundingClientRect().width.toFixed(1);
    alvoR.removeChild(sp);
  } catch (e) { /* medida de apoio: nao pode derrubar a bancada */ }
  const _txEl = f.querySelector('.laudoTexto');
  const resposta = {
    textoHtmlLen: _txEl ? _txEl.innerHTML.length : -1,
    textoTxtLen: _txEl ? (_txEl.innerText || '').length : -1,
    quebrasNoTexto: _txEl ? _txEl.querySelectorAll('.quebraFolha').length : -1,
    brsNoTexto: _txEl ? _txEl.querySelectorAll('br').length : -1,
    reguaPx: reguaPx,
    blocos: blocos,
    reservaTopoMm: +((parseFloat(cs.paddingTop) || 0) / pxmm).toFixed(1),
    reservaBaseMm: +((parseFloat(cs.paddingBottom) || 0) / pxmm).toFixed(1),
    nivel: f.getAttribute('data-nivel'),
    vaos: vaos,
    paginas: fim ? pagDe(fim.getBoundingClientRect().bottom - 2) + 1 : 1,
    pagAssinatura: assin ? pagDe(assin.getBoundingClientRect().top) : -1,
    pagFimDoTexto: caixa ? pagDe(caixa.getBoundingClientRect().bottom - 2) : -1,
    menorCorpo: menorCorpo, menorAviso: menorAviso,
    largFolha: larg, temQuebra: (pacote.html || '').indexOf('quebraFolha') >= 0,
    pacote: { html: pacote.html, css: pacote.css, fundo: pacote.fundo }
  };
  tela.style.display = 'none';               // devolve a tela como estava
  return resposta;
})()`;

(async () => {
  const chrome = acharChrome();
  if (!chrome) { console.log('  PULADO: nao achei Chrome nem Edge nesta maquina'); process.exit(0); }
  const python = acharPython();
  const { srv, porta } = await servir();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'bancada-'));
  const portaCDP = 9222 + Math.floor(Math.random() * 700);
  const flags = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + portaCDP, '--user-data-dir=' + perfil];
  if (process.getuid && process.getuid() === 0) flags.push('--no-sandbox');
  const proc = spawn(chrome, flags.concat('http://127.0.0.1:' + porta + '/index.html'), { stdio: 'ignore' });

  let cdp = null;
  const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), 'bancada-obra-'));
  try {
    cdp = conectar(await alvoDoChrome(portaCDP));
    await cdp.pronto;
    await cdp.enviar('Runtime.enable');
    for (let i = 0; i < 80; i++) {
      if (await naPagina(cdp, "typeof impHtmlDoLaudo==='function' && typeof exAplicarLocaisExtra==='function'")) break;
      await esperar(250);
    }
    ok(await naPagina(cdp, PREPARAR), 'o timbrado de prova entrou, com area livre conhecida',
       MASCARA.cabecalhoAte + '..' + MASCARA.rodapeDe + ' mm');

    // ---- acha o ponto de virada: quantos paragrafos ainda cabem em UMA folha
    console.log('\n=== os casos-limite se ajustam sozinhos ===');
    let cabe = 1, virou = 0;
    for (let n = 2; n <= 80; n += 2) {
      const r = await naPagina(cdp, MONTAR(n));
      if (r.paginas > 1) { virou = n; break; }
      cabe = n;
    }
    ok(virou > 0, 'achei quantos paragrafos fazem o laudo virar a folha',
       'cabe ' + cabe + ', vira em ' + virou);

    const CASOS = [
      { nome: 'curto', n: 3 },
      { nome: 'quase uma folha', n: cabe },
      { nome: 'uma linha alem', n: virou },
      { nome: 'duas folhas cheias', n: virou * 2 },
    ];

    console.log('\n=== CAMADA A — as regras medidas no desenho ===');
    const medidos = [];
    for (const caso of CASOS) {
      const r = await naPagina(cdp, MONTAR(caso.n));
      medidos.push({ caso, r });
      console.log('  · ' + caso.nome + ' (' + caso.n + ' paragrafos): ' + r.paginas + ' folha(s)'
        + ' · reserva ' + r.reservaTopoMm + '/' + r.reservaBaseMm + ' mm'
        + ' · degrau ' + (r.nivel || '0')
        + (r.vaos.length ? (' · vaos ' + r.vaos.map(v => v.deMm + '→' + v.ateMm).join(', ')) : ' · sem vao'));
      console.log('      folha ' + r.largFolha + ' px de largura · regua da letra ' + r.reguaPx + ' px');
      console.log('      blocos: ' + Object.keys(r.blocos)
        .map(k => k.replace('.laudo', '').replace('.', '') + ' ' + r.blocos[k].deMm + '→' + r.blocos[k].ateMm)
        .join(' | '));
      const _tx = r.blocos['.laudoTexto'];
      if (_tx) console.log('      texto: ' + _tx.larguraPx + ' px · ' + _tx.fonte + '/'
        + _tx.entrelinha + ' · ' + _tx.linhas + ' linhas · html ' + r.textoHtmlLen
        + ' ch · visivel ' + r.textoTxtLen + ' ch · ' + r.quebrasNoTexto + ' vao(s), '
        + r.brsNoTexto + ' br · white-space ' + _tx.espacoBranco);
      // REGRA 1 — a folha da assinatura tem de ter texto do laudo
      ok(r.pagAssinatura >= 0 && r.pagAssinatura === r.pagFimDoTexto,
         '   regra 1: a assinatura nao fica sozinha na folha',
         'assinatura na ' + (r.pagAssinatura + 1) + ', texto termina na ' + (r.pagFimDoTexto + 1));
      // REGRA 2 — piso do tamanho de letra
      ok(r.menorCorpo >= PISO_CORPO,
         '   regra 2: nenhuma letra do laudo abaixo de ' + PISO_CORPO, 'menor ' + r.menorCorpo);
      ok(r.menorAviso === 999 || r.menorAviso >= PISO_AVISO,
         '   regra 2: nem os avisos de rodape abaixo de ' + PISO_AVISO, 'menor ' + r.menorAviso);
      // e a folha foi mesmo paginada antes de virar foto
      ok(r.paginas === 1 || r.temQuebra,
         '   a foto mandada a impressora vai paginada');
      fs.writeFileSync(path.join(trabalho, caso.nome.replace(/ /g, '-') + '.json'),
                       JSON.stringify(r.pacote));
    }

    console.log('\n=== CAMADA B — a folha PRONTA, composta sem gastar papel ===');
    if (!python) {
      console.log('  PULADO: nao achei um Python com o agente ao lado (defina PYTHON_LAUDOS)');
    } else if (!fs.existsSync(COMPOR)) {
      console.log('  PULADO: nao achei ' + COMPOR);
    } else {
      for (const caso of CASOS) {
        const nome = caso.nome.replace(/ /g, '-');
        const saida = path.join(trabalho, 'saida-' + nome);
        const r = spawnSync(python, [COMPOR, path.join(trabalho, nome + '.json'), saida],
                            { encoding: 'utf8', timeout: 900000 });
        const arq = path.join(saida, 'medidas.json');
        if (!fs.existsSync(arq)) {
          ok(false, '  ' + caso.nome + ': a composicao nao respondeu',
             ((r.stdout || '') + (r.stderr || '')).trim().slice(-160));
          continue;
        }
        const m = JSON.parse(fs.readFileSync(arq, 'utf8'));
        if (!m.ok) {
          if (m.pulado) { console.log('  PULADO: ' + m.erro); break; }
          ok(false, '  ' + caso.nome + ': ' + m.erro);
          continue;
        }
        console.log('  · ' + caso.nome + ': ' + m.paginas + ' folha(s) compostas');
        // REGRA 4 — a foto chega em resolucao alta
        ok(m.escalaFoto >= 2 && m.fotoLarguraPx >= 794 * 2,
           '   regra 4: a foto vai em resolucao alta',
           m.fotoLarguraPx + ' px (' + Math.round(m.fotoLarguraPx / 210 * 25.4) + ' dpi)');
        // REGRA 3 — nenhuma tinta do laudo fora da area livre da mascara
        m.porPagina.forEach((p, i) => {
          ok(p.tintaDeMm >= MASCARA.cabecalhoAte,
             '   regra 3: folha ' + (i + 1) + ' — o texto comeca abaixo do cabecalho da mascara',
             p.tintaDeMm + ' mm >= ' + MASCARA.cabecalhoAte);
          ok(p.tintaAteMm <= MASCARA.rodapeDe,
             '   regra 3: folha ' + (i + 1) + ' — e termina acima do rodape da mascara',
             p.tintaAteMm + ' mm <= ' + MASCARA.rodapeDe);
          // nenhuma folha so com a mascara: se saiu papel, tem de haver laudo nele
          ok(p.tintaDeMm >= 0 && p.cobertura > 0.02,
             '   folha ' + (i + 1) + ' tem laudo — nao e uma folha so com a mascara',
             'cobertura ' + Math.round(p.cobertura * 100) + '%');
        });
        // e a mascara sai em TODAS as folhas
        ok(m.paginasComFundo === m.paginas,
           '   o timbrado sai em todas as folhas',
           m.paginasComFundo + ' de ' + m.paginas);
      }
    }
  } catch (e) {
    ok(false, 'a bancada rodou de ponta a ponta', e.constructor.name + ': ' + e.message);
  } finally {
    if (cdp) cdp.fechar();
    try { proc.kill(); } catch (e) { /* ja saiu */ }
    srv.close();
  }
  console.log('');
  /* As folhas compostas ficam no disco quando algo falha: uma medida em milimetros diz
     QUE regra caiu, mas nao MOSTRA a folha — e quem conserta precisa ver. */
  if (falhas) console.log('  as folhas compostas estao em: ' + trabalho);
  console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
  process.exit(falhas ? 1 : 0);
})();
