// Testa o backup externo contra o agente REAL, incluindo os casos de erro.
const fs = require('fs');
const path = require('path');
const os = require('os');
const AG = 'http://127.0.0.1:8977';
const DADOS = 'C:/Users/serru/AppData/Local/LaudosLocal/dados';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const post = (r, b) => fetch(AG + r, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) }).then(x => x.json());
const get = r => fetch(AG + r).then(x => x.json());

(async () => {
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
  ok(fs.readdirSync(path.join(hist, dias[0])).length === copiados.length, 'historico tem todos os arquivos');

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
  ok(e.ultimoDia === new Date().toISOString().slice(0, 10), 'data do ultimo backup: ' + e.ultimoDia);
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
