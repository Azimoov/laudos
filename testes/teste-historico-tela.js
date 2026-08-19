// Tela de Historico (19/08/2026) e a porta de "Liberar laudos" que nao tranca mais.
//
// Dois pedidos do Dr. Daniel no mesmo dia:
//  1. "Liberar laudos" recusava entrada quando nao havia pendente — e ele precisava
//     reabrir um laudo JA assinado (o do Raimundo, cujo arquivo tinha ido parar na
//     pasta temporaria e precisava ser salvo de novo).
//  2. Um botao "Historico" embaixo, com os laudos liberados separados em pastas do dia,
//     cada um podendo ser reaberto para revisao.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function corpoDe(nome) {
  let i = HTML.indexOf('async function ' + nome + '(');
  if (i < 0) i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== "Liberar laudos" nao tranca mais a porta ===');
const LIB = corpoDe('abLiberarLaudos');
ok(/x\.laudo && x\._liberado/.test(LIB), 'com a fila vazia, procura os laudos JA assinados da sessao');
ok(/rev2Abrir\(liberados\[0\]\.id\)/.test(LIB), 'e entra no mais recente em vez de recusar');
ok(LIB.indexOf('liberados') < LIB.indexOf('Nenhum exame nesta sessão'),
   'so cai nas mensagens de "nao ha nada" DEPOIS de tentar os assinados');
ok(/Use o Histórico para escolher outro/.test(LIB), 'e aponta o caminho para os demais');
ok(/Para reabrir um deles, use o Histórico/.test(LIB),
   'a mensagem de "todos assinados" deixou de ser um beco sem saida');

console.log('=== o botao e a tela existem e estao ligados ===');
ok(/onclick="hisAbrir\(\)"/.test(HTML), 'o botao Historico chama hisAbrir');
ok(/<span class="ab-nome">Histórico<\/span>/.test(HTML), 'o botao se chama "Histórico"');
ok(HTML.indexOf('onclick="abLiberarLaudos()"') < HTML.indexOf('onclick="hisAbrir()"'),
   'o botao fica ABAIXO de "Liberar laudos", como pedido');
ok(/<div id="telaHistorico">/.test(HTML), 'a tela existe');
ok(/TELAS_CHEIAS = \[[^\]]*'telaHistorico'/.test(HTML),
   'a tela entrou em TELAS_CHEIAS — senao voltariam as duas barras de rolagem');
ok(/#telaHistorico\{position:fixed;inset:0/.test(HTML), 'tem o CSS de tela cheia');
// ⚠️ regra PROPRIA, nao "#telaA,#telaB{...}": o teste ponta a ponta varre o CSS e tira o
// "#" do seletor; um seletor com duas telas viraria "telaAntigos, #telaHistorico" e a tela
// nao seria reconhecida. Aconteceu ao criar esta tela, e o teste ponta a ponta pegou.
ok(!/#tela\w+,#tela\w+\{position:fixed/.test(HTML),
   'nenhuma regra de tela cheia junta duas telas no mesmo seletor');
ok(/const TELAS = \[[^\]]*'telaHistorico'\]/.test(
     require('fs').readFileSync(require('path').join(__dirname, 'teste-navegador.js'), 'utf8')),
   'a lista do teste ponta a ponta tambem foi atualizada (ela e copia manual, de proposito)');

console.log('=== pastas do dia ===');
const PINTAR = corpoDe('hisPintar');
ok(/porDia\[d\]=porDia\[d\]\|\|\[\]/.test(PINTAR), 'agrupa os laudos por dia');
ok(/<details class="dia"/.test(PINTAR), 'cada dia vira uma pasta que abre e fecha');
ok(/iDia===0\?' open':''/.test(PINTAR), 'o dia mais recente ja vem aberto');
ok(/hisOrdemDia\(b\)\.localeCompare\(hisOrdemDia\(a\)\)/.test(PINTAR), 'dias em ordem, do mais novo ao mais velho');
const ORDEM = corpoDe('hisOrdemDia');
ok(/m\[3\]\+m\[2\]\+m\[1\]/.test(ORDEM), 'ordena por ano-mes-dia (nao pela string dd/mm/aaaa, que ordenaria errado)');
ok(/return m \? \(m\[3\]\+m\[2\]\+m\[1\]\) : '0'/.test(ORDEM), '"sem data" vai para o fim, nao para o topo');
const DIA = corpoDe('hisDia');
ok(/\^\\d\{2\}\\\/\\d\{2\}\\\/\\d\{4\}\$/.test(DIA), 'usa a data do EXAME quando ela existe');
ok(/r\.ts/.test(DIA), 'e cai na data de gravacao so como reserva');

console.log('=== reabrir para revisar ===');
const REV = corpoDe('hisRevisar');
ok(/hisExameDaSessao\(r\)/.test(REV), 'procura o exame correspondente nesta sessao');
ok(/_rev2Origem='historico'/.test(REV), 'marca de onde veio');
ok(/rev2Abrir\(ex\.id\)/.test(REV), 'laudo desta sessao reabre na revisao INTEIRA, editavel');
ok(/historico\/laudo\?id=/.test(REV), 'laudo de outro dia busca o desenho guardado no agente');
ok(/as imagens do exame não ficam guardadas no histórico/.test(REV),
   'e a tela EXPLICA por que esse nao abre editavel, em vez de so nao abrir');
const DA_SESSAO = corpoDe('hisExameDaSessao');
ok(/x\.histKey===r\.id && x\.laudo/.test(DA_SESSAO), 'casa pelo histKey, que e a chave do historico');

console.log('=== voltar nao cai no lugar errado ===');
const VOLTAR = corpoDe('rev2Voltar');
ok(/_rev2Origem==='historico'/.test(VOLTAR), 'quem veio do Historico volta para o Historico');
ok(VOLTAR.indexOf("==='historico'") < VOLTAR.indexOf('diaAbrir()'),
   'e NAO cai no painel do dia, que ligaria a gravacao sem paciente');
ok(/telaHistorico/.test(corpoDe('rev2Abrir')), 'abrir a revisao esconde a tela do Historico');

console.log('=== o titulo nao mente sobre laudo ja assinado ===');
ok(/Relendo laudo JÁ ASSINADO/.test(HTML), 'laudo reaberto diz que ja foi assinado');
ok(/ex\._liberado\s*\n?\s*\?\s*\('Relendo laudo JÁ ASSINADO/.test(HTML),
   'a troca do titulo depende de _liberado');

console.log('=== a busca e o aviso ===');
ok(/id="hisBusca"[^>]*oninput="hisPintar\(\)"/.test(HTML), 'da para procurar por nome do paciente');
ok(/norm\(r\.paciente\|\|''\)\.indexOf\(q\)/.test(PINTAR), 'a busca ignora acento e caixa (usa norm)');
ok(/histBuscaIncompleta\(\)/.test(corpoDe('hisCarregar')),
   'avisa quando so tem a copia do navegador — senao pareceria que sumiu laudo');
ok(/onclick="hisRecarregar\(\)"/.test(HTML), 'tem botao de atualizar');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
