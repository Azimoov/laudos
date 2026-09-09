// O ESQUEMA DA MAMA NAO DESENHAVA — 24/08/2026, defeito visto em atendimento.
//
// Dois defeitos empilhados, e o segundo escondia o primeiro:
//
//  1. O LEITOR DA DISTANCIA so entendia o verbo: /dist(ando|a)\s*N cm/. A redacao natural
//     — "as 9 h, A 4 CM DA PAPILA" — nao casava, entao a distancia vinha NULA mesmo escrita
//     no laudo, com todas as letras.
//  2. O DESENHO exigia lado + hora + distancia. Faltando a distancia, o achado ia para a
//     lista de "sem posicao" e o esquema saia sem desenho nenhum.
//
// Junto: em cisto simples (onde ele costuma ditar so a hora) o desenho quase nunca aparecia,
// e quando ele DITAVA a distancia tambem nao aparecia, porque a frase nao era entendida.
//
// A regra que fica: desenha-se o que se sabe; o que falta e DITO, nunca inventado. Sem a
// distancia o marcador vai no raio medio e a legenda diz que a distancia nao foi
// informada — o `distCm` continua nulo no dado. O estilo do marcador continua pertencendo
// ao TIPO da lesao: cisto simples vazado/pontilhado; nodulo preenchido.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
const consts = (HTML.match(/const MAMA_RAIO_CM = \d+;/) || [''])[0]
             + '\n' + (HTML.match(/const MAMA_DIST_INDEF_CM = [^;]+;/) || [''])[0]
             + '\n' + (HTML.match(/const MAMA_Y_PELE\s*=\s*[^;]+;/) || [''])[0]
             + '\n' + (HTML.match(/const MAMA_PX_MM\s*=\s*[^;]+;/) || [''])[0];
const api = new Function(consts + '\n' + grab('mamaCmInteiro') + '\n' + grab('mamaMm') + '\n'
  + grab('mamaLocalDoTexto') + '\n' + grab('_mamaXY')
  + '\nreturn {mamaLocalDoTexto, _mamaXY, MAMA_DIST_INDEF_CM, MAMA_RAIO_CM};')();

console.log('=== a distancia agora e lida em TODAS as formas de ditar ===');
[
  ['às 3 h, a 4 cm da papila',                        4, 'a forma natural (era esta que falhava)'],
  ['às 3 h, distando 4 cm da papila',                 4, 'com o verbo "distando" (a unica que funcionava)'],
  ['às 3 h, dista 4 cm da papila',                    4, '"dista"'],
  ['às 3 h, distante 4 cm da papila',                 4, '"distante"'],
  ['às 3 h, a 40 mm do mamilo',                       4, 'em milimetro, e "mamilo" no lugar de papila'],
  ['às 3 h, a 4,0 cm do complexo aréolo-papilar',     4, 'complexo areolo-papilar'],
  ['às 3 h, retroareolar',                            0, 'retroareolar continua valendo 0'],
].forEach(function (c) {
  const l = api.mamaLocalDoTexto('mama direita, ' + c[0]);
  ok(l.distCm === c[1], c[2] + ' → ' + l.distCm + ' cm');
});

console.log('\n=== e a PELE nunca vira distancia da papila ===');
// Sem a ancora em papila/mamilo, "a 1,5 cm da pele" viraria distancia radial e poria a
// lesao no lugar errado do desenho. Pele e PROFUNDIDADE, lida noutro campo.
const pele = api.mamaLocalDoTexto('mama direita, às 3 h, a 1,5 cm da pele');
ok(pele.distCm === null, 'a distancia da papila continua nula');
ok(pele.profMm === 15, 'e o 1,5 cm foi para a profundidade (15 mm)');

console.log('\n=== sem distancia, o achado AINDA e desenhado ===');
const lesoes = grab('mamaLesoes');
ok(/var temPos = item\.lado && item\.hora!=null;/.test(lesoes),
   'basta lado + hora para entrar no desenho (antes exigia a distancia tambem)');
ok(/if\(item\.distCm==null && temPos\) item\.distIgnorada=true;/.test(lesoes),
   'e o achado fica marcado como "distancia nao informada"');
