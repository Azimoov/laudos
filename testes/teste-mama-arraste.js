// ARRASTE DO MARCADOR DO ESQUEMA — §8 da especificação 03 (21/08/2026).
//
// Mover o marcador reescreve a FRASE do laudo. O risco que esta suíte persegue não é o
// desenho ficar torto: é ARRASTAR UM NÓDULO E REESCREVER A FRASE DE OUTRO. Por isso a
// busca da frase é uma função só (_mamaFraseDo), usada pelo desenho para LER e pelo
// arraste para ESCREVER — se as duas divergissem, o erro seria silencioso e clínico.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const MODULO = (function () {
  const i = HTML.indexOf('/* ============ ESQUEMA ANATÔMICO DA MAMA ============');
  const f = HTML.indexOf('/* ============ Categoria BI-RADS por extenso', i);
  if (i < 0 || f < 0) throw new Error('não achei o módulo do esquema');
  return HTML.slice(i, f);
})();
const api = new Function('esc', 'document', 'log', MODULO +
  '\nreturn {mamaLesoes, mamaEsquemaHTML, _mamaFraseDo, mamaReescreverLocal, mamaLocalDoTexto};'
)(s => String(s == null ? '' : s), { getElementById: () => null, addEventListener: () => {} }, () => {});

const A = 'Notou-se nódulo na mama direita, às 10 h, distando 3 cm da papila, medindo 12 x 8 mm.';
const B = 'Notou-se nódulo na mama esquerda, às 4 h, distando 6 cm da papila, medindo 9 x 7 mm.';
const CORPO = A + ' ' + B;

console.log('=== a frase é achada, e é a frase CERTA ===');
const fD = api._mamaFraseDo(CORPO, 'mama direita', 2);
const fE = api._mamaFraseDo(CORPO, 'mama esquerda', 2);
ok(fD.ini >= 0 && /direita/.test(fD.texto), 'a frase da direita é localizada');
ok(fE.ini >= 0 && /esquerda/.test(fE.texto), 'a da esquerda também');
ok(!/esquerda/.test(fD.texto) && !/direita/.test(fE.texto), 'e uma não invade a outra');
ok(api._mamaFraseDo(CORPO, 'inexistente', 2).ini < 0,
   'rótulo que não está no texto NÃO cai no corpo inteiro quando há 2 achados');
ok(api._mamaFraseDo(A, 'inexistente', 1).ini === 0,
   'mas com UM achado só, o corpo inteiro vale — não há a quem confundir');

console.log('\n=== arrastar um achado não mexe no outro ===');
const r1 = api.mamaReescreverLocal(CORPO, 'mama direita', 2, 7, 5);
ok(r1.ok, 'a reescrita acontece');
ok(/direita, às 7 h, distando 5 cm/.test(r1.corpo), 'a frase da DIREITA passou a 7h e 5 cm');
ok(/esquerda, às 4 h, distando 6 cm/.test(r1.corpo), 'e a da ESQUERDA ficou intacta');
ok(/medindo 12 x 8 mm/.test(r1.corpo) && /medindo 9 x 7 mm/.test(r1.corpo),
   'as medidas de ambos continuam onde estavam — o arraste move posição, não tamanho');
ok(r1.corpo.length - CORPO.length <= 1, 'e nada foi acrescentado ao texto além do número');

console.log('\n=== e o desenho relê o que o arraste escreveu ===');
const depois = api.mamaLesoes({ birads: [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' },
                                          { localizacao: 'mama esquerda', forma: 'oval', orientacao: 'paralela' }],
                                corpo: r1.corpo, dados_estruturados: {} });
const dD = depois.plot.filter(x => x.lado === 'D')[0];
const dE = depois.plot.filter(x => x.lado === 'E')[0];
ok(dD && dD.hora === 7 && dD.distCm === 5, 'o desenho lê 7h e 5 cm na direita — o ciclo fecha');
ok(dE && dE.hora === 4 && dE.distCm === 6, 'e continua lendo 4h e 6 cm na esquerda');

