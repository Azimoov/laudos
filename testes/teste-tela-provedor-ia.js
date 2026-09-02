// TELA NOVA DO PROVEDOR DE IA — 29/08/2026, pedido do medico:
// "quando eu clico no provedor de IA na parte de configuracoes, ele me leva para a tela
//  antiga. Preciso de uma tela nova com todas as mesmas funcionalidades, mas layout novo."
//
// ⚠️ A REGRA QUE SUSTENTA ESTA TELA (nao quebre sem ler): aqui NAO existe uma segunda
// gravacao de configuracao. Os campos novos ESPELHAM os antigos (#cfgIaBase, #cfgChave,
// #cfgModelo, #cfgModeloAux, #cfgConferente) e o Salvar chama o MESMO salvarConfig().
// Duas telas gravando por caminhos diferentes divergiriam — e chave de API e modelo
// cobrado nao sao lugar para descobrir isso depois. Mesmo principio do #bizusEditor.
//
// O aviso ambar (auxiliar vazio ou igual ao principal) nasceu do diagnostico de consumo
// de 28/08: as tres tarefas mecanicas de CADA exame estavam pagando preco de modelo caro.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  let i = HTML.indexOf('async function ' + nome + '(');
  if (i < 0) i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== o item de menu deixou de cair na tela antiga ===');
ok(HTML.indexOf('data-pane="ia" onclick="modCfgIr(\'ia\')">Provedor de IA</button>') >= 0,
   'o rotulo nao diz mais "tela antiga"');
// 29/08 (2a leva): MOD_PANE_ANCORA ESVAZIOU — todos os itens ganharam tela propria
ok(/const MOD_PANE_ANCORA = \{\};/.test(HTML),
   'nenhum item da navegacao cai mais no painel antigo');
ok(/if\(pane==='ia'\)\{ modCfgMostrarPane\('ia'\); iaCfgRender\(\); return; \}/.test(HTML),
   'e passou a abrir o painel proprio (#paneIa)');
