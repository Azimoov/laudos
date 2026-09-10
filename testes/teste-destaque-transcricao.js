/* O destaque aponta só para faixas inequívocas e nunca transforma a fala em HTML. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
function ok(c, m){ console.log((c ? '  ok   ' : '  FALHA ') + m); if(!c) falhas++; }
function corpoDe(nome){
  let i=H.indexOf('function '+nome+'('); if(i<0) throw new Error('não achei '+nome);
  let abre=H.indexOf('{',i), d=0, asp='', esc=false;
  for(let j=abre;j<H.length;j++){
    const c=H[j];
    if(asp){ if(esc) esc=false; else if(c==='\\') esc=true; else if(c===asp) asp=''; continue; }
    if(c==='"'||c==="'"||c==='`'){ asp=c; continue; }
    if(c==='{') d++; else if(c==='}' && --d===0) return H.slice(i,j+1);
  }
  throw new Error('função incompleta '+nome);
}
const iniCodigo=H.indexOf('function rev2TokensComPosicoes');
const fimCodigo=H.indexOf('async function rev2VerTranscricao',iniCodigo);
const CODIGO=H.slice(iniCodigo,fimCodigo);
const elementos={};
function no(tipo){
  return {tipo, filhos:[], style:{}, _texto:'', appendChild(x){this.filhos.push(x);},
    set textContent(v){this._texto=String(v); if(v==='') this.filhos=[];}, get textContent(){return this._texto;}};
}
const ctx={
  norm:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),
  document:{
    getElementById:id=>elementos[id]||(elementos[id]=no(id)),
    createDocumentFragment:()=>no('fragmento'),
    createTextNode:t=>({tipo:'texto',textContent:String(t)}),
    createElement:t=>no(t)
  }
};
vm.createContext(ctx);
vm.runInContext(CODIGO,ctx);
function recorte(texto, faixa){ return texto.slice(faixa.ini,faixa.fim); }

console.log('=== índice exato vence a repetição e a correção falada ===');
let texto='cisto simples no rim direito, corrigindo: na verdade cisto simples no rim esquerdo.';
let f=ctx.rev2LocalizarEvidencias(texto,[{rotulo:'Cisto renal esquerdo',
  citacao:'cisto simples no rim esquerdo',palavra_ini:9,palavra_fim:13}]);
ok(f.length===1 && recorte(texto,f[0])==='cisto simples no rim esquerdo',
  'destaca a versão final indicada pelos índices, não a primeira ocorrência');

console.log('\n=== reserva conservadora para laudo sem índices ===');
texto='Fígado com esteatose hepática leve. Vesícula sem alterações.';
f=ctx.rev2LocalizarEvidencias(texto,[{rotulo:'Esteatose',
  citacao:'esteatose hepática leve',palavra_ini:0,palavra_fim:0}]);
ok(f.length===1 && recorte(texto,f[0])==='esteatose hepática leve',
  'citação antiga única ainda pode ser localizada');
texto='nódulo regular à direita e depois nódulo regular à esquerda';
f=ctx.rev2LocalizarEvidencias(texto,[{rotulo:'Nódulo',
  citacao:'nódulo regular',palavra_ini:0,palavra_fim:0}]);
ok(f.length===0, 'citação repetida sem índices não é adivinhada');

console.log('\n=== acompanha a versão atual do laudo ===');
let estadoBloco='normal';
ctx.rev2BlocosDaTela=()=>[{titulo:'RIM DIREITO',estado:estadoBloco}];
ctx.rev2Estado=(ex,b)=>b.estado;
ctx.rev2LadoDe=s=>/direit/i.test(String(s))?0:(/esquerd/i.test(String(s))?1:-1);
ctx.rev2Proc=()=>({origem:'voz',citacao:'cisto simples no rim direito',palavra_ini:1,palavra_fim:5});
let ex={laudo:{evidencias_patologicas:[{rotulo:'Cisto renal',secao:'RIM DIREITO',
  citacao:'cisto simples no rim direito',palavra_ini:1,palavra_fim:5}]}};
ok(ctx.rev2EvidenciasPatologicas(ex).length===0,
  'achado retirado do laudo por edição também sai do destaque');
estadoBloco='alterado';
ok(ctx.rev2EvidenciasPatologicas(ex).length===1,
  'achado que permanece patológico conserva o destaque');
ex={laudo:{procedencia:[{secao:'RIM DIREITO',origem:'voz',
  citacao:'cisto simples no rim direito',palavra_ini:1,palavra_fim:5}]}};
ok(ctx.rev2EvidenciasPatologicas(ex).length===1,
  'laudo anterior ao campo novo usa a procedência apenas se a seção é patológica');

console.log('\n=== segurança e integridade do texto ===');
texto='nódulo <img src=x onerror=alert(1)> regular';
ctx.rev2EvidenciasPatologicas=()=>[{rotulo:'Nódulo',citacao:'nódulo',palavra_ini:1,palavra_fim:1}];
ctx.rev2DesenharTranscricao(texto,{});
const alvo=elementos.rv2TranscricaoTexto;
const frag=alvo.filhos[0];
const reconstruido=frag.filhos.map(x=>x.textContent).join('');
ok(reconstruido===texto, 'o destaque preserva cada caractere da transcrição');
ok(!CODIGO.includes('innerHTML'),
  'a transcrição é desenhada apenas com textContent e text nodes');
ok(frag.filhos.some(x=>x.tipo==='mark' && x.textContent==='nódulo'),
  'a evidência vira uma marca visual sem executar o restante do texto');

console.log('\n=== contrato pedido à IA e persistência ===');
ok(H.includes("EVIDÊNCIAS PATOLÓGICAS NA TRANSCRIÇÃO (campo 'evidencias_patologicas')"),
  'o pedido exige uma faixa por achado realmente usado');
ok(H.includes('NÃO inclua normalidades, frases negadas'),
  'negações e versões corrigidas são expressamente excluídas');
ok(H.includes('evidencias_patologicas:(Array.isArray(resp.evidencias_patologicas)'),
  'as evidências ficam guardadas dentro do laudo');

console.log();
console.log(falhas ? falhas+' FALHA(S)' : 'tudo certo');
process.exit(falhas ? 1 : 0);
