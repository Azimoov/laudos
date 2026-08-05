// F2b — comparacao com o exame anterior.
// Cobre (1) a extracao do texto do laudo antigo, (2) ONDE o app procura (disco do
// agente, nao so o navegador), (3) COMO decide que e o mesmo paciente (codigo do
// aparelho + nome + confirmacao do medico) e (4) a ligacao disso no prompt e na tela.
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

// ---- caixa de areia com as funcoes puras do app ----
const FUNCS = ['norm', 'levenshtein', 'tokensNome', 'simNome', 'idNomeChave', 'idDecisoes',
  'idDecidir', 'idEsquecer', 'mesmoPaciente', 'examesAnterioresDoPaciente', 'codDoEstudo',
  'textoDoLaudoAnterior'];
const store = {};
const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
const dadoSalvar = (k, v) => { store[k] = v; };
const app = new Function('localStorage', 'dadoSalvar',
  FUNCS.map(grab).join('\n') + '\n return {' + FUNCS.join(',') + '};')(localStorage, dadoSalvar);
const { textoDoLaudoAnterior, mesmoPaciente, examesAnterioresDoPaciente, codDoEstudo,
        idDecidir, idEsquecer, idNomeChave } = app;

// ---- laudo como ele fica guardado no historico (imagens ja removidas) ----
const folha =
  '<div class="laudoFolha comFundo">'
+ '<div class="laudoCab"><div contenteditable="true"><b>Nome do Paciente:</b>Maria Silva &amp; Souza'
+ '<br><b>Idade:</b> 52<br><b>Realizado em:</b> 10/02/2026<br><b>Dados Clínicos:</b> nódulo palpável</div></div>'
+ '<div class="laudoCorpoBox"><div class="laudoTitulo" contenteditable="true">Exame ecográfico das mamas</div>'
+ '<div class="laudoTexto" contenteditable="true">Transdutor linear de alta frequência.<br><br>'
+ '<b><u>DESCRIÇÃO:</u></b><br><br>Mama direita com <b>nódulo sólido medindo 0,8 cm</b>, distando 5 cm da papila mamária.<br><br>'
+ '<b>CONCLUSÃO: <b>Nódulo mamário à direita — BI-RADS 3.</b></b></div></div>'
+ '<div class="assin"><!--IMG-ASSINATURA--><span class="linha">Dr. Daniel Serruya<br>CRM 00000</span></div>'
+ '<div class="rodapeLaudo">Esclarecemos que a impressão diagnóstica em exames de imagem não é absoluta.</div>'
+ '</div>';

console.log('=== textoDoLaudoAnterior ===');
const t = textoDoLaudoAnterior({ html: folha, data: '10/02/2026' });
ok(t.includes('nódulo sólido medindo 0,8 cm'), 'traz o achado do laudo anterior');
ok(t.includes('CONCLUSÃO:') && t.includes('BI-RADS 3'), 'traz a conclusao anterior');
ok(t.includes('Exame ecográfico das mamas'), 'traz o titulo do exame anterior');
ok(!/Dr\. Daniel Serruya|CRM 00000/.test(t), 'assinatura fica de fora (nao gasta token)');
ok(!/Esclarecemos/.test(t), 'rodape fixo fica de fora');
ok(!/<[a-z/!]/i.test(t), 'nenhuma tag HTML sobra no texto');
ok(t.includes('Maria Silva & Souza'), 'entidade &amp; volta a virar &');
ok(t.includes('\nIdade: 52'), '<br> vira quebra de linha de verdade');
ok(textoDoLaudoAnterior(null) === '' && textoDoLaudoAnterior({}) === '', 'registro vazio vira texto vazio');
const sujo = textoDoLaudoAnterior({ html: '<div>antes<script>alert(1)</script><style>b{color:red}</style>depois</div>' });
ok(!sujo.includes('alert(1)') && !sujo.includes('color:red'), 'script e style nao entram no prompt');
const gigante = '<div>' + 'medida repetida. '.repeat(900) + '<b>CONCLUSÃO: FIM DO LAUDO ANTERIOR.</b></div>';
const cortado = textoDoLaudoAnterior({ html: gigante }, 200);
ok(cortado.length <= 250 && cortado.includes('omitido por tamanho'), 'respeita o limite e avisa que cortou');
ok(cortado.trim().endsWith('FIM DO LAUDO ANTERIOR.'), 'corta o MIOLO e preserva o fim (a conclusao)');

