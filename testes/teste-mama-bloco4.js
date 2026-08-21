// BLOCO 4 — registro pós-biópsia (07) e validador de léxico (08). 21/08/2026.
//
// O registro de biópsia não é burocracia: sem ele, o gráfico de evolução segue oferecendo
// para pareamento um achado que já foi retirado ou tratado. Comparar um achado
// pós-biópsia como se ainda estivesse em vigilância é erro de ESTADO, não dado faltando.
//
// E o validador tem DUAS ações diferentes de propósito: definição embutida SINALIZA (apagar
// texto clínico sem certeza é arriscado); termo fora do léxico SUBSTITUI (trocar por
// sinônimo exato não muda o significado).
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function fatia(de, ate) {
  const i = HTML.indexOf(de), f = HTML.indexOf(ate, i);
  if (i < 0 || f < 0) throw new Error('não achei ' + de);
  return HTML.slice(i, f);
}
const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const BIO = fatia('/* ============ BLOCO 4 — registro pós-biópsia ============',
                  '/* ============ BLOCO 4 — validador de léxico ============');
const LEX = fatia('/* ============ BLOCO 4 — validador de léxico ============',
                  '/* ============ Categoria BI-RADS por extenso');
const ESQ = fatia('/* ============ ESQUEMA ANATÔMICO DA MAMA ============',
                  '/* ============ GRÁFICO DE EVOLUÇÃO DO ACHADO ============');
const EVO = fatia('/* ============ GRÁFICO DE EVOLUÇÃO DO ACHADO ============',
                  '/* ============ BLOCO 3 — apresentação dos achados de mama ============');
const B3 = fatia('/* ============ BLOCO 3 — apresentação dos achados de mama ============',
                 '/* ============ BLOCO 4 — registro pós-biópsia ============');

let CAT_POR_ROTULO = {};
const api = new Function('esc', 'norm', 'document', 'log', 'exames',
  'var BIRADS_ESPECIAIS={};'
  + 'function classifLerDescritores(){return {falta:[],achou:{}};}'
  + 'function biradsAvaliar(){return {cat:"3"};}'
  + 'function biradsLinhaCategoria(c,p){return (p||"")+"Categoria: BI-RADS "+c+".";}'
  + 'function revMarcarEditado(){}\n'
  + ESQ + '\n' + EVO + '\n' + B3.replace('function _mamaCatDoAchado(d){',
      'function _mamaCatDoAchado(d){ if(d&&d.__cat) return d.__cat;') + '\n' + BIO + '\n' + LEX +
  '\nreturn {lexSubstituir, lexDefinicoes, lexAlertas, LEX_EQUIV, LEX_TERMOS,'
  + ' biopsiaPendentes, biopsiaRegistrar, biopsiaFraseComparacao, BIOPSIA_ROTULO, mamaLesoes,'
  + ' mamaCandidatos};'
)(s => String(s == null ? '' : s), norm,
  { getElementById: () => null, addEventListener: () => {} }, () => {}, []);

console.log('=== §08 mecanismo 2 — termo fora do léxico é SUBSTITUÍDO ===');
const cru = 'INDICAÇÃO: investigação de nódulo palpável\n\n'
  + 'Notou-se imagem nodular bem delimitada, de formato ovalado, alinhada com a pele, '
  + 'de conteúdo anecóide, às 10 h.';
const r = api.lexSubstituir(cru);
ok(/de margens circunscritas/.test(r.texto), '"bem delimitada" -> "de margens circunscritas"');
ok(/forma oval/.test(r.texto), '"formato ovalado" -> "forma oval"');
ok(/de orientação paralela/.test(r.texto), '"alinhada com a pele" -> "de orientação paralela"');
ok(/anecoico/.test(r.texto), '"anecóide" -> "anecoico"');
ok(r.trocas.length >= 4, 'e todas as trocas são REGISTRADAS (' + r.trocas.length + ')');
ok(r.trocas.every(t => t.de && t.para), 'com o de-para de cada uma, para aparecer na revisão');

console.log('\n=== a indicação clínica NÃO é mexida ===');
// Ali o léxico técnico não se aplica: "nódulo palpável" na indicação é queixa, não descritor.
ok(/INDICAÇÃO: investigação de nódulo palpável/.test(r.texto),
   'a linha de indicação sai exatamente como entrou');
