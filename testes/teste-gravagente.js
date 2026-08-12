// Gravacao continua pelo AGENTE, com o navegador so comandando.
// O agente e um programa nativo: fechar o Chrome nao o interrompe. O que se perdia
// era a nocao de que ele estava gravando - ao reabrir, o app achava que nao havia nada.
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
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

// ---- a marca que sobrevive ao navegador fechar ----
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
  removeItem: k => { delete store[k]; }
};
const marca = new Function('localStorage',
  grab('agMarcarAtiva') + '\n' + grab('agLimparAtiva') + '\n' + grab('agAtiva')
  + '\n return {agMarcarAtiva, agLimparAtiva, agAtiva};')(localStorage);

console.log('=== a marca de "o agente esta gravando" ===');
ok(marca.agAtiva() === null, 'sem gravacao, nao ha marca');
marca.agMarcarAtiva();
ok(!!marca.agAtiva(), 'iniciar a gravacao deixa a marca');
ok(Math.abs(marca.agAtiva().desde - Date.now()) < 5000, 'a marca guarda DESDE QUANDO grava');
ok(store.gravag && JSON.parse(store.gravag).desde > 0, 'a marca vive no armazenamento, nao na memoria da aba');
marca.agLimparAtiva();
ok(marca.agAtiva() === null, 'parar a gravacao apaga a marca');
store.gravag = 'isso nao e json';
ok(marca.agAtiva() === null, 'marca corrompida nao quebra o app');
store.gravag = '{"outracoisa":1}';
ok(marca.agAtiva() === null, 'marca sem o "desde" e ignorada');

