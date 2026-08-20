// CATEGORIA BI-RADS POR EXTENSO: rótulo + probabilidade + conduta (20/08/2026).
//
// Especificação 06 do pacote de mama. Valores da Table 2 do manual ACR BI-RADS v2025.
//
// A tabela vive no CÓDIGO, não no texto dos dizeres, por três razões — e a terceira foi
// restrição explícita do médico: (1) é consulta, não julgamento; (2) faixa parafraseada é
// faixa errada; (3) texto de dizer viaja no pedido à IA em TODO exame e é cobrado por
// token, e aqui não custa nada.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + nome);
}
const tabela = HTML.match(/const BIRADS_CAT = \{[\s\S]*?\n\};/)[0];
const especiais = HTML.match(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/)[0];
const api = new Function(
  tabela + '\n' + especiais + '\n' + grab('biradsCategoria') + '\n' + grab('biradsLinhaCategoria') +
  '\nreturn {BIRADS_CAT, BIRADS_ESPECIAIS, biradsCategoria, biradsLinhaCategoria};')();

console.log('=== as faixas, conferidas contra a Table 2 do ACR ===');
[['1', 'essencialmente 0%'], ['2', 'essencialmente 0%'], ['3', '> 0% e ≤ 2%'],
 ['4A', '> 2% e ≤ 10%'], ['4B', '> 10% e ≤ 50%'], ['4C', '> 50% e < 95%'],
 ['5', '≥ 95%'], ['6', 'N/A'], ['0', 'N/A']].forEach(([cat, faixa]) => {
  ok(api.biradsCategoria(cat).prob === faixa, 'BI-RADS ' + cat + ' -> ' + faixa);
});

console.log('\n=== as faixas não se sobrepõem nem deixam buraco ===');
// A auditoria pegou exatamente isso noutro lugar (o IPP da próstata tinha um hiato entre
// 1,5 e 5 mm que não pertencia a grau nenhum). Aqui as bordas têm de encaixar.
ok(api.biradsCategoria('4A').prob.indexOf('> 2%') === 0
   && api.biradsCategoria('3').prob.indexOf('≤ 2%') > 0, '3 termina em 2% e 4A começa em 2%');
ok(api.biradsCategoria('4A').prob.indexOf('≤ 10%') > 0
   && api.biradsCategoria('4B').prob.indexOf('> 10%') === 0, '4A termina em 10% e 4B começa em 10%');
ok(api.biradsCategoria('4B').prob.indexOf('≤ 50%') > 0
   && api.biradsCategoria('4C').prob.indexOf('> 50%') === 0, '4B termina em 50% e 4C começa em 50%');
ok(api.biradsCategoria('4C').prob.indexOf('< 95%') > 0
   && api.biradsCategoria('5').prob.indexOf('≥ 95%') === 0, '4C termina em 95% e 5 começa em 95%');

console.log('\n=== a conduta sai junto, e é a da tabela da especificação 01 ===');
ok(/Rastreamento de rotina/.test(api.biradsCategoria('1').conduta), 'categoria 1: rastreamento de rotina');
ok(/Controle de rotina/.test(api.biradsCategoria('2').conduta), 'categoria 2: controle de rotina');
ok(/6 meses/.test(api.biradsCategoria('3').conduta), 'categoria 3: seguimento em 6 meses');
['4A', '4B', '4C', '5'].forEach(c =>
  ok(/biópsia/i.test(api.biradsCategoria(c).conduta), 'categoria ' + c + ': biópsia'));
ok(/cirurgião|oncologista/i.test(api.biradsCategoria('6').conduta), 'categoria 6: equipe assistente');

console.log('\n=== categoria 4 sem letra: assume 4A, mas NUNCA calado ===');
// Decisão do médico (20/08). A ressalva foi dita: 4A é a MENOR suspeição, então assumir
// erra sempre para baixo — a direção que atrasa biópsia. Ele manteve, e o preço de manter
// é que o assumido tem de aparecer.
const d4 = api.biradsCategoria('4');
ok(d4.cat === '4A', 'categoria 4 vira 4A');
ok(d4.assumido && /assumida 4A/.test(d4.assumido), 'e volta marcada como ASSUMIDA: "' + d4.assumido + '"');
ok(/confirme/i.test(d4.assumido), 'pedindo confirmação, em vez de dar por resolvido');
ok(!api.biradsCategoria('4B').assumido, 'quando a letra veio, nada é assumido');
ok(!api.biradsCategoria('3').assumido, 'e categoria sem letra nenhuma não inventa aviso');

console.log('\n=== a linha que vai para o laudo ===');
const linha = api.biradsLinhaCategoria('3', '');
ok(/^Categoria: BI-RADS 3 — Provavelmente benigno\./.test(linha), 'traz o rótulo por extenso');
ok(/Probabilidade de malignidade: > 0% e ≤ 2%\./.test(linha), 'traz a faixa');
ok(/\nRecomendação de conduta: /.test(linha), 'e a conduta em linha própria');
ok(api.biradsLinhaCategoria('3', 'Nódulo 1 — ').indexOf('Nódulo 1 — ') === 0,
   'com o rótulo do achado na frente quando há mais de um');
ok(/N\/A/.test(api.biradsLinhaCategoria('0', '')),
   'categoria 0 mostra N/A em vez de sumir com a linha (consistência visual entre achados)');

console.log('\n=== aceita o que aparece na vida real ===');
['3', ' 3 ', 'BI-RADS 3', 'birads 3', '3.'].forEach(v =>
  ok(api.biradsCategoria(v).cat === '3', 'entende "' + v + '"'));
ok(api.biradsCategoria('4a').cat === '4A', 'letra minúscula é aceita');
ok(api.biradsCategoria('').rotulo === '' && api.biradsCategoria(null).rotulo === '',
   'vazio não inventa categoria');
ok(api.biradsLinhaCategoria('9', '') === 'Categoria: BI-RADS 9.',
   'categoria desconhecida sai crua, sem faixa inventada');

console.log('\n=== a conta local concorda com os dizeres (estavam divergindo) ===');
// Em 20/08 os dizeres foram corrigidos no bloco 1 e a CONTA ficou para trás um dia:
// BIRADS_ESPECIAIS.microcistos ainda dizia 3. Os dois têm de andar juntos.
ok(api.BIRADS_ESPECIAIS.microcistos[0] === '2',
   'microcistos agrupados: 2 na conta, como já estava no texto (auditoria: sobreclassificados)');
ok(api.BIRADS_ESPECIAIS.cistoComplicado[0] === '3',
   'cisto complicado: 3 na conta, como no texto (auditoria + fonte primária)');
ok(api.BIRADS_ESPECIAIS.cistoSimples[0] === '2', 'cisto simples: 2');
ok(api.BIRADS_ESPECIAIS.linfonodo[0] === '2', 'linfonodo intramamário: 2');
ok(/rotina/i.test(api.BIRADS_ESPECIAIS.microcistos[1]),
   'e a conduta dos microcistos acompanhou a mudança, em vez de continuar mandando seguir');

console.log('\n=== e o laudo usa a linha nova, não a antiga ===');
ok(!/'Categoria: BI-RADS '\+r\.cat\+'\.'/.test(HTML), 'a montagem antiga da categoria calculada sumiu');
ok(!/'Categoria: BI-RADS '\+e\[0\]\+'\.'/.test(HTML), 'e a do caso especial também');
ok((HTML.match(/linhas\.push\(biradsLinhaCategoria\(/g) || []).length === 2,
   'os dois caminhos (descritores e caso especial) passam pela tabela');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
