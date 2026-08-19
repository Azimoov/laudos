// Leva de correcoes de 19/08/2026 — os itens que nao cabem no teste-blocos-revisao.js:
// audio (12), botao VOZ (13), foto que faltou (14), ignorar na fila (15), contador (18),
// botoes que coexistem (19) e "abrir na pasta" que abria o laudo (1).
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
/* O agente vive no OUTRO repositorio (laudos-programa), irmao deste. Se ele nao estiver
   ao lado — outra maquina, clone so do app —, as conferencias do lado do agente sao
   PULADAS com aviso, nunca dadas como aprovadas por ausencia. */
const CAM_AGENTE = path.join(RAIZ, '..', 'laudos-programa', 'agente', 'agente-laudos.py');
const TEM_AGENTE = fs.existsSync(CAM_AGENTE);
const AGENTE = TEM_AGENTE ? fs.readFileSync(CAM_AGENTE, 'utf8') : '';
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
function corpoDe(nome) {
  let i = HTML.indexOf('async function ' + nome + '(');
  if (i < 0) i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== item 12 — o audio do exame passa a ter endereco ===');
const PROC = corpoDe('capOrtProcessar');
ok(/a\._estudoAudio=est\.id;/.test(PROC),
  'a captura AO VIVO grava de qual estudo e o audio (era o unico caminho que nao gravava)');
ok(/a\.url=agenteBase\(\)\+'\/exame\/audio\/'\+encodeURIComponent\(est\.id\)/.test(PROC),
  'e preenche a URL do audio — sem isso o tocador dizia "nao disponivel"');
ok(/_estudoAudio:a\._estudoAudio\|\|''/.test(HTML), 'o campo entra no retrato da sessao');
ok(/trechos:\(a\.trechos\|\|\[\]\)\}/.test(HTML),
  'os trechos com hora tambem entram no retrato (senao o VOZ morre ao reabrir)');