console.log('=== quem grava: o agente e o plano A ===');
const toggle = grab('capToggleRec');
ok(/var est=await capAgenteEstado\(\);\s*if\(est\)\{/.test(toggle),
   'a condicao passou a ser "o agente esta no ar", nao "o microfone dele ja esta aberto"');
ok(!/if\(capAgenteMic\)\{[\s\S]{0,120}capAgenteIniciar/.test(toggle),
   'nao depende mais do microfone ja estar aberto pelo modo de espera');
ok(toggle.indexOf('capAgenteIniciar()') < toggle.indexOf('navigator.mediaDevices.getUserMedia'),
   'o agente e tentado ANTES do microfone do navegador');
ok(/agMarcarAtiva\(\)/.test(toggle), 'ao iniciar pelo agente, deixa a marca');
ok(/agLimparAtiva\(\)/.test(toggle), 'ao parar pelo agente, apaga a marca');
ok(/O agente está no ar mas NÃO está gravando/.test(toggle),
   'se o agente falhar, o navegador assume — mas dizendo o porque');
ok(/gravacao\/prebuffer[\s\S]{0,140}ligar:true/.test(toggle) &&
   toggle.indexOf('prebuffer') < toggle.indexOf('capAgenteIniciar()'),
   'abre o microfone do agente ANTES de mandar gravar (fora do modo de espera ele fica fechado)');
ok(/for\(var tent=0; tent<3 && !chegou/.test(toggle) && /st2 && st2\.capturando/.test(toggle),
   'NAO acredita na promessa: confere que o audio esta chegando antes de dizer "pode fechar"');
ok(/if\(!chegou\)\{[\s\S]{0,300}throw new Error/.test(toggle),
   'audio nao chegando = falha declarada, nunca promessa vazia (o furo do teste de 05/08)');
ok(toggle.indexOf('agMarcarAtiva()') > toggle.indexOf('if(!chegou)'),
   'a marca de "gravando" so e deixada DEPOIS da conferencia');
ok(/if\(!capOrtWatching\)\{[\s\S]{0,160}ligar:false/.test(toggle),
   'ao parar, fecha o microfone que abriu — sem derrubar o modo de espera se ele estiver ligado');
ok(/Agente fora do ar: quem vai gravar é o NAVEGADOR/.test(toggle),
   'sem agente, avisa que a janela nao pode ser fechada');

console.log('=== reabrir o navegador reencontra a gravacao ===');
const reatar = grab('agReatar');
ok(/var marca=agAtiva\(\); if\(!marca\) return;/.test(reatar), 'so age se havia gravacao em curso');
ok(/await capAgenteEstado\(\)/.test(reatar), 'confere com o agente antes de afirmar qualquer coisa');
ok(/capEstado='agente'/.test(reatar), 'a tela volta a mostrar a gravacao em curso');
ok(/capSeg=Math\.max\(0, Math\.round\(\(Date\.now\(\)-marca\.desde\)\/1000\)\)/.test(reatar),
   'o cronometro continua de onde estava, contando desde o inicio de verdade');
ok(/não consigo falar com ele agora/.test(reatar),
   'agente fora do ar na volta: avisa em vez de fingir que nao havia nada');
ok(/Não comece outra gravação antes de conferir/.test(reatar),
   'e orienta a nao gravar por cima');
ok(/if\(!est\.capturando\)/.test(reatar),
   'se o audio nao esta chegando no agente, a gravacao e dada como parada (marca limpa)');
ok(/Confira em "Ditados guardados"/.test(reatar), 'nesse caso, aponta onde procurar o que foi gravado');
ok(/DOMContentLoaded[\s\S]{0,120}agReatar\(\)/.test(HTML), 'isso roda assim que o app abre');

console.log('=== a tela diz QUEM esta com o microfone ===');
const ui = grab('capSetRecUI');
ok(/Gravando pelo AGENTE[\s\S]{0,80}pode fechar o navegador/.test(ui),
   'gravando pelo agente: diz que pode fechar a janela');
ok(/Gravando pelo NAVEGADOR[\s\S]{0,60}NÃO feche esta janela/.test(ui),
   'gravando pelo navegador: diz que NAO pode fechar a janela');
ok(/\(navegador\)/.test(ui), 'ate o estado pausado diz de quem e o microfone');

console.log('=== fim do exame ===');
ok(/capAgenteFecharExame\(est\);\s*\/\/[^\n]*\n\s*agLimparAtiva\(\);/.test(HTML),
   'quando o agente fecha o trecho do exame, a marca e limpa');
ok(/if\(capEstado==='agente'\)\{ capEstado='idle'/.test(HTML),
   'e a tela volta ao estado parado, sem cronometro fantasma');

console.log('=== o aviso de fechar a janela nao atrapalha ===');
const antes = grab('cpGravandoAgora');
ok(/_cpAtivas/.test(antes) && !/capEstado/.test(antes),
   'o aviso de "nao feche" olha so as gravacoes do NAVEGADOR');
ok(/if\(!cpGravandoAgora\(\)\) return;/.test(HTML),
   'gravando pelo agente, o navegador fecha sem perguntar nada — nao ha o que perder');

console.log('=== o caminho antigo continua inteiro ===');
ok(/gravacao\/iniciar/.test(HTML) && /gravacao\/parar/.test(HTML) && /exame\/fechar/.test(HTML),
   'os comandos do agente que ja existiam seguem sendo usados');
ok(/capMR\.start\(CP_FATIA_MS\)/.test(HTML),
   'o plano B (navegador) continua com a caixa-preta ligada');

console.log('\n=== recuperar exames: o vinculo volta pronto ===');
// 12/08/2026, relato do Dr. Daniel: ao recuperar os exames depois de fechar a
// janela sem querer, o vinculo entre ditado e exame se perdia. Ficava "um monte
// de audio a definir" e ele tinha de refazer tudo na mao — e ai um exame ficava
// com o ditado de outro. A causa: o agente guarda cada ditado ETIQUETADO com o
// numero do exame (ditados[est.id]); a recuperacao usava a etiqueta para achar o
// ditado certo e entao a jogava fora, mandando adivinhar por semelhanca entre
// TODOS os ditados soltos.
ok(/await capAutoVincular\(ex, a\)/.test(HTML),
   'a recuperacao entrega o ditado certo em vez de mandar adivinhar');
ok(/async function capAutoVincular\(ex, aCerto\)/.test(HTML),
   'capAutoVincular aceita um ditado ja conhecido');
ok(/if\(aCerto\)\{[\s\S]{0,80}?a=aCerto;/.test(HTML),
   'com o ditado conhecido, nao passa pela escolha por semelhanca');
ok(/capMelhorDitadoIdx\(ex, pend\)/.test(HTML),
   'sem ditado conhecido, a escolha por semelhanca continua existindo (fluxo normal)');

console.log('\n=== recuperar exames: o que ja foi assinado volta assinado ===');
// Mesmo relato: exames JA liberados voltavam como "nao liberados", e ele perdia
// a conta de quais faltava assinar. O app nao tem como saber sozinho — o
// historico que ele guarda no navegador nao registra de qual exame do aparelho
// cada laudo veio. O banco do agente registra (study_uid + finalizado_em).
ok(/\/exames\/liberados/.test(HTML), 'a recuperacao pergunta ao agente quais ja foram assinados');
ok(/ex\._liberado=!!jaLiberados\[est\.id\]/.test(HTML),
   'o exame volta ja marcado como liberado quando for o caso');
ok(/agente sem a rota ainda/.test(HTML),
   'agente sem essa rota nao trava a recuperacao (segue sem a marca)');

console.log('\n=== laudo pronto NAO atropela o que esta na tela (2.0) ===');
// Relato do Dr. Daniel em 12/08: quando um laudo ficava pronto ele TOMAVA a
// tela, por cima do que estava sendo revisado. Agora quem manda e o laudo que o
// medico esta lendo; o novo espera a vez.
ok(/exLaudoPronto\(ex\.id, ex\.paciente\)/.test(HTML),
   'a captura chama exLaudoPronto em vez de abrir a revisao direto');
// So o caminho AUTOMATICO (o exame que chega do aparelho e gera o laudo
// sozinho) e que nao pode tomar a tela. Quando o medico CLICA em gerar um laudo
// especifico, abrir e justamente o que ele pediu — esses continuam abrindo.
// sem os comentarios: o proprio comentario que explica a correcao cita a
// chamada antiga, e o teste passava a acusar a si mesmo.
const semComent = t => String(t).replace(/^\s*\/\/.*$/gm, '');
const autoVinc = semComent(grab('capAutoVincular'));
ok(!/abrirRevisao\(/.test(autoVinc),
   'o caminho automatico nao abre a revisao direto (era o que atropelava)');
ok(/exLaudoPronto\(/.test(autoVinc), 'ele passa pela decisao do modo do dia');
ok(/abrirRevisao\(ex\.id\);/.test(grab('capVincularGerar')),
   'ja o "Vincular e gerar" continua abrindo: foi o medico que pediu aquele laudo');
ok(/function exTelaOcupada\(\)/.test(HTML), 'existe a checagem de tela ocupada');
ok(/if\(exTelaOcupada\(\)\)\{[\s\S]{0,240}?entrou na fila/.test(HTML),
   'com a tela ocupada, o laudo novo entra na fila em vez de abrir');
ok(/pendentes\.length\)\{ abrirRevisao\(pendentes\[0\]\.id\); \}/.test(HTML),
   'ao liberar, o proximo da fila abre sozinho (isso ja existia)');
ok(/m==='arquivo'/.test(HTML) && /m==='lista'/.test(HTML),
   'os tres modos de revisao estao implementados, nao so escritos na tela');

console.log('\n=== as escolhas do dia ficam guardadas ===');
// A tela promete "a escolha de ontem ja vem marcada". Antes, o local voltava
// para 'branco' a cada abertura do programa.
ok(/localStorage\.setItem\('g20local'/.test(HTML), 'o local de atendimento e guardado');
ok(/localStorage\.setItem\('g20modo'/.test(HTML), 'o modo de revisao e guardado');
ok(/window\.__fundo=k/.test(HTML), 'escolher o local ja troca o timbrado que sai no laudo');

console.log('\n=== a regra do "corrigindo" chegou ao pedido feito a IA ===');
// A tela escreve isso como orientacao ao medico. Antes, NADA no pedido a IA
// falava em correcao de fala: funcionava por sorte do modelo.
ok(/CORREÇÃO FALADA/.test(HTML), 'a regra existe no pedido');
ok(/DESCARTE por completo o que ele disse antes/.test(HTML), 'manda descartar a versao anterior');
ok(/nunca escreva a palavra 'corrigindo' no laudo/.test(HTML), 'e a palavra nao vaza para o laudo');

console.log('\n=== qual ditado e de qual exame: o RELOGIO passou a contar ===');
// Ate 12/08 isto olhava so semelhanca de NOME. Com a regra nova ("nao diga o
// nome do paciente"), a semelhanca dava ZERO para todos e sobrava o primeiro da
// lista — virava sorteio. Foi o que embaralhou os exames daquele dia.
const CONSTJ = (HTML.match(/var CAP_JANELA_MIN=\d+;/) || [])[0];
const M = new Function(CONSTJ + '\n'
  + ['norm', 'levenshtein', 'tokensNome', 'simNome', 'capQuandoDoEstudo', 'capMelhorDitadoIdx']
      .map(grab).join('\n')
  + '\n return {capMelhorDitadoIdx, capQuandoDoEstudo};')();
const T = (h, m) => new Date(2026, 7, 12, h, m).getTime();

ok(M.capQuandoDoEstudo({ dataOrdem: '202608121522' }) === T(15, 22),
   'a hora do exame sai do dataOrdem do aparelho (AAAAMMDDHHMM)');
ok(M.capQuandoDoEstudo({ data: '12/08/2026', hora: '15:22' }) === T(15, 22),
   'sem dataOrdem, monta a hora a partir de data + hora');
ok(M.capQuandoDoEstudo({}) === 0, 'sem nada: zero, e o criterio cai no nome');

ok(M.capMelhorDitadoIdx({ paciente: 'Maria Silva', _quando: T(14, 10) },
   [{ idx: 1, nomePaciente: '', quando: T(11, 5) },
    { idx: 2, nomePaciente: '', quando: T(14, 12) },
    { idx: 3, nomePaciente: '', quando: T(16, 40) }]) === 2,
   'NINGUEM disse o nome: escolhe o ditado da hora do exame (era sorteio antes)');
ok(M.capMelhorDitadoIdx({ paciente: 'Ana', _quando: T(9, 0) },
   [{ idx: 1, nomePaciente: '', quando: T(9, 14) },
    { idx: 2, nomePaciente: '', quando: T(9, 2) }]) === 2,
   'entre dois ditados proximos, ganha o mais perto do exame');
ok(M.capMelhorDitadoIdx({ paciente: 'Maria Silva', _quando: T(14, 10) },
   [{ idx: 1, nomePaciente: 'Joao Souza', quando: T(11, 5) },
    { idx: 2, nomePaciente: 'Maria Silva', quando: T(14, 12) }]) === 2,
   'nome dito e horario concordando: escolhe o mesmo');
ok(M.capMelhorDitadoIdx({ paciente: 'Maria Silva Souza', _quando: T(14, 10) },
   [{ idx: 1, nomePaciente: 'Maria Silva Souza', quando: T(8, 0) },
    { idx: 2, nomePaciente: 'Carlos Lima', quando: T(19, 0) }]) === 1,
   'nome forte ainda vence quando nenhum horario esta dentro da janela');
ok(M.capMelhorDitadoIdx({ paciente: 'Maria Silva' },
   [{ idx: 1, nomePaciente: 'Joao Souza' },
    { idx: 2, nomePaciente: 'Maria Silva Souza' }]) === 2,
   'sem horario dos dois lados, decide pelo nome — o jeito antigo segue valendo');

ok(/_quando:capQuandoDoEstudo\(est\)/.test(HTML), 'o exame guarda a hora do aparelho');
ok(/quando:ms, _captura:true, _agente:true/.test(HTML), 'o ditado do agente guarda a hora dele');
ok(/capAudioDoAgente\(dit\.texto\|\|'', dit\.origem\|\|'recuperado', dit\.quando\)/.test(HTML),
   'na recuperacao, vale a hora que o AGENTE carimbou, nao a de agora');

console.log('\n=== cadastro de local de atendimento (2.0) ===');
// "Outro..." abria a lista velha de fundos, que so deixava ESCOLHER entre os que
// ja existiam. Agora cadastra um local novo, com papel timbrado, e ele vira
// botao junto dos outros.
ok(/onclick="exNovoLocal\(\)"/.test(HTML), '"Outro…" abre o cadastro, nao a lista antiga');
ok(/id="exCadLocal"/.test(HTML) && /id="exCadNome"/.test(HTML) && /id="exCadArq"/.test(HTML),
   'o cadastro tem nome e imagem do papel timbrado');
ok(/DADOS_SINCRONIZADOS[^\n]*'glocais'/.test(HTML),
   'os locais vivem no COMPUTADOR, nao so neste navegador');
ok(/FUNDOS\[l\.k\]=\{nome:l\.nome\|\|l\.k, img:l\.img\|\|null\}/.test(HTML),
   'o local cadastrado entra no FUNDOS — e de la que o laudo tira o timbrado');
const cad = semComent(grab('exCadSalvar'));
ok(/norm\(l\.rot\)===nomeNorm/.test(cad),
   'a checagem de repetido compara o NOME (comparar a chave deixava cadastrar um 2o "Capanema")');
ok(/filter\(function\(l\)\{ return l\.k!==k; \}\)/.test(cad),
   'cadastrar o mesmo nome de novo ATUALIZA em vez de duplicar');
ok(/f\.size>4\*1024\*1024/.test(HTML), 'imagem grande demais e recusada com aviso');
ok(/\^image\\\//.test(HTML) || /\/\^image\\\//.test(HTML) || /test\(f\.type\)/.test(HTML),
   'arquivo que nao e imagem e recusado');

console.log('\n=== a tela de abertura nao mente sobre o aparelho ===');
// "Aparelho conectado" era mentira: o aparelho nao fica ligado ao computador,
// ele EMPURRA as imagens para o recebedor quando o medico salva. O recebedor no
// ar nao diz nada sobre o aparelho estar ligado. Apontado pelo Dr. Daniel em
// 12/08: "ele diz ultrassom conectado, mas nao tem nenhum aparelho conectado".
const apar = semComent(grab('abConferirAparelho'));
ok(!/Aparelho de ultrassom conectado/.test(HTML), 'a frase "conectado" saiu da tela');
ok(/Recebedor de exames FORA DO AR/.test(apar), 'recebedor fora do ar e dito com esse nome');
ok(/NENHUMA imagem foi recebida ainda/.test(apar), 'recebedor no ar sem imagem nenhuma tem aviso proprio');
// Segundo apontamento do Dr. Daniel, no mesmo dia: "como o sistema confere que
// os exames estao chegando e que o relogio esta ok, se nao tem nenhum aparelho
// conectado?". Estava certo de novo — as duas linhas olhavam o PASSADO e
// falavam no presente. Nao ha como interrogar o aparelho: o DICOM e de mao
// unica. O verde e do RECEBEDOR, que da para conferir agora; sobre o aparelho
// so se afirma o que ja chegou, e QUANDO chegou.
ok(!/Exames chegando do aparelho/.test(HTML),
   'nao afirma mais no presente que exames estao chegando');
ok(/Recebedor de exames no ar · última imagem do aparelho/.test(apar),
   'diz o que sabe: o recebedor esta no ar, e quando foi a ultima imagem');
ok(/abHaQuanto\(top\)/.test(apar),
   'e diz HA QUANTO TEMPO, para dar para julgar sozinho se e recente');
ok(/medido nos exames já recebidos/.test(apar),
   'o relogio diz de onde saiu a medicao — nao e uma leitura de agora');

console.log('\n=== provar que o aparelho esta enviando AGORA ===');
// O unico jeito honesto: o medico salva uma imagem e ela chega. Mesma ideia do
// teste do microfone — em vez de afirmar, provar.
const tap = semComent(grab('abTestarAparelho'));
ok(/id="abOrtTestar"/.test(HTML), 'existe o botao de testar o aparelho');
ok(/Salve uma imagem qualquer no aparelho/.test(tap), 'ele instrui o que fazer');
ok(/if\(!antes\[e\.id\]&&!achou\) achou=e;/.test(tap),
   'detecta um estudo NOVO, comparando com o que ja existia antes do teste');
ok(/Aparelho enviando AGORA/.test(tap), 'chegando imagem, afirma o presente — ai pode');
ok(/Nada chegou em 90 segundos/.test(tap), 'nao chegando, diz isso e o que conferir');
ok(/_abTestandoAp/.test(tap), 'trava de reentrada: dois toques nao disparam dois testes');

console.log('\n=== relogio do aparelho: virou conferencia de abertura ===');
// Desde 12/08 e a HORA que decide qual ditado e de qual exame. Aparelho com a
// hora errada = ditado no exame errado. O agente ja media (mediana dos 8 mais
// recentes) e publicava em /dicom/estudos; faltava alguem olhar.
ok(/id="abRelBola"/.test(HTML) && /id="abRelTxt"/.test(HTML), 'existe a linha do relogio');
ok(/j&&j\.relogio/.test(apar), 'ela le o desvio que o agente ja calculava');
ok(/rel\.desvioSeg==null/.test(apar), 'sem exames para comparar, diz isso em vez de fingir que esta ok');
ok(/AB_DESVIO_ATENCAO=120/.test(HTML),
   'o limite da tela e 2 min — bem menor que os 15 min do agente, porque aqui o que esta em jogo e o encaixe do ditado');
ok(/pode ir para o exame errado/.test(apar), 'o aviso diz a CONSEQUENCIA, nao so o numero');
ok(/Acerte a hora no ultrassom/.test(apar), 'e diz o que fazer');

console.log('\n=== a caixa de cadastro nao cai no tema escuro do app antigo ===');
// O app tem tema ESCURO por desenho, e ainda um remendo que converte caixas
// claras antigas: [style*="background:#fff;border-radius:1"] vira grafite com
// !important. A primeira versao do cadastro usava exatamente esse estilo em
// linha: a caixa virava escura e os textos, escritos para fundo branco, sumiam.
// Relatado pelo Dr. Daniel: "o texto esta com muito pouco contraste".
ok(!/id="exCadLocal" style="display:none;position:fixed/.test(HTML),
   'a caixa nao usa mais estilo em linha (era o que caia no remendo do tema escuro)');
ok(/<div id="exCadLocal" class="ab-mod">/.test(HTML), 'ela tem classe propria');
ok(/\.ab-mod input\.ab-mod-i,/.test(HTML),
   'os campos repetem o ELEMENTO no seletor para vencer input[type=text] do CSS antigo');
ok(/\.ab-mod-cx\{background:#FFFFFF;color:#101720/.test(HTML),
   'a caixa declara fundo E cor de texto, sem depender de heranca');

console.log('\n=== botao de arquivo e criacao de mascara com IA ===');
ok(/id="exCadArq"[^>]*style="display:none"/.test(HTML), 'o seletor de arquivo cru fica escondido');
ok(/class="ab-mod-arq"[\s\S]{0,220}📁/.test(HTML), 'no lugar dele, um botao com a pasta');
ok(/id="exCadArqNome"/.test(HTML), 'e o nome do arquivo escolhido aparece ao lado');
const ia = semComent(grab('exIaGerar'));
ok(/viewBox="0 0 794 1123"/.test(ia), 'a IA e instruida a desenhar em A4 de pe');
// a frase e montada em pedacos no codigo-fonte, entao a busca ignora o que ha entre eles
ok(/O MIOLO \(y=175 a y=1010\)[\s\S]{0,40}fica VAZIO/.test(ia),
   'e a deixar o miolo vazio — e ali que o laudo e escrito por cima');
ok(/NÃO invente endereço, telefone, CNPJ, CRM nem nome de médico/.test(ia),
   'proibida de inventar dado que o medico nao deu');
ok(/svg=svg\.split\('__LOGO__'\)\.join\(_exIaLogo\)/.test(ia),
   'o logo entra DEPOIS, no lugar de uma marca: nao e enviado a IA');
ok(/svg\.replace\(\/<image\\b\[\^>\]\*>\/gi,''\)/.test(ia),
   'sem logo, nenhuma imagem sobra no desenho');
ok(/exSvgParaPng/.test(ia), 'o desenho vira PNG, que e o formato que o laudo ja sabe usar');
ok(/desenho em SVG, não em imagem gerada por pixel/.test(HTML) ||
   /A IA desenha em SVG, não em imagem gerada por pixel/.test(HTML),
   'esta escrito no codigo POR QUE e SVG: texto de timbrado tem de sair exato');
const apr = semComent(grab('exIaAprovar'));
ok(/if\(!_exIaPng\) return;/.test(apr), 'so aprova o que foi realmente gerado');
ok(/exIaFechar\(\)/.test(apr), 'aprovar devolve para o cadastro, que e onde se salva');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
