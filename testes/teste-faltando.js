// F2e - as medidas que ficaram em branco no laudo.
//
// A regra: cada pontilhado do modelo e uma medida que o modelo EXIGE. A IA
// mantem o pontilhado quando o dado nao foi ditado. Entao o pontilhado que
// sobra no laudo pronto e, exatamente, o que faltou medir.
//
// O que este teste protege acima de tudo: TROCAR O MODELO NAO PODE QUEBRAR NADA.
// Modelo novo, dizeres novos, pontilhado de outro tamanho, orgao que nunca
// existiu - tudo tem que ser reconhecido sem uma linha de codigo nova.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const DADOS = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');

function grab(n) {
  let i = HTML.indexOf('async function ' + n + '(');
  if (i < 0) i = HTML.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('nao achei ' + n);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// ---- caixa de areia: so as funcoes do F2e, sem navegador ----
const blocoFALTA = (HTML.match(/const FALTA = \{[\s\S]*?\n\};/) || [])[0];
if (!blocoFALTA) { console.log('  FALHA nao achei o bloco const FALTA'); process.exit(1); }
const F = new Function(
  blocoFALTA + '\n' + grab('faltaPalavraNua') + '\n' + grab('faltaApara') + '\n'
  + grab('faltaTitulo') + '\n' + grab('faltaGrupos') + '\n' + grab('faltaTrecho') + '\n'
  + grab('medidasFaltando') + '\n' + grab('alertasFaltando') + '\n'
  + grab('alertaTipoValido') + '\n' + (HTML.match(/const ALERTAS = \[[\s\S]*?\n\];/) || [])[0]
  + '\n return {FALTA, medidasFaltando, alertasFaltando, faltaGrupos, faltaTitulo, alertaTipoValido, ALERTAS};')();
const { medidasFaltando, alertasFaltando, faltaGrupos, faltaTitulo, alertaTipoValido, ALERTAS } = F;

const MODELOS = new Function(DADOS + '\n return MODELOS;')();
const nomes = r => r.map(x => x.rotulo);
const conta = t => (String(t).match(/\.{3,}/g) || []).length;

console.log('=== laudo completo: silencio total ===');
ok(medidasFaltando({ corpo: 'Figado com 12,4 cm. Baco com 9,1 cm.', conclusao: 'Normal.' }).length === 0,
   'laudo sem nenhum pontilhado nao acusa nada');
ok(alertasFaltando({ corpo: 'Tudo medido, 12,4 cm.' }).length === 0,
   'e nao gera aviso nenhum (quadro fica apagado)');
ok(medidasFaltando(null).length === 0 && medidasFaltando(undefined).length === 0,
   'laudo inexistente nao quebra');
ok(medidasFaltando({}).length === 0, 'laudo vazio nao quebra');
ok(medidasFaltando({ conclusao: 'Volume total: ..... cm3.' }).length === 1,
   'pontilhado na CONCLUSAO tambem e visto (nao so no corpo)');
ok(medidasFaltando({ extra: 'Peso estimado: ..... g.' }).length === 1,
   'pontilhado no texto extra tambem e visto');
ok(medidasFaltando({ corpo: 'Frase normal com reticencias... e nada mais.' }).length >= 0,
   'reticencia comum nao derruba a funcao');

console.log('=== "..... x ..... x ....." e UMA medida, nao tres ===');
const dim = medidasFaltando({ corpo: '**RIM DIREITO:**\nDimensoes: ..... x ..... x ..... cm.' });
ok(dim.length === 1, 'as tres dimensoes viram um item so (' + dim.length + ')');
ok(dim[0].quantos === 3, 'e o item diz que sao 3 numeros (' + dim[0].quantos + ')');
ok(/Dimensoes/i.test(dim[0].rotulo), 'nomeado pelo que vem antes dos dois pontos: "' + dim[0].rotulo + '"');
ok(dim[0].secao === 'RIM DIREITO', 'a secao veio do titulo em negrito: "' + dim[0].secao + '"');
const doisSep = medidasFaltando({ corpo: 'Medida: ..... cm. Volume: ..... cm3.' });
ok(doisSep.length === 2, 'pontilhados separados por texto de verdade continuam DOIS itens');

console.log('=== o nome sai da propria frase ===');
const fig = medidasFaltando({ corpo: '**Figado** com dimensoes normais.\nLobo direito mede ..... cm e o esquerdo mede ..... cm. Tronco da veia porta mede ..... cm.' });
ok(fig.length === 3, 'tres medidas na linha do figado (' + fig.length + ')');
ok(/Lobo direito/i.test(fig[0].rotulo), 'a 1a e o lobo direito: "' + fig[0].rotulo + '"');
ok(/esquerdo/i.test(fig[1].rotulo), 'a 2a e o esquerdo, mesmo depois de "cm e o": "' + fig[1].rotulo + '"');
ok(/veia porta/i.test(fig[2].rotulo), 'a 3a e a veia porta: "' + fig[2].rotulo + '"');
ok(fig.every(x => x.secao === 'Figado'), 'as tres herdam a secao "Figado" da linha de cima');
ok(fig.every(x => x.rotulo && x.rotulo.trim().length > 0), 'nenhum item fica sem nome');
ok(fig.every(x => /\.{3,}/.test(x.trecho)), 'cada item mostra o trecho da frase COM o pontilhado a vista');

const bolo = medidasFaltando({ corpo: '**Baco** com dimensoes, contornos e ecogenicidade normais, medindo ..... cm.' });
ok(bolo.length === 1 && /Baco/i.test(bolo[0].rotulo),
   'quando a frase nao ajuda, o nome cai no titulo da secao: "' + bolo[0].rotulo + '"');

const negr = medidasFaltando({ corpo: '**Bexiga urinaria:** de aspecto normal.\n\n**Volume pre miccional: ..... ml**' });
ok(negr.length === 1, 'medida escrita toda em negrito e encontrada');
ok(/Volume pre miccional/i.test(negr[0].rotulo), 'e nomeada certo: "' + negr[0].rotulo + '"');
ok(negr[0].secao === 'Bexiga urinaria',
   'negrito COM pontilhado dentro nao vira titulo de secao (secao continua "' + negr[0].secao + '")');

console.log('=== O MODELO MUDOU: dizeres novos, orgao novo, pontilhado de outro tamanho ===');
// Nada disto existe nos modelos de hoje. Se passar, modelo novo nao pede codigo novo.
const modeloDeAmanha = {
  corpo: '**GLANDULA SUBMANDIBULAR DIREITA**\n'
       + 'Contornos regulares. Espessura maxima: ... mm.\n'
       + 'Eixos: ....... x ....... x ....... mm. Volume estimado: ............ cm3.\n\n'
       + '**Cadeia ganglionar cervical nivel II**\n'
       + 'Maior linfonodo mede ...... mm no menor eixo.\n',
  conclusao: 'Indice de resistencia medio de ..... (referencia ate 0,70).'
};
const amanha = medidasFaltando(modeloDeAmanha);
ok(amanha.length === 5,
   'achou os 5 lugares em branco de um modelo que nunca existiu (' + amanha.length + ')');
ok(amanha.reduce((s, x) => s + x.quantos, 0) === conta(modeloDeAmanha.corpo) + conta(modeloDeAmanha.conclusao),
   'nenhum pontilhado se perdeu e nenhum foi contado duas vezes');
ok(/Espessura maxima/i.test(amanha[0].rotulo), 'pontilhado de 3 pontos: "' + amanha[0].rotulo + '"');
ok(/Eixos/i.test(amanha[1].rotulo) && amanha[1].quantos === 3,
   'pontilhado de 7 pontos, agrupado em 3 numeros: "' + amanha[1].rotulo + '"');
ok(/Volume estimado/i.test(amanha[2].rotulo), 'pontilhado de 12 pontos: "' + amanha[2].rotulo + '"');
ok(/GLANDULA SUBMANDIBULAR/i.test(amanha[0].secao), 'orgao inventado virou secao: "' + amanha[0].secao + '"');
ok(/Cadeia ganglionar/i.test(amanha[3].secao), 'a segunda secao inventada tambem: "' + amanha[3].secao + '"');
ok(amanha.every(x => x.rotulo && x.rotulo.length > 1), 'todo item do modelo novo saiu com nome');

console.log('=== varrendo os ' + Object.keys(MODELOS).length + ' modelos REAIS do medico ===');
let totalItens = 0, totalNumeros = 0, semNome = 0, comPontilhado = 0;
for (const k of Object.keys(MODELOS)) {
  const M = MODELOS[k];
  const bruto = conta(M.corpo || '') + conta(M.conclusao || '') + conta(M.extra || '');
  const r = medidasFaltando({ corpo: M.corpo, conclusao: M.conclusao, extra: M.extra });
  const soma = r.reduce((s, x) => s + x.quantos, 0);
  if (soma !== bruto) { ok(false, 'modelo "' + k + '": contou ' + soma + ' de ' + bruto + ' pontilhados'); }
  if (bruto) comPontilhado++;
  totalItens += r.length; totalNumeros += soma;
  semNome += r.filter(x => !x.rotulo || !x.rotulo.trim()).length;
}
ok(true, comPontilhado + ' modelos exigem medida; ' + totalItens + ' campos, ' + totalNumeros + ' numeros no total');
ok(semNome === 0, 'nenhum dos ' + totalItens + ' campos ficou sem nome');
ok(totalItens > 40, 'a varredura achou bastante coisa (' + totalItens + ') - a regra nao esta muda');

console.log('=== o aviso que chega na tela ===');
const av = alertasFaltando({ corpo: '**Tireoide**\nIstmo: espessura ..... cm.' });
ok(av.length === 1, 'gera um aviso so, com tudo dentro');
ok(av[0].tipo === 'faltando', 'vai para a categoria "Dados faltando" (quadro ambar)');
ok(alertaTipoValido(av[0].tipo) === 'faltando', 'a categoria existe de verdade no painel');
ok(ALERTAS.some(a => a.k === 'faltando'), 'o painel tem o quadro "faltando"');
ok(/Istmo/i.test(av[0].texto), 'o texto do aviso diz o que faltou: nome do campo');
ok(/\.{3,}/.test(av[0].texto), 'e mostra o trecho do laudo com o pontilhado');

const av2 = alertasFaltando({ corpo: 'Dimensoes: ..... x ..... x ..... cm.\nVolume: ..... cm3.' });
ok(/2 pontilhado/.test(av2[0].texto), 'conta CAMPOS, nao numeros soltos: "' + (av2[0].texto.split('\n')[0] || '') + '"');
ok((av2[0].texto.match(/^•/gm) || []).length === 2, 'uma linha por campo em falta');
ok(/3 n[úu]meros/.test(av2[0].texto), 'e avisa quando o campo pede mais de um numero');

console.log('=== nao guarda: recalcula toda vez (aviso que mente e pior que aviso nenhum) ===');
const laudo = { corpo: 'Baco medindo ..... cm.' };
ok(medidasFaltando(laudo).length === 1, 'antes de preencher, acusa');
laudo.corpo = 'Baco medindo 9,4 cm.';
ok(medidasFaltando(laudo).length === 0, 'preencheu a medida no mesmo laudo: para de acusar na hora');
ok(alertasFaltando(laudo).length === 0, 'e o quadro ambar apaga junto');

console.log('=== a tela 3 usa isto para acender o cartao vermelho ===');
const trechoDia = (HTML.match(/function diaRenderLista\(\)[\s\S]*?\n\}/) || [''])[0];
ok(/medidasFaltando/.test(trechoDia), 'a lista do dia consulta as medidas em falta');
ok(/item'\+classe|item'\s*\+\s*classe/.test(trechoDia) && /' falta'/.test(trechoDia),
   'e poe a classe "falta" no cartao (o CSS vermelho ja existia)');
ok(/micSom\('falta'\)/.test(trechoDia), 'toca o aviso sonoro');
ok(/_diaBipou/.test(trechoDia), 'e guarda de quem ja avisou, para nao bipar a cada 5 s');
ok(/tipo==='falta'/.test(HTML) || /tipo === 'falta'/.test(HTML), 'o som "falta" tem tom proprio');
ok(/alertasDoLaudo\(L\)\.concat\(alertasFaltando\(L\)\)/.test(HTML),
   'a tela de revisao soma os avisos calculados na hora aos guardados');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