ok(/!item\.lado\?'lado não identificado':'hora do relógio não informada'/.test(lesoes),
   'sem lado ou sem hora continua FORA do desenho — ai nao ha o que desenhar');

console.log('\n=== o que falta e DITO, nao inventado ===');
ok(/const MAMA_DIST_INDEF_CM = MAMA_RAIO_CM\/2;/.test(HTML),
   'ha um raio de pouso para o marcador sem distancia');
ok(api._mamaXY(3, null, 100, 100, 80)[0] > 100,
   'e o marcador pousa na hora certa mesmo com distancia nula (3h = a direita)');
const frontal = grab('_mamaFrontal');
ok(/var _cisto=L\.marcador==='cisto-simples'/.test(frontal)
   && /_cisto[\s\S]{0,420}stroke-dasharray="3 2"/.test(frontal),
   'vazado e tracejado depende de ser CISTO SIMPLES, nao de faltar distancia');
const esquema = grab('mamaEsquemaHTML');
ok(/L2\.distIgnorada \? '<i>distância da papila não informada<\/i>'/.test(esquema),
   'e a legenda DIZ que nao foi informada, em vez de mostrar um numero');
// 24/08, 3a volta: a distancia passou a ser arredondada NA EXIBICAO (durante o arraste ela
// e fracionaria, e a legenda mostrava "a 4.128374 cm"). O valor sai por _dTxt.
ok(/a '\+_dTxt\+' cm da papila'/.test(esquema),
   'quando a distancia existe, ela continua escrita normalmente (via _dTxt, arredondada)');

console.log('\n=== a vista lateral tambem aguenta a falta ===');
const lateral = grab('_mamaLateral');
ok(/var _d=\(L\.distCm==null\)\?MAMA_DIST_INDEF_CM:L\.distCm;/.test(lateral),
   'o eixo papila→periferia usa o raio de pouso quando nao ha distancia');
ok(/var _cisto=L\.marcador==='cisto-simples'/.test(lateral)
   && /_cisto[\s\S]{0,900}stroke-dasharray="3 2"/.test(lateral),
   'e a vista lateral preserva a mesma semantica do tipo da lesao');

// ===================== A SEGUNDA CAUSA, achada no dado REAL =====================
// O primeiro conserto (desenhar sem a distancia) NAO bastou: o esquema continuou vazio.
// Reproduzindo com o laudo de verdade do banco, apareceu a causa de baixo:
//
// A IA devolve cada achado com `localizacao` — "mama direita, as 9 horas" — e o app casa
// esse achado com uma FRASE do corpo, para pegar medida e profundidade. Nesse laudo o
// casamento pegou a frase ERRADA: o cabecalho "**MAMA DIREITA** / DESCRICAO: / Mama
// simetrica.", que nao tem hora nenhuma. Como a frase veio preenchida (embora inutil), o
// `frase||rotulo` nunca caia no rotulo, a hora ficava NULA, e o achado saia do desenho por
// "hora do relogio nao informada" — com a hora escrita no proprio rotulo.
//
// Conserto: o rotulo PREENCHE O QUE FALTA na frase. Nunca sobrescreve — onde a frase tem
// valor, ele vale (e ali que estao medida e profundidade); onde ela esta muda, o rotulo
// responde. As duas coisas vieram da IA sobre o MESMO achado, entao nada e inventado.
console.log('\n=== o rotulo preenche o que a frase nao tem (caso real de 24/08) ===');
const lesoesFn = grab('mamaLesoes');
ok(/if\(rotulo && frase\)\{/.test(lesoesFn),
   'ha o preenchimento a partir do rotulo quando existe frase');
ok(/if\(\(loc\[k\]==null \|\| loc\[k\]===''\) && locRot\[k\]!=null/.test(lesoesFn),
   'e ele SO preenche o que esta vazio — nunca sobrescreve o que a frase disse');
ok(/\['lado','hora','distCm','profMm'\]/.test(lesoesFn),
   'cobrindo lado, hora, distancia e profundidade');
ok(/\(!loc\.mm \|\| !loc\.mm\.length\) && locRot\.mm/.test(lesoesFn),
   'e as medidas tambem, quando a frase nao trouxe nenhuma');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
