// A PLAQUINHA `verHist` E AS FOLHAS EM BRANCO — defeito relatado pelo Dr. Daniel, 01/09/2026.
//
// O QUE ELE VIU: abriu um laudo no Histórico, passou pelas Configurações (para conferir a
// caixa da impressão automática), voltou, liberou um laudo e clicou em Imprimir. A caixa de
// impressão do navegador abriu normalmente e saíram QUATRO FOLHAS EM BRANCO. Nenhum erro na
// tela, nenhum aviso — o pior tipo de defeito, o que não se anuncia.
//
// POR QUE: a classe `verHist` no <body> manda a impressão esconder o laudo da revisão, para
// não saírem dois laudos no mesmo papel enquanto a tela de leitura do histórico está aberta
// (regra `body.verHist #areaImpressao` no @media print). A intenção é certa; o defeito era
// quem a removia — SÓ `hisFecharLaudo`. Três outros caminhos escondem #telaVerLaudo sem
// passar por ele, e depois deles a plaquinha continuava no ar: a impressão escondia o laudo
// NOVO (aquela regra tem especificidade maior e ganha da que manda mostrar) e o ANTIGO já
// tinha sido apagado da memória. Não sobrava nada para o papel.
//
// O QUE ESTA SUÍTE PROTEGE, e é o ponto: não basta os três caminhos de hoje estarem
// consertados. Qualquer caminho NOVO que esconda #telaVerLaudo precisa acertar a plaquinha —
// senão o defeito volta pela porta que ninguém estava olhando. É essa regra que se vigia aqui.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function pegar(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== a regra de impressão que causou o estrago continua existindo ===');
// Se esta regra sumir, a suíte inteira perde o sentido — e valeria apagá-la junto.
ok(/body\.verHist #areaImpressao/.test(HTML),
   'a regra body.verHist esconde o laudo da revisão na impressão (é ela que exige a plaquinha certa)');
ok(/#areaImpressaoHist,#areaImpressaoHist \*\{visibility:visible;\}/.test(HTML),
   'e o laudo do histórico é quem deve sair no lugar dele');

console.log('\n=== a conferência existe e olha a TELA, não a memória ===');
const sinc = pegar('hisSincronizarVerHist');
ok(/getComputedStyle/.test(sinc),
   'a conferência lê o estado real da tela (getComputedStyle), não o style.display escrito à mão');
ok(/classList\.toggle\('verHist'/.test(sinc),
   'e ACERTA a plaquinha nos dois sentidos — põe quando a tela está aberta, tira quando não está');
ok(/try\{/.test(sinc) && /catch/.test(sinc),
   'sem nunca lançar: falhar aqui não pode impedir uma impressão');

console.log('\n=== a rede de segurança: a conferência acontece na hora de imprimir ===');
// É esta linha que faz o defeito não voltar por um caminho novo. Vale também para o Ctrl+P,
// que não passa por botão nenhum do programa.
ok(/addEventListener\('beforeprint', *hisSincronizarVerHist\)/.test(HTML),
   'a plaquinha é conferida no instante em que o papel vai sair (beforeprint)');

console.log('\n=== TODO caminho que esconde #telaVerLaudo acerta a plaquinha ===');
// O guardião de verdade. Varre o arquivo atrás de cada lista de telas que é escondida em
// massa e que inclui 'telaVerLaudo'; cada uma tem de acertar a plaquinha logo em seguida.
// Um caminho novo criado amanhã cai aqui antes de chegar ao papel do médico.
const RE_LISTA = /\[[^\]]*'telaVerLaudo'[^\]]*\]\s*\n?\s*\.?forEach\(function\(id\)\s*\{[^}]*display\s*=\s*'none'[^}]*\}\s*\)\s*;/g;
let m, achadas = 0;
while ((m = RE_LISTA.exec(HTML))) {
  achadas++;
  const depois = HTML.slice(m.index + m[0].length, m.index + m[0].length + 400);
  const nome = (function () {
    const antes = HTML.slice(0, m.index);
    const f = antes.lastIndexOf('function ');
    return f < 0 ? '(?)' : antes.slice(f + 9, antes.indexOf('(', f)).trim();
  })();
  ok(/hisSincronizarVerHist\(\)/.test(depois),
     'quem esconde telaVerLaudo acerta a plaquinha: ' + nome);
}
ok(achadas >= 3, 'a varredura encontrou os caminhos em massa (achou ' + achadas + ', esperado 3 ou mais)');

console.log('\n=== o caminho antigo continua correto ===');
const fechar = pegar('hisFecharLaudo');
ok(/classList\.remove\('verHist'\)/.test(fechar),
   'hisFecharLaudo continua tirando a plaquinha ao sair pelo botão "Voltar ao histórico"');
ok(/areaImpressaoHist'\); if\(a\) a\.innerHTML=''/.test(fechar),
   'e apaga o laudo antigo — é por ele já estar apagado que a plaquinha presa dava papel em branco');

console.log('\n=== os três caminhos que mordiam, um por um ===');
// Nomeados de propósito: se algum deles for reescrito e perder a chamada, a falha diz qual é.
[['modCfgAbrir', 'abrir as Configurações — o caminho que o médico percorreu em 01/09'],
 ['modCfgAbrirBizus', 'abrir os Bizus/Textos de achado'],
 ['rev2Abrir', 'abrir um exame na tela de revisão']].forEach(function (par) {
  ok(/hisSincronizarVerHist\(\)/.test(pegar(par[0])), par[0] + ': ' + par[1]);
});

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
