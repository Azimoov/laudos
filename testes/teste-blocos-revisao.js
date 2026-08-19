// Retangulos da tela de revisao — a leva de defeitos de 19/08/2026.
//
// UMA causa de arquitetura gerava QUATRO defeitos que o medico viu no mesmo dia:
// o negrito servia para tres coisas (titulo de orgao, medida, achado patologico) e o
// codigo so separava por "tem pontilhado" e "cabe em 70 caracteres". Enquanto a medida
// estava vazia (.....) ela era ignorada; assim que ele PREENCHIA, virava titulo e virava
// achado. Daí: utero em varias caixas, prostata normal em verde, medida repetida em cima
// do texto e fora da caixa de edicao, e linha inteira em negrito sumindo do campo editavel.
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const DADOS = fs.readFileSync(path.join(RAIZ, 'dados.js'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(n) {
  let i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('nao achei ' + n);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
const pega = (re, oque) => { const m = HTML.match(re); if (!m) throw new Error('nao achei ' + oque); return m[0]; };

const api = new Function([
  pega(/const FALTA\s*=\s*\{[\s\S]*?\n\};/, 'FALTA'),
  pega(/const REV2_MOLDURA = [^\n]*/, 'REV2_MOLDURA'),
  pega(/const REV2_ROTULO_MEDIDA = [^\n]*/, 'REV2_ROTULO_MEDIDA'),
  grab('norm'), grab('faltaTitulo'), grab('faltaGrupos'), grab('faltaTrecho'),
  grab('medidasFaltando'), grab('rev2TituloDeMoldura'), grab('rev2NegritoDeMedida'),
  grab('rev2TituloDeBloco'), grab('rev2Blocos'), grab('rev2BlocosDaTela'),
  grab('rev2CorpoVisivel'), grab('rev2Proc'), grab('rev2Estado'),
  grab('rev2TermosAchado'), grab('alertasAchadoSemNegrito')
].join('\n') + '\nreturn {rev2NegritoDeMedida, rev2TituloDeBloco, rev2Blocos, rev2BlocosDaTela,'
  + ' rev2CorpoVisivel, rev2Estado, alertasAchadoSemNegrito};')();
const { rev2NegritoDeMedida, rev2TituloDeBloco, rev2Blocos, rev2BlocosDaTela,
        rev2CorpoVisivel, rev2Estado, alertasAchadoSemNegrito } = api;
const MODELOS = new Function(DADOS + '\n;return MODELOS;')();
const EX = { laudo: {} };
// laudo PREENCHIDO: era so depois de preencher as medidas que os defeitos apareciam
const preenchido = k => MODELOS[k].corpo.replace(/\.{5}/g, '8');

console.log('=== negrito de MEDIDA nao se confunde com achado nem com titulo ===');
[['Peso: 25 g (Normal até 30 g)', true], ['Volume pré miccional: 364 ml', true],
 ['Dimensões: 3,2 x 3,9 x 3,6 cm (em seus diâmetros transversal, longitudinal e anteroposterior).', true],
 ['..... mm.', true], ['8 x 4 x 3 cm. Volume: 12 cm³.', true], ['Volume total da glândula: 9 cm³', true],
 ['Espessura 0,4 cm', true], ['Medida: 8 cm', true],
 ['nódulo hipoecogênico medindo 0,8 cm', false], ['tendinopatia', false],
 ['Próstata', false], ['esteatose hepática', false], ['cisto simples de 8 mm', false]
].forEach(([t, esperado]) => ok(rev2NegritoDeMedida(t) === esperado,
  (esperado ? 'medida: ' : 'NAO e medida: ') + JSON.stringify(t.slice(0, 46))));

console.log('=== item 7 — utero em UMA caixa, nao em varias ===');
let bl = rev2Blocos({ corpo: preenchido('transvaginal') });
let tits = bl.map(b => b.titulo);
ok(tits.filter(t => /útero/i.test(t)).length === 1, 'existe UM retangulo de utero');
ok(!tits.some(t => /^\d|cm³|mm/.test(t)), 'nenhuma MEDIDA virou titulo de retangulo');
ok(tits.join('|').indexOf('Ovário direito') >= 0 && tits.join('|').indexOf('Ovário esquerdo') >= 0,
  'os ovarios continuam com retangulo proprio');
ok(bl.length === 6, 'transvaginal da 6 retangulos (bexiga, vagina, utero, 2 ovarios, FSD) — deu ' + bl.length);
const utero = bl.filter(b => /útero/i.test(b.titulo))[0];
ok(/colo uterino/i.test(utero.texto), 'o colo uterino ficou DENTRO do retangulo do utero');
ok(/Endométrio/i.test(utero.texto) && /Volume total/i.test(utero.texto),
  'endometrio e volume tambem — o utero e um bloco so');

console.log('=== item 8 — prostata NORMAL nao pode ficar verde ===');
bl = rev2Blocos({ corpo: preenchido('prostata') });
bl.forEach(b => ok(rev2Estado(EX, b) === 'normal',
  'prostata normal: "' + b.titulo + '" fica cinza, nao verde'));
console.log('=== e um achado de verdade CONTINUA acendendo verde ===');
const comAchado = '**Próstata:** Com parênquima heterogêneo, apresentando **nódulo hipoecogênico medindo 0,8 cm** no lobo direito.\n**Peso: 25 g (Normal até 30 g)**';
ok(rev2Estado(EX, rev2Blocos({ corpo: comAchado })[0]) === 'alterado',
  'achado dentro do orgao acende verde (a rede nao ficou frouxa)');
ok(rev2Estado(EX, rev2Blocos({ corpo: '**Tireóide:** textura homogênea.\nMedida: **8 x 4 x 3 cm. Volume: 12 cm³.**' })[0]) === 'normal',
  'tireoide normal com medida em negrito longa tambem fica cinza');

console.log('=== item 2 — medida NAO aparece duas vezes (em cima e dentro) ===');
const linhaMedida = '**Útero:** Forma piriforme.\nEndométrio homogêneo, medindo **8 mm.**';
bl = rev2Blocos({ corpo: linhaMedida });
ok(bl.length === 1, 'a linha da medida NAO abre retangulo novo');
let cv = rev2CorpoVisivel(bl[0]);
ok(cv.txt.indexOf('8 mm') >= 0, 'a medida esta no texto editavel');
ok(bl[0].titulo === 'Útero' && bl[0].titulo.indexOf('8 mm') < 0,
  'e NAO esta tambem no titulo — era essa a duplicacao');

console.log('=== item 5 — nada de texto fora da caixa de edicao ===');
['prostata', 'transvaginal', 'tireoide', 'rins', 'abdominal', 'mama'].forEach(k => {
  const b2 = rev2Blocos({ corpo: preenchido(k) });
  ok(b2.every(b => rev2CorpoVisivel(b).txt.trim().length > 0),
    k + ': nenhum retangulo fica com o campo editavel VAZIO');
});
const soNegrito = rev2Blocos({ corpo: '**Peso: 25 g (Normal até 30 g)**' })[0];
ok(rev2CorpoVisivel(soNegrito).txt.trim().length > 0,
  'linha inteiramente em negrito continua editavel (antes sumia para o titulo)');
const moldura = rev2Blocos({ corpo: '**DESCRIÇÃO:**\nMama simétrica.' })[0];
ok(rev2CorpoVisivel(moldura).txt.indexOf('DESCRIÇÃO') >= 0,
  'moldura em bloco sem titulo NAO some da tela');

console.log('=== item 3 e 4 — impressao e dados clinicos ===');
const L = { corpo: '**Fígado:** normal.', conclusao: 'Exame normal.', cab: { dados_clinicos: 'Dor em hipocôndrio direito.' } };
const tela = rev2BlocosDaTela(L);
ok(tela[0]._dc === true && tela[0].titulo === 'DADOS CLÍNICOS', 'dados clinicos e o PRIMEIRO retangulo');
ok(tela[tela.length - 1]._conc === true, 'a impressao e o ULTIMO');
ok(rev2Estado(EX, tela[0]) === 'clinico', 'dados clinicos tem estado proprio');
ok(rev2Estado(EX, tela[tela.length - 1]) === 'conclusao', 'a impressao tem estado proprio');
// olha o CODIGO, nao o comentario: o comentario cita o rotulo antigo de proposito,
// para quem for mexer saber o que foi tirado e por que
ok(!/blocos\.push\(\{titulo:'[^']*GERADO POR IA/.test(HTML),
  'a impressao NAO se diz mais "gerada por IA"');
ok(/blocos\.push\(\{titulo:'IMPRESSÃO DIAGNÓSTICA/.test(HTML), 'o rotulo novo esta no lugar');
ok(!/_ia:true/.test(HTML), 'ninguem mais marca a conclusao como texto de IA');
ok(/#telaRev2 \.bloco\.conclusao \.txt\{color:#46505C\}/.test(HTML),
  'a impressao usa cinza MAIS ESCURO que o dos blocos normais (#8A93A0)');
ok(rev2BlocosDaTela({ corpo: '**Fígado:** normal.', conclusao: 'x' }).every(b => !b._dc),
  'sem dados clinicos, nao inventa o retangulo');

console.log('=== a lista da tela e a da edicao sao a MESMA (senao edita um e grava noutro) ===');
ok(/var blocos=rev2BlocosDaTela\(ex\.laudo\), novo=rev2ParaTexto\(el\)/.test(HTML),
  'rev2Editou usa rev2BlocosDaTela');
ok(/var blocos=rev2BlocosDaTela\(L\);/.test(HTML), 'rev2Render usa rev2BlocosDaTela');
ok(/if\(b\._dc\)\{ ex\.laudo\.cab=ex\.laudo\.cab\|\|\{\}; ex\.laudo\.cab\.dados_clinicos=novo/.test(HTML),
  'editar dados clinicos grava no CABECALHO, nao no corpo');
ok(/blocos\.filter\(function\(x\)\{ return !x\._dc && !x\._conc; \}\)/.test(HTML),
  'so os retangulos do CORPO voltam para o corpo do laudo');

console.log('=== item 6 — achado em negrito num orgao e sem negrito noutro ===');
const incoerente = { corpo: '**Tendão supraespinhal:** espessado, com **tendinopatia**.\n\n**Tendão subescapular:** espessado, com tendinopatia, sem rotura.' };
const av = alertasAchadoSemNegrito(incoerente);
ok(av.length === 1 && av[0].tipo === 'divergencia', 'acende aviso de divergencia');
ok(/tendinopatia/.test(av[0].texto), 'o aviso nomeia o termo');
ok(/subescapular/.test(av[0].texto), 'e nomeia o orgao que ficou sem negrito');
ok(alertasAchadoSemNegrito({ corpo: '**Tendão supraespinhal:** com **tendinopatia**.' }).length === 0,
  'laudo coerente nao gera aviso');
ok(alertasAchadoSemNegrito({ corpo: preenchido('prostata') }).length === 0,
  'exame normal com medidas em negrito nao gera aviso falso');
ok(/COERÊNCIA DO NEGRITO \(obrigatório\)/.test(HTML), 'a IA tambem foi instruida sobre isso');

console.log('=== item 9 — cistos so nao se contam na MAMA ===');
ok(/SÓ NO EXAME DE MAMA/.test(HTML), 'a regra de nao contar cistos ficou presa a mama');
ok(/Dois cistos no mesmo rim são DOIS cistos no laudo/.test(HTML),
  'e o exemplo do rim ficou explicito');
ok(/ESTA REGRA NÃO VALE PARA NENHUM OUTRO ÓRGÃO/.test(HTML), 'e a excecao e dita sem rodeio');

console.log('=== item 11 — cada aviso com o seu som ===');
const SOM = grab('micSom');
ok(/tipo==='pronto'/.test(SOM), 'existe som proprio para "laudo pronto"');
// de novo: o comentario cita `micSom()` para explicar o defeito. O que nao pode existir
// e a CHAMADA sem argumento, que e sempre `micSom();`
ok(!/micSom\(\);/.test(HTML), 'ninguem mais chama micSom SEM argumento (caia no som do reinicio)');
const notas = SOM.match(/\[\[\d+,0\]/g) || [];
ok(new Set(notas).size === notas.length, 'os quatro sons comecam em frequencias diferentes');

console.log('=== item 16 — o cabecalho diz a REGIAO, nao so o tipo ===');
ok(/_tituloLaudo=String\(L\.titulo\|\|''\)/.test(HTML), 'usa o titulo do laudo, que carrega a regiao');
ok(/Laudo '\+pos\+' de '\+fila\.length/.test(HTML) === false || /_posTxt/.test(HTML),
  '"Laudo 0 de 0" nao aparece mais em laudo ja assinado');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
