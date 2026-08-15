// MEDIDAS DE REFERENCIA POR IDADE (13/08/2026) — tarefa 5 do medico.
//
// "Crianca nao e adulto pequeno": um figado de 12 cm e normal aos 10 anos e seria
// pequeno num adulto; um baco de 11 cm e normal aos 10 anos e grande aos 2.
//
// O QUE ESTES TESTES PROTEGEM, em ordem de importancia:
//   1. NAO avisar quando nao se sabe. Sem idade, sem tabela, sem sexo quando o sexo
//      importa: nao se compara nada. Aviso errado sobre tamanho de orgao em crianca e
//      pior que aviso nenhum.
//   2. Nao avisar de novo o que ja esta certo (nada de alarme em exame normal).
//   3. O programa NAO conclui. Ele nunca escreve "hepatomegalia": aponta a medida,
//      mostra a faixa, cita a fonte, e a decisao continua sendo do medico.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  let i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const src = [
  (HTML.match(/const REF_MEDIDAS = \{[\s\S]*?\n\};/) || [])[0],
  (HTML.match(/const REF_APELIDOS = \[[\s\S]*?\n\];/) || [])[0],
  (HTML.match(/const FALTA = \{[\s\S]*?\n\};/) || [])[0],
  grab('idadeEmAnos'), grab('refLinha'), grab('refFaixa'), grab('faltaTitulo'), grab('faltaTrecho'),
  grab('medidasDoLaudo'), grab('alertasReferencia'), grab('alertaTipoValido'),
  (HTML.match(/const ALERTAS = \[[\s\S]*?\n\];/) || [])[0]
].join('\n');
const A = new Function(src + '\nreturn {REF_MEDIDAS, idadeEmAnos, refFaixa, medidasDoLaudo,'
  + ' alertasReferencia, alertaTipoValido, ALERTAS};')();
const { REF_MEDIDAS, idadeEmAnos, refFaixa, medidasDoLaudo, alertasReferencia,
        alertaTipoValido, ALERTAS } = A;

const so = a => (a.length ? a[0].texto : '(nenhum aviso)');

console.log('=== a idade, como o aparelho a entrega ===');
ok(idadeEmAnos('034Y') === 34, 'DICOM "034Y" = 34 anos');
ok(idadeEmAnos('008M') === 8 / 12, 'DICOM "008M" = 8 meses');
ok(idadeEmAnos('021D') === 0, 'DICOM "021D" (dias) = recem-nascido');
ok(idadeEmAnos('4 anos') === 4, '"4 anos"');
ok(idadeEmAnos('8 meses') === 8 / 12, '"8 meses"');
ok(Math.abs(idadeEmAnos('3a2m') - (3 + 2 / 12)) < 1e-9, '"3a2m" = 3 anos e 2 meses');
ok(idadeEmAnos('11') === 11, 'so o numero');
ok(idadeEmAnos('') === null && idadeEmAnos(null) === null, 'vazio = NAO SEI');
ok(idadeEmAnos('adulto') === null, 'palavra solta = NAO SEI (nao chuta)');

console.log('=== sem idade, NAO se compara nada ===');
const semIdade = { cab: {}, corpo: '**Figado**\nLobo direito mede 22,0 cm.' };
ok(alertasReferencia(semIdade).length === 0,
   '22 cm de figado sem idade nao gera aviso — comparar com que tabela?');
ok(alertasReferencia(null).length === 0, 'laudo nulo nao quebra');
ok(alertasReferencia({ cab: { idade: 'xx' }, corpo: 'mede 30 cm' }).length === 0,
   'idade ilegivel tambem cala');

console.log('=== FIGADO por idade (Pediatr Radiol 2026, n=4.611) ===');
const fig = (idade, cm) => alertasReferencia({ idadePac: idade, cab: {},
  corpo: '**Figado** com contornos regulares.\nLobo direito mede ' + cm + ' cm.' });
ok(fig('010Y', 12.0).length === 0, 'figado de 12,0 cm aos 10 anos: NORMAL, nenhum aviso');
ok(fig('010Y', 15.5).length === 1, 'o MESMO 15,5 cm aos 10 anos: fora da faixa (P95=14,4)');
ok(/ACIMA/.test(so(fig('010Y', 15.5))), 'e diz que esta acima');
ok(fig('002Y', 12.0).length === 1, 'os mesmos 12,0 cm aos 2 anos: fora (P95=10,8)');
ok(fig('002Y', 9.5).length === 0, '9,5 cm aos 2 anos: normal');
ok(fig('000M', 6.0).length === 0, 'recem-nascido com 6,0 cm: normal');
ok(fig('000M', 9.0).length === 1, 'recem-nascido com 9,0 cm: fora');
ok(fig('017Y', 16.5).length === 0, '16,5 cm aos 17 anos: ainda dentro (P95=17,0)');
ok(fig('040Y', 22.0).length === 0,
   'ADULTO com 22 cm NAO gera aviso: nao ha tabela de figado adulto nos modelos, e '
   + 'inventar um limite seria pior que ficar calado');