console.log('=== codigo do paciente vindo do aparelho ===');
ok(codDoEstudo({ codigo: ' 12345 ' }) === '12345', 'aceita "codigo" e tira espacos');
ok(codDoEstudo({ PatientID: 'AB-7' }) === 'AB-7', 'aceita PatientID');
ok(codDoEstudo({ patientId: 'x9' }) === 'x9' && codDoEstudo({ pid: 'p1' }) === 'p1', 'aceita as outras grafias');
ok(codDoEstudo({}) === '' && codDoEstudo(null) === '', 'sem codigo devolve vazio (nao quebra)');

console.log('=== e a mesma pessoa? (o risco do homonimo) ===');
for (const k of Object.keys(store)) delete store[k];
ok(mesmoPaciente('123', 'Maria Silva Souza', { cod: '123' }) === 'sim', 'codigo igual nos dois lados: compara sem perguntar');
ok(mesmoPaciente('123', 'Maria Silva Souza', { cod: '999' }) === 'nao', 'codigo DIFERENTE: sao pessoas diferentes, mesmo com nome igual');
ok(mesmoPaciente('', 'Maria Silva Souza', { cod: '123' }) === 'perguntar', 'falta codigo de um lado: pergunta ao medico');
ok(mesmoPaciente('', 'Maria Silva Souza', { cod: '' }) === 'perguntar', 'sem codigo nenhum: pergunta ao medico');

console.log('=== a resposta do medico fica guardada ===');
idDecidir('Maria Silva Souza', '', 'sim');
ok(mesmoPaciente('', 'Maria Silva Souza', { cod: '' }) === 'sim', 'depois do "e a mesma pessoa" nao pergunta de novo');
ok(mesmoPaciente('', 'MARIA SOUZA SILVA', { cod: '' }) === 'sim', 'ordem/caixa do nome nao refaz a pergunta');
ok(store.gpacid && JSON.parse(store.gpacid)[idNomeChave('Maria Silva Souza')].r === 'sim',
   'a resposta vai para gpacid (que sincroniza com o computador)');
idDecidir('Joao Pereira Lima', '', 'nao');
ok(mesmoPaciente('', 'Joao Pereira Lima', { cod: '' }) === 'nao', 'depois do "e outra pessoa" nao compara mais');
idDecidir('Ana Costa Reis', 'C1', 'sim');
ok(mesmoPaciente('C1', 'Ana Costa Reis', { cod: '' }) === 'sim', 'mesmo codigo do que foi confirmado: segue valendo');
ok(mesmoPaciente('C2', 'Ana Costa Reis', { cod: '' }) === 'perguntar', 'codigo novo diferente do confirmado: pergunta de novo');
idEsquecer('Joao Pereira Lima');
ok(mesmoPaciente('', 'Joao Pereira Lima', { cod: '' }) === 'perguntar', 'da para desfazer a resposta');

