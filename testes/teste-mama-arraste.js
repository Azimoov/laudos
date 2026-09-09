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
const especiais = (HTML.match(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/) || [''])[0];
const api = new Function('esc', 'document', 'log', especiais + '\n' + MODULO +
  '\nreturn {mamaLesoes, mamaEsquemaHTML, _mamaFraseDo, mamaReescreverLocal, mamaLocalDoTexto,'+
  ' mamaRotuloAtualizado,mamaLocalEstruturadaAtualizar,mamaNumerarAchados};'
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

console.log('\n=== dois arrastes consecutivos no mesmo nódulo (08/09) ===');
const repetido={
  _classifBruto:{birads:[
    {localizacao:'mama direita, às 10 h, distando 3 cm da papila',forma:'oval',orientacao:'paralela'},
    {localizacao:'mama esquerda, às 4 h, distando 6 cm da papila',forma:'oval',orientacao:'paralela'}
  ]},
  _descritores:{}, dados_estruturados:{achados:[{},{}]}, corpo:CORPO
};
const primeiro=api.mamaReescreverLocal(repetido.corpo,repetido._classifBruto.birads[0].localizacao,2,7,5);
ok(primeiro.ok, 'o primeiro arraste encontra e altera a frase');
repetido.corpo=primeiro.corpo;
ok(api.mamaLocalEstruturadaAtualizar(repetido,'L1','D',7,5),
  'a primeira mudança atualiza também a localização estruturada');
ok(/às 7 h/.test(repetido._classifBruto.birads[0].localizacao)
   && /distando 5 cm/.test(repetido._classifBruto.birads[0].localizacao),
  'o BI-RADS deixa de guardar a hora e a distância antigas');
const segundo=api.mamaReescreverLocal(repetido.corpo,repetido._classifBruto.birads[0].localizacao,2,2,4);
ok(segundo.ok && /direita, às 2 h, distando 4 cm/.test(segundo.corpo),
  'o segundo arraste reencontra o mesmo nódulo e também altera o texto');
ok(/esquerda, às 4 h, distando 6 cm/.test(segundo.corpo),
  'nenhum dos dois gestos mexe no achado da outra mama');
ok(repetido._descritores['birads|0'].localizacao===repetido._classifBruto.birads[0].localizacao,
  'a posição corrigida sobreviverá a uma regeneração do laudo');

console.log('\n=== o que NÃO se faz quando não há onde escrever ===');
// A frase foi reescrita à mão e perdeu os trechos de localização. Acrescentar uma segunda
// localização no fim faria o laudo dizer duas coisas sobre o mesmo achado.
console.log('\n=== três lesões do mesmo lado conservam identidade própria ===');
const tresCorpo='**MAMA DIREITA**\n**DESCRIÇÃO:**\n'
  +'Cisto simples na mama direita, às 2 h, distando 2 cm da papila, medindo 4 mm.\n'
  +'Cisto simples na mama direita, às 6 h, distando 4 cm da papila, medindo 5 mm.\n'
  +'Cisto simples na mama direita, às 10 h, distando 6 cm da papila, medindo 6 mm.';
const tresBir=[
  {localizacao:'mama direita',forma:'oval',orientacao:'paralela'},
  {localizacao:'mama direita',forma:'oval',orientacao:'paralela'},
  {localizacao:'mama direita',forma:'oval',orientacao:'paralela'}
];
const numerado=api.mamaNumerarAchados(tresCorpo,tresBir);
ok(numerado.mudou && /Achado 1/.test(numerado.corpo) && /Achado 2/.test(numerado.corpo)
   && /Achado 3/.test(numerado.corpo),
  'o corpo recebe a mesma numeração 1, 2 e 3 usada na figura');
const move3=api.mamaReescreverLocal(numerado.corpo,'mama direita',3,8,7,'L3');
ok(move3.ok && /Achado 3[^\n]*às 8 h[^\n]*distando 7 cm/.test(move3.corpo),
  'arrastar a figura 3 altera a linha Achado 3');
ok(/Achado 1[^\n]*às 2 h[^\n]*distando 2 cm/.test(move3.corpo)
   && /Achado 2[^\n]*às 6 h[^\n]*distando 4 cm/.test(move3.corpo),
  'e as linhas 1 e 2 permanecem integralmente intactas');
const relido3=api.mamaLesoes({birads:tresBir,corpo:numerado.corpo,dados_estruturados:{}});
ok(relido3.plot.map(x=>x.hora).join(',')==='2,6,10',
  'mesmo com três rótulos estruturados idênticos, cada marcador nasce na própria linha');
const comLacuna=api.mamaLesoes({
  birads:tresBir,
  corpo:'**MAMA DIREITA**\nAchado 1 — Cisto simples sem hora informada.\n'
    +'Achado 2 — Cisto simples na mama direita, às 6 h, medindo 5 mm.\n'
    +'Achado 3 — Cisto simples na mama direita, às 10 h, medindo 6 mm.',
  dados_estruturados:{}
});
ok(comLacuna.plot.map(x=>x.n).join(',')==='2,3',
  'se o achado 1 não puder ser desenhado, os marcadores seguintes continuam 2 e 3');

console.log('\n=== antes de qualquer clique, apenas a figura tocada se move ===');
const tresLaudo={birads:tresBir,corpo:numerado.corpo,dados_estruturados:{}};
const inicial3=api.mamaEsquemaHTML(tresLaudo);
const movendo2=api.mamaEsquemaHTML(tresLaudo,{id:'L2',hora:9,distCm:7});
const marca=(html,id) => (new RegExp('<ellipse data-lesao="'+id+'"[^>]+>')).exec(html)?.[0] || '';
ok(marca(inicial3,'L1')===marca(movendo2,'L1'),
  'durante o primeiro arraste da figura 2, a figura 1 não se move');
ok(marca(inicial3,'L3')===marca(movendo2,'L3'),
  'durante o primeiro arraste da figura 2, a figura 3 não se move');
ok(marca(inicial3,'L2')!==marca(movendo2,'L2'),
  'e somente a figura 2 acompanha o gesto, sem exigir clique prévio em cada marcador');

console.log('\n=== o símbolo sempre corresponde ao tipo da lesão ===');
const htmlCistos=api.mamaEsquemaHTML(tresLaudo);
ok((htmlCistos.match(/data-tipo-marcador="cisto-simples"/g)||[]).length===6,
  'os três cistos simples são vazados/pontilhados nas duas vistas, mesmo com distância informada');
ok(!/data-tipo-marcador="cisto-simples"[^>]*fill="#6A4FB6"/.test(htmlCistos),
  'nenhum cisto simples é convertido em círculo sólido');
const mistoCorpo='**MAMA DIREITA**\n**DESCRIÇÃO:**\n'
  +'Achado 1 — Cisto simples na mama direita, às 2 h, distando 2 cm da papila, medindo 4 mm.\n'
  +'Achado 2 — Nódulo de margens circunscritas na mama direita, às 6 h, distando 4 cm da papila, medindo 5 mm.\n'
  +'Achado 3 — Nódulo de margens espiculadas na mama direita, às 10 h, distando 6 cm da papila, medindo 6 mm.';
const mistoBir=[
  {localizacao:'mama direita',caso_especial:'cistoSimples'},
  {localizacao:'mama direita',forma:'oval',orientacao:'paralela',margem:'circ'},
  {localizacao:'mama direita',forma:'oval',orientacao:'paralela',margem:'espiculada'}
];
const htmlMisto=api.mamaEsquemaHTML({birads:mistoBir,corpo:mistoCorpo,dados_estruturados:{}});
ok(/<ellipse data-lesao="L1" data-tipo-marcador="cisto-simples"[^>]*fill="none"[^>]*stroke-dasharray/.test(htmlMisto),
  'cisto simples = círculo vazado de linha pontilhada');
ok(/<ellipse data-lesao="L2" data-tipo-marcador="nodulo-regular"[^>]*fill="#6A4FB6"/.test(htmlMisto),
  'nódulo de margem regular = contorno regular preenchido');
ok(/<polygon data-lesao="L3" data-tipo-marcador="nodulo-irregular"[^>]*fill="#6A4FB6"/.test(htmlMisto),
  'nódulo de margem irregular = contorno irregular preenchido');

console.log('\n=== sequência longa de arrastes não perde nem trava marcador ===');
const longa={
  _classifBruto:{birads:tresBir.map(x=>({...x}))},
  _descritores:{},dados_estruturados:{achados:[{},{},{}]},corpo:numerado.corpo
};
let longaOk=true;
for(let gesto=0;gesto<36;gesto++){
  const idx=gesto%3, id='L'+(idx+1), d=longa._classifBruto.birads[idx];
  const hora=((gesto*5+idx)%12)+1, dist=((gesto*3+idx)%7)+1;
  const rr=api.mamaReescreverLocal(longa.corpo,d.localizacao,3,hora,dist,id);
  if(!rr.ok){ longaOk=false; break; }
  longa.corpo=rr.corpo;
  if(!api.mamaLocalEstruturadaAtualizar(longa,id,'D',hora,dist)){ longaOk=false; break; }
  const lido=api.mamaLesoes(longa).plot.find(x=>x.id===id);
  if(!lido||lido.hora!==hora||lido.distCm!==dist){ longaOk=false; break; }
}
ok(longaOk,'36 arrastes alternados entre três figuras foram aceitos e relidos corretamente');
ok((longa.corpo.match(/Achado [123] —/g)||[]).length===3,
  'após a sequência continuam existindo exatamente três vínculos, sem duplicação');
const semDistCorpo='**MAMA DIREITA**\n**DESCRIÇÃO:**\n'
  +'• Cisto simples na mama direita, às 2 h, medindo 4 mm.\n'
  +'• Cisto simples na mama direita, às 6 h, medindo 5 mm.\n'
  +'• Cisto simples na mama direita, às 10 h, medindo 6 mm.';
const semDistNumerado=api.mamaNumerarAchados(semDistCorpo,tresBir);
ok(semDistNumerado.mudou && (semDistNumerado.corpo.match(/Achado [123] —/g)||[]).length===3,
  'cistos simples sem distância da papila também recebem três vínculos independentes');

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
// 24/08/2026 — O ENCAIXE MUDOU DE LUGAR; a intencao e a mesma. Antes ele acontecia a CADA
// movimento do dedo (dentro de `mover`), e o marcador pulava de hora em hora: o medico
// descreveu como "foram rapidamente para uma posicao pre-definida e travaram la". Agora o
// desenho segue o dedo em valor fracionario e o arredondamento acontece UMA vez, ao soltar
// — que e o momento em que o valor vai para o laudo. O papel continua recebendo hora
// inteira e centimetro inteiro.
const mover = HTML.slice(HTML.indexOf('var mover=function(ev){'), HTML.indexOf('var soltar=function(){'));
const soltarBloco = HTML.slice(HTML.indexOf('var soltar=function(){'), HTML.indexOf("caixa.addEventListener('mousedown'"));
ok(!/Math\.round\(/.test(mover),
   'durante o arraste NADA e arredondado — o desenho acompanha o dedo');
ok(/hora FRACION/.test(mover), 'e o codigo diz que a hora ali e fracionaria de proposito');
ok(/a\.hora=Math\.round\(a\.hora\)%12/.test(soltarBloco),
   'ao SOLTAR, a hora e arredondada para inteiro');
ok(/if\(a\.hora===0\) a\.hora=12/.test(soltarBloco),
   'e 0h vira 12h, que e como o relogio se escreve');
ok(/a\.distCm=Math\.max\(0,Math\.round\(a\.distCm\)\)/.test(soltarBloco)
   && /a\.profMm=Math\.max\(0,Math\.round\(a\.profMm\)\)/.test(soltarBloco),
   'distancia e profundidade tambem arredondam ao soltar');
ok(soltarBloco.indexOf('Math.round(a.hora)') < soltarBloco.indexOf('mamaReescreverLocal'),
   'e tudo isso ANTES de escrever no laudo — nenhuma casa decimal chega ao papel');

console.log('\n=== o ciclo, lido no código ===');
const soltar = HTML.slice(HTML.indexOf('var soltar=function(){'), HTML.indexOf('caixa.addEventListener(\'mousedown\''));
ok(/mamaReescreverLocal/.test(soltar), 'ao soltar, o texto do laudo é reescrito');
ok(soltar.indexOf('if(!r.ok)') < soltar.indexOf('ex.laudo.corpo=r.corpo'),
   'e a recusa é tratada ANTES de gravar — nunca se grava um resultado que falhou');
ok(/log\(/.test(soltar) && /voltou\s*\n?\s*\+?'?ao lugar anterior|ao lugar anterior/.test(soltar),
   'a recusa avisa o médico e devolve o desenho ao lugar antigo');
ok(/abrirRevisao\(ex\.id, true\)/.test(soltar), 'e o sucesso redesenha texto E esquema juntos');
ok(soltar.indexOf('mamaLocalEstruturadaAtualizar') < soltar.indexOf('abrirRevisao(ex.id, true)'),
  'o dado estruturado é atualizado antes de redesenhar e permitir o próximo gesto');
ok(/revMarcarEditado/.test(soltar), 'marcando o laudo como editado, como qualquer outra edição');
ok(/touchstart/.test(HTML) && /touchmove/.test(HTML), 'funciona no toque, não só no mouse');
ok(/cursor:grab/.test(HTML), 'e o marcador mostra que é arrastável');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
