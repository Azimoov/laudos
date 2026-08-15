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
  grab('idadeEmAnos'), grab('idadePrecisaAnos'), grab('refLinha'), grab('refFaixa'),
  grab('faltaTitulo'), grab('faltaTrecho'),
  grab('medidasDoLaudo'), grab('alertasReferencia'), grab('alertaTipoValido'),
  (HTML.match(/const ALERTAS = \[[\s\S]*?\n\];/) || [])[0]
].join('\n');
const A = new Function(src + '\nreturn {REF_MEDIDAS, idadeEmAnos, idadePrecisaAnos, refFaixa,'
  + ' medidasDoLaudo, alertasReferencia, alertaTipoValido, ALERTAS};')();
const { REF_MEDIDAS, idadeEmAnos, idadePrecisaAnos, refFaixa, medidasDoLaudo,
        alertasReferencia, alertaTipoValido, ALERTAS } = A;

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
// 15/08: o figado adulto passou a ser conferido. 16,0 cm, decisao do Dr. Daniel.
ok(fig('040Y', 15.0).length === 0, 'adulto com 15,0 cm: normal (limite 16,0)');
ok(fig('040Y', 16.0).length === 0, 'adulto com 16,0 cm: passa raspando');
ok(fig('040Y', 16.5).length === 1, 'adulto com 16,5 cm: acima');
ok(fig('040Y', 22.0).length === 1,
   'ADULTO com 22 cm AGORA gera aviso — antes de 15/08 passava calado');
ok(/16/.test(so(fig('040Y', 22.0))), 'e o aviso mostra o limite de 16 cm');
// O DEGRAU DOS 18 ANOS: conhecido, aceito pelo medico, e travado aqui de proposito.
// A tabela pediatrica vai ate 17,2 cm aos 17 anos; o limite de adulto e 16,0. Logo o
// MESMO figado muda de veredito no aniversario de 18. Isso e consequencia de misturar
// duas fontes (Manteghinejad para crianca, valor classico para adulto), nao um bug.
// Se um dia alguem "consertar" isto, que seja de proposito e nao por acidente.
ok(fig('017Y', 17.0).length === 0, 'degrau: 17,0 cm aos 17 anos NAO avisa (P95 = 17,2)...');
ok(fig('018Y', 17.0).length === 1, '...e o MESMO 17,0 cm aos 18 anos avisa (limite 16,0)');

console.log('=== BACO (Mohtasib 2021, n=1.028, aberto) — sem divisao por sexo ===');
// 15/08: trocada a tabela (era Rosenberg 1991, n=230, lido por citacao de terceiros) e
// retirada a divisao por sexo dos >=15 anos, que aplicava 1,0 cm de diferenca.
//
// CUIDADO AO LER: a diferenca por sexo EXISTE. Quatro dos cinco estudos consultados a
// encontram, entre eles os dois maiores (Mohtasib n=1.028, Akinlade n=1.000). O motivo
// de nao usa-la e outro: onde foi medida, vale 0,24 cm (Waelti) a 0,3 cm (Mohtasib), e
// os dois maiores estudos, tendo-a achado, escolhem apresentar a tabela SEM separar por
// sexo por nao considera-la clinicamente significativa. 1,0 cm nunca teve respaldo.
const bac = (idade, cm, sexo) => alertasReferencia({ idadePac: idade, sexoPac: sexo, cab: {},
  corpo: '**Baco** de contornos regulares, medindo ' + cm + ' cm.' });
// as faixas do artigo, uma amostra de cada ponta e do meio
ok(bac('000M', 5.0).length === 0, 'recem-nascido com 5,0 cm: normal (limite 5,5)');
ok(bac('000M', 6.0).length === 1, 'e com 6,0 cm: acima');
ok(bac('001M', 5.4).length === 0,
   'bebe de 1 mes EXATO ainda pega o limite de 5,5 — 1/12 nao e 0,0833');
ok(bac('006M', 6.9).length === 0, '6 meses com 6,9 cm: normal (limite 7,0)');
ok(bac('002Y', 7.5).length === 0, 'baco de 7,5 cm aos 2 anos: normal (limite 8,0)');
ok(bac('002Y', 9.0).length === 1, '9,0 cm aos 2 anos: acima');
ok(bac('003Y', 8.4).length === 0, 'aos 3 anos o limite sobe para 8,5: 8,4 passa');
ok(bac('010Y', 9.0).length === 0, 'os mesmos 9,0 cm aos 10 anos: normal (limite 10,5)');
ok(bac('010Y', 11.0).length === 1, 'mas 11,0 aos 10 anos e acima — Rosenberg deixava passar');
ok(bac('013Y', 12.0).length === 0, 'aos 13 anos o limite e 12,0: 12,0 passa raspando');
ok(bac('013Y', 12.5).length === 1, 'e 12,5 aos 13 anos ja e acima');
// o sexo nao entra mais em lugar nenhum
ok(bac('016Y', 12.5, 'M').length === 0, '12,5 cm num rapaz de 16: normal (limite 13,0)');
ok(bac('016Y', 12.5, 'F').length === 0,
   'os MESMOS 12,5 cm numa moca de 16: TAMBEM normal — o limite nao depende do sexo');
