// Testa o backup externo contra o agente REAL, incluindo os casos de erro.
const fs = require('fs');
const path = require('path');
const os = require('os');
/* 09/09/2026 — A PASTA VEM DO AGENTE, NAO DE UM CAMINHO ESCRITO AQUI.
   Ate hoje o ENDERECO do agente era configuravel (AGENTE_URL) mas a PASTA era fixa na
   linha estavel. Quem apontasse a suite para outra linha ficava com o teste conversando
   com um agente e conferindo a pasta de OUTRO: tres falhas que nao eram defeito nenhum
   (contagem de arquivos, tamanho do glaudos.json, historico). E a saida escolhida em
   02/09 foi deixar as duas suites PULADAS — o que custou uma semana sem elas.
   Agora a pasta e perguntada ao proprio agente (rota /dados devolve "pasta"), entao
   endereco e pasta nao tem como discordar: e sempre a mesma linha, seja ela qual for.
   Sem AGENTE_URL, procura a 3.0 (reforma) e depois a 2.0 (atendimento). A 8977 saiu:
   a linha estavel foi desativada em 02/09 e nao volta sozinha. */
const AG = process.env.AGENTE_URL || 'http://127.0.0.1:8999';
// 10/08/2026: a pasta do agente saiu do cache do app Claude, onde uma
// reinstalacao levaria o banco de pacientes junto. Ver README do laudos-programa.
let DADOS = '';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const post = (r, b) => fetch(AG + r, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(x => x.json());
const get = r => fetch(AG + r).then(x => x.json());

(async () => {
  /* Primeira coisa: qual linha atendeu o telefone. Sem isto o teste nao sabe de quem e a
     pasta que ele vai conferir — e conferir a pasta errada e o defeito que esta suite teve
     por uma semana. Imprime a pasta para quem le a saida saber, sem adivinhar. */
  const man = await get('/dados');
  DADOS = String(man.pasta || '').replace(/\\/g, '/');
  ok(!!DADOS && fs.existsSync(DADOS), 'o agente disse onde mora: ' + (DADOS || '(nao disse)'));
  if (!DADOS || !fs.existsSync(DADOS)) {
    console.log('\n  sem a pasta do agente nao da para conferir nada. Parando aqui.');
    process.exit(1);
  }

  console.log('=== 1. pasta que nao existe: recusa ===');
  let j = await post('/backup/pasta', { pasta: 'Z:\\nao\\existe\\mesmo' });
  ok(j.ok === false && /nao encontrada/i.test(j.erro || ''), 'recusou com motivo claro: ' + (j.erro || '').slice(0, 50));

  console.log('=== 2. pasta sem permissao de escrita: recusa ===');
  j = await post('/backup/pasta', { pasta: 'C:\\Windows\\System32\\drivers\\etc' });
  ok(j.ok === false, 'recusou pasta protegida (' + (j.erro || '').slice(0, 45) + ')');

  console.log('=== 3. pasta valida: aceita e ja copia ===');
  const alvo = path.join(os.tmpdir(), 'teste-backup-laudos');
  fs.mkdirSync(alvo, { recursive: true });
  j = await post('/backup/pasta', { pasta: alvo });
  ok(j.ok === true, 'aceitou a pasta');
  ok(j.primeiraCopia && j.primeiraCopia.ok, 'fez a primeira copia na hora');
  const dest = path.join(alvo, 'LaudosLocal-backup');
  const copiados = fs.readdirSync(dest).filter(f => f.endsWith('.json'));
  const origem = fs.readdirSync(DADOS).filter(f => f.endsWith('.json'));
  ok(copiados.length === origem.length, 'copiou os ' + origem.length + ' arquivos de dados (' + copiados.length + ')');
  ok(!fs.existsSync(path.join(dest, 'backups')), 'NAO copiou a pasta backups/ (evita copia da copia)');
  const gl = path.join(dest, 'glaudos.json');
  ok(fs.existsSync(gl) && fs.statSync(gl).size === fs.statSync(path.join(DADOS, 'glaudos.json')).size,
    'glaudos.json integro (' + (fs.statSync(gl).size / 1048576).toFixed(1) + ' MB)');
  ok(JSON.parse(fs.readFileSync(gl, 'utf8')).chave === 'glaudos', 'conteudo e JSON valido e legivel');
  ok(!fs.readdirSync(dest).some(f => f.endsWith('.tmp')), 'nenhum .tmp deixado para tras');

  console.log('=== 4. historico datado ===');
  const hist = path.join(dest, 'historico');
  const dias = fs.readdirSync(hist);
  ok(dias.length === 1, 'criou 1 pasta de historico (' + dias[0] + ')');
  /* 09/09/2026 — O HISTORICO GUARDA TUDO, NAO SO OS .json.
     Esta linha comparava a pasta do dia (contada inteira) com `copiados`, que conta SO os
     .json. Enquanto a pasta de dados da linha estavel tinha so .json, os dois numeros
     batiam por coincidencia. Na 3.0 ha um arquivo `glocais.json.antes-de-05-09-2026`
     (uma copia de seguranca guardada antes de uma mudanca) e a conta passou a acusar
     defeito onde o agente estava certo: ele copia todo arquivo solto da pasta.
     Agora a comparacao e com o que existe DE FATO no destino — que e o que o historico
     promete espelhar. */
  const noDestino = fs.readdirSync(dest).filter(f => fs.statSync(path.join(dest, f)).isFile());
  const noHistorico = fs.readdirSync(path.join(hist, dias[0]));
  ok(noHistorico.length === noDestino.length,
    'historico espelha o destino (' + noHistorico.length + ' de ' + noDestino.length + ')');
  ok(noDestino.every(f => noHistorico.includes(f)),
    'e nao falta nenhum arquivo pelo nome, nao so pela contagem');

  console.log('=== 5. 2a copia no mesmo dia: pula o que nao mudou ===');
  j = await post('/backup/agora', {});
  ok(j.ok === true && j.arquivos === 0, 'nao recopiou nada (' + j.arquivos + ' arquivos) — nao castiga o OneDrive');

  console.log('=== 6. arquivo mudou: copia so ele ===');
  await post('/dados/gteste', { valor: JSON.stringify({ x: Date.now() }), ts: Date.now() });
  j = await post('/backup/agora', {});
  ok(j.ok === true && j.arquivos >= 1, 'copiou o arquivo novo (' + j.arquivos + ')');
  ok(fs.existsSync(path.join(dest, 'gteste.json')), 'gteste.json chegou no destino');

  console.log('=== 7. estado reportado ao app ===');
  const e = await get('/backup/estado');
  ok(e.pasta === alvo && e.existe === true, 'pasta e existencia corretas');
  // Dia LOCAL, nao o de Greenwich: o agente carimba a data com o relogio da
  // maquina. Com toISOString() este teste falhava toda noite depois das 21h
  // (em Londres ja era o dia seguinte) — defeito do teste, nunca do programa.
  const d = new Date();
  const hojeLocal = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)
                    + '-' + ('0' + d.getDate()).slice(-2);
  ok(e.ultimoDia === hojeLocal, 'data do ultimo backup: ' + e.ultimoDia);
  ok(typeof e.espacoLivre === 'number' && e.espacoLivre > 0, 'espaco livre: ' + (e.espacoLivre / 1073741824).toFixed(1) + ' GB');
  ok(!e.erro, 'sem erro pendente');

  console.log('=== 8. desligar (pasta vazia) ===');
  j = await post('/backup/pasta', { pasta: '' });
  ok(j.ok === true, 'aceitou desligar');
  const e2 = await get('/backup/estado');
  ok(e2.pasta === '', 'estado limpo');

  // limpeza
  fs.rmSync(alvo, { recursive: true, force: true });
  try { fs.unlinkSync(path.join(DADOS, 'gteste.json')); } catch (x) {}
  console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
  process.exit(falhas ? 1 : 0);
})();
