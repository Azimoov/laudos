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

const MODELOS = new Function(DADOS + '\n;return MODELOS;')();
// MODELOS entra como PARAMETRO: rev2MoldeDoModelo consulta os modelos do medico para
// saber o que ja era estrutura antes de o exame existir.
const api = new Function('MODELOS', [
  pega(/const FALTA\s*=\s*\{[\s\S]*?\n\};/, 'FALTA'),
  pega(/const REV2_MOLDURA = [^\n]*/, 'REV2_MOLDURA'),
  pega(/const REV2_ROTULO_MEDIDA = [^\n]*/, 'REV2_ROTULO_MEDIDA'),
  pega(/const REV2_PALAVRA_MEDIDA = [^\n]*/, 'REV2_PALAVRA_MEDIDA'),
  pega(/const REV2_NEGACAO = [^\n]*/, 'REV2_NEGACAO'),
  pega(/const REV2_NEGACAO_POS = [^\n]*/, 'REV2_NEGACAO_POS'),
  pega(/const REV2_LADOS = [^\n]*/, 'REV2_LADOS'),
  grab('norm'), grab('rev2LadoDe'), grab('faltaTitulo'), grab('faltaApara'),
  grab('faltaPalavraNua'), grab('faltaGrupos'), grab('faltaTrecho'),
  grab('medidasFaltando'), grab('rev2TituloDeMoldura'), grab('rev2NegritoDeMedida'),
  grab('rev2Assinatura'), grab('rev2MoldeDoTexto'), grab('rev2MoldeDoModelo'),
  grab('rev2MoldeDoLaudo'),
  grab('rev2TituloDeBloco'), grab('rev2Blocos'), grab('rev2BlocosDaTela'),
  grab('rev2CorpoVisivel'), grab('rev2Proc'), grab('rev2Estado'),
  grab('rev2TermosAchado'), grab('alertasAchadoSemNegrito')
].join('\n') + '\nreturn {rev2NegritoDeMedida, rev2TituloDeBloco, rev2Blocos, rev2BlocosDaTela,'
  + ' rev2CorpoVisivel, rev2Estado, alertasAchadoSemNegrito, rev2Proc, rev2MoldeDoTexto, rev2Assinatura};')(MODELOS);
const { rev2NegritoDeMedida, rev2TituloDeBloco, rev2Blocos, rev2BlocosDaTela,
        rev2CorpoVisivel, rev2Estado, alertasAchadoSemNegrito, rev2Proc,
        rev2MoldeDoTexto, rev2Assinatura } = api;
/* Exame como ele existe DE VERDADE depois da 3ª rodada: com o molde CONGELADO no laudo.
   Testar sem isso mede um programa que não existe. */
const comMolde = (tipo, corpo) => ({ tipo, laudo: { corpo, _molde: rev2MoldeDoTexto(MODELOS[tipo].corpo) } });
const EX = { laudo: {} };
// laudo PREENCHIDO: era so depois de preencher as medidas que os defeitos apareciam
const preenchido = k => MODELOS[k].corpo.replace(/\.{5}/g, '8');

console.log('=== negrito de MEDIDA nao se confunde com achado nem com titulo ===');
// ⚠️ A heuristica e a RESERVA, e ficou de proposito CONSERVADORA na 2a rodada: na duvida
// ela diz "achado", porque achado silenciado e pior que alarme falso. Quem reconhece os
// rotulos compridos do medico ("Dimensoes: ... em seus diametros transversal...") e o
// MOLDE tirado do modelo — testado logo abaixo, no estado do retangulo.
[['Peso: 25 g (Normal até 30 g)', true], ['Volume pré miccional: 364 ml', true],
 ['..... mm.', true], ['8 x 4 x 3 cm. Volume: 12 cm³.', true], ['Volume total da glândula: 9 cm³', true],
 ['Espessura 0,4 cm', true], ['Medida: 8 cm', true],
 // este NAO e reconhecido pela heuristica (sobra "em seus diametros transversal...") e
 // esta certo assim: quem o reconhece e o molde
 ['Dimensões: 3,2 x 3,9 x 3,6 cm (em seus diâmetros transversal, longitudinal e anteroposterior).', false],
 ['nódulo hipoecogênico medindo 0,8 cm', false], ['tendinopatia', false],
 ['Próstata', false], ['esteatose hepática', false], ['cisto simples de 8 mm', false],
 // ⚠️ ACHADO QUE COMECA POR NUMERO — a primeira versao desta funcao (19/08/2026) tratava
 // qualquer negrito iniciado por digito como medida, e isso SILENCIARIA estes quatro:
 // o orgao ficaria cinza, como se normal. Achado silenciado e pior que alarme falso.
 ['2 cistos simples no rim direito', false], ['3 nódulos hipoecogênicos', false],
 ['1,2 cm de nódulo sólido', false], ['2 cálculos calicinais', false],
 // e a medida com faixa de referencia, que COMECA por numero, continua sendo medida
 ['25 g (Normal até 30 g)', true]
].forEach(([t, esperado]) => ok(rev2NegritoDeMedida(t) === esperado,
  (esperado ? 'medida: ' : 'NAO e medida: ') + JSON.stringify(t.slice(0, 46))));

