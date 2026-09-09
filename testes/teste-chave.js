// Testa o proxy da OpenAI no agente: guarda a chave, nao devolve nunca, encaminha,
// e o app deixa de carregar a chave. Roda contra o agente REAL (sem gastar token:
// usa uma chave falsa e confere que o erro vem da OpenAI, nao do agente).
const fs = require('fs');
/* 09/09/2026 — O ARQUIVO DE CONFIGURACAO VEM DO AGENTE, NAO DE UM CAMINHO ESCRITO AQUI.
   Ate hoje o ENDERECO era configuravel (AGENTE_URL) e o arquivo era fixo na linha estavel.
   Isso nao dava so falha falsa: o teste LIA a chave da estavel e, no fim, GRAVAVA essa
   chave no agente que estivesse respondendo — mudava a configuracao de uma linha usando
   o valor de outra, calado. Agora o agente diz onde mora (rota /dados devolve "pasta") e
   o config-agente.json sai dali, ao lado da pasta dados. Uma linha so, do inicio ao fim.
   Sem AGENTE_URL, procura a 3.0 (reforma) e depois a 2.0. A 8977 saiu: a linha estavel
   foi desativada em 02/09 e nao volta sozinha. */
const AG = process.env.AGENTE_URL || 'http://127.0.0.1:8999';
// 10/08/2026: a pasta do agente saiu do cache do app Claude, onde uma
// reinstalacao levaria o banco de pacientes junto. Ver README do laudos-programa.
let CONF = '';
/* O Windows costuma deixar uma marca invisivel (BOM) no comeco do arquivo; JSON.parse
   engasga nela. O agente ja sabe ignorar desde 03/09 — o teste passa a saber tambem. */
const lerConf = () => JSON.parse(fs.readFileSync(CONF, 'utf8').replace(/^﻿/, '').trim() || '{}');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const post = (r, b) => fetch(AG + r, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(async x => ({ s: x.status, j: await x.json().catch(() => ({})) }));
const get = r => fetch(AG + r).then(x => x.json());

(async () => {
  // Qual linha atendeu o telefone: e dela a configuracao que este teste le e devolve.
  const man = await get('/dados');
  const pasta = String(man.pasta || '').replace(/\\/g, '/');
  CONF = pasta.replace(/\/dados\/?$/, '') + '/config-agente.json';
  ok(!!pasta && fs.existsSync(CONF), 'o agente disse onde mora: ' + (CONF || '(nao disse)'));
  if (!pasta || !fs.existsSync(CONF)) {
    console.log('\n  sem o config-agente.json desta linha nao da para conferir. Parando aqui.');
    process.exit(1);
  }
  const antes = lerConf();
  const chaveOriginal = antes.openaiKey || '';

  console.log('=== 1. recusa o que nao parece chave ===');
  let r = await post('/ia/chave', { chave: 'minha-senha-do-banco' });
  ok(r.j.ok === false && /sk-/.test(r.j.erro || ''), 'recusou com motivo: ' + (r.j.erro || '').slice(0, 45));

  console.log('=== 2. guarda a chave ===');
  const FALSA = 'sk-teste-NAOEUMACHAVEREAL-1234567890abcd';
  r = await post('/ia/chave', { chave: FALSA });
  ok(r.j.ok === true && r.j.configurada === true, 'aceitou e marcou como configurada');
  const conf = lerConf();
  ok(conf.openaiKey === FALSA, 'gravou no arquivo do computador');

  console.log('=== 3. a chave NUNCA volta para o navegador ===');
  const est = await get('/ia/estado');
  const txt = JSON.stringify(est);
  ok(!txt.includes(FALSA), 'estado nao contem a chave inteira');
  ok(!txt.includes('1234567890abcd'), 'nem o miolo dela');
  ok(est.final === '...abcd', 'devolve so os 4 ultimos, para o medico se reconhecer (' + est.final + ')');
  ok(est.configurada === true, 'informa que existe chave');

  console.log('=== 4. encaminha de verdade para a OpenAI ===');
  const rp = await fetch(AG + '/ia/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'oi' }], max_tokens: 1 })
  });
  const jp = await rp.json();
  ok(rp.status === 401, 'a OpenAI respondeu 401 com a chave falsa (status repassado: ' + rp.status + ')');
  ok(/invalid_api_key|Incorrect API key/i.test(JSON.stringify(jp)), 'erro veio DA OPENAI, ou seja: o pedido saiu mesmo');
  ok(!JSON.stringify(jp).includes(FALSA), 'a resposta de erro nao devolve a chave');

  console.log('=== 5. sem chave configurada, avisa claro ===');
  await post('/ia/chave', { chave: '' });
  const r2 = await fetch(AG + '/ia/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'x', messages: [] }) });
  const j2 = await r2.json();
  ok(r2.status === 400 && /nao configurada/i.test(j2.error.message), 'diz que falta configurar, sem tentar a rede');
  const e2 = await get('/ia/estado');
  ok(e2.configurada === false, 'estado voltou a "sem chave"');

  console.log('=== 6. o app parou de carregar a chave ===');
  ok(/iaPeloAgente\(\)/.test(HTML), 'openai() consulta se deve usar o agente');
  ok(/agenteBase\(\)\+.\/ia\/chat/.test(HTML), 'chama /ia/chat');
  ok(/localStorage\.setItem\('gmk',''\)/.test(HTML), 'apaga a copia do navegador ao guardar');
  ok(/guardarChaveNoAgente/.test(HTML) && /removerChaveDoNavegador/.test(HTML), 'botoes de guardar e apagar existem');
  const salvar = HTML.slice(HTML.indexOf('cfg.chave = document.getElementById'), HTML.indexOf('dadoSalvar(\'gmedico\''));
  ok(/_iaAgente\.ok!==false/.test(salvar), 'o botao comum de Salvar tambem manda a chave para o agente');
  ok(/ia\/transcrever/.test(HTML), 'a transcricao de reserva tambem passa pelo agente');

  // restaura o que estava
  await post('/ia/chave', { chave: chaveOriginal });
  console.log('\n(chave original restaurada: ' + (chaveOriginal ? 'sim' : 'nao havia') + ')');
  console.log(falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
