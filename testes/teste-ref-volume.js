// ASTERISCO E FONTE NO JULGAMENTO DE TAMANHO — pedido do Dr. Daniel, 21/08/2026.
//
// Toda vez que o laudo AFIRMA que algo está aumentado ou reduzido, tem de haver asterisco
// ali e a fonte no fim do texto. A auditoria que abriu a tarefa: 23 frases dos dizeres
// julgam tamanho, e 22 não declaravam referência nenhuma. Dizer "aumentado" sem dizer
// aumentado em relação a QUÊ é o mesmo defeito dos valores sem fonte — em forma de
// adjetivo, que é mais fácil de não notar.
//
// A regra que esta suíte mais cobra: ONDE NÃO HÁ FONTE, O RODAPÉ DIZ QUE NÃO HÁ. Número
// inventado para tapar buraco é indefensável se questionado, e a assinatura é do médico.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const MOD = HTML.slice(HTML.indexOf('const REF_VOLUME'),
                       HTML.indexOf('/* ============ BLOCO 4 — registro pós-biópsia'));
const api = new Function(MOD + '\nreturn {refVolumeMarcar, REF_VOLUME};')();
const marca = (c, k) => api.refVolumeMarcar(c, k || '');

console.log('=== marca o julgamento, e só o julgamento ===');
const r1 = marca('Fígado com dimensões aumentadas, contornos regulares.', 'Hepatomegalia.');
ok(/dimensões aumentadas\*/.test(r1.corpo), 'marca no corpo');
ok(/Hepatomegalia\*/.test(r1.conclusao), 'e na conclusão');
ok(r1.corpo.replace(/\*/g, '') === 'Fígado com dimensões aumentadas, contornos regulares.',
   'e NADA mais do texto é tocado — tirando os asteriscos, é idêntico ao que entrou');
ok(marca('Fígado com dimensões normais. Baço normal.').usados.length === 0,
   'exame normal não ganha asterisco nenhum');
ok(marca('').nota === '', 'texto vazio não gera rodapé');

console.log('\n=== os órgãos que o médico citou ===');
[['Útero aumentado de volume, com miomatose.', 'utero'],
 ['Ovário direito aumentado, medindo 30 cm³.', 'ovario'],
 ['Próstata aumentada, com calcificações.', 'prostata'],
 ['Baço com dimensões aumentadas.', 'baco'],
 ['Notou-se atrofia renal à direita.', 'rim'],
 ['Notou-se ectasia ductal na mama direita.', 'ducto_mamario']].forEach(([txt, alvo]) => {
  const r = marca(txt);
  ok(r.usados.indexOf(alvo) >= 0, alvo + ': "' + txt.slice(0, 40) + '…" → ' + (r.usados.join(',') || 'nada'));
  ok(/\*/.test(r.corpo), '   com asterisco no texto');
});

console.log('\n=== ONDE NÃO HÁ FONTE, O RODAPÉ DIZ QUE NÃO HÁ ===');
// É o coração da tarefa. Inventar um número para preencher a lacuna seria repetir
// exatamente o defeito que a auditoria do CBR apontou.
const semFonte = Object.keys(api.REF_VOLUME).filter(k => !api.REF_VOLUME[k].fonte);
ok(semFonte.length > 0, 'há órgãos sem fonte, e eles são declarados: ' + semFonte.join(', '));
semFonte.forEach(k => {
  const R = api.REF_VOLUME[k];
  ok(/SEM referência estabelecida|NÃO tem fonte declarada/.test(R.ref),
     k + ': a própria referência diz que não existe');
  ok(!!R.ressalva, '   e explica o que fazer no lugar');
  ok(!/\d+\s*(cm|mm|mL|ml|cm³)/.test(R.ref.replace(/0,12 cm²/, '')),
     '   e NÃO inventa número para tapar o buraco');
});
const rv = marca('Vesícula biliar de dimensões aumentadas.');
ok(/SEM referência estabelecida/.test(rv.nota),
   'e isso chega ao rodapé do laudo: "' + rv.nota.split('\n')[1].slice(0, 70) + '…"');

