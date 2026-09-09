// O LAUDO CHEGA AO PAPEL? — defeito relatado pelo Dr. Daniel em 01/09/2026, 23:09.
//
// O QUE ELE VIU: clicou em "Aprovar, assinar e imprimir → próximo laudo" e recebeu SEIS
// FOLHAS EM BRANCO. Antes, no mesmo dia, quatro. Nenhum erro na tela, nenhum aviso — a
// caixa de impressão abria certinha e o papel é que vinha vazio.
//
// A CAUSA: o #areaImpressao — a folha que vai ao papel — mora fisicamente dentro de
// #telaRevisao, a tela ANTIGA de revisão. A tela 2.0 esconde essa tela (display:none) ao
// abrir, e o que está dentro de display:none não é renderizado nem impresso. O laudo
// estava lá, com o texto inteiro; só não existia para a impressora. A tela "Ver o laudo
// final" escapava por acidente, porque MOVE o nó para um lugar visível — e foi isso que
// mascarou o defeito por semanas: quem testava por ali via tudo funcionando.
//
// POR QUE ESTA SUÍTE ABRE UM CHROME DE VERDADE: o defeito não é legível no código. Nada
// no texto do index.html diz "isto vai sair em branco" — é preciso PÔR A PÁGINA EM MÍDIA
// DE IMPRESSÃO e medir o tamanho da folha. Uma suíte de regex teria passado o dia inteiro
// verde enquanto o médico recebia papel vazio. Aqui a pergunta é a que importa: com a tela
// que ele usa aberta, a folha do laudo tem tamanho no papel?
//
// SEM DEPENDÊNCIA NENHUMA: usa o Chrome (ou Edge) já instalado, pelo protocolo do
// DevTools — mesmo caminho de teste-navegador.js.
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

// A medição: dispara a MESMA preparação que o beforeprint dispara e olha a folha.
const MEDIR = `(() => {
  try { prepararPapel(); } catch (e) {}
  const a = document.getElementById('areaImpressao');
  const r = a.getBoundingClientRect();
  let culpado = null, n = a;
  while (n && n !== document.body) {
    if (getComputedStyle(n).display === 'none') culpado = (n.id || n.tagName.toLowerCase());
    n = n.parentNode;
  }
  return { larg: Math.round(r.width), alt: Math.round(r.height),
           folhasA4: Math.max(1, Math.ceil(document.documentElement.scrollHeight / 1122)),
           temTexto: (a.innerText || '').indexOf('MARCA DO LAUDO') >= 0,
           escondidoPor: culpado };
})()`;

