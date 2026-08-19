// Doppler arterial de MMII: o modelo novo (19/08/2026) e a regra da velocidade ausente.
//   velocidade PREENCHIDA  -> fica no texto, e conta na caixa VERDE (calculo)
//   velocidade AUSENTE     -> a oracao some do texto, e acende a caixa VERMELHA (faltando),
//                             dizendo QUAL arteria ficou sem numero
// Decisao do medico: laudo de UM membro so, nunca os dois no mesmo laudo.
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const DADOS = fs.readFileSync(path.join(RAIZ, 'dados.js'), 'utf8');

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

const RE = (HTML.match(/const RE_VEL_VAZIA = [^\n]+/) || [])[0];
const EXD = (HTML.match(/const EX_DOPPLER_ART = [^\n]+/) || [])[0];
const app = new Function(RE + '\n' + EXD + '\n' + grab('processarDopplerArterial')
  + '\n return {processarDopplerArterial, EX_DOPPLER_ART};')();
const { processarDopplerArterial, EX_DOPPLER_ART } = app;

const MODELOS = new Function(DADOS + '\n;return MODELOS;')();
const BIZUS = new Function(DADOS + '\n;return BIZUS;')();
const MOD = MODELOS.doppler_arterial_mmii;

console.log('=== o modelo existe e esta bem formado ===');
ok(!!MOD, 'o modelo doppler_arterial_mmii existe em dados.js');
ok(MOD.nome === 'Doppler arterial - membro inferior', 'nome do menu');
ok(/MEMBRO INFERIOR \.\.\.\.\./.test(MOD.titulo), 'o titulo pede o LADO nos pontilhados');
ok(!/DIREIT|ESQUERD/i.test(MOD.corpo), 'o corpo NAO fixa lado nenhum — quem preenche e o ditado');
ok(!/MEMBRO INFERIOR DIREITO[\s\S]*MEMBRO INFERIOR ESQUERDO/i.test(MOD.corpo),
   'o corpo NAO traz os dois membros (decisao do medico: um laudo por membro)');
['femoral comum', 'femoral profunda', 'femoral superficial', 'poplítea',
 'tibial anterior', 'tibial posterior', 'fibular'].forEach(function (seg) {
  ok(MOD.corpo.indexOf(seg) >= 0, 'o corpo cobre a arteria ' + seg);
});
ok((MOD.corpo.match(/velocidade de pico sist[óo]lico de \.{5} cm\/s/g) || []).length === 7,
   'os SETE segmentos pedem velocidade de pico sistolico');
ok(/dentro dos padrões da normalidade/.test(MOD.conclusao), 'conclusao de exame normal');
ok(/Doppler pulsado/.test(MOD.tecnica), 'a tecnica cita a analise espectral (nao e so modo B)');

console.log('=== velocidade AUSENTE: some do texto e vira aviso ===');
let r = processarDopplerArterial(MOD.corpo);
ok(r.semVel.length === 7, 'os sete segmentos entram na lista de sem velocidade');
ok(!/\.{3,}\s*cm\/s/.test(r.corpo), 'nao sobra NENHUM pontilhado de velocidade no corpo');
ok(!/velocidade de pico sistólico/i.test(r.corpo), 'a oracao da velocidade sumiu por completo');
ok((r.corpo.match(/padrão espectral trifásico e velocidades normais/g) || []).length === 7,
   'os sete viraram a redacao sem numero, que e como o medico escreve quando nao mede');
ok(r.faltando.length === 1 && /Não encontrei a velocidade/.test(r.faltando[0]),
   'sai UM aviso de dados faltando, nao sete');
ok(/Artéria femoral comum/.test(r.faltando[0]) && /Artéria fibular/.test(r.faltando[0]),
   'o aviso nomeia as arterias que ficaram sem numero');
ok(/confira se a medida existe nas imagens/.test(r.faltando[0]),
   'o aviso diz o que fazer, nao so que faltou');
ok(r.comVel === 0 && r.obs.length === 0, 'sem velocidade nenhuma, nao ha o que registrar na caixa verde');
ok(!/ {2,}/.test(r.corpo), 'a troca nao deixou espaco duplo');
ok(r.corpo.split('\n').length === MOD.corpo.split('\n').length, 'nao criou nem perdeu linha');

console.log('=== velocidade PREENCHIDA: fica no texto ===');
const cheio = MOD.corpo.replace(/de \.{5} cm\/s/g, 'de 92 cm/s');
r = processarDopplerArterial(cheio);
ok(r.semVel.length === 0 && r.faltando.length === 0, 'com tudo preenchido, nada em falta');
ok(r.comVel === 7, 'conta os sete segmentos medidos');
ok(/Velocidade de pico sistólico registrada em 7 segmentos/.test(r.obs[0]),
   'o que foi medido acende a caixa VERDE');
ok((r.corpo.match(/de 92 cm\/s/g) || []).length === 7, 'os numeros continuam intactos no texto');
ok(!/velocidades normais/.test(r.corpo), 'nao troca frase que tinha numero de verdade');

