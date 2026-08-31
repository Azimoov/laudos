// OS ERROS QUE A AUDITORIA INDEPENDENTE ACHOU EM 24/08/2026, e que NENHUMA suite pegava.
//
// Dois ciclos de auditoria sobre as cinco correcoes pedidas pelo medico. A bateria inteira
// dava "tudo verde" enquanto o app indicava BIOPSIA por engano — porque os testes rodavam
// com dados montados a mao, e os erros so aparecem com frase de laudo DE VERDADE. Por isso
// esta suite usa o texto real do laudo, com a mama e a lesao na mesma frase.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
function bloco(re, oque) { const m = HTML.match(re); if (!m) throw new Error('nao achei ' + oque); return m[0]; }

const src = [
  bloco(/const CLASSIF = \{[\s\S]*?\n\};/, 'CLASSIF'),
  bloco(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/, 'BIRADS_ESPECIAIS'),
  bloco(/const BIRADS_CAT = \{[\s\S]*?\n\};/, 'BIRADS_CAT'),
  bloco(/const BIRADS_GRAVIDADE = \{[^}]*\};/, 'BIRADS_GRAVIDADE'),
  bloco(/const BIRADS_PADRAO = \{[^}]*\};/, 'BIRADS_PADRAO'),
  grab('norm'), grab('_negadoAntesDe'), grab('classifCasarNoTexto'), grab('classifCasar'),
  grab('classifLerDescritores'), grab('classifExigir'), grab('classifCategoriaDitada'),
  grab('classifConferir'), grab('biradsCategoria'), grab('biradsLinhaCategoria'),
  grab('biradsDoExame'), grab('biradsAvaliar'), grab('_mamaFraseDo'),
  grab('mamaCmInteiro'), grab('mamaMm'), grab('mamaLocalDoTexto'),
// 25/08: cisto simples passou a ser lido da propria frase do laudo
  grab('mamaCasoEspecialDoTexto'),
  grab('mamaReescreverLocal'), grab('processarBirads')
].join('\n');
const api = new Function(src + '\nreturn {processarBirads, classifCasarNoTexto, classifCasar, '
  + 'mamaReescreverLocal, _mamaFraseDo, CLASSIF};')();
const D = k => api.CLASSIF.birads.desc.find(d => d.k === k);

console.log('=== ERRO 1 (1o ciclo): "nao paralela" nao pode virar "paralela" ===');
// Medido de ponta a ponta: com o defeito, BI-RADS 4A (biopsia) caia para 3 (seguimento 6
// meses). O rotulo benigno inteiro e "Paralela a pele" (15 caracteres normalizados) e
// vencia "nao paralela" (12) na conta de maior casamento.
['orientação NÃO paralela à pele', 'orientação não-paralela à pele',
 'orientacao nao paralela a pele', 'não paralela'].forEach(function (f) {
  const r = api.classifCasarNoTexto(D('orientacao'), f);
  ok(r && r.v === 'nao', JSON.stringify(f) + ' -> ' + (r && r.v));
});
ok(api.classifCasarNoTexto(D('orientacao'), 'orientação paralela à pele').v === 'paralela',
   'e a paralela de verdade continua sendo lida (controle)');
ok(api.classifCasar(D('orientacao'), 'não paralela à pele').v === 'nao',
   'o caminho estruturado (classifCasar) tambem — a IA pode mandar a frase inteira no campo');

console.log('\n=== ERRO 2 (1o ciclo): "irregular" nao pode inventar "circunscrita" ===');
// 'regular' e sinonimo de circunscrita e e substring de "irregular".
ok(api.classifCasarNoTexto(D('margem'), 'de forma irregular') === null,
   '"de forma irregular" nao produz margem nenhuma');
ok(api.classifCasarNoTexto(D('margem'), 'margens irregulares') === null, '"margens irregulares" idem');
ok(api.classifCasar(D('margem'), 'margens irregulares') === null, 'e pelo caminho estruturado tambem');
ok(api.classifCasarNoTexto(D('margem'), 'margens circunscritas').v === 'circ',
   'mas o plural legitimo casa: "margens circunscritas"');
ok(api.classifCasarNoTexto(D('margem'), 'margens indistintas').v === 'indistinta', 'e "indistintas"');

