// Esquema anatômico da tireoide — duas vistas junto ao texto do lobo/istmo.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const ini = HTML.indexOf('/* ============ ESQUEMA ANATÔMICO DA TIREOIDE');
const fim = HTML.indexOf('/* ============ ESQUEMA ANATÔMICO DA MAMA', ini);
if (ini < 0 || fim < 0) throw new Error('não achei o módulo da tireoide');
const MOD = HTML.slice(ini, fim);
const holder={ex:null,logs:[]};
const api = new Function('esc','negrito','imagensRevisaoLigadas','rev2TemAchado','rev2Ex','log','agendarSalvarSessao','rev2Render',
  MOD + '\nreturn {TIREOIDE_ARQS,tireoideEstrutura,tireoideNivel,tireoideTransversal,'+
  'tireoideProfundidade,tireoideLesoes,tireoideXY,tireoideLateralEspelhada,tireoideXEspelho,tireoideEsquemaHTML,tireoideCorpoHTML,'+
  'tireoideCaixaHTML,tireoidePerguntaHTML,tireoideRegistrarLocalNoCorpo,tireoideInformarLocal,'+
  'tireoideReporSrcNoHistorico,tireoideSubstituirLocal,tireoideSnap};')(
  s => String(s == null ? '' : s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])),
  s => String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>'),
  () => true, () => true, () => holder.ex, m => holder.logs.push(m), () => {}, () => {}
);

function L(tirads, escolhas){
  return {_classifBruto:{tirads:tirads||[]}, _tireoideIlustracoes:escolhas||{}, _descritores:{},
    corpo:'**Lobo direito**\nTexto do lobo direito.\n\n**Lobo esquerdo**\nTexto do lobo esquerdo.\n\n**Istmo:**\nEspessura normal.\n\n**Volume total da glândula: 10 cm³.**'};
}
const completa={localizacao:'lobo direito, terço médio, porção lateral, plano posterior',
  estrutura:'lobo-direito',nivel:'medio',transversal:'lateral',profundidade:'posterior',tamanho_cm:1.4};

console.log('=== contrato com a IA e leitura sem inferência ===');
['localizacao','estrutura','nivel','transversal','profundidade'].forEach(c =>
  ok(HTML.includes('\\"'+c+'\\":\\"\\"'), 'JSON da tireoide pede '+c));
let les = api.tireoideLesoes(L([completa]));
ok(les.length === 1 && les[0].completa, 'localização completa fica pronta para desenhar');
let inc = api.tireoideLesoes(L([{localizacao:'nódulo no lobo direito, terço médio'}]))[0];
ok(!inc.completa && inc.estrutura === 'lobo-direito' && inc.nivel === 'medio',
  'localização parcial conserva o que foi dito e não completa o resto');
ok(inc.profundidade === '', '"terço médio" não é confundido com profundidade central');
ok(api.tireoideEstrutura('ISTMO') === 'istmo', 'reconhece istmo');
ok(api.tireoideNivel('junção dos terços médio e inferior') === 'juncao-medio-inferior', 'reconhece junção');

console.log('\n=== duas vistas e os arquivos anatômicos aprovados ===');
let desenho = api.tireoideEsquemaHTML(L([completa]), 'lobo-direito');
ok((desenho.match(/laudoTireoideFigura/g)||[]).length === 2, 'gera exatamente duas vistas');
ok(desenho.includes(api.TIREOIDE_ARQS.anterior), 'primeira vista usa a tireoide anterior');
ok(desenho.includes(api.TIREOIDE_ARQS.lobo), 'lobo usa a lateral única compartilhada');
ok(!desenho.includes(api.TIREOIDE_ARQS.istmo), 'lobo não usa o corte do istmo');
const ist={localizacao:'istmo, terço médio, central, plano anterior',estrutura:'istmo',nivel:'medio',transversal:'central',profundidade:'anterior'};
let desIst=api.tireoideEsquemaHTML(L([ist]), 'istmo');
ok(desIst.includes(api.TIREOIDE_ARQS.istmo), 'istmo usa sua própria vista lateral corrigida');
ok(/Representação esquemática, sem escala anatômica real/.test(desIst), 'leva a ressalva clínica');
for (const arq of Object.values(api.TIREOIDE_ARQS)) {
  const p=path.join(__dirname,'..',arq), png=fs.existsSync(p)?fs.readFileSync(p):null;
  ok(!!png, path.basename(arq)+' existe no repositório');
  ok(!!png && png.readUInt32BE(16)===1024 && png.readUInt32BE(20)===1536, path.basename(arq)+' mantém a tela 1024 × 1536');
  ok(!!png && png[25]===6, path.basename(arq)+' é RGBA, com canal transparente real');
}

console.log('\n=== posição, tamanho e paginação ===');
ok(api.tireoideXY(les[0],'anterior')[0] < 50, 'lobo direito do paciente fica à esquerda na vista anterior');
ok(/width:.*tamanho_cm|tamanho_cm\*7/.test(MOD), 'diâmetro do marcador cresce com a medida');
const antDir={...completa,profundidade:'anterior'}, posDir={...completa,profundidade:'posterior'};
ok(api.tireoideXY(antDir,'lateral')[0] > api.tireoideXY(posDir,'lateral')[0],
  'na vista lateral original, anterior fica a direita e posterior a esquerda');
ok(api.tireoideSnap({...completa},'lateral',54,51).profundidade === 'anterior',
  'arrastar para a frente registra plano anterior');
ok(api.tireoideSnap({...completa},'lateral',30,51).profundidade === 'posterior',
  'arrastar para tras registra plano posterior');