console.log('=== escolha dos exames anteriores ===');
for (const k of Object.keys(store)) delete store[k];
const hist = [
  { id: 'a', paciente: 'Maria Silva Souza', tipo: 'mama', data: '10/02/2026', ts: 200, cod: '123', html: '<div>antigo A</div>' },
  { id: 'b', paciente: 'Maria Silva Souza', tipo: 'mama', data: '01/01/2025', ts: 100, cod: '123', html: '<div>antigo B</div>' },
  { id: 'c', paciente: 'Maria Silva Souza', tipo: 'abdome', data: '05/05/2025', ts: 150, cod: '123', html: '<div>outro tipo</div>' },
  { id: 'd', paciente: 'Maria Silva Souza', tipo: 'mama', data: '09/09/2024', ts: 90, cod: '999', html: '<div>homonima</div>' },
  { id: 'e', paciente: 'Carlos Andrade Lima', tipo: 'mama', data: '03/03/2025', ts: 120, cod: '777', html: '<div>outro paciente</div>' }
];
const r1 = examesAnterioresDoPaciente(hist, 'Maria Silva Souza', 'mama', '123', 'atual');
ok(r1.lista.map(x => x.id).join(',') === 'a,b', 'pega so os do mesmo paciente e do mesmo tipo, mais novo primeiro');
ok(!r1.lista.some(x => x.id === 'd'), 'HOMONIMA com codigo diferente NAO entra (o ponto critico)');
ok(!r1.lista.some(x => x.id === 'c'), 'exame de outro tipo nao entra');
ok(!r1.lista.some(x => x.id === 'e'), 'outro paciente nao entra');
ok(r1.pendentes.length === 0, 'com codigo dos dois lados nao sobra nada para perguntar');
const r2 = examesAnterioresDoPaciente(hist, 'Maria Silva Souza', 'mama', '', 'atual');
ok(r2.lista.length === 0 && r2.pendentes.length === 3, 'sem codigo hoje: nada e usado sozinho, tudo vira pergunta');
idDecidir('Maria Silva Souza', '', 'sim');
const r3 = examesAnterioresDoPaciente(hist, 'Maria Silva Souza', 'mama', '', 'atual');
ok(r3.lista.length === 3 && r3.pendentes.length === 0, 'depois de confirmado, passa a comparar');
const r4 = examesAnterioresDoPaciente(hist, 'Maria Silva Souza', 'mama', '123', 'a');
ok(!r4.lista.some(x => x.id === 'a'), 'o proprio laudo de hoje nunca entra como "anterior"');
ok(examesAnterioresDoPaciente(hist, 'Ze', 'mama', '', null).pendentes.length === 0,
   'nome curto demais nao arrisca falso positivo');
ok(examesAnterioresDoPaciente(null, 'Maria Silva Souza', 'mama', '123', null).lista.length === 0,
   'historico ausente nao quebra');