ok(/sa\._estudoAudio \? \(agenteBase\(\)\+'\/exame\/audio\/'/.test(HTML),
  'ao restaurar a sessao, a URL se REFAZ (o audio do agente nao tem blob)');
ok(/if\(dit\.temAudio\)\{ a\._estudoAudio=est\.id;/.test(HTML),
  'o caminho de recuperacao tambem grava o estudo do audio');

console.log('=== item 12b — ouvir o ditado INTEIRO (nao existia) ===');
ok(/function rev2Inteiro\(\)/.test(HTML), 'existe a funcao de tocar o ditado inteiro');
ok(/id="rv2BtInteiro"[^>]*onclick="rev2Inteiro\(\)"/.test(HTML), 'e tem botao na tela de revisao');
ok(/function rev2Parar\(\)/.test(HTML), 'da para parar');
const INT = corpoDe('rev2Inteiro');
ok(/clearTimeout\(window\.__rv2Par\)/.test(INT),
  'cancela o corte do trecho — inteiro toca ate o fim, nao 5 segundos');
ok(/\.catch\(function\(e\)\{/.test(INT), 'falha ao tocar vira mensagem, nao silencio');
ok(/o agente está desligado/.test(INT), 'e a mensagem diz a causa mais provavel');

console.log('=== item 13 — o rodape deixou de ser um beco sem saida ===');
ok(/sem marcação de tempo \(transcrito na nuvem\) — não há VOZ por trecho/.test(HTML),
  'explica POR QUE nao ha VOZ por trecho');
ok(/mas dá para ouvir o ditado inteiro no botão ao lado/.test(HTML),
  'e aponta a saida, em vez de so dizer que nao funciona');

console.log('=== item 14 — acrescentar a foto que faltou ===');
ok(/async function rev2BuscarImagens\(\)/.test(HTML), 'da para buscar as fotos no aparelho');
ok(/async function rev2AnexarFotos\(inp\)/.test(HTML), 'e da para anexar arquivo de imagem');
ok(/id="rv2InpFoto"[^>]*accept="image\/\*"[^>]*multiple/.test(HTML),
  'o seletor aceita arquivo de imagem (e mais de um) — antes so havia WEBCAM');
const BUSCA = corpoDe('rev2BuscarImagens');
ok(/jaTem\.indexOf\(id\)<0/.test(BUSCA), 'compara pelo id da instancia: rodar 2x nao duplica foto');
ok(/ex\._instIds=\(ex\._instIds\|\|\[\]\)\.concat/.test(BUSCA), 'registra o que ja baixou');
ok(/est\.instancias\|\|est\.instances/.test(BUSCA), 'le o campo "instancias" que o agente devolve');
const ANEXA = corpoDe('rev2AnexarFotos');
ok(/inp\.value=''/.test(ANEXA), 'permite escolher o MESMO arquivo de novo (senao o input trava)');
ok(/indexOf\('data:image'\)!==0/.test(ANEXA), 'recusa arquivo que nao e imagem');
ok(/agendarSalvarSessao/.test(ANEXA) && /agendarSalvarSessao/.test(BUSCA),
  'a foto nova entra no retrato da sessao — senao some ao fechar a janela');
ok(/refaça o laudo se elas mudarem o texto/.test(HTML),
  'avisa que acrescentar foto NAO refaz o laudo sozinho');

console.log('=== item 15 — ignorar por enquanto (diferente de deixar para depois) ===');
ok(/var _rev2Ignorado=\{\}/.test(HTML), 'existe a marca de ignorado');
ok(/!_rev2Ignorado\[x\.id\]/.test(corpoDe('rev2Fila')), 'a fila pula os ignorados');
ok(/function rev2Ignorar\(\)/.test(HTML) && /onclick="rev2Ignorar\(\)"/.test(HTML),
  'tem funcao e botao');
ok(/function rev2TrazerIgnorados\(\)/.test(HTML), 'e da para trazer de volta');
ok(/id="rv2Ignorados"/.test(HTML), 'o rodape mostra quantos estao fora da sequencia');
ok(/delete _rev2Fim\[ex\.id\]; delete _rev2Ignorado\[ex\.id\]/.test(HTML),
  'assinar limpa as duas marcas');
ok(/Deixar para depois<\/button>/.test(HTML) && /Ignorar por enquanto<\/button>/.test(HTML),
  'os dois botoes coexistem — sao coisas diferentes');

console.log('=== item 18 — contador de exames do dia ===');
const CONT = corpoDe('abContarPendentes');
ok(/j&&j\.gerados/.test(CONT) && /j&&j\.liberados/.test(CONT),
  'usa gerados e liberados, que o agente ja mandava e eram jogados fora');
ok(/id="abContador"/.test(HTML), 'tem lugar na tela de abertura');
ok(/de dias anteriores/.test(CONT), 'separa o atraso de outros dias do que e de hoje');
ok(/#telaAbertura \.ab-cont/.test(HTML), 'tem CSS proprio');

console.log('=== item 19 — os tres botoes coexistem ===');
const LISTA = corpoDe('diaRenderLista');
ok(/bts\.push/.test(LISTA), 'os botoes sao acumulados numa lista, nao trocados num if/else');
ok((LISTA.match(/bts\.push/g) || []).length >= 3, 'sao pelo menos tres botoes possiveis');
ok(/if\(x\.laudo\)\{[\s\S]{0,200}diaRevisar/.test(LISTA), '"Revisar" aparece sempre que ha laudo');
ok(/if\(x\._liberado\)\{[\s\S]{0,200}diaAbrirNaPasta/.test(LISTA), '"Abrir na pasta" quando foi liberado');
ok(/bts\.push\('<button class="bt cinza" onclick="diaReabrir/.test(LISTA), '"Reabrir exame" SEMPRE');
ok(/x\._liberado && !confirm\(/.test(corpoDe('diaReabrir')),
  'reabrir um laudo ja assinado pergunta antes (ele volta para a fila)');

console.log('=== item 1 — "Abrir na pasta" abre a PASTA, nao o laudo ===');
const ABRIR = corpoDe('diaAbrirNaPasta');
ok(!/diaRevisar\(exId\)/.test(ABRIR) || /abrir\/pasta/.test(ABRIR),
  'nao cai mais direto em reabrir o laudo');
ok(/abrir\/pasta/.test(ABRIR), 'chama a rota do agente que abre o Explorer');
if (TEM_AGENTE) {
  ok(/"\/abrir\/pasta"/.test(AGENTE), 'a rota existe no agente');
  ok(/os\.startfile/.test(AGENTE), 'e ela abre a pasta de verdade');
  ok(/os\.path\.isabs\(parte\) or "\.\." in parte/.test(AGENTE),
    'o agente recusa caminho absoluto e ".." — so aceita NOMES de pasta');
} else {
  console.log('  --   lado do agente PULADO: nao achei ' + CAM_AGENTE);
}

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