console.log('\n=== feminino: o laudo escreve "hipoecogenica", nao "hipoecogenico" ===');
// Sem isto o dizer padrao corrigido (que passou a dizer "hipoecogenica") nao seria
// reconhecido, e o pre-preenchimento do padrao ecogenico nao teria efeito nenhum.
ok(api.classifCasarNoTexto(D('eco'), 'imagem nodular sólida hipoecogênica').v === 'hipoecoico',
   '"hipoecogênica" e lida');
ok(api.classifCasarNoTexto(D('eco'), 'nódulo hipoecogênico').v === 'hipoecoico', 'e "hipoecogênico"');

console.log('\n=== ERRO 6 (2o ciclo, o mais grave): descritor da MAMA virando descritor da LESAO ===');
// O laudo real descreve a mama e a lesao na MESMA frase. O "heterogeneo" da composicao
// mamaria era lido como padrao ecogenico do nodulo — e heterogeneo e descritor SUSPEITO.
// Um nodulo oval, paralelo e circunscrito saia como BI-RADS 4A com "biopsia" na conclusao.
const corpoReal = '**MAMA ESQUERDA**\n**DESCRIÇÃO:**\n\nMama simétrica.\n'
  + 'Parênquima mamário com ecogênicidade habituais de padrão heterogêneo, apresentando '
  + 'imagem nodular sólida, de forma oval, orientação paralela à pele e margens circunscritas, '
  + 'localizada às 3 h, distando 5 cm da papila mamária, medindo 4,0 x 4,4 x 4,8 mm.\n'
  + 'Região axilar livre.';
const rReal = api.processarBirads(
  [{ localizacao: 'mama esquerda, 3 horas', tipo: 'massa', tamanho_cm: 0.48 }], '', corpoReal);
const ecoLido = (rReal.lidos || []).filter(x => x.chave === 'eco')[0];
ok(!ecoLido, 'o padrao ecogenico NAO e lido — ele descreve a mama, nao a lesao');
ok(rReal.pendencias.some(p => p.chave === 'eco'),
   'ele continua sendo PEDIDO como pendencia, que e o certo');
ok(!/biópsia|biopsia/i.test(rReal.linhas.join(' ')),
   'e nenhuma biopsia e recomendada a partir de palavra que nao e do achado');
ok((rReal.lidos || []).some(x => x.chave === 'forma' && x.valor === 'oval')
   && (rReal.lidos || []).some(x => x.chave === 'orientacao' && x.valor === 'paralela')
   && (rReal.lidos || []).some(x => x.chave === 'margem' && x.valor === 'circ'),
   'mas os descritores QUE SAO da lesao continuam sendo lidos (forma, orientacao, margem)');

console.log('\n=== ERRO 6, 3a volta: o corte e no SUBSTANTIVO do achado, nao no verbo ===');
// O 3o ciclo mostrou que cortar no verbo deixava duas frestas: conector fora da lista
// ("com", "contendo") trazia o vazamento de volta, e descritor legitimo escrito ANTES de um
// "apresentando" de meio de frase era descartado. O substantivo resolve os dois.
function _rodaCorpo(corpo) {
  return api.processarBirads([{ localizacao: 'mama esquerda, 3 horas', tipo: 'massa' }], '', corpo);
}
[['com', 'Parênquima heterogêneo com nódulo de forma oval, orientação paralela à pele e margens circunscritas, às 3 h.'],
 ['contendo', 'Parênquima com margens mal definidas contendo nódulo de forma oval, orientação paralela à pele e margens circunscritas, às 3 h.'],
 ['onde se ve', 'Parênquima heterogêneo, onde se vê nódulo de forma oval, orientação paralela à pele e margens circunscritas, às 3 h.']
].forEach(function (c) {
  const r = _rodaCorpo('**MAMA ESQUERDA**\n' + c[1]);
  const eco = (r.lidos || []).filter(x => x.chave === 'eco')[0];
  const margem = (r.lidos || []).filter(x => x.chave === 'margem')[0];
  ok(!eco, 'conector "' + c[0] + '": o padrao ecogenico da MAMA nao vaza para a lesao');
  ok(!/bi[óo]psia/i.test(r.linhas.join(' ')), '   e nenhuma biopsia e recomendada');
  ok(margem && margem.valor === 'circ', '   mas a margem DA LESAO continua sendo lida');
});
// e o oposto: descritor da lesao antes de um "apresentando" no meio da frase
const rAntes = _rodaCorpo('**MAMA ESQUERDA**\nNódulo sólido hipoecogênico, de forma irregular, '
  + 'orientação não paralela à pele e margens espiculadas, apresentando reforço acústico posterior, às 3 h.');