console.log('=== BACO (Rosenberg, AJR 1991) — e o sexo NAO importa (corrigido em 14/08) ===');
// 14/08: saiu a divisao por sexo dos >=15 anos (era 12,0 mocas / 13,0 rapazes).
// Eze 2013 (n=947) e Megremis 2004 (n=512) nao acham diferenca entre os sexos; Waelti
// 2021 (n=736), o UNICO que acha, mede 0,24 cm e recomenda tabela unica. O programa
// aplicava 1,0 cm — quatro vezes a maior diferenca ja medida.
const bac = (idade, cm, sexo) => alertasReferencia({ idadePac: idade, sexoPac: sexo, cab: {},
  corpo: '**Baco** de contornos regulares, medindo ' + cm + ' cm.' });
ok(bac('002Y', 7.5).length === 0, 'baco de 7,5 cm aos 2 anos: normal (limite 8,0)');
ok(bac('002Y', 9.0).length === 1, '9,0 cm aos 2 anos: acima');
ok(bac('010Y', 9.0).length === 0, 'os mesmos 9,0 cm aos 10 anos: normal (limite 11,0)');
ok(bac('016Y', 12.5, 'M').length === 0, '12,5 cm num rapaz de 16: normal (limite 13,0)');
ok(bac('016Y', 12.5, 'F').length === 0,
   'os MESMOS 12,5 cm numa moca de 16: TAMBEM normal — o limite deixou de depender do sexo');
ok(bac('016Y', 13.5, 'F').length === 1, '13,5 cm aos 16 passa do limite numa moca...');
ok(bac('016Y', 13.5, 'M').length === 1, '...e passa igual num rapaz');
ok(bac('013Y', 12.0).length === 0, 'aos 13 anos o limite ainda e 12,0: 12,0 passa raspando');
ok(bac('013Y', 12.5).length === 1, 'e 12,5 aos 13 anos ja e acima');
// nao basta o resultado bater hoje: a divisao por sexo tem de SUMIR da tabela, senao
// alguem a religa sem querer e o teste acima continua verde por coincidencia
ok(!REF_MEDIDAS.baco.pedSexo, 'a tabela por sexo do baco saiu de vez');
ok(!REF_MEDIDAS.baco.sexoDesde, 'e o gatilho de idade que a ligava tambem');
ok(/Eze|Megremis|Waelti/.test(REF_MEDIDAS.baco.fonte),
   'e a fonte registra por que a divisao por sexo nao e usada');
// o degrau some: 17 anos e 18 anos passam a ter o mesmo limite
ok(bac('017Y', 12.5, 'F').length === 0 && bac('018Y', 12.5, 'F').length === 0,
   'nao ha mais degrau no aniversario de 18 anos');
ok(bac('040Y', 12.0).length === 0, 'adulto com 12,0 cm: normal (13,0, do modelo do medico)');
ok(bac('040Y', 14.0).length === 1, 'adulto com 14,0 cm: acima — aqui SIM ha referencia');
ok(/13/.test(so(bac('040Y', 14.0))), 'e o aviso mostra o limite de 13 cm');

console.log('=== RIM (Pediatr Nephrol 2021, aberto, n=1.758, por idade E sexo) ===');
// 13/08: substituiu a formula de Rosenbaum + margem de +/-1,5 cm, que era escolha minha
// e nao do estudo. Agora os percentis sao do proprio artigo.
const rim = (idade, cm, sexo) => alertasReferencia({ idadePac: idade, sexoPac: sexo, cab: {},
  corpo: '**Rim direito** topico.\nMedida renal em seu maior eixo ' + cm + ' cm.' });
ok(rim('005Y', 8.0, 'M').length === 0, 'rim de 8,0 cm num menino de 5 anos: normal (6,98-9,28)');
ok(rim('005Y', 9.5, 'M').length === 1, '9,5 cm aos 5 anos: acima do P97,5');
ok(rim('005Y', 6.0, 'M').length === 1, '6,0 cm aos 5 anos: abaixo do P2,5');
ok(/abaixo/.test(so(rim('005Y', 6.0, 'M'))), 'e o aviso diz que e abaixo, nao acima');
ok(rim('000M', 6.0, 'M').length === 0, 'recem-nascido com 6,0 cm: normal (5,16-7,01)');
ok(rim('000M', 4.5, 'M').length === 1, 'e com 4,5 cm: abaixo');
// o sexo separa de verdade na adolescencia
ok(rim('017Y', 12.3, 'M').length === 0, 'rapaz de 17 com 12,3 cm: normal (ate 12,41)');
ok(rim('017Y', 12.3, 'F').length === 1, 'moca de 17 com os MESMOS 12,3 cm: acima (ate 11,86)');
// sem sexo: faixa mais estreita, e o aviso avisa que e palpite
const semSexo = rim('017Y', 12.3, '');
ok(semSexo.length === 1, 'sem sexo, 12,3 cm aos 17 dispara — erra para o lado de avisar');
ok(/sexo n[ãa]o veio/.test(so(semSexo)), 'e o aviso diz que o sexo nao veio...');
ok(/falso alarme/.test(so(semSexo)), '...e que pode ser falso alarme');
ok(rim('040Y', 15.0).length === 0,
   'ADULTO nao e conferido: o estudo vai so ate 19 anos');
