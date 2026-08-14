// Classificacao automatica por descritor — TI-RADS, BI-RADS e O-RADS (12/08/2026).
//
// A divisao de trabalho que estes testes protegem:
//   a IA ANOTA o que o medico ditou · o APLICATIVO calcula a categoria.
// Aritmetica da sempre o mesmo resultado para a mesma entrada; modelo de linguagem nao.
// Num laudo que leva assinatura, isso e a diferenca entre conferivel e nao conferivel.
//
// E protegem tres promessas feitas ao medico:
//   1. faltou um descritor -> NAO sai categoria, e sai a LISTA DE OPCOES para clicar;
//   2. o que voce ditou x o que a conta deu -> conflito aparece (pega erro dos dois lados);
//   3. valor que a IA mandou e nao foi reconhecido conta como NAO DITADO, nunca como palpite.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + name);
}
function bloco(re, oque) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei o bloco ' + oque);
  return m[0];
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const src = [
  bloco(/const CLASSIF = \{[\s\S]*?\n\};/, 'CLASSIF'),
  bloco(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/, 'BIRADS_ESPECIAIS'),
  grab('norm'), grab('classifVale'), grab('classifOpcoes'), grab('classifRotulo'),
  grab('classifCasar'), grab('classifLerDescritores'), grab('classifExigir'),
  grab('biradsAvaliar'), grab('oradsAvaliar'),
  grab('classifCategoriaDitada'), grab('classifConferir'),
  grab('tiradsCategoria'), grab('tiradsConduta'), grab('tiradsPontuarDescritores'),
  grab('processarTirads'), grab('processarBirads'), grab('processarOrads'), grab('classifAplicar')
].join('\n');
const A = new Function(src + '\nreturn {CLASSIF, classifVale, classifCasar, classifLerDescritores,'
  + ' biradsAvaliar, oradsAvaliar, classifCategoriaDitada, classifConferir,'
  + ' processarTirads, processarBirads, processarOrads, classifAplicar, tiradsPontuarDescritores};')();
const { CLASSIF, classifVale, classifLerDescritores, oradsAvaliar,
        classifCategoriaDitada, classifConferir,
        processarTirads, processarBirads, processarOrads, classifAplicar,
        tiradsPontuarDescritores } = A;

const MASSA_OK = { forma: 'oval', orientacao: 'paralela', margem: 'circ', eco: 'hipoecoico', posterior: 'nenhum', halo: 'nao' };

console.log('=== a IA esta PROIBIDA de calcular (esta escrito no pedido) ===');
ok(/N[ÃA]O calcule nem escreva a categoria TI-RADS/.test(HTML), 'TI-RADS: proibida');
ok(/N[ÃA]O calcule nem escreva a categoria BI-RADS/.test(HTML), 'BI-RADS: proibida');
ok(/N[ÃA]O calcule nem escreva a categoria O-RADS/.test(HTML), 'O-RADS: proibida');
ok(/NUNCA infira um descritor que n[ãa]o foi mencionado/.test(HTML), 'e proibida de completar o que nao foi dito');
ok(/N[ÃA]O use \\"c[íi]stico complexo e s[óo]lido\\" nem \\"padr[ãa]o combinado\\"/.test(HTML),
   'o pedido avisa a IA dos dois termos que sairam na v2025');

console.log('=== cada sistema so vale no exame dele ===');
ok(classifVale('birads', 'mama') && !classifVale('birads', 'tireoide'), 'BI-RADS: so mama');
ok(classifVale('orads', 'transvaginal') && classifVale('orads', 'pelvica'), 'O-RADS: transvaginal e pelvica');
ok(!classifVale('orads', 'mama') && !classifVale('tirads', 'mama'), 'e nao vazam para outro exame');
ok(classifVale('tirads', 'tireoide'), 'TI-RADS: tireoide');

console.log('=== BI-RADS automatico: descritores completos ===');
let r = processarBirads([MASSA_OK], '');
ok(r.linhas.length === 1 && /BI-RADS 3/.test(r.linhas[0]), 'tudo benigno -> a conclusao recebe BI-RADS 3');
ok(r.pendencias.length === 0, 'nada pendente');
ok(/Confira antes de liberar/.test(r.obs[0]), 'e o aviso pede conferencia — o app nao manda, sugere');
r = processarBirads([{ ...MASSA_OK, margem: 'espiculada' }], '');
ok(/BI-RADS 4C/.test(r.linhas[0]), 'margem espiculada -> 4C');

