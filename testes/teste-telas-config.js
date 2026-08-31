// AS TELAS DE CONFIGURACAO QUE ERAM "TELA ANTIGA" — 29/08/2026, pedido do medico:
// "da uma olhada nas demais telas na parte de configuracao que ainda levam para a tela
//  antiga e reformula elas uma a uma para o layout novo".
//
// COMO ESTAS TELAS FUNCIONAM (leia antes de mexer): o painel novo e so MOLDURA. Os
// controles de verdade continuam sendo os MESMOS NOS do painel antigo, MOVIDOS para
// dentro do host quando a aba abre (cfgMoverBloco), como o #bizusEditor ja fazia.
// Nao existe copia: copia significaria dois formularios gravando a mesma configuracao,
// que e como nasce o "salvei e nao pegou".
//
// ⚠️ O NO MUDA DE CASA e nao volta sozinho. Por isso o item "Painel antigo" continua na
// navegacao: sem ele, o que ainda nao ganhou moldura (editor antigo de modelos, pastas
// do navegador, status do banco) viraria codigo inalcancavel.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  let i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
// a tabela de blocos, lida do proprio index.html
const CFG_BLOCOS = eval('(' + (HTML.match(/const CFG_BLOCOS = (\{[\s\S]*?\n\});/) || [])[1] + ')');

console.log('=== cada aba tem painel proprio ===');
['paneDitado', 'paneImpressao', 'paneRevisao', 'paneAssinatura', 'paneBackup']
  .forEach(id => ok(HTML.indexOf('id="' + id + '"') >= 0, 'existe #' + id));
['ditado', 'impressao', 'revisao', 'assinatura', 'backup'].forEach(p =>
  ok(new RegExp("data-pane=\"" + p + "\"").test(HTML), 'a navegacao tem o item "' + p + '"'));
ok(/const MOD_PANE_ANCORA = \{\};/.test(HTML),
   'e NENHUM item cai mais no painel antigo (a lista de ancoras esvaziou)');

console.log('\n=== os controles de verdade sao MOVIDOS, nunca copiados ===');
const mover = grab('cfgMoverBloco');
ok(/h\.appendChild\(b\)/.test(mover), 'o bloco original e movido para dentro do host');
ok(/b\.parentNode!==h/.test(mover), 'e so quando ainda nao esta la (reabrir a aba nao repete)');
ok(!/innerHTML/.test(mover), 'nada de copiar HTML — copia divergiria do que grava');
// cada bloco citado na tabela precisa EXISTIR no HTML, dos dois lados
Object.keys(CFG_BLOCOS).forEach(pane => {
  CFG_BLOCOS[pane].forEach(([bloco, host]) => {
    ok(HTML.indexOf('id="' + bloco + '"') >= 0, pane + ': o bloco #' + bloco + ' existe no painel antigo');
    ok(HTML.indexOf('id="' + host + '"') >= 0, pane + ': o host #' + host + ' existe na tela nova');
  });
});

console.log('\n=== e os controles que importam vao junto ===');
// se um destes sair do seu bloco, ele some da tela nova sem ninguem perceber
const dentroDe = (bloco, alvo) => {
  const i = HTML.indexOf('id="' + bloco + '"');
  if (i < 0) return false;
  // fim do bloco: o proximo id="bloco..." ou o fim do cartao de configuracoes
  const resto = HTML.slice(i);
  const prox = resto.slice(1).search(/id="(bloco[A-Za-z]+|cpRecuperar)"/);
  return resto.slice(0, prox > 0 ? prox : 4000).indexOf('id="' + alvo + '"') >= 0;
};
[['blocoDitado', 'cfgAgenteLocal'], ['blocoDitado', 'btnReiniciarAgente'],
 ['blocoImpressao', 'cfgImpAuto'], ['blocoImpressao', 'cfgImpLaudo'],
 ['blocoBackup', 'cfgBackupPasta'], ['blocoBackup', 'backupEstado'],
 ['blocoAssinatura', 'cfgMedico'], ['blocoAssinatura', 'cfgCrm'], ['blocoAssinatura', 'assPrev'],
 ['blocoPaciente', 'cfgPaciente'], ['blocoBiopsia', 'biopsiaLista'],
 ['blocoAprendizados', 'listaRegras']]
  .forEach(([b, a]) => ok(dentroDe(b, a), '#' + a + ' esta dentro de #' + b));

