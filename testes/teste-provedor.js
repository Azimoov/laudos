// ENDERECO DO PROVEDOR DE IA configuravel (13/08/2026) — tarefa 4 do medico.
//
// A pergunta dele era: "para trocar de provedor basta a chave, ou mexe no codigo?".
// Resposta: o formato do pedido e da resposta e o mesmo em quase todo concorrente
// (Google, Groq, Mistral, DeepSeek, Together, Azure, servidor local) — o que faltava
// era poder mudar o ENDERECO, que estava cravado em tres lugares.
//
// A regra que estes testes protegem acima de tudo: NADA MUDA PARA QUEM NAO MEXER.
// O padrao tem de continuar sendo exatamente o endereco de sempre.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const AG = fs.readFileSync(path.join(require('os').homedir(),
  'Laudos USG 2.0', 'agente', 'agente-laudos.py'), 'utf8');

function grab(name) {
  let i = HTML.indexOf('async function ' + name + '(');
  if (i < 0) i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const PADRAO = 'https://api.openai.com/v1';
const cfg = {};
const api = new Function('cfg', "const IA_BASE_PADRAO='" + PADRAO + "';\n"
  + grab('iaBase') + '\nreturn {iaBase, IA_BASE_PADRAO};')(cfg);
const { iaBase } = api;

console.log('=== quem nao mexer em nada NAO sente diferenca ===');
cfg.iaBase = undefined;
ok(iaBase() === PADRAO, 'sem nada configurado, vale o endereco de sempre');
cfg.iaBase = '';
ok(iaBase() === PADRAO, 'campo apagado tambem volta ao padrao — nunca fica sem endereco');
cfg.iaBase = '   ';
ok(iaBase() === PADRAO, 'so espacos idem');
ok(new RegExp("iaBase: localStorage\\.getItem\\('giabase'\\)\\|\\|'" + PADRAO + "'").test(HTML),
   'e o valor de fabrica no proprio cfg e o endereco de hoje, ja preenchido');

console.log('=== o endereco colado da documentacao do provedor funciona ===');
cfg.iaBase = 'https://api.groq.com/openai/v1/';
ok(iaBase() === 'https://api.groq.com/openai/v1', 'barra sobrando no fim e aparada');
cfg.iaBase = 'https://api.groq.com/openai/v1/chat/completions';
ok(iaBase() === 'https://api.groq.com/openai/v1',
   'endereco com a ROTA colada junto (e assim que aparece nos exemplos deles) e corrigido');
cfg.iaBase = 'https://api.openai.com/v1/audio/transcriptions';
ok(iaBase() === PADRAO, 'idem para a rota de transcricao');
cfg.iaBase = 'http://127.0.0.1:1234/v1';
ok(iaBase() === 'http://127.0.0.1:1234/v1',
   'servidor na propria maquina (http, sem s) e aceito — e o caso de rodar a IA local');

console.log('=== nenhum endereco ficou cravado no app ===');
ok(!/fetch\('https:\/\/api\.openai\.com/.test(HTML),
   'nao ha mais nenhum fetch com o endereco escrito na mao');
ok(/fetch\(iaBase\(\)\+'\/chat\/completions'/.test(HTML), 'o laudo usa o endereco configurado');
ok(/fetch\(iaBase\(\)\+'\/audio\/transcriptions'/.test(HTML), 'a transcricao de emergencia tambem');
ok((HTML.match(/api\.openai\.com/g) || []).length <= 4,
   'o endereco so aparece como PADRAO e nos textos de ajuda (' + (HTML.match(/api\.openai\.com/g) || []).length + 'x)');

console.log('=== o agente vai para o MESMO lugar que o app ===');
ok(/def ia_base\(\)/.test(AG), 'o agente tem o endereco configuravel');
ok(/_conf_ler\(\)\.get\("iaBase"\)/.test(AG), 'lido do config-agente.json');
ok(/or OPENAI_URL/.test(AG), 'com o padrao sendo o endereco de sempre');
ok(/ia_base\(\) \+ caminho/.test(AG), 'e e ele que a chamada usa');
ok(!/OPENAI_URL \+ caminho/.test(AG), 'a forma antiga, cravada, nao ficou para tras');
ok(/dadoSalvar\('giabase',cfg\.iaBase\)/.test(HTML), 'o app guarda o endereco...');
ok(/body:JSON\.stringify\(\{base:cfg\.iaBase\}\)/.test(HTML),
   '...e AVISA o agente, senao um iria para um lugar e o outro para outro');

console.log('=== a trava do "sk-" nao pode impedir a troca de provedor ===');
// Chave do Google comeca com AIza, a do Groq com gsk_, e servidor local costuma nao
// ter chave nenhuma. Exigir "sk-" sempre mataria justamente o que este campo permite.
const rota = AG.slice(AG.indexOf('if rota == "/ia/chave"'), AG.indexOf('if rota == "/ia/chave"') + 2600);
ok(/"api\.openai\.com" in alvo and not k\.startswith\("sk-"\)/.test(rota),
   'o "sk-" so e exigido quando o endereco E MESMO o da OpenAI');
ok(/mude o ENDERECO antes da chave/.test(rota), 'e o recado diz a ordem certa de fazer as coisas');
ok(/not base\.startswith\(\("http:\/\/", "https:\/\/"\)\)/.test(rota),
   'endereco sem http e recusado antes de estragar tudo');
ok(/if "chave" in c:/.test(rota) && /if "base" in c:/.test(rota),
   'da para gravar so um dos dois — salvar o endereco nao apaga a chave');

console.log('=== da para testar ANTES de precisar ===');
const t = grab('iaTestarEndereco');
ok(/cfg\.iaBase=base;/.test(t), 'o teste usa o endereco DIGITADO, nao o que esta salvo');
ok(/finally\{[\s\S]*cfg\.iaBase=salvo/.test(t),
   'e devolve o valor antigo no fim — testar nao muda a configuracao');
ok(/cfg\.modeloAux\|\|cfg\.modelo/.test(t), 'testa no modelo barato');
ok(/404\|not found/.test(t) && /401\|403\|key/.test(t),
   'e traduz os erros mais comuns: rota errada x chave errada');
ok(/function iaVoltarPadrao\(\)/.test(HTML) && /id="cfgIaBase"/.test(HTML),
   'ha o campo e o botao de voltar ao padrao');
ok(/N[ãa]o mexa se estiver funcionando/.test(HTML),
   'e a tela avisa para nao mexer no que esta funcionando');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