const soIndic = api.lexSubstituir('INDICAÇÃO: nódulo bem delimitado ao exame clínico');
ok(soIndic.trocas.length === 0, 'e nada é trocado quando o termo só aparece ali');

console.log('\n=== não troca o que já está certo ===');
const jaCerto = api.lexSubstituir('Notou-se formação anecoica de margens circunscritas.');
ok(jaCerto.trocas.length === 0, 'texto já no léxico não gera troca nenhuma');
ok(jaCerto.texto === 'Notou-se formação anecoica de margens circunscritas.', 'nem alteração');

console.log('\n=== e a CONCORDÂNCIA não é quebrada ao consertar a grafia ===');
// A primeira versão trocava "formação anecoica" por "formação anecoico": consertava a
// grafia e quebrava a frase. Corrigir ortografia estragando concordância é piorar com cara
// de melhorar, num documento assinado.
ok(/formação anecoica\b/.test(api.lexSubstituir('Notou-se formação anecóica.').texto),
   'feminino continua feminino: "anecóica" -> "anecoica"');
ok(/nódulo anecoico\b/.test(api.lexSubstituir('Notou-se nódulo anecóico.').texto),
   'e masculino continua masculino');
ok(/formação anecoica\b/.test(api.lexSubstituir('Notou-se formação anecogênica.').texto),
   '"anecogênica" -> "anecoica", com o gênero de pé');
// "anecoide" não carrega gênero na forma: ele vem do substantivo antes dela
ok(/formação anecoica\b/.test(api.lexSubstituir('Notou-se formação anecóide.').texto),
   '"formação anecóide" -> "anecoica" (gênero lido do substantivo)');
ok(/nódulo anecoico\b/.test(api.lexSubstituir('Notou-se nódulo anecóide.').texto),
   'e "nódulo anecóide" -> "anecoico"');
ok(/imagens anecoicas\b/.test(api.lexSubstituir('Notaram-se imagens anecóides.').texto),
   'plural também acompanha');

console.log('\n=== §08 mecanismo 1 — definição embutida SINALIZA, não apaga ===');
const comDef = 'Notou-se nódulo de margens circunscritas (ou seja, bem delimitadas e '
  + 'sem infiltração do tecido vizinho), às 10 h.';
const defs = api.lexDefinicoes(comDef);
ok(defs.length >= 1, 'a definição entre parênteses é detectada');
ok(defs[0].termo === 'margens circunscritas', 'com o termo apontado: ' + defs[0].termo);
const al = api.lexAlertas({ corpo: comDef, conclusao: '' });
ok(al.length >= 1 && al[0].tipo === 'lexico', 'e vira alerta da categoria própria');
ok(/decida se mantém, edita ou tira/.test(al[0].texto),
   'que devolve a decisão ao médico — o sistema não apaga texto clínico sozinho');
ok(api.lexAlertas({ corpo: 'Notou-se nódulo de margens circunscritas, às 10 h.' }).length === 0,
   'e o termo SEM explicação não acende alerta nenhum');
ok(api.lexDefinicoes('Notou-se nódulo de forma oval, isto é, mais largo que alto.').length >= 1,
   'o conectivo "isto é" também é pego');
ok(api.lexDefinicoes('Notou-se nódulo de forma oval (12 mm).').length === 0,
   'mas parêntese CURTO com medida não é definição — alerta que erra vira alerta ignorado');

console.log('\n=== a categoria de alerta é própria, e NÃO a vermelha ===');
// O vermelho está reservado para segurança de dado do paciente ("Dados faltando"). Diluí-lo
// em questão de redação faria o médico aprender a ignorar os dois.
const ALERTAS = HTML.slice(HTML.indexOf('const ALERTAS = ['), HTML.indexOf('\n];', HTML.indexOf('const ALERTAS = [')));
ok(/k:'lexico'/.test(ALERTAS), 'a categoria "lexico" existe no painel');
ok(/Definição de termo no laudo/.test(ALERTAS), 'com o nome que a especificação pede');
const corLex = /k:'lexico'[^}]*cor:'(#\w+)'/.exec(ALERTAS)[1];
const corFalta = /k:'faltando'[^}]*cor:'(#\w+)'/.exec(ALERTAS)[1];
ok(corLex !== corFalta, 'e cor diferente da de "Dados faltando" (' + corLex + ' vs ' + corFalta + ')');
ok(/lexAlertas\(L\)/.test(HTML), 'e o alerta é montado junto com os outros na revisão');