console.log('=== BI-RADS: faltou um descritor -> NAO calcula, e OFERECE as opcoes ===');
const semMargem = { forma: 'oval', orientacao: 'paralela', eco: 'hipoecoico', posterior: 'nenhum' };
r = processarBirads([semMargem], '');
ok(r.linhas.length === 0, 'sem margem, NENHUMA categoria vai para a conclusao');
ok(r.pendencias.length === 1, 'e sai exatamente uma pendencia (' + r.pendencias.length + ')');
const p = r.pendencias[0];
ok(p.chave === 'margem' && p.rotulo === 'Margem', 'a pendencia diz QUAL descritor faltou: ' + p.rotulo);
ok(p.sistema === 'birads', 'e de qual sistema');
ok(Array.isArray(p.opcoes) && p.opcoes.length === 5, 'traz as 5 opcoes de margem para clicar');
ok(p.opcoes.every(o => o.v && o.rot), 'cada opcao tem codigo e texto legivel');
ok(p.opcoes.map(o => o.rot).join(', ').includes('Microlobulada'), 'com os nomes por extenso: '
   + p.opcoes.map(o => o.rot).join(', '));
ok(/faltou ditar: margem/.test(r.obs[0]), 'o aviso em texto tambem diz o que faltou');

r = processarBirads([{ forma: '', orientacao: '', margem: '', eco: '', posterior: '' }], '');
ok(r.pendencias.length === 5, 'nada ditado -> uma pendencia por descritor (' + r.pendencias.length + ')');
ok(new Set(r.pendencias.map(x => x.chave)).size === 5, 'sem repetir descritor');

console.log('=== valor nao reconhecido conta como NAO DITADO (nunca vira palpite) ===');
r = processarBirads([{ ...MASSA_OK, margem: 'meio esquisita' }], '');
ok(r.linhas.length === 0, 'margem que ninguem reconhece nao vira categoria');
ok(r.pendencias[0].ditado === 'meio esquisita', 'e a pendencia guarda o que a IA tinha escrito');
ok(/n[ãa]o reconhecida/.test(r.obs[0]), 'o aviso diz que nao reconheceu, em vez de escolher a mais parecida');
r = processarBirads([{ ...MASSA_OK, margem: 'circunscrita' }], '');
ok(/BI-RADS 3/.test(r.linhas[0]), 'mas sinonimo legitimo ("circunscrita") e aceito');
r = processarBirads([{ ...MASSA_OK, orientacao: 'não paralela' }], '');
ok(/BI-RADS 4A/.test(r.linhas[0]), 'sinonimo com acento tambem ("nao paralela" -> suspeito)');

console.log('=== BI-RADS: caso especial dispensa os descritores ===');
r = processarBirads([{ caso_especial: 'cistoSimples' }], '');
ok(/BI-RADS 2/.test(r.linhas[0]) && r.pendencias.length === 0,
   'cisto simples sai como 2 sem exigir forma/margem/orientacao');

console.log('=== O-RADS automatico ===');
r = processarOrads([{ tipo: 'fisio' }], '');
ok(/O-RADS US 1/.test(r.linhas[0]), 'foliculo ou corpo luteo <= 3 cm -> categoria 1');
r = processarOrads([{ tipo: 'solidoIrreg' }], '');
ok(/O-RADS US 5/.test(r.linhas[0]), 'solida de contorno irregular -> categoria 5');
r = processarOrads([{ tipo: 'solido', papilas: 5 }], '');
ok(/O-RADS US 5/.test(r.linhas[0]), '4 ou mais projecoes papilares -> 5');
r = processarOrads([{ tipo: 'solido', papilas: 2 }], '');
ok(/O-RADS US 4/.test(r.linhas[0]), '1 a 3 projecoes -> 4');