console.log('=== onde procura: a copia do COMPUTADOR, nao so a do navegador ===');
ok(/async function histParaBusca\(\)/.test(HTML), 'existe a busca no historico completo');
ok(/fetch\(agenteBase\(\)\+'\/dados\/glaudos'/.test(grab('histParaBusca')), 'baixa o historico do agente (disco)');
ok(/return lerHistorico\(\)/.test(grab('histParaBusca')), 'sem agente, cai na copia do navegador em vez de falhar');
ok(/_histDiscoTentou/.test(grab('histParaBusca')), 'nao repete a tentativa a cada laudo quando o agente esta fora');
ok(/examesAnterioresDoPaciente\(await histParaBusca\(\)/.test(HTML), 'o gerarLaudo procura na copia completa');
ok(/histBuscaIncompleta\(\)\) log\(/.test(HTML), 'avisa o medico quando a busca saiu incompleta');
ok(/histDiscoAtualizar\(reg\)/.test(HTML), 'laudo recem-salvo entra na copia em memoria (vale ja no proximo)');

console.log('=== o codigo do aparelho atravessa ate o historico ===');
ok(/codPac:d\.codigo\|\|''/.test(HTML), 'importacao manual do aparelho leva o codigo para o exame');
ok(/codPac:codDoEstudo\(est\)/.test(HTML), 'captura automatica leva o codigo para o exame');
ok(/cod:ex\.codPac\|\|''/.test(HTML), 'o codigo chega na revisao');
ok(/cod:meta\.cod\|\|''/.test(HTML), 'o codigo e gravado no historico, para servir no proximo exame');
ok(HTML.indexOf("'gpacid'") > 0 && /DADOS_SINCRONIZADOS = \[[^\]]*'gpacid'/.test(HTML),
   'as respostas do medico sincronizam com o computador');

console.log('=== ligacao no prompt ===');
ok(/const usados = ant\.lista\.slice\(0, Math\.max\(1, ex\._antQuantos\|\|1\)\)/.test(HTML),
   'usa 1 exame anterior por padrao, e mais quando o medico pede');
ok(/anteriorTxt \? "EXAME ANTERIOR DO MESMO PACIENTE/.test(HTML), 'bloco so entra quando ha texto');
const iAnt = HTML.indexOf('EXAME ANTERIOR DO MESMO PACIENTE');
const iSeg = HTML.indexOf('PACIENTE JÁ EXAMINADO NESTE SERVIÇO');
ok(iAnt > 0 && iSeg > 0 && iAnt < iSeg, 'o laudo anterior vem ANTES das regras de seguimento');
const bloco = HTML.slice(iAnt, iSeg);
ok(/PROIBIDO trazer para o laudo de hoje/.test(bloco), 'proibe copiar achado que so existe no exame antigo');
ok(/exclusivamente o que está no DITADO DE HOJE e nas IMAGENS DE HOJE/.test(bloco), 'a fonte continua sendo o exame de hoje');
ok(/quando o achado existir NOS DOIS exames/.test(bloco), 'so compara com os dois lados');
ok(/NÃO afirme que desapareceu nem que persiste/.test(bloco), 'achado antigo nao citado hoje nao vira conclusao');
ok(/vale sempre o ditado de hoje/.test(bloco), 'em divergencia, manda o ditado de hoje');
ok(/REFERÊNCIA PRINCIPAL é o mais recente/.test(bloco), 'com varios anteriores, o mais recente manda');

console.log('=== avisos na TELA (e nunca no papel) ===');
ok(/já examinado aqui/.test(HTML), 'etiqueta no cartao antes de ditar (momento 1)');
ok(/onclick="abrirExameAnterior\(/.test(HTML), 'da para abrir o laudo anterior');
ok(/id="revAnterior"/.test(HTML), 'bloco na coluna da esquerda da revisao (momento 3)');
ok(/montarRevAnterior\(ex\)/.test(HTML), 'o bloco e montado ao abrir a revisao');
ok(/É a mesma pessoa do exame de hoje\?/.test(HTML), 'a pergunta de confirmacao existe');
ok(/function antResponder/.test(HTML) && !/antResponder[\s\S]{0,400}await gerarLaudo/.test(HTML),
   'responder NAO refaz o laudo sozinho (refazer custa dinheiro: fica num botao)');
ok(/Refazer com a comparação|Trazer os '\+Math\.min\(3,total\)\+' últimos e refazer/.test(HTML),
   'ha botao para refazer trazendo os anteriores');
// nada disso pode entrar na folha impressa
ok(/<div id="areaImpressao"[^>]*><\/div>/.test(HTML), 'a area de impressao continua vazia no HTML (o laudo e injetado nela)');
const idsForaDoPapel = ['revAnterior', 'antVer', 'antVerCab', 'antVerCorpo', 'antVerPergunta'];
ok(idsForaDoPapel.every(id => HTML.indexOf('id="' + id + '"') > HTML.indexOf('<div id="areaImpressao"')),
   'os avisos ficam fora do #areaImpressao — nao saem na impressao');
const print = HTML.slice(HTML.indexOf('@media print'), HTML.indexOf('@page'));
ok(/body \*\{visibility:hidden;\}/.test(print) && /#areaImpressao,#areaImpressao \*\{visibility:visible;\}/.test(print),
   'a regra de impressao continua intocada (so o laudo sai no papel)');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