ok(bac('016Y', 13.5, 'F').length === 1, '13,5 cm aos 16 passa do limite numa moca...');
ok(bac('016Y', 13.5, 'M').length === 1, '...e passa igual num rapaz');
// nao basta o resultado bater hoje: a divisao por sexo tem de SUMIR da tabela, senao
// alguem a religa sem querer e os casos acima continuam verdes por coincidencia
ok(!REF_MEDIDAS.baco.pedSexo, 'a tabela por sexo do baco saiu de vez');
ok(!REF_MEDIDAS.baco.sexoDesde, 'e o gatilho de idade que a ligava tambem');
ok(/Mohtasib/.test(REF_MEDIDAS.baco.fonte), 'a fonte nova esta registrada...');
ok(/acesso aberto|aberto/.test(REF_MEDIDAS.baco.fonte), '...e diz que e de acesso aberto');
ok(/Rosenberg/.test(REF_MEDIDAS.baco.fonte),
   'e a faixa de 15 a 18 anos declara que NAO e do Mohtasib');
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

console.log('=== UTERO (Salardi 1985) — por VOLUME, e so dos 2 aos 7 anos ===');
// O unico orgao comparado por volume, e o unico com teto de idade. Dos 8 anos em diante
// quem manda e a puberdade, e o exame nao traz estagio puberal nem tempo de menarca.
const ut = (idade, txt) => alertasReferencia({ idadePac: idade, cab: {},
  corpo: '**Utero** de contornos regulares, medindo ' + txt + '.' });
// 3,0 x 1,5 x 1,0 x 0,5233 = 2,36 cm3 -> dentro (limite 4,3)
ok(ut('004Y', '3,0 x 1,5 x 1,0 cm').length === 0, 'utero de 2,36 cm3 aos 4 anos: normal');
// 4,0 x 2,5 x 2,0 x 0,5233 = 10,47 cm3 -> acima
ok(ut('004Y', '4,0 x 2,5 x 2,0 cm').length === 1, 'utero de 10,47 cm3 aos 4 anos: acima');
ok(/cm3|cm³/.test(so(ut('004Y', '4,0 x 2,5 x 2,0 cm'))), 'e o aviso fala em cm3, nao em cm');
// a fronteira do limite
ok(ut('004Y', '3,0 x 2,0 x 1,3 cm').length === 0, '4,08 cm3 passa raspando');
ok(ut('004Y', '3,5 x 2,0 x 1,2 cm').length === 1, 'e 4,40 cm3 ja e acima');
// O TETO DE IDADE: o mesmo utero enorme nao gera aviso fora da janela
ok(ut('010Y', '4,0 x 2,5 x 2,0 cm').length === 0,
   'aos 10 anos o MESMO utero nao gera aviso: a idade nao diz o estagio puberal');
ok(ut('016Y', '4,0 x 2,5 x 2,0 cm').length === 0, 'idem aos 16 anos');
ok(ut('030Y', '4,0 x 2,5 x 2,0 cm').length === 0, 'idem na adulta — nao ha tabela de adulto');
ok(ut('001Y', '4,0 x 2,5 x 2,0 cm').length === 0,
   'e abaixo de 2 anos tambem cala: o estudo comeca aos 2');
// SEM OS TRES EIXOS NAO HA VOLUME: cala, em vez de comparar grandeza errada
ok(ut('004Y', '3,0 cm').length === 0,
   'utero com UMA medida so nao e comparado: comprimento nao se compara com tabela de volume');
ok(ut('004Y', '3,0 x 2,0 cm').length === 0, 'com dois eixos idem');
// O PARA-CHOQUE DO OVARIO: medida de ovario na mesma linha que cita utero nao pode
// ser comparada com a tabela do utero
const ovNaLinha = alertasReferencia({ idadePac: '004Y', cab: {},
  corpo: '**Utero** anteversofletido. Ovario direito medindo 4,0 x 2,5 x 2,0 cm.' });
ok(ovNaLinha.length === 0, 'medida de OVARIO na linha do utero nao vira aviso de utero');
ok(!REF_MEDIDAS.ovario, 'e o ovario nao tem tabela: n=4 em uma das faixas, daria inversao');
// a procedencia, e a honestidade sobre o limite ser calculado
ok(/Salardi/.test(REF_MEDIDAS.utero.fonte), 'a fonte do utero esta registrada');
ok(/m[ée]dia \+ 2 DP|media \+ 2 DP/.test(REF_MEDIDAS.utero.fonte),
   'e a fonte diz que o limite foi DERIVADO, nao publicado');
ok(REF_MEDIDAS.utero.volume === true, 'o utero esta marcado como tabela de volume');
ok(REF_MEDIDAS.utero.idadeMin === 2 && REF_MEDIDAS.utero.idadeMax === 7,
   'com piso e teto de idade explicitos');
