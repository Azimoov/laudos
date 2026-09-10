/* Login comercial: a tela ajuda, mas quem realmente autoriza e o agente local. */
const fs = require('fs');
const path = require('path');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const falhas = [];
function ok(cond, msg) {
  console.log((cond ? '  ok   ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
}

console.log('=== 1. entrada segura e sem senha dentro do aplicativo ===');
ok(/id="authGate"[^>]*aria-modal="true"/.test(fonte),
  'a identidade e pedida antes de mostrar o arquivo clinico');
ok(/id="authEntrarBt"[^>]*onclick="authEntrar\(\)"/.test(fonte),
  'ha um botao unico que abre o provedor de identidade');
const gate = (fonte.match(/<div id="authGate"[\s\S]*?<\/script>/) || [''])[0];
ok(!/<input[^>]+type=["']password["']/i.test(gate),
  'o programa nao coleta nem guarda a senha do usuario');
ok(/URLSearchParams\(location\.search\)\.get\('auth'\)==='1'/.test(gate),
  'instalacao comercial nasce fechada sem piscar dados de paciente');

console.log('\n=== 2. conta, clinica e assinatura ficam visiveis ===');
for (const id of ['paneConta', 'authContaUsuario', 'authContaClinica',
                  'authContaPapel', 'authContaAssinatura', 'authContaRevalidar']) {
  ok(fonte.includes('id="' + id + '"'), id + ' existe na tela de Configuracoes');
}
ok(/conta:'paneConta'/.test(fonte), 'a pagina Conta participa da navegacao das Configuracoes');

console.log('\n=== 3. tokens e permissoes ===');
ok(/fetch\(agenteBase\(\)\+'\/auth\/estado'/.test(fonte),
  'a pagina pergunta o estado ao agente, sem acessar tokens');
ok(/fetch\(agenteBase\(\)\+'\/auth\/iniciar'/.test(fonte) &&
   /fetch\(agenteBase\(\)\+'\/auth\/sair'/.test(fonte),
  'entrada e saida passam pelo agente local');
ok(!/localStorage\.setItem\([^\n]*(access|refresh)[_-]?token/i.test(fonte),
  'nenhum token de acesso ou renovacao e escrito no localStorage');
ok(/async function authExigir\(acao\)/.test(fonte) &&
   /\(s\.acesso\|\|\{\}\)\[acao\]/.test(fonte),
  'a interface respeita as permissoes recebidas para cada acao');

console.log('\n=== 4. pontos com custo e responsabilidade profissional ===');
ok(/async function openai\([^)]*\)\{\s*if\(typeof authExigir==='function' && !\(await authExigir\('criar'\)\)\)/.test(fonte),
  'qualquer chamada de IA confere permissao para criar');
ok(/async function capToggleRec\(\)\{[\s\S]{0,180}capEstado==='idle'[\s\S]{0,160}authExigir\('criar'\)/.test(fonte),
  'o botao de gravacao nao cai para um gravador alternativo se a conta estiver pausada');
ok(/async function rev2Aprovar\([^)]*\)\{\s*if\(typeof authExigir==='function' && !\(await authExigir\('assinar'\)\)\)/.test(fonte),
  'a tela nova confere permissao profissional antes de aprovar');
ok(/async function liberarEProximo\(\)\{\s*if\(typeof authExigir==='function' && !\(await authExigir\('assinar'\)\)\)/.test(fonte),
  'o caminho antigo tambem confere permissao antes de liberar');
ok(!/async function imprimirLaudoAtual\(\)\{\s*if[\s\S]{0,120}authExigir\('assinar'\)/.test(fonte),
  'imprimir laudo guardado nao depende de pagamento nem de permissao de assinar');

console.log('\n=== 5. falha segura somente quando o login foi ativado ===');
ok(/if\(authObrigatorioNaAbertura\(\)\)[\s\S]{0,500}arquivo cl[ií]nico permanece fechado/i.test(fonte),
  'instalacao comercial fica fechada se o agente nao responder');
ok(/configurado:false[\s\S]{0,180}consultar:true,criar:true,assinar:true,administrar:true/.test(fonte),
  'linha de reforma nao e interrompida antes da ativacao comercial');

console.log('\n' + (falhas.length ? falhas.length + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas.length ? 1 : 0);