ok(/const MOD_PANES = \{modelos:'paneModelos', bizus:'paneBizus', ia:'paneIa',/.test(HTML),
   'os paineis proprios ficam numa lista so (o proximo entra num lugar so)');

console.log('\n=== a tela existe, com TODAS as funcoes da antiga ===');
ok(/id="paneIa"/.test(HTML), 'o painel existe');
[['iaNvBase', 'endereco do provedor'],
 ['iaNvChave', 'chave da API'],
 ['iaNvModelo', 'modelo principal'],
 ['iaNvAux', 'modelo auxiliar'],
 ['iaNvConferente', 'segunda leitura (conferente)']]
  .forEach(([id, oq]) => ok(HTML.indexOf('id="' + id + '"') >= 0, 'tem campo de ' + oq));
['iaCfgTestar', 'iaCfgPadrao', 'iaCfgGuardarChave', 'iaCfgApagarChave', 'iaCfgSalvar']
  .forEach(f => ok(HTML.indexOf(f + '()') >= 0, 'tem a acao ' + f));
// 31/08/2026 — ESTES TRES TESTES MUDARAM DE LADO. Ate aqui eles exigiam que o modelo
// principal continuasse sendo um <select> com "chat-latest", "gpt-5.5" e "gpt-4o"
// escritos a mao, como na tela antiga. Isso deixou de ser o desejado: a conta do medico
// oferece 124 modelos, e a geracao em uso (5.6 sol/terra/luna) nao estava entre as tres.
// Pior, DOIS defeitos foram MEDIDOS no navegador por causa da lista fixa:
//   (a) o valor de fabrica do <select> era "chat-latest"; como o localStorage nasce vazio
//       a cada abertura (a porta e sorteada), os campos eram preenchidos ANTES de a
//       sincronizacao com o agente chegar e ficavam com o padrao. A tela nova le o valor
//       desse campo, entao mostrava "chat-latest" com "gpt-5.5" gravado no disco — e
//       salvar trocava o modelo que ESCREVE O LAUDO, sem aviso nenhum.
//   (b) atribuir a um <select> um valor fora das <option> resulta em "" (regra do HTML).
//       Escolher "gpt-5.6-sol" gravaria modelo VAZIO: programa sem IA no meio do exame.
// NAO devolver a lista fixa. O que se garante agora e o oposto: campo livre + a lista
// de verdade, vinda da conta dele.
ok(/<input type="text" id="iaNvModelo"/.test(HTML),
   'o modelo principal e campo LIVRE (aceita qualquer modelo da conta)');
ok(!/<select id="iaNvModelo"/.test(HTML),
   'e nao voltou a ser lista fixa escrita a mao');
ok(/<input type="text" id="cfgModelo"/.test(HTML),
   'o campo antigo #cfgModelo tambem e livre (era o <select> que gravava "" no defeito b)');
ok(/id="iaNvAlvo"/.test(HTML) && /value="pri"/.test(HTML) && /value="aux"/.test(HTML),
   'a lista de modelos serve aos DOIS campos (seletor de destino)');
ok(/function iaCfgEscolherModelo\(/.test(HTML) && /pri\?'iaNvModelo':'iaNvAux'/.test(HTML),
   'tocar num nome cai no campo escolhido no seletor');

console.log('\n=== os defeitos medidos em 31/08 nao voltam ===');
ok(/function preencherCamposConfig\(/.test(HTML),
   'o preenchimento dos campos e uma funcao propria (nao so dentro do alternarConfig)');
ok(/try\{ preencherCamposConfig\(\); \}catch\(e\)\{\}/.test(HTML),
   'e ela roda TAMBEM depois da sincronizacao com o agente (defeito a)');
const salvarCfg = grab('salvarConfig');
ok(/cfg\.modelo = _mNovo \|\| cfg\.modelo;/.test(salvarCfg),
   'campo principal vazio NAO apaga o modelo gravado (trava do defeito b)');
// o palpite de "barato" pelo nome tem de alcancar a geracao 5.6 (sol/terra/luna),
// que abandonou o sufixo mini/nano. "sol" fica de fora: e o porte caro.
const ehBarato = grab('iaCfgModeloEhBarato');
ok(/luna/.test(ehBarato) && /terra/.test(ehBarato),
   'a caixa "mais baratos" reconhece luna e terra');
ok(!/\bsol\b/.test(ehBarato),
   'e NAO trata "sol" como barato (custa o mesmo que o gpt-5.5)');

console.log('\n=== NADA e gravado por um caminho novo ===');
const salvar = grab('iaCfgSalvar');
ok(/iaCfgParaAntigo\(\)/.test(salvar), 'o salvar copia os campos novos para os ANTIGOS antes');
ok(/salvarConfig\(\)/.test(salvar), 'e chama o MESMO salvarConfig() de sempre');
ok(!/dadoSalvar\(|localStorage\.setItem/.test(salvar),
   'a tela nova NAO grava nada por conta propria (sem segundo caminho de gravacao)');
const paraAntigo = grab('iaCfgParaAntigo');
['cfgIaBase', 'cfgChave', 'cfgModelo', 'cfgModeloAux'].forEach(id =>
  ok(paraAntigo.indexOf(id) >= 0, 'espelha para #' + id));
const testar = grab('iaCfgTestar');
ok(/iaCfgParaAntigo\(\)/.test(testar) && /iaTestarEndereco\(\)/.test(testar),
   'testar o endereco sincroniza e reusa a funcao antiga');
const guardar = grab('iaCfgGuardarChave');
ok(/guardarChaveNoAgente\(\)/.test(guardar), 'guardar a chave reusa a funcao antiga');
ok(/apagarChave|removerChaveDoNavegador\(\)/.test(grab('iaCfgApagarChave')),
   'apagar a chave reusa a funcao antiga');
const conf = grab('iaCfgConferente');
ok(/conferenteAlternar\(el\)/.test(conf), 'a segunda leitura reusa conferenteAlternar');
ok(/cfgConferente/.test(conf), 'e mantem o checkbox antigo em sincronia');

console.log('\n=== a chave nunca e reexibida ===');
const render = grab('iaCfgRender');
ok(/iaNvChave.*value=''/.test(render.replace(/\s+/g, ' ')),
   'ao abrir a tela, o campo da chave nasce VAZIO (nunca mostra a guardada)');
ok(/k\.value=''/.test(salvar), 'e depois de salvar tambem some da tela');

console.log('\n=== o aviso de custo (diagnostico de 28/08) ===');
const pintar = grab('iaCfgPintarCusto');
ok(/!aux \|\| aux===pri/.test(pintar),
   'acende quando o auxiliar esta vazio OU igual ao principal');
ok(/style\.display=mesmo\?'':'none'/.test(pintar), 'e apaga sozinho quando ele difere');
ok(/id="iaAvisoCusto"/.test(HTML), 'o lugar do aviso existe na tela');

console.log('\n=== o visual fica preso a esta tela ===');
// a paleta e as classes sao escopadas em #telaModelos — vazar mexeria no resto do app
const css = HTML.slice(HTML.indexOf('#telaModelos .iaEstado'), HTML.indexOf('#telaModelos .grid{display:grid'));
ok(css.length > 400, 'o CSS da tela nova existe');
const linhas = css.split('\n').filter(l => /^\s*[.#][A-Za-z]/.test(l));
ok(linhas.every(l => l.indexOf('#telaModelos') >= 0),
   'e TODO seletor comeca em #telaModelos (nao vaza para o resto do app)');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
