// Reativação do esquema da mama — disponibilidade global e confirmação por laudo/lado.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c,m) => { console.log((c?'  ok   ':'  FALHA ')+m); if(!c) falhas++; };

function grab(nome){
  const i=HTML.indexOf('function '+nome+'('); if(i<0) throw new Error('não achei '+nome);
  let d=0, abriu=false;
  for(let j=i;j<HTML.length;j++){
    if(HTML[j]==='{'){d++;abriu=true;}
    else if(HTML[j]==='}' && --d===0 && abriu) return HTML.slice(i,j+1);
  }
  throw new Error('não fechou '+nome);
}

const holder={ex:null, config:true, patologia:true, renders:0, salvou:0, logs:[]};
const codigo=[
  'var MAMA_DESENHOS=true;',
  grab('mamaLadoTitulo'), grab('mamaCaixaHTML'), grab('mamaAlternar'),
  grab('mamaTituloDeSecao'), grab('mamaSecoesLocalizar'),
  grab('mamaRegistrarHoraNoCorpo'), grab('mamaInformarHora'),
  'return {mamaLadoTitulo,mamaCaixaHTML,mamaAlternar,mamaInformarHora};'
].join('\n');
const api=new Function('norm','imagensRevisaoLigadas','rev2TemAchado','mamaLesoes','esc',
  'rev2Ex','agendarSalvarSessao','rev2Render','log',codigo)(
  s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),
  ()=>holder.config, ()=>holder.patologia, L=>{
    const d=(((L||{})._classifBruto||{}).birads||[])[0];
    if(d && /às\s*\d+\s*h/i.test(d.localizacao||'')) return {plot:[{lado:'D'}],semPos:[]};
    return L._lesoes;
  },
  s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])),
  ()=>holder.ex, ()=>holder.salvou++, ()=>holder.renders++, m=>holder.logs.push(m)
);

const ex={tipo:'mama',laudo:{corpo:'**MAMA DIREITA**\n**Nódulo mamário.**\n\n**MAMA ESQUERDA**\nSem alterações.',
  _lesoes:{plot:[{lado:'D'}],semPos:[]}}};
console.log('=== disponibilidade na revisão ===');
ok(/var MAMA_DESENHOS = true/.test(HTML), 'motor da mama foi reativado');
ok(api.mamaLadoTitulo('MAMA DIREITA')==='D' && api.mamaLadoTitulo('Mama esquerda')==='E',
  'cada cartão é associado ao lado correto');
let h=api.mamaCaixaHTML(ex,{titulo:'MAMA DIREITA',texto:'**nódulo**'});
ok(/Adicionar ilustração/.test(h), 'cartão patológico oferece Adicionar ilustração');
holder.config=false;
ok(api.mamaCaixaHTML(ex,{titulo:'MAMA DIREITA',texto:'**nódulo**'})==='',
  'configuração desligada oculta a opção');
holder.config=true; holder.patologia=false;
ok(api.mamaCaixaHTML(ex,{titulo:'MAMA DIREITA',texto:'normal'})==='',
  'mama sem achado patológico não oferece desenho');
holder.patologia=true;

console.log('\n=== segurança e escolha persistida ===');
const inc={tipo:'mama',laudo:{corpo:'**MAMA DIREITA**\n**nódulo mamário.**\n\n**MAMA ESQUERDA**\nSem alterações.',
  _classifBruto:{birads:[{localizacao:'mama direita'}]},
  _lesoes:{plot:[],semPos:[{id:'L1',lado:'D',rotulo:'nódulo mamário',porque:'hora do relógio não informada'}]}}};
h=api.mamaCaixaHTML(inc,{titulo:'MAMA DIREITA',texto:'**nódulo**'});
ok(/Hora do relógio/.test(h) && /mamaInformarHora/.test(h) && /12 h/.test(h),
  'sem hora, pergunta na própria caixa em vez de inventar marcador');
holder.ex=inc;
api.mamaInformarHora('L1',9,'D');
ok(inc.laudo._mamaIlustracoes.D===true, 'a resposta inclui a ilustração sem regenerar o laudo');
ok(/mama direita, às 9 h/.test(inc.laudo.corpo), 'e registra a hora escolhida no texto da mama');
holder.ex=ex;
const salvouAntes=holder.salvou, rendersAntes=holder.renders;
api.mamaAlternar('D');
ok(ex.laudo._mamaIlustracoes.D===true, 'toque guarda a escolha no próprio laudo e no lado certo');
ok(holder.salvou===salvouAntes+1 && holder.renders===rendersAntes+1, 'escolha salva a sessão e atualiza a revisão imediatamente');
h=api.mamaCaixaHTML(ex,{titulo:'MAMA DIREITA',texto:'**nódulo**'});
ok(/Remover ilustração/.test(h), 'depois de adicionar, o mesmo botão permite remover');
api.mamaAlternar('D');
ok(ex.laudo._mamaIlustracoes.D===false, 'remoção também fica registrada');
ok(/mamaTemSelecao\(L\)/.test(HTML) && /mamaCorpoHTML\(L\)/.test(HTML),
  'a montagem final ancora o esquema no corpo somente quando o laudo tem uma escolha');
ok(/_mamaIlustracoes:_mamaImgAntes\|\|undefined/.test(HTML),
  'a escolha de ilustrar sobrevive se o mesmo laudo for regenerado');
ok(/_mamaLayout:_mamaLayoutAntes\|\|undefined/.test(HTML),
  'posição e cadeado também sobrevivem se o laudo for regenerado');

console.log('\n=== modelos personalizados e âncoras futuras ===');
const ancApi=new Function('norm',[
  grab('modeloMamaParece'),grab('modeloMamaAncorasLocais'),grab('modeloMamaAncoraExata'),
  'return {modeloMamaParece,modeloMamaAncorasLocais,modeloMamaAncoraExata};'
].join('\n'))(s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
const corpoModelo='INTRODUÇÃO\n\n**MAMA DIREITA**\nTexto D.\n\n**MAMA ESQUERDA**\nTexto E.';
const am=ancApi.modeloMamaAncorasLocais(corpoModelo);
ok(am.D==='**MAMA DIREITA**' && am.E==='**MAMA ESQUERDA**',
  'a leitura local reconhece as duas âncoras clássicas sem trocar os lados');
ok(/async function modeloMamaMapear/.test(HTML) && /mapear seções do modelo de mama/.test(HTML),
  'ao salvar modelo de mama editado, a IA lê e marca as caixas direita e esquerda');
ok(/await modeloMamaMapear\(m,MODELOS\[chave\]\)/.test(HTML) &&
   /await modeloMamaMapear\(novo\[_ch\],MODELOS\[_ch\]\)/.test(HTML),
  'a marcação vale nos dois editores de modelos');
ok(/\.laudoMamaLayoutControles/.test(HTML) && /querySelectorAll\('\.laudoMamaLayoutControles'\)/.test(HTML),
  'cadeado aparece na revisão, mas é removido do arquivo entregue');

if(falhas){ console.error('\n'+falhas+' FALHA(S)'); process.exit(1); }
console.log('\nTudo certo.');