const antEsq={...completa,estrutura:'lobo-esquerdo',profundidade:'anterior'};
const xOriginal=api.tireoideXY(antEsq,'lateral')[0];
const xExibido=api.tireoideXEspelho(antEsq.estrutura,'lateral',xOriginal);
ok(xExibido === 100-xOriginal && api.tireoideXEspelho(antEsq.estrutura,'lateral',xExibido) === xOriginal,
  'lobo esquerdo espelha a imagem e converte o arraste de volta para a anatomia correta');
let desenhoEsq=api.tireoideEsquemaHTML(L([antEsq]), 'lobo-esquerdo');
ok(/laudoTireoideImg espelhada/.test(desenhoEsq) && /VISTA LATERAL DO LOBO ESQUERDO/.test(desenhoEsq),
  'vista lateral do lobo esquerdo e identificada e espelhada');
ok(!/laudoTireoideImg espelhada/.test(desenho), 'vista lateral do lobo direito nao e espelhada');
let laudo=L([completa],{'lobo-direito':true});
let corpo=api.tireoideCorpoHTML(laudo);
ok(corpo.indexOf('Texto do lobo direito.') < corpo.indexOf('laudoTireoideEsq'), 'imagem entra abaixo do texto do lobo afetado');
ok(corpo.indexOf('laudoTireoideEsq') < corpo.indexOf('Lobo esquerdo'), 'e antes do lobo seguinte');
ok(/laudoTireoideSecao/.test(corpo), 'texto e imagens ficam numa unidade indivisível do paginador');
ok(!/laudoTireoideEsq/.test(api.tireoideCorpoHTML(L([completa],{}))), 'sem confirmação, não acrescenta imagem');

console.log('\n=== botão, segurança e persistência ===');
let cx=api.tireoideCaixaHTML({tipo:'tireoide',laudo:L([completa])},{titulo:'Lobo direito',texto:'**nódulo**'});
ok(/Adicionar ilustração/.test(cx), 'cartão patológico oferece o botão');
let cxInc=api.tireoideCaixaHTML({tipo:'tireoide',laudo:L([{localizacao:'lobo direito, terço médio'}])},{titulo:'Lobo direito',texto:'**nódulo**'});
ok(/complete a localização/.test(cxInc) && /Posição transversal/.test(cxInc) && /Profundidade/.test(cxInc),
  'posição incompleta pergunta na própria caixa exatamente o que falta');
ok(/tireoideInformarLocal/.test(cxInc) && /Médio/.test(cxInc) && /Anterior/.test(cxInc),
  'as respostas são botões utilizáveis, sem precisar regenerar o laudo');
let lr=L([{localizacao:'lobo direito',estrutura:'lobo-direito',nivel:'medio',transversal:'lateral',profundidade:'posterior'}]);
let lrLes=api.tireoideLesoes(lr)[0];
ok(api.tireoideRegistrarLocalNoCorpo(lr,lrLes) && /Localização do nódulo: lobo direito, terço médio, porção lateral, plano posterior/.test(lr.corpo),
  'a localização informada também é registrada no texto do lobo');
holder.ex={tipo:'tireoide',laudo:L([{localizacao:'lobo direito',estrutura:'lobo-direito'}])};
api.tireoideInformarLocal(0,'nivel','medio','lobo-direito');
api.tireoideInformarLocal(0,'transversal','lateral','lobo-direito');
ok(!holder.ex.laudo._tireoideIlustracoes['lobo-direito'], 'antes da última resposta a imagem ainda não entra');
api.tireoideInformarLocal(0,'profundidade','posterior','lobo-direito');
ok(holder.ex.laudo._tireoideIlustracoes['lobo-direito']===true,
  'a última resposta adiciona a ilustração automaticamente');
ok(/Localização do nódulo: lobo direito, terço médio, porção lateral, plano posterior/.test(holder.ex.laudo.corpo),
  'o fluxo interativo atualiza o corpo do laudo sem regenerá-lo');
let emb='<img class="laudoTireoideImg" data-tireoide-src="'+api.TIREOIDE_ARQS.anterior+'" src="data:image/png;base64,AAAA">';
let leve=api.tireoideReporSrcNoHistorico(emb);
ok(!leve.includes('base64') && leve.includes(api.TIREOIDE_ARQS.anterior), 'histórico troca base64 pelo arquivo local');
let tro=api.tireoideSubstituirLocal('Nódulo no lobo direito, terço médio, porção lateral, plano posterior.', completa.localizacao, 'lobo direito, terço inferior, porção medial, plano anterior');
ok(tro.ok && /terço inferior/.test(tro.corpo), 'arraste só confirma se conseguir atualizar a frase do laudo');
ok(!api.tireoideSubstituirLocal('texto sem localização','outra frase','nova').ok, 'sem casamento seguro, a alteração é recusada');
ok(/await tireoideImagensCarregar\(\)/.test(HTML) && /tireoideAplicarDataImgs/.test(HTML), 'salvar e imprimir esperam os PNGs serem embutidos');
ok(/tireoideReporSrcNoHistorico\(html\)/.test(HTML), 'histórico não guarda megabytes repetidos');

console.log('\n=== configuração ===');
ok(/id="cfgImagensRevisao"/.test(HTML) && /grev2imagens/.test(HTML), 'opção permanente existe nas Configurações');

if (falhas) { console.error('\n'+falhas+' FALHA(S)'); process.exit(1); }
console.log('\nTudo certo — '+(process.version)+'.');
