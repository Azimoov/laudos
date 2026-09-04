// A CAIXA EM VOLTA DO TEXTO NAO PODE DESCOLAR DO TEXTO — 04/09/2026, relatado por ele.
//
// "Quando eu libero um exame a partir da tela de visualizar laudo, a linha, a caixa em
// volta do texto principal fica arrastada mais para a esquerda e acaba sobrepondo o texto."
//
// O ENCADEAMENTO, medido:
//   1. o timbrado dele e um LOCAL DE ATENDIMENTO que ele mesmo cadastrou. Mora em
//      `glocais`, nao em FUNDOS — entao `margensDaFolha` nao acha a ficha do timbrado e
//      cai na unica outra prova que tinha: a imagem embutida na folha;
//   2. `salvarLaudoHistorico` RETIRA `<img class="fundoLaudo">` antes de guardar (e ela
//      que estoura a cota do navegador). A prova sumia junto com o laudo guardado;
//   3. sem a imagem, o laudo era julgado "sem timbrado" e o lado ia de 8 mm para 12 mm:
//      o texto anda 4 mm (~15 px) para dentro da folha;
//   4. as molduras de cada folha sao desenhadas em PIXELS FIXOS, medidos no desenho de
//      8 mm, e nao andam junto. Medido: 14,1 px de descolamento, com a linha da direita
//      caindo dentro do texto.
//
// POR QUE ABRE UM CHROME: nada no texto do index.html diz "isto vai sair torto". A
// pergunta so tem resposta MEDINDO a folha em midia de impressao, que e onde `lado`
// manda. Uma suite de regex passaria verde com a caixa cortando o laudo.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function acharChrome() {
  return [
    process.env.CHROME_BIN,
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
  for (let i = 0; i < 60; i++) {
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
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const pronto = new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('nao consegui falar com o Chrome'))); });
  const enviar = (m, p) => new Promise(res => { const id = ++n; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  return { pronto, enviar, fechar: () => ws.close() };
}
async function naPagina(cdp, expr) {
  const r = await cdp.enviar('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const ex = r.result && r.result.exceptionDetails;
  if (ex) throw new Error(String((ex.exception && ex.exception.description) || ex.text));
  return r.result && r.result.result && r.result.result.value;
}

// mede a folha de um container: onde esta a caixa, onde esta a moldura, onde esta o texto
const MEDIR = raiz => `(() => {
  const f = document.querySelector('${raiz} .laudoFolha');
  if (!f) return { erro: 'sem folha' };
  const fr = f.getBoundingClientRect();
  const cx = f.querySelector('.laudoCorpoBox').getBoundingClientRect();
  const tx = f.querySelector('.laudoTexto').getBoundingClientRect();
  const m  = f.querySelector('.laudoMoldura');
  const mr = m ? m.getBoundingClientRect() : null;
  return {
    lado: margensDaFolha().lado,
    temFundo: margensDaFolha().temFundo,
    pad: Math.round(parseFloat(getComputedStyle(f).paddingLeft)),
    caixaL: +(cx.left - fr.left).toFixed(1),
    caixaR: +(cx.right - fr.left).toFixed(1),
    textoL: +(tx.left - fr.left).toFixed(1),
    textoR: +(tx.right - fr.left).toFixed(1),
    molL: mr ? +(mr.left - fr.left).toFixed(1) : null,
    molR: mr ? +(mr.right - fr.left).toFixed(1) : null,
    // ⚠️ O EIXO VERTICAL É O QUE CUMPRE A QUEIXA DELE. A 1a versao desta suite so olhava
    // left/right, e por isso dava VERDE com a moldura 14,1 px fora do lugar: na horizontal
    // ela fica mais LARGA que a caixa e nunca cruza o texto. Quem "sobrepoe o texto" e a
    // linha de CIMA, que descolava 72,8 px e caia 26 px dentro das letras.
    caixaT: +(cx.top - fr.top).toFixed(1),
    caixaB: +(cx.bottom - fr.top).toFixed(1),
    textoT: +(tx.top - fr.top).toFixed(1),
    textoB: +(tx.bottom - fr.top).toFixed(1),
    molT: mr ? +(mr.top - fr.top).toFixed(1) : null,
    molB: mr ? +(mr.bottom - fr.top).toFixed(1) : null,
    desloc: mr ? +(mr.left - cx.left).toFixed(1) : null,
    deslocV: mr ? +(mr.top - cx.top).toFixed(1) : null,
    // alguma linha da moldura cai DENTRO do bloco de texto?
    cortaTexto: mr ? (mr.right < tx.right - 1 || mr.left > tx.left + 1
                      || (mr.top > tx.top + 1 && mr.top < tx.bottom - 1)
                      || (mr.bottom > tx.top + 1 && mr.bottom < tx.bottom - 1)) : false
  };
})()`;

// Monta o cenario dele: timbrado PROPRIO (chave que nao existe em FUNDOS), imagem
// embutida, folha visivel na tela "Ver o laudo final".
const MONTAR = `(() => {
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const L = [];
  for (let i = 0; i < 24; i++) L.push('<p>Linha ' + i + ' do laudo, com texto suficiente para ocupar a largura da folha inteira.</p>');
  const area = document.getElementById('areaImpressao');
  area.innerHTML = '<div class="laudoFolha comFundo" data-fundo="ame-tailandia">'
    + '<img class="fundoLaudo" src="' + PX + '">'
    + '<div class="laudoCorpoBox"><div class="laudoTitulo">TITULO</div>'
    + '<div class="laudoTexto">' + L.join('') + '</div></div>'
    + '<div class="assin"><p>Dr. Daniel</p></div></div>';
  window.__fundo = 'ame-tailandia'; window.__fundoPerguntado = true;
  document.getElementById('rv2FinalHost').appendChild(area);
  document.getElementById('rv2Final').classList.add('aberta');
  try { aplicarMargensImpressao(); } catch (e) {}
  try { paginarLaudoTela(); } catch (e) {}
  return typeof FUNDOS !== 'undefined' && !!FUNDOS['ame-tailandia'];
})()`;

// O que salvarLaudoHistorico guarda: folhaHtmlLimpo SEM a imagem do timbrado.
const GUARDAR = `(() => {
  let html = folhaHtmlLimpo();
  html = html.replace(/<img class="fundoLaudo"[^>]*>/g, '');
  document.getElementById('areaImpressaoHist').innerHTML = html;
  document.getElementById('telaVerLaudo').style.display = 'block';
  try { aplicarMargensImpressao(); } catch (e) {}
  return html.indexOf('fundoLaudo') < 0;
})()`;

(async () => {
  const chrome = acharChrome();
  if (!chrome) { console.log('  PULADO: nao achei Chrome nem Edge nesta maquina'); process.exit(0); }
  const { srv, porta } = await servir();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'laudos-mold-'));
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
    await cdp.enviar('Emulation.enable');
    for (let i = 0; i < 60; i++) {
      if (await naPagina(cdp, "typeof margensDaFolha==='function' && typeof paginarLaudoTela==='function'")) break;
      await esperar(250);
    }
    ok(await naPagina(cdp, "typeof margensDaFolha==='function'"), 'a pagina carregou');

    console.log('\n=== o timbrado que ELE cadastrou nao esta em FUNDOS ===');
    // E a raiz de tudo: sem ficha em FUNDOS, a unica prova de timbrado era a imagem.
    const estaEmFundos = await naPagina(cdp, MONTAR);
    ok(estaEmFundos === false,
       'a chave do timbrado proprio nao tem ficha em FUNDOS  [' + estaEmFundos + ']');
    await esperar(400);
    const tela = await naPagina(cdp, MEDIR('#areaImpressao'));
    ok(tela.temFundo === true && tela.lado === 8,
       'com a imagem na folha, o programa sabe que ha timbrado  [lado ' + tela.lado + 'mm]');
    ok(tela.molL != null, 'e a moldura da folha foi desenhada');
    ok(Math.abs(tela.desloc) <= 2,
       'que contorna a caixa do texto  [descolamento ' + tela.desloc + ' px]');

    console.log('\n=== o laudo GUARDADO perde a imagem, mas nao pode perder o timbrado ===');
    const tirou = await naPagina(cdp, GUARDAR);
    ok(tirou === true, 'a imagem do timbrado sai do que e guardado (e ela que estoura a cota)');
    await esperar(300);
    const hist = await naPagina(cdp, MEDIR('#areaImpressaoHist'));
    ok(hist.temFundo === true,
       'e MESMO ASSIM o laudo guardado continua sendo um laudo com timbrado  [temFundo '
       + hist.temFundo + ']');
    ok(hist.lado === 8,
       'com a mesma margem lateral do original — 8 mm, nao 12  [lado ' + hist.lado + 'mm]');

    console.log('\n=== e no PAPEL, que e onde essa margem manda ===');
    await cdp.enviar('Emulation.setEmulatedMedia', { media: 'print' });
    await naPagina(cdp, 'try{ aplicarMargensImpressao(); }catch(e){}');
    await esperar(350);
    const papel = await naPagina(cdp, MEDIR('#areaImpressaoHist'));
    console.log('        X: caixa ' + papel.caixaL + '..' + papel.caixaR
      + ' | moldura ' + papel.molL + '..' + papel.molR
      + ' | texto ' + papel.textoL + '..' + papel.textoR);
    console.log('        Y: caixa ' + papel.caixaT + '..' + papel.caixaB
      + ' | moldura ' + papel.molT + '..' + papel.molB
      + ' | texto ' + papel.textoT + '..' + papel.textoB + ' | pad ' + papel.pad + 'px');
    ok(Math.abs(papel.desloc) <= 2,
       'a moldura contorna a caixa na horizontal  [descolamento ' + papel.desloc + ' px]');
    // ESTE E O EIXO DA QUEIXA. Com o defeito dava +72,8 px, e a linha de cima da moldura
    // caia 26 px dentro do texto.
    ok(Math.abs(papel.deslocV) <= 2,
       'e na VERTICAL, que e onde ela sobrepunha o texto  [descolamento ' + papel.deslocV + ' px]');
    ok(!papel.cortaTexto,
       'nenhuma linha da moldura cai dentro do texto — era esta a queixa dele');
    // a prova pelo avesso: com o defeito, o lado ia a 12 mm e a caixa andava ~15 px
    ok(papel.pad <= 32,
       'a folha impressa mantem os 8 mm de lado (30 px), nao os 12 mm (45 px)  ['
       + papel.pad + ' px]');
    await cdp.enviar('Emulation.setEmulatedMedia', { media: 'screen' });

    console.log('\n=== A REGRESSAO QUE A 1a CORRECAO CRIOU: marca sem timbrado ===');
    /* `abrirRevisao` escreve `data-fundo` SEMPRE, mesmo quando nao ha timbrado nenhum para
       por — a classe `comFundo` e que so entra quando ha imagem. Aceitar a marca sozinha
       dava 8 mm de lado e 5,8 mm de topo a uma FOLHA BRANCA no arquivo salvo,
       ressuscitando o defeito de 01/09 ("texto alto e rente as bordas"). */
    const marcaSemTimbre = await naPagina(cdp, `(() => {
      document.getElementById('telaVerLaudo').style.display = 'none';
      document.getElementById('areaImpressaoHist').innerHTML = '';
      document.getElementById('areaImpressao').innerHTML =
        '<div class="laudoFolha" data-fundo="loc-desconhecido">'
        + '<div class="laudoCorpoBox"><div class="laudoTexto"><p>Sem timbrado de verdade.</p>'
        + '</div></div></div>';
      const m = margensDaFolha();
      return { lado: m.lado, topo: m.topo, temFundo: m.temFundo };
    })()`);
    ok(marcaSemTimbre.temFundo === false,
       'folha COM marca mas SEM a classe comFundo nao e tratada como timbrada');
    ok(marcaSemTimbre.lado === 12 && marcaSemTimbre.topo === 15,
       'e mantem o respiro da folha branca: 12 mm de lado, 15 de topo  [lado '
       + marcaSemTimbre.lado + ', topo ' + marcaSemTimbre.topo + ']');

    console.log('\n=== os timbrados dele existem desde a ABERTURA do programa ===');
    /* `exAplicarLocaisExtra` e quem poe os locais cadastrados dentro de FUNDOS, e ela so
       rodava ao salvar o cadastro e ao abrir "Realizar exames". Numa sessao em que ele vai
       direto para "Liberar laudos" ou para o Historico, o timbrado dele nao existia: o
       laudo guardado reabria e IMPRIMIA SEM O TIMBRADO. A margem era o sintoma menor. */
    const naAbertura = await naPagina(cdp, `(() => {
      const chave = 'loc-teste-abertura';
      const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const antes = !!FUNDOS[chave];
      localStorage.setItem('glocais', JSON.stringify(
        [{ k: chave, nome: 'Teste Abertura', img: PX, padTopMm: 34, padBottomMm: 24 }]));
      exAplicarLocaisExtra();
      const depois = !!(FUNDOS[chave] && FUNDOS[chave].img);
      localStorage.removeItem('glocais');
      return { antes: antes, depois: depois };
    })()`);
    ok(naAbertura.antes === false && naAbertura.depois === true,
       'exAplicarLocaisExtra traz o timbrado cadastrado para dentro de FUNDOS');
    const chamadaNaAbertura = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
    ok(/DOMContentLoaded[\s\S]{0,900}exAplicarLocaisExtra\(\)/.test(chamadaNaAbertura),
       'e ela e chamada na ABERTURA, nao so ao passar por "Realizar exames"');
    ok(/if\(r\.baixados\.length\)[\s\S]{0,4000}exAplicarLocaisExtra\(\);\s*rev2AtualizarFundos\(\)/.test(chamadaNaAbertura),
       'e a copia de locais que chega depois, pelo agente, atualiza a liberacao ja aberta');
    ok(/id="rv2Fundo"/.test(chamadaNaAbertura) && /function rev2AtualizarFundos\(\)/.test(chamadaNaAbertura),
       'a atualizacao troca so a lista de fundos, sem remontar o laudo em edicao');

    console.log('\n=== OS DOIS CAMINHOS DE SALVAR TEM DE GUARDAR A MESMA COISA ===');
    /* Ele mostrou a folha e disse a frase que resolveu o caso: "se eu salvo apertando
       'aprovar e assinar próximo laudo' na tela anterior, ele salva certo, mas se eu faço
       esse caminho [Ver o laudo final → Salvar e liberar], ele salva dessa forma".

       O QUE OS DOIS FAZIAM DE DIFERENTE, medido em 04/09:
         · "Aprovar e assinar" chama rev2Preparar antes de salvar. O #areaImpressao está
           dentro da telaRevisao, escondida, e a paginação desiste de medir: o laudo é
           guardado com ZERO molduras e com a BORDA PRÓPRIA da caixa;
         · "Ver o laudo final" pagina com a folha VISÍVEL: desenha molduras em pixels fixos
           (medidos NAQUELA janela) e APAGA a borda própria da caixa. `jaPreparado=true`
           fazia o salvamento levar exatamente esse estado.
       Na folha dele o retângulo saiu mais estreito que a caixa e o texto escapou por fora
       dele — porque aqueles pixels foram medidos noutra régua.

       Esta verificação compara os DOIS caminhos. É a mais valiosa da suíte: enquanto eles
       guardarem a mesma coisa, não importa por qual porta ele salva. */
    const dois = await naPagina(cdp, `(() => {
      document.getElementById('telaVerLaudo').style.display = 'none';
      document.getElementById('areaImpressaoHist').innerHTML = '';
      const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const L = [];
      for (let i = 0; i < 26; i++) L.push('Linha ' + i + ' do laudo com bastante texto para ocupar a largura toda.');
      const montar = () => {
        exames = [{ id: 8001, paciente: 'Teste Dois Caminhos', tipo: 'abdominal',
          imagens: [], audios: [], _liberado: false, _quando: Date.now(),
          laudo: { cab: { nome: 'Teste Dois Caminhos' }, titulo: 'T', tecnica: 't',
                   corpo: L.join(String.fromCharCode(10, 10)), conclusao: 'Normal.', obs: '' } }];
        window.__fundo = 'capanema'; window.__fundoPerguntado = true;
        _rev2Id = 8001; _rev2Origem = 'dia';
        rev2Abrir(8001);
      };
      const retrato = () => {
        const f = document.querySelector('#areaImpressao .laudoFolha');
        const cx = f && f.querySelector('.laudoCorpoBox');
        const h = folhaHtmlLimpo();
        return { molduras: f ? f.querySelectorAll('.laudoMoldura').length : -1,
                 bordaCaixa: cx ? (cx.style.borderColor || '(propria)') : '(sem caixa)',
                 htmlTemMoldura: h.indexOf('laudoMoldura') >= 0,
                 htmlTemTransparente: h.indexOf('border-color: transparent') >= 0
                                   || h.indexOf('border-color:transparent') >= 0 };
      };
      // CAMINHO A — 'Aprovar, assinar e imprimir -> proximo laudo'. O #areaImpressao
      // volta para a telaRevisao, escondida, que e onde ele esta na vida real.
      document.getElementById('rv2Final').classList.remove('aberta');
      document.getElementById('revLayout').appendChild(document.getElementById('areaImpressao'));
      montar(); rev2Preparar();
      const A = retrato();
      // CAMINHO B — "Ver o laudo final" -> "Salvar e liberar"
      montar(); rev2VerFinal();
      rev2FinalFechar(); try { paginarLaudoTela(); } catch (e) {}
      const B = retrato();
      try { rev2FinalFechar(); } catch (e) {}
      exames = [];
      return { A: A, B: B };
    })()`);
    ok(dois.A.molduras === 0 && dois.A.htmlTemMoldura === false,
       'o caminho "Aprovar e assinar" guarda o laudo SEM moldura em pixels  ['
       + dois.A.molduras + ']');
    ok(dois.B.molduras === 0 && dois.B.htmlTemMoldura === false,
       'e o caminho "Ver o laudo final" passou a guardar igual  [' + dois.B.molduras + ']');
    ok(dois.A.bordaCaixa === dois.B.bordaCaixa,
       'a borda da caixa fica igual nos dois  [A ' + dois.A.bordaCaixa
       + ' · B ' + dois.B.bordaCaixa + ']');
    ok(dois.B.htmlTemTransparente === false,
       'e a borda propria da caixa NAO viaja apagada — era ela que sumia, deixando so o '
       + 'retangulo desenhado na regua errada');
    ok(JSON.stringify(dois.A) === JSON.stringify(dois.B),
       'os dois caminhos guardam exatamente a mesma coisa');

    console.log('\n=== desistir de medir nao pode custar o retangulo ===');
    /* Quando a paginacao desiste (folha escondida, largura zero) ela ja removia as
       molduras; se a borda propria continuasse transparente, o laudo ficava SEM caixa
       nenhuma em volta do texto — nem a de verdade, nem a desenhada. */
    const semCaixa = await naPagina(cdp, `(() => {
      const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const area = document.getElementById('areaImpressao');
      document.getElementById('rv2Final').classList.remove('aberta');
      document.getElementById('telaRevisao').appendChild(area);
      document.getElementById('telaRevisao').style.display = 'none';
      area.innerHTML = '<div class="laudoFolha comFundo" data-fundo="capanema">'
        + '<img class="fundoLaudo" src="' + PX + '">'
        + '<div class="laudoCorpoBox" style="border-color:transparent">'
        + '<div class="laudoTexto"><p>x</p></div></div></div>';
      try { paginarLaudoTela(); } catch (e) {}
      const cx = area.querySelector('.laudoCorpoBox');
      return { largura: area.querySelector('.laudoFolha').clientWidth,
               borda: cx.style.borderColor || '(propria)' };
    })()`);
    ok(semCaixa.largura === 0, 'o cenario e mesmo o da folha escondida  [' + semCaixa.largura + ' px]');
    ok(semCaixa.borda === '(propria)',
       'e a borda propria da caixa volta antes de desistir  [' + semCaixa.borda + ']');

    console.log('\n=== e a folha BRANCA continua com o respiro dela ===');
    // 12 mm nas laterais e regra de 01/09 para o laudo sem timbrado: a correcao nao pode
    // ter transformado toda folha em folha timbrada.
    const branca = await naPagina(cdp, `(() => {
      document.getElementById('telaVerLaudo').style.display = 'none';
      document.getElementById('areaImpressaoHist').innerHTML = '';
      const area = document.getElementById('areaImpressao');
      area.innerHTML = '<div class="laudoFolha" data-fundo="branco">'
        + '<div class="laudoCorpoBox"><div class="laudoTexto"><p>Sem timbrado.</p></div></div></div>';
      window.__fundo = 'branco';
      const m = margensDaFolha();
      return { lado: m.lado, temFundo: m.temFundo };
    })()`);
    ok(branca.temFundo === false && branca.lado === 12,
       'folha branca segue com 12 mm de lado e sem timbrado  [lado ' + branca.lado + 'mm]');
    const semMarca = await naPagina(cdp, `(() => {
      const area = document.getElementById('areaImpressao');
      area.innerHTML = '<div class="laudoFolha"><div class="laudoCorpoBox">'
        + '<div class="laudoTexto"><p>Folha sem marca nenhuma.</p></div></div></div>';
      const m = margensDaFolha();
      return { lado: m.lado, temFundo: m.temFundo };
    })()`);
    ok(semMarca.temFundo === false,
       'e folha sem marca nenhuma tambem  [lado ' + semMarca.lado + 'mm]');
  } catch (e) {
    ok(false, 'a medicao rodou: ' + e.message);
  } finally {
    if (cdp) cdp.fechar();
    try { proc.kill(); } catch (e) {}
    srv.close();
    setTimeout(() => {
      try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
      console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
      process.exit(falhas ? 1 : 0);
    }, 400);
  }
})();