console.log('=== O-RADS: o caminho automatico NAO assume o menor risco ===');
r = processarOrads([{ tipo: 'uniSimples' }], '');       // falta o tamanho
ok(r.linhas.length === 0, 'sem o diametro, nao sai categoria nenhuma');
ok(r.pendencias.length === 1 && r.pendencias[0].chave === 'tamanho_cm',
   'sai o pedido do diametro: ' + (r.pendencias[0] || {}).rotulo);
r = processarOrads([{ tipo: 'uniSimples', tamanho_cm: 4 }], '');
ok(/O-RADS US 2/.test(r.linhas[0]), 'com o diametro (< 10 cm) -> categoria 2');
r = processarOrads([{ tipo: 'uniSimples', tamanho_cm: 12 }], '');
ok(/O-RADS US 3/.test(r.linhas[0]), '>= 10 cm -> categoria 3');
r = processarOrads([{ tipo: 'multiLisa', tamanho_cm: 4 }], '');
ok(r.pendencias.some(x => x.chave === 'escore_cor'), 'multilocular lisa tambem pede o escore de cor');
ok(r.pendencias.find(x => x.chave === 'escore_cor').opcoes.length === 4, 'com as 4 opcoes de CS para clicar');
// a CALCULADORA continua assumindo, de proposito: la o medico esta olhando a tela
const falta = [];
const so = oradsAvaliar({ tipo: { v: 'uniSimples' } }, falta);
ok(so && so.cat === '2', 'a conta pura ainda devolve categoria (a calculadora usa isso)...');
ok(falta.length === 1, '...mas avisa o que faltou — quem decide se aceita e quem chama');

console.log('=== ascite muda a categoria ===');
r = processarOrads([{ tipo: 'uniIrreg', ascite: 'sim' }], '');
ok(/O-RADS US 5/.test(r.linhas[0]), 'ascite com lesao categoria >= 3 leva a 5');
r = processarOrads([{ tipo: 'fisio', ascite: 'true' }], '');
ok(/investigar outras causas/.test(r.obs[0]), 'ascite com lesao de baixa categoria vira nota, nao upgrade');

console.log('=== TI-RADS: as pendencias agora tambem oferecem opcoes ===');
r = processarTirads([{ composicao: 'solida', ecogenicidade: 'hipoecogenica', forma: 'mais alta que larga' }], '');
ok(r.linhas.length === 0, 'faltando a margem, o TI-RADS continua se recusando a calcular');
ok(r.pendencias.length === 1 && r.pendencias[0].chave === 'margem', 'e agora diz a CHAVE do que faltou');
ok(r.pendencias[0].opcoes.length === 4, 'com as 4 opcoes de margem do ACR TI-RADS');
const pts = tiradsPontuarDescritores({ composicao: 'solida', ecogenicidade: 'hipoecogenica' });
ok(Array.isArray(pts.faltaK) && pts.faltaK.includes('forma') && pts.faltaK.includes('margem'),
   'a pontuacao devolve as chaves do que falta, alem do texto');
ok(pts.falta.length === pts.faltaK.length, 'uma chave para cada texto — nenhum aviso fica sem opcao');

console.log('=== A CONFERENCIA: o que voce ditou x o que a conta deu ===');
ok(classifCategoriaDitada('nodulo suspeito, BI-RADS 4A', 'birads') === '4A', 'le "BI-RADS 4A"');
ok(classifCategoriaDitada('classifico como bi rads 3 mesmo', 'birads') === '3', 'le "bi rads 3" (como sai do ditado)');
ok(classifCategoriaDitada('BI-RADS: 0a', 'birads') === '0A', 'le "BI-RADS: 0a"');
ok(classifCategoriaDitada('TI-RADS 4', 'tirads') === '4', 'le TI-RADS');
ok(classifCategoriaDitada('TIRADS TR3', 'tirads') === '3', 'le "TIRADS TR3"');
ok(classifCategoriaDitada('O-RADS 5', 'orads') === '5', 'le O-RADS');
ok(classifCategoriaDitada('exame sem classificacao', 'birads') === null, 'nao inventa quando nao foi ditada');
ok(classifCategoriaDitada('TI-RADS 4', 'birads') === null, 'nao confunde TI-RADS com BI-RADS');

