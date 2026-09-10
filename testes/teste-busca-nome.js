// A BUSCA DE PACIENTE POR NOME, POR SEMELHANCA (10/09/2026)
//
// Palavras dele: "Ta faltando uma barra de busca por nome do paciente. Ela pode ser geral,
// para buscar tanto na lista de trabalho como no historico, como nos exames realizados no
// dia. Eu quero que ela seja uma lista que funcione por INFERENCIA. Entao, se eu escrevo
// Joana Silva, vai aparecer uma paciente chamada Joana Silva em primeiro lugar, mas, se
// tiver uma outra que chama Joana Pereira da Silva, ela vai aparecer tambem abaixo, sempre
// classificando os primeiros da lista como os mais similares ao nome escrito. Mas SEM
// EXCLUIR nomes que nao sejam exatamente iguais."
//
// O que este teste tranca, e por que:
//  - O EXEMPLO DELE, ao pe da letra. "Joana Silva" e "Joana Pereira da Silva" nesta ordem,
//    as duas na lista. E o pedido em uma frase; se um dia isso inverter, inverteu o pedido.
//  - NAO E FILTRO. Nome parecido nao pode sumir. Filtro responde "dentro ou fora" e joga
//    fora o que nao bate -- e e assim que a paciente cujo nome ele escreveu com uma letra
//    diferente some da tela como se nao existisse.
//  - A busca le de UMA fonte so (repoItens), que ja junta as tres: aparelho, sessao de hoje
//    e indice do historico. Duas fontes seriam duas buscas, e ele teria de adivinhar em
//    qual procurar.
//  - A barra e a MESMA peca nas duas telas. Duas copias divergem no primeiro conserto
//    feito so de um lado.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m, extra) => {
  console.log((c ? '  ok   ' : '  FALHA ') + m + (extra ? '  [' + extra + ']' : ''));
  if (!c) falhas++;
};
function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) return '';
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  return '';
}
function corpoDa(id) {
  const i = HTML.indexOf('<div id="' + id + '"');
  if (i < 0) return '';
  const j = HTML.indexOf('\n<div id="tela', i + 5);
  const k = HTML.indexOf('\n<!-- =======================', i + 5);
  const fim = Math.min(j < 0 ? HTML.length : j, k < 0 ? HTML.length : k);
  return HTML.slice(i, fim);
}

// O motor da nota, recortado do programa e posto para rodar na bancada. Nada de reescrever
// a regra aqui: uma copia da regra passaria mesmo depois de o programa mudar de ideia.
const motor = new Function(
  grab('norm') + '\n' + grab('buscaDist') + '\n' + grab('buscaPalavra') + '\n'
  + grab('buscaPontos') + '\n' + grab('buscaOrdenar') + '\n'
  + 'var BUSCA_TETO=50;\n'
  + 'return {norm:norm, pontos:buscaPontos, ordenar:buscaOrdenar};'
)();
const nota = (termo, nome) => motor.pontos(motor.norm(termo), motor.norm(nome));
// A ordenacao pede itens no formato da lista; aqui so o que ela olha.
const ordenar = (termo, nomes) =>
  motor.ordenar(nomes.map((n, i) => ({ paciente: n, ordem: String(1000 - i) })), termo)
    .map(r => r.it.paciente);

console.log('=== 1. o exemplo dele, ao pe da letra ===');
{
  const r = ordenar('Joana Silva', [
    'Joana Pereira da Silva', 'Joana Silva', 'Joana Souza', 'Carlos Silva', 'Marcos Antunes',
  ]);
  ok(r[0] === 'Joana Silva', 'quem tem o nome exato vem em PRIMEIRO', r.join(' > '));
  ok(r.indexOf('Joana Pereira da Silva') === 1,
     'e "Joana Pereira da Silva" aparece TAMBEM, logo abaixo', 'posicao ' + (r.indexOf('Joana Pereira da Silva') + 1));
  ok(r.indexOf('Joana Souza') > r.indexOf('Joana Pereira da Silva'),
     'quem so tem uma das duas palavras fica atras de quem tem as duas');
  ok(r.indexOf('Marcos Antunes') < 0, 'e quem nao tem relacao nenhuma nao entra na lista');
}

console.log('\n=== 2. NAO e filtro: nome parecido nao some ===');
ok(nota('Joana Silva', 'Joana Pereira da Silva') > 0,
   'nome que nao e igual continua tendo nota', 'nota ' + nota('Joana Silva', 'Joana Pereira da Silva'));