ok(rAntes.pendencias.length === 0,
   'descritor escrito ANTES de "apresentando" nao e mais descartado (0 pendencias)');
ok(/BI-RADS 5/.test(rAntes.linhas.join(' ')),
   'e o achado francamente suspeito sai como BI-RADS 5, em vez de virar pendencia a toa');

console.log('\n=== ERRO 4.1 (2o ciclo): o arraste nao pode escrever uma SEGUNDA distancia ===');
// A frase recortada podia vir truncada (o "....." em branco do dizer, ou um decimal com
// ponto), o codigo entendia "nao ha distancia" e escrevia outra — duas localizacoes
// radiais contradizendo uma a outra no mesmo paragrafo.
const conta = s => (String(s).match(/\d+\s*cm\s*d[aeo]s?\s*(?:papila|mamilo)/gi) || []).length;
const comBranco = '**MAMA DIREITA**\nNotou-se formação cística, localizada na mama direita, '
  + 'às 9 h, distando ..... cm da papila até o centro do achado, medindo 6,1 x 3,6 x 6,7 mm.';
const r41 = api.mamaReescreverLocal(comBranco, 'mama direita, 9 horas', 2, 11, 3);
ok(conta(r41.frase) <= 1, 'com "....." em branco na frase, sai UMA distancia (' + conta(r41.frase) + ')');
const comDecimal = '**MAMA ESQUERDA**\nNódulo às 3 h, distando 5.5 cm da papila, medindo 5 x 5 mm.';
const r42 = api.mamaReescreverLocal(comDecimal, 'mama esquerda, 3 horas', 1, 4, 2);
ok(conta(r42.frase) === 1, 'com decimal de ponto, tambem UMA (' + conta(r42.frase) + ')');
ok(/distando 2 cm/.test(r42.frase), 'e e a NOVA distancia que vale');
// o caso legitimo: frase sem distancia nenhuma -> escreve
const semDist = '**MAMA DIREITA**\nNotou-se formação cística simples, anecoica, localizada na '
  + 'mama direita, às 9 h, medindo 6 x 4 x 7 mm.';
const r43 = api.mamaReescreverLocal(semDist, 'mama direita, 9 horas', 1, 10, 3);
ok(r43.ok && conta(r43.frase) === 1,
   'cisto SEM distancia (o dizer novo): a distancia escolhida e escrita, uma vez');
ok(grab('mamaReescreverLocal').indexOf('!/papila|mamilo/i.test(depois)') >= 0,
   'a guarda esta no codigo: so escreve distancia nova quando nao ha mencao a papila/mamilo');

console.log('\n=== ERRO 4.2: a legenda nao mostra casas decimais durante o arraste ===');
const esq = grab('mamaEsquemaHTML');
ok(/var _hTxt=\(L2\.hora==null\)\?'':Math\.round\(L2\.hora\)/.test(esq),
   'a hora e arredondada NA EXIBICAO (o valor guardado segue fracionario ate soltar)');
ok(/var _dTxt=\(L2\.distCm==null\)\?'':Math\.round\(L2\.distCm\)/.test(esq), 'e a distancia tambem');

console.log('\n=== ERRO 5.1: nao sobra preposicao solta no rotulo ===');
ok(/replace\(\/\\s\+\(\?:de\|da\|do\|das\|dos\|na\|no\|nas\|nos\|em\|\[aàoe\]\)\$\/i,''\)/.test(esq)
   || esq.indexOf("(?:de|da|do|das|dos|na|no|nas|nos|em|[aàoe])$") >= 0,
   'a preposicao pendurada no fim e removida ("cisto na" -> "cisto")');
ok(esq.indexOf("_rot.replace(/[^a-zA-ZÀ-ÿ]/g,'').length<3") >= 0,
   'e resto com menos de 3 letras nao aparece — e lixo de recorte, nao informacao');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