(async () => {
  const chrome = acharChrome();
  if (!chrome) { console.log('  PULADO: nao achei Chrome nem Edge nesta maquina'); process.exit(0); }
  const { srv, porta } = await servir();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'laudos-papel-'));
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
    for (let i = 0; i < 40; i++) {
      if (await naPagina(cdp, "typeof rev2Abrir==='function' && typeof prepararPapel==='function'")) break;
      await esperar(250);
    }
    ok(await naPagina(cdp, "typeof prepararPapel==='function'"),
       'a preparação do papel existe na página');

    await naPagina(cdp, `document.getElementById('areaImpressao').innerHTML =
      '<div class="laudoFolha"><p>MARCA DO LAUDO — este texto tem de chegar ao papel</p></div>'`);

    // Daqui para baixo o que se mede é o PAPEL, não a tela.
    await cdp.enviar('Emulation.setEmulatedMedia', { media: 'print' });

    console.log('\n=== com a tela 2.0 aberta — o caminho do dia a dia dele ===');
    // rev2Abrir esconde #telaRevisao, e é dentro dela que a folha mora. Foi exatamente
    // este estado que devolveu seis folhas em branco em 01/09.
    await naPagina(cdp, `document.getElementById('telaRevisao').style.display='none';
                         var t=document.getElementById('telaRev2'); if(t) t.style.display='block';`);
    const b = await naPagina(cdp, MEDIR);
    ok(b.larg > 0 && b.alt > 0, 'a folha do laudo TEM TAMANHO no papel  [' + b.larg + 'x' + b.alt + ']');
    ok(!b.escondidoPor, 'e nenhuma tela escondida a engole  [' + (b.escondidoPor || 'nenhuma') + ']');
    ok(b.temTexto, 'com o texto do laudo dentro dela');
    ok(b.folhasA4 <= 2, 'sem folhas em branco de brinde  [' + b.folhasA4 + ' folha(s) A4]');

    console.log('\n=== com a tela antiga de revisão aberta ===');
    await naPagina(cdp, `document.getElementById('telaRevisao').style.display='block';
                         var t=document.getElementById('telaRev2'); if(t) t.style.display='none';`);
    const a = await naPagina(cdp, MEDIR);
    ok(a.larg > 0 && a.alt > 0, 'a folha continua saindo pelo caminho antigo  [' + a.larg + 'x' + a.alt + ']');
    ok(a.folhasA4 <= 2, 'e também sem folhas sobrando  [' + a.folhasA4 + ' folha(s) A4]');

    console.log('\n=== com a tela de liberação aberta (o nó é movido para lá) ===');
    await naPagina(cdp, `document.getElementById('rv2FinalHost').appendChild(document.getElementById('areaImpressao'));
                         document.getElementById('rv2Final').classList.add('aberta');`);
    const c = await naPagina(cdp, MEDIR);
    ok(c.larg > 0 && c.alt > 0, 'a folha sai também dali  [' + c.larg + 'x' + c.alt + ']');
    ok(c.temTexto, 'com o texto dentro');
    ok(c.folhasA4 <= 2, 'e sem folhas sobrando  [' + c.folhasA4 + ' folha(s) A4]');

    console.log('\n=== o piso de segurança: sem a preparação, ainda assim sai ===');
    // Se o beforeprint não disparar (ou prepararPapel falhar), a regra de limpeza fica
    // desligada e vale só `#telaRevisao{display:block!important}`. O acabamento piora;
    // o papel NUNCA fica vazio. Falhar para o lado seguro é a regra aqui.
    await naPagina(cdp, `document.getElementById('rv2FinalHost').parentNode.parentNode
                           .querySelector('#rv2FinalHost') && (function(){
                           var a=document.getElementById('areaImpressao');
                           document.getElementById('revLayout').appendChild(a);
                         })();
                         document.getElementById('rv2Final').classList.remove('aberta');
                         document.getElementById('telaRevisao').style.display='none';
                         document.body.classList.remove('papelPreparado');
                         Array.prototype.forEach.call(document.body.children, function(x){ x.classList.remove('noPapel'); });`);
    const s = await naPagina(cdp, `(() => {
      const a = document.getElementById('areaImpressao');
      const r = a.getBoundingClientRect();
      return { larg: Math.round(r.width), alt: Math.round(r.height) };
    })()`);
    ok(s.larg > 0 && s.alt > 0,
       'sem a preparação o laudo ainda chega ao papel  [' + s.larg + 'x' + s.alt + ']');

    console.log('\n=== os carimbos do navegador não têm onde ser escritos ===');
    // Data, hora, nome do exame e o endereço 127.0.0.1 saíam impressos em cima e embaixo
    // do laudo (visto no papel de 01/09). Não é conteúdo do laudo, e não há como desligá-lo
    // pelo código: o navegador escreve na MARGEM DA PÁGINA. Zerando a margem, ele fica sem
    // lugar — e o respiro do laudo passa a vir do padding da folha.
    const semTimbre = await naPagina(cdp, `_estiloPaginaTexto(15,15,12,false)`);
    ok(/@page\{size:A4;margin:0;\}/.test(semTimbre),
       'laudo SEM timbrado: margem de página zero (é isso que apaga os carimbos)');
    ok(/\.laudoFolha\{[^}]*padding:15mm 12mm 15mm 12mm!important/.test(semTimbre),
       'e o respiro do laudo vem do padding da folha, não da margem da página');
    const comTimbre = await naPagina(cdp, `_estiloPaginaTexto(34,24,8,true)`);
    ok(/@page\{size:A4;margin:0;\}/.test(comTimbre),
       'laudo COM timbrado continua como sempre foi (já era margem zero)');
    ok(!/@page\s*\{[^}]*margin:\s*8mm/i.test(await naPagina(cdp, `document.documentElement.innerHTML`)),
       'não sobrou nenhuma margem de 8mm no arquivo — era por ela que os carimbos entravam');
    const M = await naPagina(cdp, `JSON.stringify(margensDaFolha('branco'))`);
    ok(/"topo":15/.test(M) && /"base":15/.test(M) && /"lado":12/.test(M),
       'e a folha branca reserva 15mm em cima e embaixo, 12mm nas laterais  [' + M + ']');

    console.log('\n=== laudo COM TIMBRADO: a grade fecha mesmo com a tela escondida ===');
    // paginarLaudoTela precisa MEDIR a folha para saber onde cada página de 297mm termina,
    // e a folha mora dentro de #telaRevisao — que a 2.0 esconde. Dentro de display:none
    // tudo mede zero e a paginação desistia calada: sem vãos, sem máscara nas páginas
    // seguintes, e a última folha cortada antes do fim do timbrado. Foi o que ele viu no
    // papel em 02/09. Medido: escondida dava 0 vãos e 2,24 páginas; visível, 2 e 2,99.
    const t = await naPagina(cdp, `(() => {
      const chave = FUNDOS.capanema ? 'capanema' : (FUNDOS.labita ? 'labita' : null);
      if (!chave) return { pulado: true };
      const linhas = [];
      for (let i=0;i<70;i++) linhas.push('<p>Linha ' + i + ' de enchimento para passar de uma pagina.</p>');
      document.getElementById('areaImpressao').innerHTML =
        '<div class="laudoFolha" data-fundo="'+chave+'">' +
        '<div class="laudoCabBox"><b>Nome do Paciente:</b> Teste</div>' +
        '<div class="laudoCorpoBox"><div class="laudoTexto">' + linhas.join('') + '</div></div>' +
        '<div class="assin"><p>Dr. Daniel Serruya</p></div>' +
        '<div class="rodapeLaudo"><p>Esclarecemos que a impressao diagnostica nao e absoluta.</p></div>' +
        '</div>';
      window.__fundo = chave; window.__fundoPerguntado = true;
      aplicarFundoNaFolha();
      // O ESTADO QUE MORDIA: a tela escondida, como fica na 2.0.
      document.getElementById('telaRevisao').style.display = 'none';
      try { prepararPapel(); } catch(e) {}
      const folha = document.querySelector('#areaImpressao .laudoFolha');
      const r = folha.getBoundingClientRect();
      const pxmm = folha.clientWidth / 210;
      return { pulado: false,
               paginas: +(r.height / pxmm / 297).toFixed(2),
               vaos: folha.querySelectorAll('.quebraFolha').length,
               mascaras: folha.querySelectorAll('.fundoFolhaTela').length,
               // a tela tem de voltar como estava: paginar não pode deixar a tela aberta
               telaVoltou: document.getElementById('telaRevisao').style.display === 'none' };
    })()`);
    if (t.pulado) {
      console.log('  PULADO: nenhum timbrado cadastrado nesta cópia');
    } else {
      ok(t.vaos > 0 && t.mascaras > 0,
         'a paginação roda mesmo com a tela escondida  [' + t.vaos + ' vãos, ' + t.mascaras + ' máscaras]');
      ok(Math.abs(t.paginas - Math.round(t.paginas)) < 0.02,
         'e a folha fecha em página inteira — o corte não cai no meio do timbrado  [' + t.paginas + ' páginas]');
      ok(t.telaVoltou, 'e a tela volta escondida como estava, sem efeito colateral na revisão');
    }

    console.log('\n=== a assinatura fica FORA da moldura (laudo curto, timbrado) ===');
    // 02/09: com o laudo de uma página, a moldura da folha era desenhada MEDINDO A TELA
    // (onde .laudoCorpoBox tem min-height:620px) e no papel aquela altura era anulada: a
    // caixa encolhia, a moldura não, e a assinatura — que vem DEPOIS da caixa — aparecia
    // dentro do retângulo. Medido no papel dele: caixa em 116,3mm, assinatura em 154,8mm,
    // moldura descendo até 206,5mm. Medir numa régua e desenhar noutra era o defeito.
    // A ORDEM DA VIDA REAL, e ela importa: o beforeprint dispara com a página ainda em
    // MÍDIA DE TELA, e só depois o navegador troca para a mídia de impressão. Foi
    // exatamente essa defasagem que criou o defeito — medir numa régua, desenhar noutra.
    // Um teste que fizesse tudo já em mídia print não veria nada.
    await cdp.enviar('Emulation.setEmulatedMedia', { media: 'screen' });
    const montou = await naPagina(cdp, `(() => {
      const chave = FUNDOS.labita ? 'labita' : (FUNDOS.capanema ? 'capanema' : null);
      if (!chave) return false;
      const linhas = [];
      for (let i=0;i<8;i++) linhas.push('<p>Linha ' + i + ' — laudo curto, de uma pagina.</p>');
      document.getElementById('areaImpressao').innerHTML =
        '<div class="laudoFolha" data-fundo="'+chave+'">' +
        '<div class="laudoCabBox"><b>Nome do Paciente:</b> Teste</div>' +
        '<div class="laudoCorpoBox"><div class="laudoTexto">' + linhas.join('') + '</div></div>' +
        '<div class="assin"><p>Dr. Daniel Serruya</p></div>' +
        '<div class="rodapeLaudo"><p>Esclarecemos que a impressao diagnostica nao e absoluta.</p></div>' +
        '</div>';
      window.__fundo = chave; window.__fundoPerguntado = true;
      aplicarFundoNaFolha();
      document.getElementById('telaRevisao').style.display = 'none';
      try { prepararPapel(); } catch(e) {}   // é aqui que a paginação acontece
      return true;
    })()`);
    await cdp.enviar('Emulation.setEmulatedMedia', { media: 'print' });
    const s2 = await naPagina(cdp, `(() => {
      if (!${montou}) return { pulado: true };
      const folha = document.querySelector('#areaImpressao .laudoFolha');
      const fr = folha.getBoundingClientRect();
      const pxmm = folha.clientWidth / 210;
      const mm = v => +((v - fr.top) / pxmm).toFixed(1);
      const cx = folha.querySelector('.laudoCorpoBox').getBoundingClientRect();
      const as = folha.querySelector('.assin').getBoundingClientRect();
      let molduraMaisBaixa = 0;
      folha.querySelectorAll('.laudoMoldura').forEach(d => {
        molduraMaisBaixa = Math.max(molduraMaisBaixa, mm(d.getBoundingClientRect().bottom));
      });
      return { pulado: false, caixa: mm(cx.bottom), assin: mm(as.top), moldura: molduraMaisBaixa,
               _diag: { comFundo: folha.classList.contains('comFundo'),
                        temImg: !!folha.querySelector('.fundoLaudo'),
                        molduras: folha.querySelectorAll('.laudoMoldura').length,
                        larguraPx: folha.clientWidth,
                        telaDisplay: getComputedStyle(document.getElementById('telaRevisao')).display } };
    })()`);
    if (s2.pulado) {
      console.log('  PULADO: nenhum timbrado cadastrado nesta cópia');
    } else {
      console.log('  diagnóstico: ' + JSON.stringify(s2._diag));
      ok(s2.moldura <= s2.assin + 0.5,
         'a moldura fecha ANTES da assinatura  [moldura até ' + s2.moldura + 'mm, assinatura em ' + s2.assin + 'mm]');
      ok(Math.abs(s2.moldura - s2.caixa) < 2,
         'e ela acompanha a caixa do corpo, sem sobrar  [caixa em ' + s2.caixa + 'mm]');
    }

    console.log('\n=== timbrado que come muita pagina: a assinatura NAO pula sozinha ===');
    // 02/09/2026, relatado por ele. A caixa do corpo tem altura minima de 620px (164mm),
    // para a folha BRANCA nao parecer um bilhete. Com um timbrado que reserva 50mm em cima
    // e 35 embaixo sobram 212mm, e a conta estoura: 22 (cabecalho) + 164 (a altura minima)
    // + 24 (assinatura com a rubrica dele) + 12 (rodape legal) = 222mm. A assinatura descia
    // para uma folha nova com a primeira visivelmente vazia. Com timbrado quem da corpo a
    // folha e o proprio timbrado — a altura minima sai, e os 164mm voltam para o conteudo.
    await cdp.enviar('Emulation.setEmulatedMedia', { media: 'screen' });
    const ap = await naPagina(cdp, `(() => {
      // um timbrado exigente, como o do medico: 50mm em cima, 35 embaixo
      FUNDOS.__teste_reserva_grande = { nome:'Teste', padTopMm:50, padBottomMm:35,
        img:'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297"><rect width="210" height="297" fill="#fff"/></svg>') };
      const linhas=[]; for(let i=0;i<10;i++) linhas.push('<p>Linha '+i+' de um laudo curto.</p>');
      document.getElementById('telaRevisao').style.display='block';
      document.getElementById('areaImpressao').innerHTML =
        '<div class="laudoFolha" data-fundo="__teste_reserva_grande">' +
        '<div class="laudoCabBox"><b>Nome do Paciente:</b> Teste<br>Idade: 48 anos<br>Realizado em: 02/09/2026<br>Dados Clinicos:</div>' +
        '<div class="laudoCorpoBox"><div class="laudoTitulo">RELATORIO</div><div class="laudoTexto">'+linhas.join('')+'</div></div>' +
        // a rubrica escaneada dele tem 62px de altura — e foi ela que estourou a conta
        '<div class="assin"><div style="height:62px"></div><span class="linha">Dr. Daniel Serruya<br>Crm-Pa - 9962</span></div>' +
        '<div class="rodapeLaudo">Esclarecemos que a impressao diagnostica em exames de imagem nao e absoluta.</div>' +
        '</div>';
      window.__fundo='__teste_reserva_grande'; window.__fundoPerguntado=true;
      aplicarFundoNaFolha();
      try { paginarLaudoTela(); } catch(e) { return { erro: e.message }; }
      const folha=document.querySelector('#areaImpressao .laudoFolha');
      const fr=folha.getBoundingClientRect();
      const pxmm=folha.clientWidth/210;
      const as=folha.querySelector('.assin').getBoundingClientRect();
      const cx=folha.querySelector('.laudoCorpoBox');
      return { paginas: +(fr.height/pxmm/297).toFixed(2),
               paginaDaAssinatura: Math.floor(((as.top-fr.top)/pxmm)/297)+1,
               minHeightDaCaixa: getComputedStyle(cx).minHeight };
    })()`);
    if (ap.erro) { ok(false, 'nao consegui montar o caso: ' + ap.erro); }
    else {
      ok(ap.paginaDaAssinatura === 1,
         'a assinatura fica na primeira folha  [pagina ' + ap.paginaDaAssinatura + ']');
      ok(ap.paginas <= 1.05,
         'e o laudo curto nao gasta uma folha a mais  [' + ap.paginas + ' folha(s)]');
      ok(ap.minHeightDaCaixa === '0px',
         'com timbrado a caixa perde a altura minima — quem da corpo a folha e o timbrado  ['
         + ap.minHeightDaCaixa + ']');
    }
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
