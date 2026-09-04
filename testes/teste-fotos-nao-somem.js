// AS FOTOS DO EXAME NAO PODEM SUMIR NUM RECARREGAMENTO — 03/09/2026.
//
// O CASO REAL, lido no agente-diario.log da linha 3.0:
//   23:29  Maria De Fatima ... 2  (11 foto(s))   <- mama, completo
//   23:43  Maria De Fatima ...    ( 6 foto(s))   <- tireoide, completo
//   23:45  Maria De Fatima ... 2  ( 0 foto(s))   <- MAMA, SEM NENHUMA
//   23:47  Maria De Fatima ... 2  ( 0 foto(s))   <- de novo
//
// Entre 23:29 e 23:45 houve um F5 (pedido por mim, para a assinatura recem-configurada
// valer). As fotos do exame eram a UNICA peca que vivia so na memoria da janela: o
// retrato da sessao tem um modo LEVE, sem imagens, para nao travar em dias de 100 exames,
// e ao restaurar elas voltam vazias. O ditado tinha protecao (o endereco se refaz por
// `_estudoAudio`); a imagem, nenhuma.
//
// E o pior nao foi perder: foi o programa GRAVAR o laudo com zero fotos, duas vezes, sem
// dizer uma palavra. Perder tem conserto — refazer. Laudo de ultrassom entregue sem as
// imagens, nao: ele vai para a pasta, para a nuvem e para a mao do paciente.
//
// Tres regras, e esta suite existe para que nenhuma delas se perca:
//   1. o exame guarda o VINCULO com o aparelho (_instIds), venha de onde vier;
//   2. ao restaurar a sessao, as fotos sao rebuscadas do aparelho;
//   3. salvar um laudo que PERDEU as fotos pergunta antes.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== 1. o exame guarda o vinculo com o aparelho ===');
// Sem _instIds nao ha de onde rebuscar: as fotos so existem na memoria da janela. O exame
// de mama da Maria de Fatima veio pela tela de fotos antigas e nasceu SEM o vinculo — por
// isso ficou irrecuperavel, enquanto o de tireoide (que tinha) pode ser refeito.
ok(/instancias:\(e\.instancias\|\|\[\]\)\.slice\(\)/.test(HTML),
   'o que a tela de antigos importa leva as instancias do aparelho junto');
ok(/_estudoId:d\.id\|\|'', ?_instIds:\(d\.instancias\|\|\[\]\)\.slice\(\)/.test(HTML),
   'e o exame criado a partir delas nasce COM _estudoId e _instIds');
// o caminho da captura ao vivo ja fazia isso — nao pode regredir
ok(/_estudoId:est\.id, ?_instIds:instIds/.test(HTML),
   'o caminho da captura ao vivo continua guardando o vinculo');
// e o retrato da sessao tem de carregar o vinculo, senao ele se perde no F5
const salvar = grab('salvarSessao');
ok(/_instIds:e\._instIds\|\|\[\]/.test(salvar),
   'o retrato da sessao guarda _instIds — e por ele que a volta acontece');

console.log('\n=== 2. as fotos voltam do aparelho ao restaurar ===');
const reb = grab('rev2RebuscarImagens');
ok(!!reb, 'existe quem rebusque as fotos');
ok(/!e\.imagens \|\| !e\.imagens\.length/.test(reb) && /_instIds\|\|\[\]\)\.length/.test(reb),
   'so mexe em exame que esta SEM fotos e TEM vinculo — nao rebaixa o que ja tem');
ok(/dicomBaixarImagem/.test(reb), 'e busca as imagens no aparelho, uma a uma');
const rest = grab('restaurarSessao');
ok(/rev2RebuscarImagens\(\)/.test(rest), 'a restauracao da sessao chama a recuperacao');
ok(/setTimeout\(function\(\)\{ rev2RebuscarImagens\(\); \}, 0\)/.test(rest),
   'em segundo plano: a tela abre na hora, as fotos chegam depois');
ok(/renderExames\(\)/.test(reb) && /diaRenderLista\(\)/.test(reb),
   'e a tela se redesenha conforme cada exame recupera as suas');
ok(/catch\(err\)/.test(reb), 'foto que nao volta nao derruba as outras');
ok(/n[aã]o consegui recuperar/i.test(reb),
   'e se nada voltar, diz — em vez de deixar o exame vazio em silencio');

console.log('\n=== 3. laudo que PERDEU as fotos nao sai calado ===');
const salvarPasta = grab('salvarLaudoPasta');
ok(/está SEM NENHUMA|esta SEM NENHUMA/.test(salvarPasta),
   'salvar um laudo cujas fotos sumiram pergunta antes');
ok(/confirm\(/.test(salvarPasta), 'com uma pergunta de verdade, nao um aviso que passa');
ok(/return false;/.test(salvarPasta), 'e da para cancelar — o laudo NAO e gravado');
ok(/nao da para acrescenta|não dá para acrescentá/.test(salvarPasta),
   'dizendo o que esta em jogo: a foto nao entra depois no arquivo ja gravado');
ok(/await rev2RebuscarImagens\(\)/.test(salvarPasta),
   'e antes de perguntar, TENTA recuperar — perguntar sem tentar seria empurrar o problema');
ok(salvarPasta.indexOf('rev2RebuscarImagens') < salvarPasta.indexOf('confirm('),
   'nessa ordem: recupera primeiro, pergunta so se ainda faltar');

console.log('\n=== o exame que NUNCA teve foto passa direto ===');
// Ditado avulso e laudo refeito do historico nao tem imagem por natureza (o historico nao
// guarda fotos — esta escrito no proprio hisReabrir). Perguntar neles seria uma pergunta
// por laudo, todo dia, sobre um problema que nao existe.
ok(/\(_exAtual\._instIds\|\|\[\]\)\.length/.test(salvarPasta),
   'a pergunta so aparece quando o exame TEM vinculo com o aparelho');
ok(/_semImagens/.test(HTML),
   'e o laudo reaberto do historico continua marcado como sem imagens, sem virar alarme');

console.log('\n=== o registro fica no diario ===');
ok(/salvo SEM as /.test(salvarPasta),
   'seguir mesmo assim deixa registro — laudo sem foto nao pode ser indistinguivel de laudo completo');
ok(/Salvamento cancelado/.test(salvarPasta), 'e cancelar tambem fica registrado');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