ok(!/Rosenbaum/.test(JSON.stringify(REF_MEDIDAS.rim)), 'a fonte antiga saiu');
ok(/CC BY 4\.0|acesso aberto/.test(REF_MEDIDAS.rim.fonte), 'e a nova diz que e de acesso aberto');
ok(!REF_MEDIDAS.rim.formula, 'nao ha mais formula com margem inventada');

console.log('=== milimetro tambem e lido, e convertido ===');
const mm = alertasReferencia({ idadePac: '002Y', cab: {},
  corpo: '**Baco** medindo 95 mm.' });
ok(mm.length === 1, '95 mm aos 2 anos = 9,5 cm: acima do limite de 8,0');
const mmOk = alertasReferencia({ idadePac: '002Y', cab: {}, corpo: '**Baco** medindo 75 mm.' });
ok(mmOk.length === 0, 'e 75 mm = 7,5 cm: normal');

console.log('=== nao inventa orgao: numero sem contexto NAO e comparado ===');
ok(medidasDoLaudo({ corpo: 'Bexiga com 8,0 cm.' }).length === 0,
   'bexiga nao tem tabela aqui: o numero e ignorado, nao chutado');
ok(medidasDoLaudo({ corpo: 'Cisto de 3,0 cm.' }).length === 0, 'cisto solto idem');
ok(medidasDoLaudo({ corpo: '**Figado**\nLobo direito mede 14,2 cm.' })[0].orgao === 'figado',
   'mas "lobo direito" sob o titulo Figado e reconhecido');
ok(medidasDoLaudo({ corpo: 'Medida renal em seu maior eixo 9,0 cm.' })[0].orgao === 'rim',
   'e "medida renal" tambem, mesmo sem titulo');

console.log('=== exame normal nao vira alarme ===');
const normal = { idadePac: '008Y', cab: {}, corpo:
  '**Figado** com dimensoes normais.\nLobo direito mede 11,5 cm.\n\n'
  + '**Baco** com dimensoes normais, medindo 9,5 cm.\n\n'
  + '**Rim direito** topico.\nMedida renal em seu maior eixo 8,5 cm.' };
ok(alertasReferencia(normal).length === 0,
   'crianca de 8 anos com os tres orgaos dentro da faixa: NENHUM aviso');

console.log('=== varios numeros do mesmo orgao nao viram varios avisos ===');
const tres = { idadePac: '002Y', cab: {}, corpo:
  '**Baco** medindo 9,0 x 4,0 x 3,0 cm.' };
const av = alertasReferencia(tres);
ok(av.length === 1, 'um aviso so');
ok((so(av).match(/^•/gm) || []).length === 1, 'e uma linha so, do maior valor');
ok(/9/.test(so(av)), 'reportando o 9,0 e nao o 3,0');

console.log('=== o programa APONTA, nao conclui ===');
const grande = fig('002Y', 13.0);
ok(!/hepatomegalia/i.test(so(grande)), 'nao escreve "hepatomegalia"');
ok(!/aumentad/i.test(so(grande)), 'nem "aumentado" — quem conclui e o medico');
ok(/confira a medida e decida/.test(so(grande)), 'e diz isso com todas as letras');
ok(/fonte:/.test(so(grande)), 'com a FONTE do numero, para ele poder discordar');
ok(/Pediatr Radiol/.test(so(grande)), 'citando o estudo, nao "a literatura"');

console.log('=== a categoria no painel ===');
ok(alertaTipoValido('referencia') === 'referencia', 'a categoria existe');
ok(ALERTAS.some(a => a.k === 'referencia'), 'e esta no painel');
ok(new Set(ALERTAS.map(a => a.cor)).size === ALERTAS.length, 'sem repetir cor de outra');
ok((HTML.match(/alertasReferencia\(L\)/g) || []).length >= 2,
   'e o aviso e montado nas DUAS telas de revisao');

console.log('=== a procedencia de cada tabela esta no codigo ===');
Object.keys(REF_MEDIDAS).forEach(k => {
  ok(!!REF_MEDIDAS[k].fonte && REF_MEDIDAS[k].fonte.length > 40,
     'a tabela de ' + k + ' diz de onde veio');
});
ok(/N[ÃA]O foi inventado|nenhum n[úu]mero aqui foi inventado/i.test(HTML),
   'e o codigo avisa que nada disto vale sem a revisao do medico');
ok(/tireoide/i.test(HTML) && /superf[íi]cie corporal/i.test(HTML),
   'e diz POR QUE a tireoide ficou de fora, em vez de simplesmente faltar');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
