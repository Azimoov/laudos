// "0 ANOS" NAO E IDADE, E DATA DE NASCIMENTO FALTANDO — 24/08/2026.
//
// ACONTECEU EM ATENDIMENTO, e e o pior tipo de defeito: silencioso e clinicamente errado.
// O paciente foi cadastrado no aparelho SEM data de nascimento; a idade chegou como zero;
// o programa comparou as medidas de um ADULTO com a tabela do RECEM-NASCIDO — a faixa mais
// estreita que existe. Referencia pediatrica em adulto, num laudo assinado, sem aviso.
//
// A REGRA QUE SEPARA UM DO OUTRO: recem-nascido de verdade NUNCA e relatado em "anos". Ele
// vem em dias, semanas ou meses ("003D", "2 meses") — e ali o zero e MEDIDO, entao continua
// valendo. O que passa a ser recusado e o zero escrito em ANOS ("0", "0 anos", "000Y"): nao
// existe paciente de zero anos redondos, existe cadastro sem nascimento.
//
// E a segunda camada: sem idade, o programa DIZ que nao conferiu. Antes devolvia lista
// vazia — e ausencia silenciosa e indistinguivel de "conferi e esta tudo bem".
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
const api = new Function(grab('idadeEmAnos') + '\nreturn {idadeEmAnos};')();

console.log('=== zero em ANOS = idade desconhecida (o defeito de 24/08) ===');
['0', '0 anos', '0 ano', '000Y', '0Y', '0 a', '00'].forEach(function (t) {
  ok(api.idadeEmAnos(t) === null, JSON.stringify(t) + ' -> null (nao vale como idade)');
});

console.log('\n=== mas o RECEM-NASCIDO de verdade continua valendo ===');
// Aqui o zero e medido, nao e ausencia — e a tabela pediatrica tem de continuar agindo.
ok(api.idadeEmAnos('003D') === 0, '3 dias -> 0 anos (tabela do recem-nascido vale)');
ok(api.idadeEmAnos('2 dias') === 0, '"2 dias" -> 0');
ok(api.idadeEmAnos('001W') === 0, '1 semana -> 0');
ok(api.idadeEmAnos('3 semanas') === 0, '"3 semanas" -> 0');
ok(Math.abs(api.idadeEmAnos('2 meses') - 2 / 12) < 1e-9, '2 meses -> 0,1666 ano');
ok(Math.abs(api.idadeEmAnos('011M') - 11 / 12) < 1e-9, '11 meses -> 0,9166 ano');

console.log('\n=== e as idades normais nao mudaram ===');
ok(api.idadeEmAnos('1 ano') === 1, '1 ano');
ok(api.idadeEmAnos('7 anos') === 7, '7 anos');
ok(api.idadeEmAnos('48 anos') === 48, '48 anos');
ok(api.idadeEmAnos('048Y') === 48, 'tag 048Y');
ok(api.idadeEmAnos('') === null, 'vazio continua null');
ok(api.idadeEmAnos('sei la') === null, 'texto sem numero continua null');
ok(Math.abs(api.idadeEmAnos('4 anos e 6 meses') - 4.5) < 1e-9, '"4 anos e 6 meses"');

console.log('\n=== sem idade, o programa DIZ que nao conferiu ===');
const alertas = grab('alertasReferencia');
ok(/if\(anos==null\)\{/.test(alertas),
   'ha um ramo proprio para "idade desconhecida" (antes so devolvia lista vazia)');
ok(/Medidas NÃO conferidas contra a referência/.test(alertas),
   'e ele avisa, em vez de calar — calar e indistinguivel de "esta tudo bem"');
ok(/falta a data de nascimento no cadastro do aparelho/.test(alertas),
   'dizendo a CAUSA, que e o que o medico pode corrigir');
ok(/if\(!_temMedida\.length\) return \[\]/.test(alertas),
   'mas so acende quando ha medida no laudo — sem medida o aviso viraria ruido');

console.log('\n=== a ordem das fontes de idade nao mudou ===');
// Nascimento (com casas decimais) primeiro; depois a idade do agente; depois a que a IA
// leu do cabecalho da imagem. So muda o que cada uma DEVOLVE quando o valor e zero-anos.
ok(/var anos=idadePrecisaAnos\(L\.nascPac, L\.dataExame\);/.test(alertas),
   'a data de nascimento continua sendo a primeira fonte');
ok(alertas.indexOf('idadePrecisaAnos') < alertas.indexOf('idadeEmAnos(L.idadePac)'),
   'e vem antes da idade em anos inteiros do agente');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