console.log('\n=== o estado de fora e relido ao abrir a aba ===');
const render = grab('cfgPaneRender');
ok(/impCarregarImpressoras\(/.test(render),
   'impressao: a lista de impressoras e relida (a do consultorio pode nem existir aqui)');
ok(/atualizarEstadoBackup\(\)/.test(render), 'backup: le o estado do agente');
ok(/mostrarAssPrev\(\)/.test(render), 'assinatura: mostra a assinatura guardada');
ok(/biopsiaRender\(\)/.test(render) && /renderRegras\(\)/.test(render),
   'revisao: lista biopsias pendentes e aprendizados');
ok(/log\(/.test(render), 'e avisa se um bloco nao for encontrado (falha silenciosa, nao)');

console.log('\n=== um caminho de gravacao so ===');
const salvar = grab('cfgSalvarSimples');
ok(/salvarConfig\(\)/.test(salvar), 'o salvar da assinatura chama o salvarConfig de sempre');
ok(!/dadoSalvar\(|localStorage\.setItem/.test(salvar), 'e nao grava nada por conta propria');

console.log('\n=== "Voltar ao programa" volta ao PROGRAMA (31/08, item 6) ===');
// Ele reclamou: "quando eu aperto para retornar ao programa ele volta para a tela antiga".
// Causa: modCfgFechar so ESCONDIA a tela nova — e como modCfgAbrir tinha escondido todas
// as outras, sobrava o corpo do programa antigo (as abas do 1.0) a mostra.
const fechar = grab('modCfgFechar');
ok(/_modCfgVolta \|\| 'telaAbertura'/.test(fechar),
   'volta para a tela de onde veio, e na falta dela para a ABERTURA — nunca para a antiga');
ok(/restaurar===false/.test(fechar),
   'com restaurar=false nao restaura nada (senao cobriria o painel antigo)');
ok(/modCfgFechar\(false\)/.test(HTML), 'e e assim que o "Painel antigo" a chama');
const lembrar = grab('modCfgLembrarTela');
ok(/getComputedStyle\(e\)\.display!=='none'/.test(lembrar),
   'a tela aberta e reconhecida pelo display calculado');
// ⚠️ a armadilha que mordeu na 1a versao: estas telas sao position:fixed, e para elemento
// fixo offsetParent e SEMPRE nulo — usa-lo fazia nenhuma tela ser reconhecida.
// Cobra CODIGO, nao comentario: o proprio comentario da funcao CITA offsetParent para
// avisar do perigo, e a 1a versao desta assercao batia nele (teste que le prosa erra).
const lembrarCodigo = lembrar.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok(!/offsetParent/.test(lembrarCodigo),
   'e NAO por offsetParent, que e nulo em tela fixa (mordeu na 1a versao)');
ok(/modCfgLembrarTela\(\);/.test(grab('modCfgAbrir')), 'abrir as Configuracoes guarda a tela atual');

console.log('\n=== a saida de emergencia ===');
ok(/data-pane="antigo"/.test(HTML), 'existe o item "Painel antigo"');
ok(/if\(pane==='antigo'\)\{ modCfgAbrirAntigo\(\); return; \}/.test(HTML), 'e ele abre o painel antigo');
ok(/data-pane="antigo"[^>]*>Painel antigo<span class="antiga">/.test(HTML),
   'e diz no rotulo que e a tela antiga');

console.log('\n=== o revestimento nao vaza para o resto do app ===');
const i0 = HTML.indexOf('#telaModelos .cfgHost label');
const css = HTML.slice(i0, HTML.indexOf('#telaModelos .grid{display:grid', i0));
ok(css.length > 300, 'o CSS que reveste os controles movidos existe');
const seletores = css.split('\n').filter(l => /^\s*#/.test(l));
ok(seletores.every(l => l.indexOf('#telaModelos') >= 0),
   'e TODO seletor comeca em #telaModelos (o painel antigo continua com o visual dele)');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
