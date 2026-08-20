// Ponte VOZ/IMG da tela de revisao — construida em 14/08, conferida e coberta em 17/08.
//
// A regra (decisao do Dr. Daniel em 17/08): a ligacao frase->trecho e CONFERIDA —
// a citacao literal que a IA copiou do ditado tem de ser REENCONTRADA no texto dos
// trechos com hora. Nao achou com folga = SEM botao: e melhor nao tocar nada do que
// tocar o pedaco errado. A procedencia e escrita na GERACAO e nao se atualiza com a
// edicao (mesmo precedente da referencia escrita no corpo, 15/08).
//
// Tambem cobre o defeito achado em 17/08: exame com DUAS gravacoes tocava sempre a
// primeira — agora cada trecho leva a URL do proprio audio (audioUrl).
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, started = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; started = true; }
    else if (HTML[j] === '}') { d--; if (started && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('nao fechou ' + name);
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function bloco(re, oque) {
  const m = HTML.match(re);
  if (!m) throw new Error('nao achei o bloco ' + oque);
  return m[0];
}
const src = [grab('norm'), grab('rev2Proc'), grab('rev2Trecho'), grab('rev2AudioDoTrecho'),
             grab('faltaTitulo'), grab('faltaGrupos'), grab('medidasFaltando'),
             bloco(/const FALTA\s*=\s*\{[\s\S]*?\n\};/, 'FALTA'),
             bloco(/const REV2_MOLDURA = [^\n]*/, 'REV2_MOLDURA'),
             // 19/08/2026: o corte de retangulos passou a distinguir negrito de MEDIDA
             // de negrito de TITULO — ver rev2NegritoDeMedida no index.html
             bloco(/const REV2_ROTULO_MEDIDA = [^\n]*/, 'REV2_ROTULO_MEDIDA'),
             bloco(/const REV2_PALAVRA_MEDIDA = [^\n]*/, 'REV2_PALAVRA_MEDIDA'),
             grab('rev2TituloDeMoldura'), grab('rev2NegritoDeMedida'),
             // 2a rodada de 19/08: o estado do retangulo passou a consultar o MODELO do
             // medico (o que ja era estrutura antes do exame existir) — ver rev2MoldeDoModelo
             grab('rev2Assinatura'), grab('rev2MoldeDoTexto'), grab('rev2MoldeDoModelo'),
             grab('rev2MoldeDoLaudo'),
             // 3a rodada: rev2Proc passou a respeitar LADO (a ficha VOZ tocava o ditado do
             // outro lado quando a secao vinha sem lateralidade)
             bloco(/const REV2_LADOS = [^\n]*/, 'REV2_LADOS'), grab('rev2LadoDe'),
             grab('rev2TituloDeBloco'), grab('rev2CorpoVisivel'),
             grab('rev2Blocos'), grab('rev2Estado')].join('\n');
// MODELOS entra no ambiente porque rev2MoldeDoModelo o consulta. Aqui os casos de teste
// nao passam `tipo`, entao o molde vem nulo e vale a heuristica de reserva — de proposito:
// esta suite testa a moldura, nao o molde (que tem suite propria em teste-blocos-revisao).
const MODELOS = {};
const api = new Function('MODELOS', src + '\nreturn {rev2Proc, rev2Trecho, rev2AudioDoTrecho,'
  + ' rev2Blocos, rev2Estado, rev2TituloDeMoldura, rev2NegritoDeMedida,'
  + ' rev2TituloDeBloco, rev2CorpoVisivel};')(MODELOS);
const { rev2Proc, rev2Trecho, rev2AudioDoTrecho, rev2Blocos, rev2Estado,
        rev2TituloDeMoldura, rev2NegritoDeMedida, rev2TituloDeBloco,
        rev2CorpoVisivel } = api;

const ex = { laudo: {
  procedencia: [
    { secao: 'Ovario direito', imagem_n: 3, origem: 'ambos', citacao: 'cisto anecoico de paredes finas' },
    { secao: 'Utero', imagem_n: 0, origem: 'voz', citacao: 'utero em anteversoflexao contornos regulares' }
  ],
  trechos: [
    { inicio: 12, fim: 18, audioUrl: 'http://a/1',
      texto: 'no ovario direito ha um cisto anecoico de paredes finas com conteudo liquido' },
    { inicio: 3, fim: 9, audioUrl: 'http://a/2',
      texto: 'utero em anteversoflexao contornos regulares medindo sete centimetros' }
  ]
}};

console.log('=== a procedencia acha a secao ===');
ok(rev2Proc(ex, 'Ovario direito') === ex.laudo.procedencia[0], 'secao do retangulo casa com a anotacao da IA');
ok(rev2Proc(ex, 'Figado') === null, 'secao sem anotacao devolve nada (sem chute)');
ok(rev2Proc(ex, '') === null, 'retangulo sem titulo nao casa com nada');

console.log('=== a conferencia da citacao (decisao de 17/08: conferido ou sem botao) ===');
ok(rev2Trecho(ex, 'cisto anecoico de paredes finas') === ex.laudo.trechos[0],
   'citacao literal reencontrada -> o trecho certo');
ok(rev2Trecho(ex, 'utero em anteversoflexao contornos regulares') === ex.laudo.trechos[1],
   'e cada citacao vai ao SEU trecho, nao ao primeiro');
ok(rev2Trecho(ex, 'paredes finas conteudo liquido ovario') === ex.laudo.trechos[0],
   'sem match literal, vale a sobreposicao de palavras (>=2)');
ok(rev2Trecho(ex, 'figado baco pancreas aumentados') === null,
   'citacao que nao esta em trecho nenhum -> SEM botao');
ok(rev2Trecho(ex, 'paredes esquisitas estranhas') === null,
   'uma palavra so de sobreposicao nao basta -> SEM botao');
ok(rev2Trecho(ex, 'oi') === null, 'citacao curta demais nao vale como prova -> SEM botao');
ok(rev2Trecho({ laudo: { trechos: [] } }, 'cisto anecoico de paredes finas') === null,
   'exame sem trechos com hora -> SEM botao (exames antigos e transcricao da nuvem)');

console.log('=== o tocador acha o audio certo (defeito de 17/08) ===');
const doisAudios = [{ url: 'http://a/1' }, { url: 'http://a/2' }];
ok(rev2AudioDoTrecho(doisAudios, ex.laudo.trechos[1]) === doisAudios[1],
   'trecho da SEGUNDA gravacao toca a segunda, nao a primeira');
ok(rev2AudioDoTrecho(doisAudios, ex.laudo.trechos[0]) === doisAudios[0],
   'trecho da primeira toca a primeira');
ok(rev2AudioDoTrecho(doisAudios, { inicio: 1, fim: 2 }) === doisAudios[0],
   'trecho antigo (sem audioUrl) cai no comportamento de antes: primeiro audio');
ok(rev2AudioDoTrecho([{}, {}], ex.laudo.trechos[0]) === null,
   'nenhum audio com URL -> nada a tocar (sem erro)');
ok(rev2AudioDoTrecho([], ex.laudo.trechos[0]) === null, 'lista vazia -> nada a tocar');

console.log('=== o que vira retangulo (decisao do medico, 17/08) ===');
// "Titulo do exame, descricao, metodo e tecnica nao precisam de retangulo — sao
// sempre iguais e nao vao mudar." O estrago que isto conserta: a IA escreve
// **MAMA DIREITA** e na linha seguinte **DESCRICAO:**, e o corte por titulo
// separava o nome do orgao (com as fichas VOZ/IMG) dos achados (com a cor).
// o achado em negrito e LONGO, como nos laudos de verdade: negrito com menos de
// 70 caracteres e lido como titulo pelo faltaTitulo (regra que ja existia)
const CORPO = ['**MAMA DIREITA**', '**DESCRIÇÃO:**', '',
               'Mama simétrica.', '',
               'Parênquima de padrão heterogêneo. **Notou-se imagem nodular, sólida,'
               + ' hipoecogênica, de forma oval, margens circunscritas, no quadrante'
               + ' superior externo, distando 5 cm da papila mamária.**', '',
               '**MAMA ESQUERDA**', '**DESCRIÇÃO:**', '',
               'Mama simétrica.', '',
               'Região axilar livre.'].join('\n');
const bl = rev2Blocos({ corpo: CORPO });
ok(bl.length === 2, 'orgao + "DESCRICAO" viram UM retangulo por orgao (' + bl.length + ')');
ok(bl[0].titulo === 'MAMA DIREITA' && bl[1].titulo === 'MAMA ESQUERDA',
   'o titulo do retangulo e o ORGAO, nunca "DESCRICAO"');
ok(bl.every(b => /DESCRIÇÃO/.test(b.texto)),
   'e o cabecalho fixo continua no texto (editavel, so nao vira moldura)');
ok(rev2TituloDeMoldura('DESCRIÇÃO') && rev2TituloDeMoldura('Técnica')
   && rev2TituloDeMoldura('MÉTODO') && rev2TituloDeMoldura('achados'),
   'descricao, tecnica, metodo e achados sao moldura');
ok(!rev2TituloDeMoldura('MAMA DIREITA') && !rev2TituloDeMoldura('Ovário direito')
   && !rev2TituloDeMoldura('Endométrio'),
   'nome de orgao NUNCA e moldura');

console.log('=== e a cor nao se confunde com a moldura (alarme falso de 17/08) ===');
const exVazio = { laudo: { procedencia: [], trechos: [] } };
ok(rev2Estado(exVazio, bl[0]) === 'alterado',
   'orgao com achado em negrito: alterado');
ok(rev2Estado(exVazio, bl[1]) !== 'alterado',
   'orgao NORMAL nao vira alterado por causa do "DESCRICAO:" em negrito');
ok(rev2Estado(exVazio, bl[1]) === 'normal',
   'e o orgao normal fica cinza, como no desenho');

console.log('=== as amarras no codigo-fonte ===');
ok(HTML.indexOf('DE ONDE VEIO CADA COISA') >= 0, 'o pedido a IA exige a procedencia (secao/imagem/citacao)');
ok(HTML.indexOf('REGRA DURA') >= 0 && HTML.indexOf('imagem_n = 0') >= 0,
   'e manda apontar imagem SO quando leu nela (na duvida, 0)');
ok(/audioUrl:a\.url/.test(HTML), 'cada trecho leva a URL do proprio audio ao ser guardado no laudo');
ok(/\(ex\.imagens\|\|\[\]\)\.length>=pr\.imagem_n/.test(HTML),
   'ficha IMG so nasce quando a foto citada existe de verdade');
ok(HTML.indexOf("rev2Tocar('+trI+')") >= 0, 'a ficha VOZ aponta o trecho (indice), nao horas soltas');
const editouSrc = grab('rev2Editou');
ok(!/procedencia/.test(editouSrc),
   'a edicao do medico NAO reescreve a procedencia — congelada na geracao (decisao de 17/08)');

console.log('=== 20/08/2026: a ficha VOZ com trecho vindo da NUVEM ===');
// Ter marcacao de tempo e condicao NECESSARIA, nao suficiente: a ficha VOZ so nasce
// quando a procedencia casa com o titulo E a citacao e reencontrada num trecho. Depois
// de a nuvem passar a devolver hora (whisper-1 + verbose_json), faltava provar que a
// ponte INTEIRA fecha com trechos daquele formato — a segmentacao do whisper-1 e mais
// grossa que a do motor local, e era ai que isto poderia falhar calado.
//
// Os trechos abaixo NAO sao inventados: foram colhidos da OpenAI de verdade em
// 20/08/2026, com audio sintetico (nenhum dado de paciente), e ficam aqui congelados
// para a bateria nao gastar chamada nem depender de rede.
const trechosDaNuvem = [
  { inicio: 1.0, fim: 5.0, texto: 'Figado de contornos regulares e dimensões normais.' },
  { inicio: 6.0, fim: 8.0, texto: 'Rim direito sem cálculos.' },
  { inicio: 9.0, fim: 12.0, texto: 'Vesícula biliar de paredes finas.' },
];
const exNuvem = { laudo: { trechos: trechosDaNuvem, procedencia: [
  { secao: 'Fígado', citacao: 'contornos regulares e dimensões normais', imagem_n: 0 },
  { secao: 'Rim direito', citacao: 'Rim direito sem cálculos', imagem_n: 0 },
  { secao: 'Vesícula biliar', citacao: 'paredes finas', imagem_n: 0 } ] } };
[['Fígado', 0], ['Rim direito', 1], ['Vesícula biliar', 2]].forEach(function (par) {
  const pr = rev2Proc(exNuvem, par[0]);
  const tr = pr ? rev2Trecho(exNuvem, pr.citacao) : null;
  const trI = tr ? trechosDaNuvem.indexOf(tr) : -1;
  ok(trI === par[1],
     '"' + par[0] + '": a VOZ nasce e aponta o trecho certo (' + par[1] + '), vindo da nuvem');
});
ok(rev2Trecho(exNuvem, 'baço aumentado com nódulo hipoecoico') === null,
   'e a trava de 17/08 continua de pe: citacao que nao esta no ditado nao ganha botao');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