console.log('\n=== §07 — quem aparece na lista de biópsia pendente ===');
const laudoCom = (cat) => ({
  birads: [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela', __cat: cat }],
  corpo: 'Notou-se nódulo na mama direita, às 10 h, distando 3 cm da papila, medindo 12 mm.',
  dados_estruturados: {}
});
const exs = [{ id: 1, tipo: 'mama', paciente: 'Maria', laudo: laudoCom('4B') },
             { id: 2, tipo: 'mama', paciente: 'Ana', laudo: laudoCom('3') },
             { id: 3, tipo: 'mama', paciente: 'Rita', laudo: laudoCom('5') },
             { id: 4, tipo: 'tireoide', paciente: 'Joana', laudo: laudoCom('4A') }];
const pend = api.biopsiaPendentes(exs);
ok(pend.length === 2, 'só categorias 4 e 5 entram (' + pend.length + ')');
ok(pend.some(p => p.paciente === 'Maria') && pend.some(p => p.paciente === 'Rita'),
   'a de 4B e a de 5');
ok(!pend.some(p => p.paciente === 'Ana'), 'a de categoria 3 não — ela não pede tecido');
ok(!pend.some(p => p.paciente === 'Joana'), 'e exame que não é de mama fica fora deste bloco');
ok(pend[0].onde.indexOf('mama direita') === 0, 'cada item diz ONDE está o achado: ' + pend[0].onde);

console.log('\n=== registrar o resultado tira o achado da lista ===');
exs[0].laudo.biopsias = { L1: { status: 'biopsiado_benigno', data: '10/03/2026' } };
const pend2 = api.biopsiaPendentes(exs);
ok(pend2.length === 1 && pend2[0].paciente === 'Rita',
   'quem já tem resultado sai da lista de pendentes');
ok(Object.keys(api.BIOPSIA_ROTULO).length === 4,
   'e os quatro estados existem: ativo + os três resultados');

console.log('\n=== e o achado biopsiado sai do PAREAMENTO (o efeito que importa) ===');
const hoje = { lado: 'D', hora: 10, distCm: 3, tipo: 'nodulo' };
const antesBio = { lado: 'D', hora: 10, distCm: 3, tipo: 'nodulo', mm: [11], status: 'ativo' };
ok(api.mamaCandidatos(hoje, [antesBio]).length === 1, 'enquanto ativo, é candidato');
ok(api.mamaCandidatos(hoje, [Object.assign({}, antesBio, { status: 'biopsiado_maligno' })]).length === 0,
   'depois da biópsia, NÃO é — o que existe ali hoje é evento novo por definição');
ok(/_les\.forEach\(function\(v,k\)\{ var b=_bio/.test(HTML),
   'e o status viaja junto com os achados do exame anterior, senão a regra não teria o que checar');

console.log('\n=== §07.4 — o exame seguinte DECLARA a biópsia ===');
const fr = api.biopsiaFraseComparacao(1, '20/02/2025', 'biopsiado_benigno', '10/03/2025');
ok(/foi submetido a biópsia em 10\/03\/2025/.test(fr), 'a frase diz que houve biópsia e quando');
ok(/resultado benigno/.test(fr), 'e qual foi o resultado');
ok(/não sendo objeto de comparação neste exame/.test(fr),
   'e por que ele não aparece na comparação — sumir faria parecer que nunca existiu');
ok(api.biopsiaFraseComparacao(1, 'x', 'ativo') === '', 'achado ativo não gera essa frase');

console.log('\n=== nada disso é automático ===');
ok(/NÃO HÁ IMPORTAÇÃO AUTOMÁTICA/.test(BIO),
   'está escrito que o registro é manual — o sistema não descobre resultado de biópsia sozinho');
ok(/biopsiaRender\(\)/.test(HTML) && /id="biopsiaLista"/.test(HTML),
   'e existe a tela onde o médico lança o resultado');
ok(HTML.indexOf('id="biopsiaLista"') > HTML.indexOf('id="reiniciarEstado"'),
   'fora do fluxo de realizar exame: o resultado chega semanas depois');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