// os outros orgaos NAO mudaram de grandeza
ok(!REF_MEDIDAS.figado.volume && !REF_MEDIDAS.baco.volume && !REF_MEDIDAS.rim.volume,
   'figado, baco e rim continuam sendo comparados pelo maior eixo');

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

console.log('=== BEBES: a idade sai da DATA DE NASCIMENTO, nao do inteiro do agente ===');
// O agente calcula idade em anos INTEIROS: bebe de 11 meses chega como "0". E a faixa de
// 0 anos e a do RECEM-NASCIDO, a mais estreita de todas. Resultado: alarme falso em todo
// bebe do primeiro ano, justo onde os orgaos crescem mais depressa.
// Com as duas datas do aparelho, a idade sai com casas decimais.
const bebe11m = { idadePac: '0', nascPac: '20250915', dataExame: '15/08/2026', cab: {},
  corpo: '**Figado**\nLobo direito mede 9,0 cm.' };
ok(alertasReferencia(bebe11m).length === 0,
   'bebe de 11 meses com figado de 9,0 cm: NORMAL (faixa 9-12m e 6,9-9,8)');
// e a prova de que sem o conserto seria alarme falso: o MESMO laudo sem data de nascimento
const bebe11mSemData = { idadePac: '0', cab: {}, corpo: '**Figado**\nLobo direito mede 9,0 cm.' };
ok(alertasReferencia(bebe11mSemData).length === 1,
   'o MESMO figado, sem data de nascimento, cai na faixa de recem-nascido e vira aviso');
// a idade aparece certa no texto do aviso
const bebeGrande = { idadePac: '0', nascPac: '20250915', dataExame: '15/08/2026', cab: {},
  corpo: '**Figado**\nLobo direito mede 12,0 cm.' };
ok(/11 meses/.test(so(alertasReferencia(bebeGrande))),
   'e o aviso diz "11 meses", nao "0 meses"');
// a funcao em si
ok(Math.abs(idadePrecisaAnos('20250915', '15/08/2026') - 0.914) < 0.01, '11 meses = 0,91 anos');
ok(Math.abs(idadePrecisaAnos('19860310', '15/08/2026') - 40.4) < 0.1, 'adulto de 40 anos');
// so aceita o que da para confiar — no resto, deixa o caminho antigo agir
ok(idadePrecisaAnos('', '15/08/2026') === null, 'sem nascimento: null');
ok(idadePrecisaAnos('2025091', '15/08/2026') === null, 'nascimento truncado: null');
ok(idadePrecisaAnos('20250230', '15/08/2026') === null,
   '30 de fevereiro nao existe: null, em vez de o Date "consertar" para 02/03');
ok(idadePrecisaAnos('20991231', '15/08/2026') === null, 'nascimento no futuro: null');
ok(idadePrecisaAnos('18000101', '15/08/2026') === null, 'idade impossivel: null');
ok(idadePrecisaAnos('20250915', 'bagunca') !== null,
   'data de exame ilegivel nao invalida: cai para hoje, que e quando o exame e feito');
// nao pode ter estragado o caminho de quem ja funcionava
ok(alertasReferencia({ idadePac: '010Y', cab: {}, corpo: '**Baco** medindo 9,0 cm.' }).length === 0,
   'crianca de 10 anos sem data de nascimento continua sendo conferida pelo caminho antigo');

console.log('=== o cadastro do APARELHO chega inteiro ao laudo (15/08) ===');
// Tudo nesta secao existe por causa de uma cadeia so: o medico digita a data de
// nascimento no aparelho -> o agente calcula a idade a partir dela (_idade) -> o app
// guarda em idadeExame/sexoPac -> alertasReferencia compara as medidas. Se qualquer elo
// se perder, o programa fica MUDO e ninguem percebe, porque calar nao da erro.
const capturas = HTML.match(/_captura:true/g) || [];
ok(capturas.length >= 2, 'ha pelo menos dois caminhos de captura ao vivo');
ok((HTML.match(/sexoPac:est\.sexo/g) || []).length >= 2,
   'e OS DOIS copiam o sexo que o aparelho mandou — antes de 15/08 jogavam fora');
ok((HTML.match(/nascPac:est\.nascimento/g) || []).length >= 2,
   'e os dois copiam a data de nascimento tambem');
// o efeito de nao copiar era um aviso que culpava o aparelho por uma perda do app
ok(/sexo n[ãa]o veio na etiqueta/.test(HTML),
   'o aviso de "sexo nao veio" continua existindo, para quando o aparelho REALMENTE nao mandar');

console.log('=== a tela do dia orienta a preencher nascimento e sexo ===');
const regras = (HTML.match(/<div class="regras">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
ok(/data de nascimento e sexo/i.test(regras),
   'a regra pede data de nascimento E sexo, nao so o nome');
ok(/aparelho/i.test(regras), 'e diz ONDE preencher: no aparelho');
ok(/preciso|precis[ãa]o/i.test(regras),
   'e explica o ganho: o laudo sai mais preciso');
ok(/n[ãa]o sabe a idade|nao confere/i.test(regras),
   'e diz o custo de nao preencher, que e o programa ficar mudo');

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
