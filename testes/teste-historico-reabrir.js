// REABRIR UM LAUDO ANTIGO NA TELA DE LIBERAÇÃO — pedido do Dr. Daniel, 21/08/2026.
//
// O histórico guarda o laudo como HTML JÁ DESENHADO, não como campos. Reabri-lo editável
// exige desmontar esse desenho de volta em título / técnica / corpo / conclusão /
// ressalvas — e desmontar errado significaria entregar ao médico um laudo com pedaços no
// lugar trocado, para ele assinar.
//
// O que esta suíte mais persegue: que a reconstrução RECUSE o que não reconhece, em vez de
// devolver um laudo pela metade.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// A RECONSTRUÇÃO EM SI (hisLaudoDoHtml) é testada em `teste-navegador.js`, e não aqui, de
// propósito: ela desmonta HTML e precisa de DOM DE VERDADE. Recortar a função e rodá-la
// contra um DOM de mentira testaria a mentira. Lá a página inteira é carregada num Chrome
// de verdade — é o mesmo motivo pelo qual aquela suíte existe.
// Esta aqui cobre o que é legível no código: o caminho, as travas e os avisos.

function pegar(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== o botão existe e sabe QUAL laudo está na tela ===');
ok(/id="verLaudoReabrir"/.test(HTML), 'há o botão "Reabrir para editar"');
ok(/Reabrir para editar/.test(HTML), 'com rótulo que diz o que faz');
const abrirBlk = HTML.slice(HTML.indexOf('abrindo o laudo guardado'), HTML.indexOf('function hisFecharLaudo'));
ok(/_bt\.onclick=function\(\)\{ hisReabrir\(r\.id\); \}/.test(abrirBlk),
   'o id vai por closure, não concatenado dentro de um onclick no HTML');
ok(!/onclick="hisReabrir\(/.test(HTML),
   'e não existe nenhum onclick com o id concatenado — id de histórico pode ter aspas');

console.log('\n=== a tela de leitura sai da frente ao reabrir ===');
// Ela vive em z-index 9100, ACIMA das outras. Sem entrar nesta lista, a revisão abriria por
// baixo dela e o botão pareceria não funcionar — o mesmo defeito que custou a tarde de ontem.
const abrirRev = HTML.slice(HTML.indexOf('function rev2Abrir(exId)'), HTML.indexOf('function rev2AbrirOpcoes'));
ok(/'telaVerLaudo'/.test(abrirRev), 'telaVerLaudo está na lista de telas que rev2Abrir esconde');
const reab = pegar('hisReabrir');
ok(/hisFecharLaudo\(\)/.test(reab), 'e hisReabrir também a fecha explicitamente');
ok(/rev2Abrir\(/.test(reab), 'antes de abrir a tela de liberação');
ok(/_rev2Origem='historico'/.test(reab), 'marcando de onde veio, para o Voltar não errar');

console.log('\n=== exame ainda NESTA sessão não é reconstruído ===');
// Reconstruir seria entregar uma versão pior do que já existe: sem imagens, sem ditado.
ok(/hisExameDaSessao\(r\)/.test(reab), 'primeiro procura o exame real da sessão');
ok(reab.indexOf('hisExameDaSessao') < reab.indexOf('hisLaudoDoHtml'),
   'e só reconstrói se não achar — o de verdade tem imagens e ditado, a reconstrução não');

console.log('\n=== não duplica ao reabrir duas vezes ===');
ok(/_doHistorico===r\.id/.test(reab), 'reabrir o mesmo laudo reaproveita o que já está aberto');
ok(/jaAberto/.test(reab), 'em vez de empilhar um segundo exame do mesmo laudo');

console.log('\n=== o que NÃO volta é dito na cara ===');
ok(/imagens do exame NÃO ficam guardadas/.test(reab),
   'o aviso diz que o laudo volta SEM as fotos');
ok(/sem esquema anatômico e sem conferência contra imagem/.test(reab),
   'e diz a CONSEQUÊNCIA disso, não só o fato');
ok(/_semImagens:true/.test(reab), 'e o exame reconstruído carrega essa marca');
const render = HTML.slice(HTML.indexOf("document.getElementById('rv2Tit')"), HTML.indexOf("var elIgn="));
ok(/ex\._doHistorico/.test(render), 'a tela de revisão reconhece o laudo reaberto');
ok(/Laudo REABERTO do histórico/.test(render), 'e o anuncia no alto');
ok(/sem as imagens do exame/.test(render),
   'com o aviso das fotos ali também — senão só se descobre ao procurar e não achar');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
