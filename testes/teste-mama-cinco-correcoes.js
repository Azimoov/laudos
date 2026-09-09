// AS CINCO CORRECOES PEDIDAS PELO MEDICO EM 24/08/2026, depois de o esquema finalmente
// aparecer. Cada bloco guarda UMA delas, com o motivo.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'material', 'laudo-mama-real.json'), 'utf8'));
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

console.log('=== 1. formatacao: nenhum bloco VAZIO no meio do laudo ===');
// Sem exame anterior, mamaEvolucaoHTML devolve ''; com a secao da paciente desligada,
// pacienteFolhaHTML tambem. Antes os dois viravam blocos ocos no documento.
const abrir = grab('abrirRevisao');
ok(/_evo\?'<div class="mamaEvoBox"/.test(abrir), 'o bloco de evolucao so sai se tiver conteudo');
const folhaPaciente = grab('pacienteFolhaHTML');
ok(/if\(!miolo\) return '';/.test(folhaPaciente)
   && /_folhaPaciente\+_folhaAbre/.test(abrir),
   'a folha da paciente so existe quando tem conteudo e vem antes do laudo tecnico');
const esquemaFn = grab('mamaEsquemaHTML');
ok(/display:block;margin:20px 0 16px/.test(esquemaFn),
   'o espaco em volta do desenho vive num lugar so (CSS do bloco), nao em <br> soltos');

console.log('\n=== 2. o rotulo da mama nao escreve por cima do "6" ===');
const frontal = grab('_mamaFrontal');
ok(/y="219"/.test(frontal), 'o titulo desceu para y=219');
ok(/viewBox="0 0 210 226" width="210" height="226"/.test(frontal),
   'e a folha do desenho cresceu para caber (210 -> 226) — nao foi so empurrar');
ok(!/y="203"/.test(frontal), 'a posicao antiga, que colidia com o numero das 6 h, saiu');

console.log('\n=== 3. a distancia ditada e LIDA (o achado casa com a frase certa) ===');
// "distando 5 cm da papila" estava escrito no laudo e saia como "nao informada": o achado
// era casado com o CABECALHO da mama ("**MAMA ESQUERDA** / DESCRICAO: / Mama simetrica."),
// que nao fala dele. Agora a busca e pela HORA, dentro da secao daquela mama.
const fraseFn = grab('_mamaFraseDo');
ok(fraseFn.indexOf('var _reH=new RegExp') >= 0, 'ha a busca de reserva pela hora');
// indexOf, nao regex: a fonte tem barras invertidas ("MAMA\\s+") e escapa-las duas vezes
// numa regex de teste e um jeito facil de reprovar codigo certo.
ok(fraseFn.indexOf("MAMA\\\\s+'+_lado") >= 0 && fraseFn.indexOf("MAMA\\\\s+'+_outro") >= 0,
   'e ela fica presa a secao do lado — a hora de uma mama nao casa com a frase da outra');
ok(fraseFn.indexOf('_reH') < fraseFn.indexOf('var chave='),
   'a busca pela hora vem ANTES da busca antiga, que fica so como reserva');

console.log('\n=== 4. a legenda nao repete o que ja disse ===');
// A legenda comeca "Mama direita, 9h" e depois repetia o rotulo da IA, "mama direita, as
// 9 horas". Agora tira-se do rotulo o lado e a hora; so o que sobrar aparece.
// indexOf pelo mesmo motivo do bloco 3: a fonte e uma regex, e escapar regex dentro de
// regex reprova codigo certo.
ok(esquemaFn.indexOf("replace(/mama\\s+(direita|esquerda)/ig,'')") >= 0,
   'o lado e removido do rotulo antes de mostra-lo');
// 24/08, 2a volta: a IA passou a mandar "3 horas" SEM o "as", e com a distancia junto
// ("mama esquerda, 3 horas, 5 cm da papila mamaria"). A limpeza foi ampliada.
ok(esquemaFn.indexOf("(?:[àa]s\\s*)?\\b\\d{1,2}\\s*(?:h\\b|horas?\\b)") >= 0,
   'e a hora tambem, COM ou SEM o "as" na frente');
ok(esquemaFn.indexOf("papila|mamilo") >= 0,
   'e a distancia da papila, que a IA passou a repetir dentro do rotulo');
ok(/_rot\?\(' — '\+esc\(_rot\)\):''/.test(esquemaFn),
   'e o rotulo so aparece se sobrar alguma informacao nova');

console.log('\n=== 5. UMA categoria por EXAME, a mais alta — nao uma por lesao ===');
const consts = (HTML.match(/const BIRADS_GRAVIDADE = \{[^}]*\};/) || [''])[0];
const api = new Function(consts + '\n' + grab('biradsDoExame') + '\nreturn {biradsDoExame};')();
[[['2','3'],'3'], [['2','4A'],'4A'], [['4A','4C','3'],'4C'], [['5','2'],'5'],
 [['1','2'],'2'], [['6','4B'],'6'], [['0'],'0'], [['0','4A'],'4A'], [[],null]
].forEach(function (c) {
  ok(api.biradsDoExame(c[0]) === c[1],
     '[' + c[0].join(',') + '] -> ' + api.biradsDoExame(c[0]) + ' (esperado ' + c[1] + ')');
});
const proc = grab('processarBirads');
ok(/cats\.push\(e\[0\]\)/.test(proc) && /cats\.push\(r\.cat\)/.test(proc),
   'cada lesao CONTRIBUI com sua categoria, em vez de escrever uma linha propria');
ok(/linhas\.push\(biradsLinhaCategoria\(catExame, ''\)\)/.test(proc),
   'e sai UMA linha de categoria, sem prefixo de lesao');
ok(!/biradsLinhaCategoria\([^,]+, \(n>1\?\(rot\+' — '\):''\)\)/.test(proc),
   'o prefixo por lesao ("mama direita, as 9 horas — Categoria:") nao existe mais');
ok(/a mais alta entre os achados/.test(proc),
   'e quando as categorias divergem, o painel de trabalho DIZ qual venceu e por que');

console.log('\n=== e o laudo real continua desenhando (nao quebrei o que funcionava) ===');
// 25/08: cisto simples passou a ser lido da propria frase do laudo
const nomes = ['mamaCmInteiro','mamaMm','mamaLocalDoTexto','_mamaFraseDo','mamaCasoEspecialDoTexto','_mamaCatDoAchado','mamaLesoes'];
const api2 = new Function(
  (HTML.match(/const MAMA_RAIO_CM = \d+;/) || [''])[0] + '\n'
  + (HTML.match(/const MAMA_DIST_INDEF_CM = [^;]+;/) || [''])[0] + '\n'
  + (HTML.match(/const BIRADS_ESPECIAIS = \{[\s\S]*?\n\};/) || [''])[0] + '\n'
  + nomes.map(grab).join('\n') + '\nreturn {mamaLesoes};')();
const r2 = api2.mamaLesoes(REAL);
ok(r2.plot.length === 2, 'os dois achados continuam plotados');
const esq = r2.plot.filter(x => x.lado === 'E')[0];
ok(esq && esq.distCm === 5 && !esq.distIgnorada,
   'e o nodulo da esquerda agora tem a distancia LIDA do laudo: ' + (esq && esq.distCm) + ' cm');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