console.log('=== preenchimento PARCIAL: so o que faltou e apagado ===');
const meio = MOD.corpo.replace(/de \.{5} cm\/s/, 'de 88 cm/s');   // so o 1o
r = processarDopplerArterial(meio);
ok(r.comVel === 1, 'conta o unico segmento medido');
ok(r.semVel.length === 6, 'os outros seis entram no aviso');
ok(/de 88 cm\/s/.test(r.corpo), 'o segmento medido mantem o numero');
ok(!/Artéria femoral comum/.test(r.faltando[0]),
   'a arteria que TEM numero nao aparece na lista de faltando');
ok(r.obs.length === 1 && r.faltando.length === 1, 'as duas caixas acendem juntas, cada uma com o seu');

console.log('=== a regra nao morde onde nao deve ===');
ok(processarDopplerArterial('').corpo === '', 'corpo vazio nao quebra');
ok(processarDopplerArterial(null).faltando.length === 0, 'corpo nulo nao inventa aviso');
const semVelNenhuma = '**Artéria poplítea:**\nPérvia, de paredes regulares. Ao Doppler, padrão espectral trifásico.';
r = processarDopplerArterial(semVelNenhuma);
ok(r.semVel.length === 0 && r.faltando.length === 0,
   'texto que nunca pediu velocidade nao gera aviso (so o pontilhado intacto gera)');
const jaTrocado = processarDopplerArterial(MOD.corpo).corpo;
ok(processarDopplerArterial(jaTrocado).faltando.length === 0,
   'passar duas vezes nao acumula aviso nem reescreve de novo');

console.log('=== ligacoes no app ===');
ok(/const EX_DOPPLER_ART = \{doppler_arterial_mmii:true\}/.test(HTML), 'o tipo esta no mapa do Doppler');
ok(/TIPOS_COM_LATERALIDADE[^\n]*doppler_arterial_mmii/.test(HTML),
   'o tipo tem LADO (o audio e o titulo carregam direito/esquerdo)');
ok(/doppler_arterial_mmii:\['doppler arterial'/.test(HTML), 'os sinonimos do aparelho apontam para o modelo');
ok(/BIZUS_SECOES[^\n]*'DOPPLER ARTERIAL MMII'/.test(HTML), 'a secao de dizeres esta registrada');
ok(/doppler_arterial_mmii:\['DOPPLER ARTERIAL MMII'\]/.test(HTML), 'o tipo puxa a secao de dizeres certa');
ok(/'DOPPLER ARTERIAL MMII':'Doppler arterial \(membro inferior\)'/.test(HTML),
   'a secao tem nome legivel no editor');
ok(/EX_DOPPLER_ART\[ex\.tipo\]\s*\?\s*"DOPPLER ARTERIAL DE MEMBRO INFERIOR/.test(HTML),
   'o pedido a IA ganha as instrucoes proprias deste exame');
ok(/NUNCA descreva os dois membros no mesmo laudo/.test(HTML), 'a IA e proibida de juntar os dois membros');
ok(/DEIXE OS PONTILHADOS INTACTOS/.test(HTML),
   'a IA e mandada NAO reescrever a frase quando falta velocidade — quem apaga e o app');
ok(/NÃO calcule nem escreva porcentagem de estenose por conta própria/.test(HTML),
   'a IA e proibida de decidir o grau da estenose (conflito na literatura — e decisao do medico)');
ok(/const dp = processarDopplerArterial\(resp\.corpo\|\|mod\.corpo\)/.test(HTML),
   'a funcao e chamada na esteira do laudo');
ok(/alertas\.push\(\{tipo:'faltando', texto:dp\.faltando/.test(HTML), 'o que faltou acende a VERMELHA');
ok(/alertas\.push\(\{tipo:'calculo', texto:dp\.obs/.test(HTML), 'o que foi medido acende a VERDE');

console.log('=== dizeres das patologias ===');
const iSec = BIZUS.indexOf('DOPPLER ARTERIAL MMII:');
ok(iSec >= 0, 'a secao existe no arquivo de dizeres');
const sec = BIZUS.slice(iSec);
['Ateromatose sem repercussão hemodinâmica', 'Estenose hemodinamicamente significativa',
 'Estenose grave', 'Oclusão arterial segmentar', 'Aneurisma arterial',
 'Pseudoaneurisma pós-punção', 'Fístula arteriovenosa pós-punção'].forEach(function (t) {
  ok(sec.indexOf(t) >= 0, 'dizer presente: ' + t);
});
ok((sec.match(/CONCLUSÃO:/g) || []).length === 7, 'os sete dizeres trazem conclusao propria');
ok(/relação de velocidades de \.{5}/.test(sec),
   'as estenoses pedem a RELACAO de velocidades, nao so a velocidade solta');
ok(/segmento de referência \(artéria \.{5}\)/.test(sec),
   'o segmento de comparacao e um campo — o denominador do Gao 2018 e a poplitea, que nao serve para todo vaso');
ok(/contra \.{5} cm do segmento normal imediatamente adjacente/.test(sec),
   'o aneurisma compara com o segmento normal ao lado (nao ha limiar consensual em cm)');
ok(!/2,5|4,0|210 cm\/s|275 cm\/s/.test(sec),
   'nenhum limiar de estenose foi gravado no texto do laudo: a categoria e decisao do medico');
ok(/tardus-parvus/.test(sec), 'a estenose grave descreve a repercussao a jusante');
ok(/yin-yang/.test(sec) && /vaivém/.test(sec), 'o pseudoaneurisma traz os dois sinais que o definem');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