console.log('\n=== o que NÃO se faz quando não há onde escrever ===');
// A frase foi reescrita à mão e perdeu os trechos de localização. Acrescentar uma segunda
// localização no fim faria o laudo dizer duas coisas sobre o mesmo achado.
const solto = 'Notou-se nódulo na mama direita, no quadrante superior externo, medindo 12 x 8 mm.';
const r2 = api.mamaReescreverLocal(solto, 'mama direita', 1, 7, 5);
ok(r2.ok === false, 'sem os trechos "às ..h" e "distando ..cm", a reescrita RECUSA');
ok(r2.corpo === solto, 'e o texto volta exatamente como estava — nada acrescentado');
const r3 = api.mamaReescreverLocal(CORPO, 'inexistente', 2, 7, 5);
ok(r3.ok === false && r3.corpo === CORPO, 'rótulo não localizado também não escreve nada');

console.log('\n=== a unidade não se perde na reescrita ===');
const emCm = 'Notou-se nódulo na mama direita, às 10 h, distando 30 mm da papila, medindo 12 x 8 mm.';
const r4 = api.mamaReescreverLocal(emCm, 'mama direita', 1, 10, 4);
ok(/distando 4 cm da papila/.test(r4.corpo),
   'distância escrita em mm no texto é reescrita em CM inteiro, como o ACR manda');
ok(/medindo 12 x 8 mm/.test(r4.corpo), 'e a medida da lesão continua em mm');

console.log('\n=== o desenho provisório do arraste ===');
const laudo2 = { birads: [{ localizacao: 'mama direita', forma: 'oval', orientacao: 'paralela' }],
                 corpo: A, dados_estruturados: {} };
const parado = api.mamaEsquemaHTML(laudo2);
const arrastando = api.mamaEsquemaHTML(laudo2, { id: 'L1', hora: 2, distCm: 7 });
ok(parado !== arrastando, 'o desenho acompanha a posição provisória');
ok(/2h, a 7 cm da papila/.test(arrastando), 'e a legenda mostra a posição nova durante o arraste');
ok(/10h, a 3 cm da papila/.test(parado), 'enquanto o texto do laudo ainda diz a antiga');
ok(/10h, a 3 cm da papila/.test(api.mamaEsquemaHTML(laudo2)),
   'o arraste NÃO altera o laudo enquanto o dedo não solta');

console.log('\n=== encaixe: hora e centímetro inteiros (§8.2) ===');
// O manual ACR não prevê meia-hora nem fração de centímetro. Arraste livre produziria um
// laudo mais "preciso" do que o padrão permite — precisão inventada é pior que ausente.
const mover = HTML.slice(HTML.indexOf('var mover=function(ev){'), HTML.indexOf('var soltar=function(){'));
ok(/Math\.round\(\(\(ang%360\)\+360\)%360\/30\)/.test(mover), 'a hora é arredondada para inteiro');
ok(/if\(h===0\) h=12/.test(mover), 'e 0h vira 12h, que é como o relógio se escreve');
ok((mover.match(/Math\.round\(/g) || []).length >= 3, 'distância e profundidade também arredondam');
ok(!/toFixed\(1\)/.test(mover), 'nenhuma casa decimal escapa para o laudo');

console.log('\n=== o ciclo, lido no código ===');
const soltar = HTML.slice(HTML.indexOf('var soltar=function(){'), HTML.indexOf('caixa.addEventListener(\'mousedown\''));
ok(/mamaReescreverLocal/.test(soltar), 'ao soltar, o texto do laudo é reescrito');
ok(soltar.indexOf('if(!r.ok)') < soltar.indexOf('ex.laudo.corpo=r.corpo'),
   'e a recusa é tratada ANTES de gravar — nunca se grava um resultado que falhou');
ok(/log\(/.test(soltar) && /voltou\s*\n?\s*\+?'?ao lugar anterior|ao lugar anterior/.test(soltar),
   'a recusa avisa o médico e devolve o desenho ao lugar antigo');
ok(/abrirRevisao\(ex\.id, true\)/.test(soltar), 'e o sucesso redesenha texto E esquema juntos');
ok(/revMarcarEditado/.test(soltar), 'marcando o laudo como editado, como qualquer outra edição');
ok(/touchstart/.test(HTML) && /touchmove/.test(HTML), 'funciona no toque, não só no mouse');
ok(/cursor:grab/.test(HTML), 'e o marcador mostra que é arrastável');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