console.log('=== e o achado que comeca por numero ACENDE VERDE de verdade ===');
[['**Rim direito:** tópico, apresentando **2 cistos simples no rim direito**.', 'alterado'],
 ['**Rim direito:** tópico, com **3 nódulos hipoecogênicos**.', 'alterado'],
 ['**Próstata:** homogênea.\n**Peso: 25 g (Normal até 30 g)**', 'normal']
].forEach(([corpo, esperado]) => {
  const b = rev2Blocos({ corpo })[0];
  ok(rev2Estado(EX, b) === esperado,
    'estado "' + esperado + '" para: ' + JSON.stringify(corpo.slice(0, 52)));
});

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
// ⚠️ o exame leva o TIPO: e por ele que rev2Estado acha o modelo do medico e sabe o que
// ja era estrutura. Sem o tipo cai na heuristica de reserva, que e mais desconfiada.
bl = rev2Blocos({ corpo: preenchido('prostata') });
bl.forEach(b => ok(rev2Estado({ tipo: 'prostata', laudo: {} }, b) === 'normal',
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

// ===================================================================================
// 2ª RODADA — o que uma avaliacao independente pegou e as suites acima NAO pegavam.
// Licao de processo: as assercoes de regex sobre o texto do index.html provam que o
// COMENTARIO existe, nao que o comportamento esta certo; e testar so 3 modelos deixa
// 23 de fora. Daqui em diante, os dois lados varrem TODOS os modelos.
// ===================================================================================
console.log('=== TODOS os 26 modelos NORMAIS: nenhum verde falso ===');
Object.keys(MODELOS).filter(k => k !== 'outro').forEach(k => {
  const verdes = rev2Blocos({ corpo: preenchido(k) })
    .filter(b => rev2Estado({ tipo: k, laudo: {} }, b) === 'alterado')
    .map(b => b.titulo || '(sem titulo)');
  ok(verdes.length === 0, 'modelo normal "' + k + '" sem verde falso'
    + (verdes.length ? ' — acendeu: ' + verdes.join(', ') : ''));
});

console.log('=== os 12 achados REAIS tem de acender verde (regressao achada na 2a rodada) ===');
// 8 destes 12 ficaram CINZA na 1a versao: hiperplasia por volume, endometrio espessado,
// aneurisma de aorta, area hipoecogenica, infarto esplenico, massa ovariana, IR elevado e
// peso prostatico. Achado silenciado e o erro que chega ao paciente.
[['prostata', '**Próstata:** aumentada, com **Volume aumentado: 78 cm³**.'],
 ['prostata', '**Próstata:** **Peso: 82 g (acima do normal)**'],
 ['abdominal', '**Fígado** com **Área hipoecogênica** no lobo direito.'],
 ['transvaginal', '**Útero:** normal.\nEndométrio com **Espessura de 18 mm, acima do esperado**'],
 ['abdominal', '**Grandes vasos** com **Diâmetro de 5,2 cm — aneurisma** de aorta.'],
 ['rins', '**RIM DIREITO:** **Índice de resistividade de 0,95, elevado**'],
 ['abdominal', '**Baço** com **Área de infarto** esplênica.'],
 ['transvaginal', '**Ovário direito:** **Medida aumentada, com massa sólida de 6 cm**'],
 ['rins', '**RIM DIREITO:** com **3 cistos simples**.'],
 ['ombro', '**Tendão supraespinhal:** com **5 mm de rotura transfixante**.'],
 ['mama', '**MAMA DIREITA** com **Nódulo** sólido.'],
 ['rins', '**RIM DIREITO:** com **Cálculo de 1,5 cm**.']
].forEach(([tipo, corpo]) => {
  const acendeu = rev2Blocos({ corpo }).some(b => rev2Estado({ tipo, laudo: {} }, b) === 'alterado');
  ok(acendeu, 'ACENDE: ' + corpo.replace(/\n/g, ' ').slice(0, 62));
});

console.log('=== a regra do molde: o que ja vinha do modelo nao e achado ===');
ok(/function rev2MoldeDoModelo/.test(HTML), 'existe o molde tirado do modelo do medico');
ok(/_molde\.titulos\[as\] \|\| _molde\.medidas\[as\]/.test(HTML),
  'rev2Estado consulta o molde — titulos E medidas, que o modelo separa sozinho');
ok(/replace\(\/\[\\d\.,\]\+\/g,'#'\)/.test(HTML), 'a assinatura ignora os numeros ("..... cm" = "8 cm")');
// obst23: **..... bpm.** e **..... cm. Grau .....** nao existem como palavra de medida,
// e viravam verde falso no obstetrico normal ate o molde entrar
ok(rev2Blocos({ corpo: preenchido('obst23') })
     .every(b => rev2Estado({ tipo: 'obst23', laudo: {} }, b) !== 'alterado'),
   'obstetrico normal (bpm, Grau) sem verde falso');

console.log('=== aviso do item 6: nao pode gritar em exame normal ===');
// ⚠️ o 2o parametro e o MOLDE, nao o tipo (mudou na 3a rodada, junto com o congelamento)
const moldeDe = k => rev2MoldeDoTexto(MODELOS[k].corpo);
Object.keys(MODELOS).filter(k => k !== 'outro').forEach(k => {
  ok(alertasAchadoSemNegrito({ corpo: preenchido(k) }, moldeDe(k)).length === 0,
    'modelo normal "' + k + '" nao dispara o aviso de negrito');
});
ok(alertasAchadoSemNegrito({ corpo:
  '**Tendão supraespinhal:** com **tendinopatia**.\n\n**Tendão subescapular:** sem tendinopatia.' },
  moldeDe('ombro')).length === 0, 'NEGACAO ("sem tendinopatia") nao dispara — senao o aviso mandaria '
  + 'pintar de verde uma estrutura normal');
ok(alertasAchadoSemNegrito({ corpo:
  '**RIM DIREITO:** com **litíase renal**.\n\n**RIM ESQUERDO:** ausência de litíase renal.' },
  moldeDe('rins')).length === 0, '"ausencia de" tambem nao dispara');
ok(alertasAchadoSemNegrito({ corpo:
  '**Tendão supraespinhal:** com **tendinopatia**.\n\n**Tendão subescapular:** espessado, com tendinopatia, sem rotura.' },
  moldeDe('ombro')).length === 1, 'mas o caso REAL do medico continua acendendo');

// ===================================================================================
// 3ª RODADA — as tres REGRESSOES que a 2a leva criou, achadas por avaliacao independente.
// A licao: eu classificava o negrito pela APARENCIA, e nao fecha. O modelo do medico ja
// separa titulo de medida sozinho — no modelo, medida SEMPRE tem pontilhado e titulo
// NUNCA tem. Daí saem os dois conjuntos, e o molde e CONGELADO no laudo ao nascer.
// ===================================================================================
console.log('=== R1 — achado que ABRE a linha nao pode virar titulo (0 de 8 acendiam) ===');
[['abdominal', '**Baço** normal.\n**Área de infarto**'],
 ['mama', '**MAMA DIREITA**\n**Nódulo sólido BI-RADS 4**'],
 ['rins', '**RIM DIREITO:** normal.\n**Trombose venosa profunda**'],
 ['ombro', '**Tendão supraespinhal:** ok.\n**Rotura completa do tendão**']
].forEach(([t, c]) => {
  const e = comMolde(t, c), bl = rev2Blocos(e.laudo, e.laudo._molde);
  ok(bl.some(b => rev2Estado(e, b) === 'alterado'), 'ACENDE: ' + c.split('\n')[1]);
  ok(bl.length === 1, 'e NAO fatia o orgao num retangulo proprio: ' + c.split('\n')[1]);
});
{
  const e = comMolde('obst23', MODELOS.obst23.corpo.replace(/\.{5}/g, '8'));
  const bl = rev2Blocos(e.laudo, e.laudo._molde);
  ok(bl.length <= 2, 'obst23 preenchido continua com poucos retangulos (virou 6 na 2a rodada) — deu ' + bl.length);
  ok(bl.every(b => rev2Estado(e, b) !== 'alterado'), 'e sem verde falso');
}

console.log('=== R3 — laudo pronto nao pode mudar de cor depois ===');
{
  // laudo de PROSTATA normal, com o molde congelado, avaliado como se o tipo tivesse sido
  // trocado para "rins" no cartao: 25 combinacoes davam verde falso antes do congelamento
  const cong = { tipo: 'rins', laudo: { corpo: preenchido('prostata'),
                                        _molde: rev2MoldeDoTexto(MODELOS.prostata.corpo) } };
  ok(rev2Blocos(cong.laudo, cong.laudo._molde).every(b => rev2Estado(cong, b) !== 'alterado'),
    'trocar o TIPO do exame nao repinta o laudo — o molde vai congelado nele');
  ok(/_molde:rev2MoldeDoTexto\(mod\.corpo\)/.test(HTML), 'o molde e congelado na geracao');
  ok(/if\(L\._molde && L\._molde\.titulos\) return L\._molde;/.test(HTML),
    'e tem prioridade sobre o modelo de agora');
}

console.log('=== o modelo separa titulo de medida sozinho (pontilhado) ===');
{
  const m = rev2MoldeDoTexto(MODELOS.prostata.corpo);
  ok(!!m.titulos[rev2Assinatura('Próstata')], '"Próstata" (sem pontilhado) e TITULO');
  ok(!!m.medidas[rev2Assinatura('Peso: ..... g (Normal até 30 g)')], '"Peso: ....." e MEDIDA');
  const o = rev2MoldeDoTexto(MODELOS.obst23.corpo);
  ok(!!o.medidas[rev2Assinatura('..... bpm.')], '"..... bpm." e MEDIDA');
  ok(!!o.titulos[rev2Assinatura('BIOMETRIA FETAL')], '"BIOMETRIA FETAL" e TITULO');
}

console.log('=== VARREDURA: 26 modelos x 2 versoes, os dois lados ===');
{
  let vf = 0, af = 0;
  Object.keys(MODELOS).filter(k => k !== 'outro').forEach(k => {
    const molde = rev2MoldeDoTexto(MODELOS[k].corpo);
    [MODELOS[k].corpo, MODELOS[k].corpo.replace(/\.{5}/g, '8')].forEach(c => {
      const e = { tipo: k, laudo: { corpo: c, _molde: molde } };
      if (rev2Blocos(e.laudo, molde).some(b => rev2Estado(e, b) === 'alterado')) vf++;
      if (alertasAchadoSemNegrito(e.laudo, molde).length) af++;
    });
  });
  ok(vf === 0, 'nenhum verde falso em 52 varreduras — deu ' + vf);
  ok(af === 0, 'nenhum aviso falso em 52 varreduras — deu ' + af);
}

console.log('=== residuais que a 2a avaliacao apontou ===');
{
  const e = comMolde('transvaginal', '**Útero:** normal.\nEndométrio com **Espessura de 18 mm, acima do esperado**');
  ok(rev2Blocos(e.laudo, e.laudo._molde).some(b => rev2Estado(e, b) === 'alterado'),
    'espessamento endometrial ("Espessura de 18 mm") ACENDE — ficava mudo');
}
[['não há sinais de tendinopatia'], ['ausência de sinais de tendinopatia'],
 ['sem evidências de tendinopatia'], ['não se observam sinais de tendinopatia'],
 ['sem qualquer sinal de tendinopatia'], ['tendinopatia ausente']
].forEach(([f]) => {
  ok(alertasAchadoSemNegrito({ corpo: '**Tendão A:** com **tendinopatia**.\n\n**Tendão B:** ' + f + '.' },
     rev2MoldeDoTexto(MODELOS.ombro.corpo)).length === 0, 'negacao calada: ' + f);
});

console.log('=== VOZ/IMG nao pode pegar o LADO ERRADO ===');
[[['Ovário', 'Ovário direito'], 'Ovário esquerdo', null],
 [['Mama esquerda', 'Mama'], 'MAMA DIREITA', null],
 [['Tendão supra-espinhal'], 'Tendão supraespinhal', 'Tendão supra-espinhal'],
 [['Supraespinhal'], 'Tendão supraespinhal', 'Supraespinhal']
].forEach(([secoes, tit, esperado]) => {
  const r = rev2Proc({ laudo: { procedencia: secoes.map(s => ({ secao: s, citacao: 'x' })) } }, tit);
  ok((r ? r.secao : null) === esperado,
    JSON.stringify(secoes) + ' x "' + tit + '" -> ' + (esperado === null ? 'nenhuma' : esperado));
});

console.log('=== foto: nem perder nem duplicar ===');
ok(/ex\._instIds=instOk/.test(HTML), 'a recuperacao guarda de qual instancia veio cada foto');
ok(/instOk\.push\(est\.instancias\[q\]\)/.test(HTML), 'e so guarda as que REALMENTE baixaram');
ok(/if\(Array\.isArray\(ex\._instIds\) && i<ex\._instIds\.length\) ex\._instIds\.splice\(i,1\)/.test(HTML),
  'apagar uma foto tambem tira o id do mapa (senao desalinha)');
ok(/var manuais=\(ex\.imagens\|\|\[\]\)\.slice\(\(ex\._instIds\|\|\[\]\)\.length\)/.test(HTML),
  'completar com o aparelho PRESERVA as fotos anexadas a mao (sumiam caladas)');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
