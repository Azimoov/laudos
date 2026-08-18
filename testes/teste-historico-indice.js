// Busca do exame anterior: o app procura por um INDICE leve (17/08/2026).
//
// Antes o programa baixava o historico INTEIRO ao abrir - com o desenho pronto de
// cada laudo junto. Medido nesta maquina em 17/08: 317 laudos = 3,6 MB, dos quais
// 96% era desenho que a busca nem olha. Agora o agente serve o indice sem o campo
// 'html' (442 caracteres por laudo) e o desenho de UM laudo e buscado so quando
// ele entra de fato na comparacao.
//
// A TRAVA QUE IMPORTA: a regra de QUEM e o mesmo paciente NAO pode migrar para o
// agente. Regra copiada diverge, e identidade de paciente e o pior lugar para
// divergir - um homonimo comparado com o exame errado e dano clinico.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const AGENTE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'laudos-programa', 'agente', 'agente-laudos.py'), 'utf8');

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

console.log('=== o app procura pelo indice, nao pelo historico inteiro ===');
const busca = grab('histParaBusca');
ok(/\/historico\/indice/.test(busca), 'histParaBusca pede /historico/indice');
ok(/\/dados\/glaudos/.test(busca), 'e cai no caminho antigo se o agente for velho (sem a rota)');
ok(/lerHistorico\(\)/.test(busca), 'sem agente nenhum, ainda usa a copia do navegador');

console.log('=== o desenho do laudo vem sob demanda ===');
const texto = grab('histTextoAnterior');
ok(/\/historico\/laudo\?id=/.test(texto), 'busca o desenho de UM laudo, pelo id');
ok(/if\(reg\.html\)/.test(texto), 'laudo que ja tem o desenho em maos nao gera pedido novo');
ok(/_histHtml\[id\]/.test(texto), 'o que ja veio fica guardado (nao repete o pedido)');
ok(/await histTextoAnterior\(L,/.test(HTML), 'a geracao do laudo usa o caminho sob demanda');
ok(!/textoDoLaudoAnterior\(L, Math\.floor/.test(HTML),
   'e nao usa mais o caminho antigo, que exigia o desenho carregado');

console.log('=== o agente serve o indice SEM o desenho ===');
ok(/def historico_indice\(\)/.test(AGENTE), 'o agente tem a rota do indice');
ok(/k != "html"/.test(AGENTE), 'e ele TIRA o campo html de cada laudo');
ok(/def historico_laudo\(ident\)/.test(AGENTE), 'e sabe devolver o desenho de um laudo pelo id');
ok(/"\/historico\/indice"/.test(AGENTE) && /"\/historico\/laudo"/.test(AGENTE),
   'as duas rotas estao ligadas no atendimento de pedidos');

console.log('=== a regra de identidade do paciente NAO migrou para o agente ===');
// se um dia alguem mover isto para o Python, este teste cai - de proposito
ok(/function examesAnterioresDoPaciente/.test(HTML), 'a decisao continua no app');
ok(!/levenshtein|simNome|mesmoPaciente/i.test(AGENTE),
   'o agente NAO tem copia da comparacao de nomes (regra copiada diverge)');
ok(!/def examesAnteriores/i.test(AGENTE), 'nem da escolha do exame anterior');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