ok(classifConferir('birads', '4A', 'digo BI-RADS 4A').conflito === false, 'concordam -> sem conflito');
const cf = classifConferir('birads', '4A', 'digo que e BI-RADS 3');
ok(cf.conflito === true && cf.ditado === '3' && cf.calculado === '4A',
   'discordam -> conflito, com os dois valores lado a lado');
ok(classifConferir('birads', '3', 'nao falei categoria').conflito === false,
   'nao ditou categoria -> nao ha o que conferir');

r = processarBirads([{ ...MASSA_OK, margem: 'espiculada' }], 'para mim isso e BI-RADS 3');
ok(r.conflitos.length === 1, 'o conflito sai da geracao do laudo');
ok(r.conflitos[0].ditado === '3' && r.conflitos[0].calculado === '4C',
   'ditado 3 x calculado 4C — pega erro do medico E erro da conta');

console.log('=== o pacote que chega na tela ===');
const saida = classifAplicar({ tipo: 'mama' },
  { birads: [{ ...MASSA_OK, margem: 'espiculada' }], orads: [{ tipo: 'fisio' }], tirads: [{}] },
  'eu disse BI-RADS 3');
ok(saida.linhas.length === 1 && /BI-RADS/.test(saida.linhas[0]),
   'num exame de mama so o BI-RADS roda — orads e tirads sao ignorados');
ok(saida.conflitos.length === 1, 'o conflito vem estruturado, para a tela desenhar as duas fichas');
ok(saida.alertas.some(a => a.tipo === 'calculo' && /CONFLITO/.test(a.texto)),
   'e tambem em texto, para a tela de hoje');
const saidaTV = classifAplicar({ tipo: 'transvaginal' },
  { birads: [MASSA_OK], orads: [{ tipo: 'solidoIrreg' }] }, '');
ok(saidaTV.linhas.length === 1 && /O-RADS/.test(saidaTV.linhas[0]), 'na transvaginal, so o O-RADS');
const saidaAbd = classifAplicar({ tipo: 'abdominal' }, { birads: [MASSA_OK], orads: [{ tipo: 'fisio' }] }, '');
ok(saidaAbd.linhas.length === 0 && saidaAbd.alertas.length === 0, 'no abdome, nenhum dos tres');

const comFalta = classifAplicar({ tipo: 'mama' }, { birads: [semMargem] }, '');
ok(comFalta.alertas.some(a => a.tipo === 'faltando'), 'descritor faltando acende a caixa "Dados faltando"');
ok(comFalta.pendencias.length === 1 && comFalta.pendencias[0].opcoes.length === 5,
   'e as opcoes chegam na tela junto com o aviso');
ok(/Toque para escolher ou ditar/.test(comFalta.alertas.find(a => a.tipo === 'faltando').texto),
   'o aviso convida ao clique ou ao ditado');

console.log('=== O-RADS: a tabela e a tela nao podem divergir ===');
const blocoOr = bloco(/id="blocoOrads"[\s\S]*?<div class="calcRes"/, 'bloco do ovario');
const opsTipo = [...bloco(/<select id="orTipo"[\s\S]*?<\/select>/, 'select orTipo')
  .matchAll(/<option value="(\w+)"/g)].map(m => m[1]);
ok(CLASSIF.orads.desc.find(d => d.k === 'tipo').ops.map(o => o.v).join(',') === opsTipo.join(','),
   'tipo de lesao: tabela === tela (' + opsTipo.length + ' opcoes)');
ok(/id="orCS"/.test(blocoOr) && /id="orTam"/.test(blocoOr) && /id="orPap"/.test(blocoOr),
   'os campos que a tabela cita existem na tela');

console.log('=== nada quebra com entrada torta ===');
ok(processarBirads(null, '').linhas.length === 0, 'lista nula');
ok(processarBirads([], '').pendencias.length === 0, 'lista vazia');
ok(processarOrads([{}], '').linhas.length === 0, 'lesao sem tipo nenhum nao gera categoria');
ok(processarOrads([{ tipo: 'inexistente' }], '').pendencias.length === 1, 'tipo desconhecido vira pendencia');
ok(classifAplicar({ tipo: 'mama' }, {}, '').linhas.length === 0, 'resposta da IA sem os campos');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
