// BUSCAR EXAME NO APARELHO — o caminho que existia no código e não existia na tela.
// 21/08/2026.
//
// As funções dicom* estavam escritas desde 89f935e, mas o botão que as chamava saiu em
// 07/08 (a57725c), quando o médico pediu para enxugar a aba "Arquivos acumulados". Ficaram
// órfãs: função escrita, container removido, nenhum caminho até elas. Ele tentou puxar um
// exame antigo do Orthanc e não achou por onde — porque não havia.
//
// Esta suíte existe para a ponta solta não voltar: função sem gatilho é função que ninguém
// descobre que quebrou.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

console.log('=== o caminho existe de ponta a ponta ===');
ok(/onclick="dicomBuscar\(\)"/.test(HTML), 'há um botão que chama dicomBuscar()');
ok(/id="dicomLista"/.test(HTML), 'e o lugar onde a lista é desenhada existe');
ok(/id="dicomInfo"/.test(HTML), 'e o lugar do aviso também');
// A regra geral, que é o que evita o defeito de origem: toda função dicom* precisa de um
// caminho até ela, e todo id que o código escreve precisa existir no HTML.
['dicomLista', 'dicomInfo'].forEach(id => {
  ok(new RegExp('getElementById\\(.' + id + '.\\)').test(HTML),
     'o código escreve em #' + id + '…');
  ok(new RegExp('id="' + id + '"').test(HTML), '   …e o #' + id + ' está no HTML');
});
ok(/onclick="dicomImportar\(\)"/.test(HTML), 'o botão de importar também tem quem o chame');

console.log('\n=== a lista diz QUAL exame é cada linha ===');
// Pedido do médico (21/08): a lista mostrava nome, idade, data e nº de imagens — tudo
// menos o que decide a escolha. Com 277 estudos e o mesmo paciente três vezes no mesmo
// dia, não havia como saber qual linha era a mama.
const api = new Function(
  HTML.slice(HTML.indexOf('const DICOM_REGIAO'), HTML.indexOf('function dicomRender')) +
  '\nreturn {dicomRegiao, DICOM_REGIAO};')();
// as descrições REAIS do Orthanc dele, conferidas na listagem de 21/08
[['BREAST', 'Mama'], ['GYN', 'Ginecológico'], ['URO', 'Urológico'], ['SMP', 'Partes moles'],
 ['OB', 'Obstétrico'], ['ABD', 'Abdome'], ['Nerve Blocks', 'Bloqueio de nervo']].forEach(([cod, nome]) =>
  ok(api.dicomRegiao(cod) === nome, cod + ' -> ' + nome));
ok(api.dicomRegiao('breast') === 'Mama', 'não depende de maiúscula');
ok(api.dicomRegiao('XPTO') === 'XPTO',
   'código desconhecido sai CRU — melhor "XPTO" do que nada, e melhor que eu adivinhar');
ok(api.dicomRegiao('') === '' && api.dicomRegiao(null) === '', 'sem descrição, sem etiqueta');
const render = HTML.slice(HTML.indexOf('function dicomRender'), HTML.indexOf('function dicomMarcarTodos'));
ok(/dicomRegiao\(e\.descricao\)/.test(render), 'a lista usa a região de cada estudo');
ok(render.indexOf('dicomRegiao(e.descricao)') < render.indexOf('anos · '),
   'e ela vem logo depois do nome, antes de idade e data — é por ela que se escolhe');

console.log('\n=== ele está na tela CERTA ===');
// Foi removido da aba "Arquivos acumulados" a pedido do médico. Voltou na tela de exames
// antigos, que nasceu depois e é onde puxar exame do aparelho pertence.
const tela = HTML.slice(HTML.indexOf('<div id="telaAntigos">'), HTML.indexOf('id="antMic"'));
ok(/dicomBuscar\(\)/.test(tela), 'o botão vive dentro da tela de exames antigos');
ok(tela.indexOf('id="antImgs"') < tela.indexOf('dicomBuscar()'),
   'logo abaixo de escolher arquivo, que é a outra forma de trazer imagem');

console.log('\n=== e o material importado CHEGA no gerador ===');
const antGerar = HTML.slice(HTML.indexOf('async function antGerar()'), HTML.indexOf('function antAplicarEscolhas'));
ok(/await processar\(\)/.test(antGerar), 'a tela chama processar()');
ok(/!dicomProntos\.length/.test(antGerar),
   'e o que veio do aparelho conta como material — sem isto, importar e tocar em Gerar '
   + 'respondia "escolha ao menos as imagens" a quem acabara de escolhê-las');
const proc = HTML.slice(HTML.indexOf('async function processar()'), HTML.indexOf('// 2. transcrever áudios'));
ok(/for\(let i=0;i<dicomProntos\.length;i\+\+\)/.test(proc), 'processar() transforma cada importado em exame');
ok(/_dicom:true/.test(proc), 'marcando que veio do aparelho');
ok(/nascPac:d\.nascimento/.test(proc) && /sexoPac:d\.sexo/.test(proc),
   'com nascimento e sexo vindos das tags DICOM, sem custo de leitura de legenda');

console.log('\n=== a lista de importados é ESVAZIADA depois de virar exame ===');
// Nunca era. Importar um segundo exame reprocessaria o primeiro junto, e o médico veria um
// laudo repetido sem entender de onde veio. Só apareceu quando o botão voltou e o caminho
// pôde ser percorrido duas vezes seguidas.
ok(/dicomProntos=\[\];/.test(proc), 'dicomProntos é zerado dentro de processar()');
ok(proc.indexOf('exames.push({id:0, nomeArquivo:\'\', paciente:d.paciente') < proc.indexOf('dicomProntos=[];'),
   'e só DEPOIS de os exames terem sido criados — zerar antes perderia o material');
ok(/dicomRender\(\)/.test(proc), 'e a lista na tela é redesenhada, para não mostrar o que já foi consumido');

console.log('\n=== a mensagem não aponta para botão que não existe ===');
// Ela dizia "toque em Processar", botão da aba antiga. Mandar o médico para um botão
// inexistente é a mesma armadilha do caminho que não existia.
// Sem os comentários: a única ocorrência restante de "toque em Processar" é o comentário
// que EXPLICA a troca. É a terceira vez nesta semana que uma asserção minha bate no próprio
// comentário — teste que lê prosa em vez de comportamento erra dos dois lados.
const semComentario = HTML.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
ok(!/toque em Processar/.test(semComentario), 'a frase antiga saiu do código');
ok(/Gerar laudo/.test(HTML.slice(HTML.indexOf('function dicomImportar'), HTML.indexOf('function dicomImportar') + 2600)),
   'e a nova aponta para o botão que está na tela');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