console.log('\n=== cada fonte é rastreável ===');
Object.keys(api.REF_VOLUME).forEach(k => {
  const R = api.REF_VOLUME[k];
  if (!R.fonte) return;
  // Três procedências aceitáveis, e nenhuma outra: cita algo datável, aponta o acervo do
  // programa, ou DIZ que é valor de uso corrente sem fonte primária localizada. Esta
  // terceira é a do baço — 13 cm vem dos modelos do próprio médico, e declarar isso é mais
  // honesto do que emprestar uma citação que não sustenta o número que ele usa.
  ok(/\d{4}|referências do programa|NÃO localizado em fonte primária/.test(R.fonte),
     k + ': a fonte é rastreável — ano, acervo, ou "valor de uso corrente" dito às claras');
});
ok(/doi 10\.1006\/gyno\.2000\.5783/.test(api.REF_VOLUME.ovario.fonte), 'ovário: DOI do Pavlik 2000');
ok(/doi 10\.1111\/andr\.13217/.test(api.REF_VOLUME.prostata.fonte), 'próstata: DOI do Lotti 2022');
ok(/FÉRTEIS/.test(api.REF_VOLUME.prostata.ressalva),
   'e a próstata carrega a ressalva de que a casuística é de homens férteis de ~35 anos — '
   + 'não a faixa em que a hiperplasia é avaliada');
ok(/11,5%/.test(api.REF_VOLUME.figado.ressalva), 'fígado: a ressalva dos 11,5% de saudáveis acima de 16 cm');
ok(/Chow 2016/.test(api.REF_VOLUME.baco.ressalva), 'baço: a contestação do Chow 2016');
ok(/não há corte único estabelecido/.test(api.REF_VOLUME.utero.ressalva),
   'útero adulto: dito às claras que não existe corte único — os estudos dão médias, não limite');

console.log('\n=== dois defeitos que a revisão desta tarefa pegou ===');
// 1) o asterisco acumulava a cada reprocessamento: "Hepatomegalia***"
let t = 'Hepatomegalia. Fígado com dimensões aumentadas.';
for (let n = 0; n < 4; n++) t = marca(t).corpo;
ok(!/\*\*/.test(t), 'refazer o laudo 4 vezes não acumula asterisco: "' + t.slice(0, 46) + '…"');
ok((t.match(/\*/g) || []).length === 2, 'continuam exatamente 2 marcas');
// 2) o útero GRÁVIDO era marcado, e apontava a tabela pediátrica de 2 a 7 anos
const grav = marca('Útero aumentado de volume de paredes finas e íntegras, contendo feto único, vivo.');
ok(grav.usados.length === 0,
   'útero grávido NÃO é marcado — ele é aumentado por natureza, não é achado');
ok(marca('Útero aumentado de volume, com miomatose.').usados.indexOf('utero') >= 0,
   'mas o útero não grávido continua sendo');
ok(marca('Útero aumentado de volume, com miomatose.\nAusência de feto.').usados.indexOf('utero') >= 0,
   'e um feto citado noutra frase não cala o achado desta — a exceção olha a FRASE');

console.log('\n=== a trava: texto mexido além do asterisco é descartado ===');
ok(/replace\(\/\\\*\/g,''\)!==/.test(MOD.replace(/\s/g, '')) ||
   /marcadoC\.replace/.test(MOD),
   'a função compara o texto sem asteriscos com o que entrou');
ok(/return \{corpo:texto, conclusao:concl, nota:'', usados:\[\]\}/.test(MOD),
   'e devolve o ORIGINAL quando a comparação falha — laudo mexido por engano é dano');

console.log('\n=== o rodapé chega ao laudo, e não se empilha ===');
ok(/_extraFinal/.test(HTML), 'a nota é acrescentada ao rodapé do laudo');
ok(/extra:\(_extraFinal\|\|mod\.extra\|\|''\)/.test(HTML),
   'e o laudo guarda ESSE rodapé — usar mod.extra jogaria a nota fora e o asterisco '
   + 'apontaria para nada, que é pior que não marcar');
const refazer = HTML.slice(HTML.indexOf('REFAZER O LAUDO troca o texto inteiro'));
ok(/refVolumeMarcar\(L\.corpo, L\.conclusao\)/.test(refazer),
   'refazer o laudo remarca sobre o texto novo — senão o rodapé sobraria apontando para nada');
ok(/split\('Referências dos julgamentos de tamanho'\)\[0\]/.test(refazer),
   'e substitui a nota antiga em vez de empilhar uma segunda');
ok((HTML.match(/REFAZER O LAUDO troca o texto inteiro/g) || []).length === 2,
   'nos DOIS caminhos de refazer que existem no app');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