ok(nota('Silva', 'Joana Pereira da Silva') > 0, 'so o sobrenome tambem acha');
ok(nota('joana', 'JOANA SILVA') > 0, 'maiuscula nao separa');
ok(nota('João', 'Joao Pedro') > 0, 'acento nao separa');
ok(nota('sil', 'Joana Silva') > 0, 'meia palavra acha o comeco da palavra inteira');

console.log('\n=== 3. o nome escrito de ouvido (que aqui e a regra, nao a excecao) ===');
ok(nota('Rejane Brito', 'Regiane Brito') > 0, 'Rejane acha Regiane (uma letra)');
ok(nota('Ana Sousa', 'Ana Souza') > 0, 'Sousa acha Souza');
ok(nota('Rejane', 'Regiane') > 0, 'e sozinho tambem');
ok(nota('Cristina', 'Marcelo') === 0,
   'mas nome INTEIRAMENTE diferente nao vira parecido — senao a lista viraria ruido');

console.log('\n=== 4. o desempate que ele descreveu: menos palavra sobrando ganha ===');
{
  const a = nota('Joana Silva', 'Joana Silva');
  const b = nota('Joana Silva', 'Joana Pereira da Silva');
  const c = nota('Joana Silva', 'Joana Cristina Pereira Ramos da Silva');
  ok(a > b && b > c, 'quanto mais nome sobrando, mais para baixo', a + ' > ' + b + ' > ' + c);
}

console.log('\n=== 5. le de UMA fonte, que ja junta as tres ===');
const pintar = grab('buscaPintar');
ok(/repoItens\(\)/.test(pintar), 'a busca le de repoItens()');
const itens = grab('repoItens');
ok(/_repo\.estudos/.test(itens), '  que traz os exames do aparelho');
ok(/exames\.forEach/.test(itens), '  os desta sessao (os de hoje)');
ok(/_repo\.historico/.test(itens), '  e o indice do historico');
ok(/repoCarimbar\(repoItens\(\), pref\+'b_'\)/.test(pintar),
   'e carimba as etiquetas com o lugar — o resultado da busca e mais uma copia na pagina');

console.log('\n=== 6. a MESMA barra nas duas telas ===');
ok(/<div id="trabBusca">/.test(corpoDa('telaTrabalho')), 'ha lugar para ela na tela de Trabalho');
ok(/<div id="diaBusca">/.test(corpoDa('telaDia')), 'e no painel do dia');
ok(/buscaMontar\('trab'\)/.test(grab('trabAbrir')), 'a tela de Trabalho monta a barra ao abrir');
ok(/buscaMontar\('dia'\)/.test(grab('diaAbrir')), 'e o painel do dia tambem');
const montar = grab('buscaMontar');
ok(/pref\+'BuscaCampo/.test(montar) && /pref\+'BuscaRes/.test(montar),
   'e as duas saem da MESMA peca, so mudando o prefixo');

console.log('\n=== 7. o que a tela faz enquanto ele digita ===');
ok(/clearTimeout\(_buscaEspera\[pref\]\)/.test(grab('buscaDigitou')),
   'espera ele parar de digitar (senao a tela treme a cada letra)');
ok(/if\(buscaTermo\(pref\)!==termo\) return;/.test(pintar),
   'e nao escreve resultado velho por cima de uma pergunta que ele ja mudou');
ok(/listas\.style\.display='none'/.test(pintar) && /listas\.style\.display=''/.test(pintar),
   'buscando, as listas do dia saem da frente; limpando, voltam');
ok(/Nenhum nome se parece com/.test(pintar),
   'e busca sem resultado DIZ isso, em vez de deixar a tela em branco');
ok(/r\.it\.tipo=\(r\.it\.tipo\|\|''\)\+\(r\.it\.dia\?' · '\+r\.it\.dia:''\)/.test(pintar),
   'cada resultado mostra a data — fora da lista por dia, o cartao nao diria de quando e');
ok(/repoLinhaHtml\(r\.it\)/.test(pintar),
   'e o resultado usa o MESMO cartao das listas, com os quatro sinais e os botoes');

console.log('\n=== 8. o teto, para a lista nao virar rolagem infinita ===');
ok(/BUSCA_TETO/.test(pintar), 'ha um teto de resultados na tela');
ok(/Mostrando os '\+mostrar\.length\+' primeiros/.test(pintar),
   'e quando o teto corta, a tela DIZ que cortou — cortar em silencio esconde paciente');

console.log(falhas ? '\n  ' + falhas + ' FALHA(S)' : '\n  tudo certo');
process.exit(falhas ? 1 : 0);
