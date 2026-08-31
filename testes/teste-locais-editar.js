// EDITAR OS LOCAIS DE ATENDIMENTO — 31/08/2026, pedido do medico (item 8):
// "os botoes indicando qual o local do atendimento devem ter uma opcao de editar eles".
//
// ⚠️ A DECISAO QUE SUSTENTA ISTO: ao EDITAR, a CHAVE do local nao muda, nem que ele troque
// o nome inteiro. A chave e o que liga o local ao papel timbrado (FUNDOS), ao "local de
// hoje" guardado (g20local) e aos laudos ja salvos com aquele fundo. Recalcula-la a partir
// do nome novo deixaria tudo isso apontando para um local que nao existe mais — e o laudo
// antigo abriria SEM TIMBRADO. Renomear e so trocar o rotulo.
//
// E os locais que vem no programa (Tailandia, Capanema) tambem se editam: gravar um
// cadastro com a MESMA chave substitui o embutido, em vez de aparecer um segundo botao.
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

console.log('=== o lapis existe em cada local ===');
const render = grab('exRenderLocais');
ok(/localEdit/.test(render), 'cada botao de local ganha um botao de editar');
ok(/exEditarLocal\(/.test(render), 'que abre a edicao daquele local');
ok(/event\.stopPropagation\(\)/.test(render),
   'e o clique no lapis NAO escolhe o local (senao editar trocaria o local do dia)');
ok(/#telaExames \.localEdit\{position:absolute/.test(HTML),
   'o lapis fica por cima do botao, sem empurrar o layout dos cartoes');

console.log('\n=== editar reusa o formulario do cadastro ===');
const editar = grab('exEditarLocal');
ok(/_exCadEditando=k/.test(editar), 'guarda QUAL local esta sendo editado');
ok(/exCadNome'\)\.value=l\.rot/.test(editar), 'ja abre com o nome atual preenchido');
ok(/FUNDOS\[k\]\|\|\{\}\)\.img/.test(editar),
   'e mostra o timbrado atual — inclusive o dos locais que vem no programa');
ok(/Editar local de atendimento/.test(editar), 'o titulo do formulario diz que e edicao');
const novo = grab('exNovoLocal');
ok(/_exCadEditando=null/.test(novo), 'e cadastrar um novo limpa o modo de edicao');
ok(/Cadastrar um local de atendimento/.test(novo), 'voltando o titulo para cadastro');
ok(/_exCadEditando=null/.test(grab('exCadFechar')),
   'cancelar tambem sai do modo edicao (senao o proximo cadastro sobrescreveria)');

console.log('\n=== a chave NAO muda ao renomear (o ponto critico) ===');
const salvar = grab('exCadSalvar');
ok(/var k=editando \|\| \('loc-'/.test(salvar),
   'editando, mantem a chave; so no cadastro novo ela nasce do nome');
ok(/l\.k!==k && norm\(l\.rot\)===nomeNorm/.test(salvar),
   'renomear para o nome de OUTRO local e recusado');
ok(/Esse local já vem no programa/.test(salvar),
   'e cadastrar um novo com nome ja existente tambem');
ok(/aplicarMargensImpressao/.test(salvar),
   'depois de editar, a folha aberta reaplica as margens do timbrado');

console.log('\n=== o embutido editado SUBSTITUI, nao duplica ===');
const todos = grab('exTodosLocais');
ok(/porChave\[l\.k\]/.test(todos), 'um cadastro com a mesma chave assume o lugar do embutido');
ok(/EX_LOCAIS\.some\(function\(b\)\{ return b\.k===l\.k; \}\)/.test(todos),
   'e o embutido nao entra duas vezes na lista');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
