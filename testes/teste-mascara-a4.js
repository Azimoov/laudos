// Mascara enviada: ocupa a folha A4 inteira e avisa antes de uma distorcao visivel.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function grab(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, abriu = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; abriu = true; }
    else if (HTML[j] === '}') { d--; if (abriu && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('funcao incompleta: ' + nome);
}

console.log('=== o arquivo vira uma folha A4 inteira ===');
const cfg = (HTML.match(/var EX_MASCARA_A4=\{[^;]+;/) || [''])[0];
const dist = grab('exMascaraDistorcao');
const normalizar = grab('exMascaraParaA4');
/* 06/09/2026 — A GRADE ERA 794 x 1123, uma folha A4 a 96 pontos por polegada, e TODO
   timbrado cadastrado era redesenhado nela: a resolucao do arquivo original morria ali,
   para sempre. No papel isso e o logo serrilhado — e nenhum ajuste na impressora conserta,
   porque a informacao ja nao existe no arquivo guardado. Medido em 06/09: o timbrado AME
   da 3.0 tinha 96 dpi; o MESMO timbrado na 2.0, cadastrado antes desta funcao existir,
   tem 300. A grade passou a ser 300 dpi, com piso nos 794 de antes. */
ok(/larg:2480,alt:3508/.test(cfg), 'a grade e A4 em 300 pontos por polegada: 2480 x 3508 px');
ok(/minLarg:794/.test(cfg), 'e o piso continua sendo a grade antiga, para arquivo pequeno');
ok(/Math\.min\(EX_MASCARA_A4\.larg, *_oL\)/.test(normalizar),
   'a tela nunca passa da resolucao DO ARQUIVO DELE — nao se inventa detalhe');
ok(/Math\.max\(EX_MASCARA_A4\.minLarg/.test(normalizar),
   'nem desce abaixo do piso');
ok(/_L\*EX_MASCARA_A4\.alt\/EX_MASCARA_A4\.larg/.test(normalizar),
   'e a altura sai da largura — a proporcao da folha A4 e o que faz a mascara casar com o papel');
ok(/imageSmoothingQuality='high'/.test(normalizar),
   'a reducao faz a media dos pontos, em vez de descartar e serrilhar o logo');
ok(/drawImage\(im,0,0,c\.width,c\.height\)/.test(normalizar),
   'a imagem e desenhada do primeiro ao ultimo pixel da folha');
ok(/fillStyle='#fff'/.test(normalizar), 'transparencia recebe fundo branco, sem surpresa no papel');
ok(/toDataURL\('image\/jpeg',0\.94\)/.test(normalizar),
   'imagem complexa tem alternativa compacta para nao estourar o armazenamento');

const ctx = {};
vm.runInNewContext(cfg + '\n' + dist, ctx);
ok(ctx.exMascaraDistorcao(794, 1123) < 0.001, 'uma imagem A4 nao dispara aviso');
ok(ctx.exMascaraDistorcao(1000, 1000) > 0.40, 'uma imagem quadrada e reconhecida como muito diferente');

console.log('\n=== A MASCARA DIZ O PROPRIO TAMANHO (07/09/2026, frente 2 do plano) ===');
/* O formulario pedia, com estas palavras, que ELE medisse: "meca ate onde terminam o
   cabecalho e o rodape do timbrado". Numero digitado nao acompanha o desenho — quando o
   timbrado muda, ele fica para tras e ninguem avisa. Foi o que aconteceu em 05/09: a
   mascara terminava o cabecalho em 25,9 mm e o cadastro reservava 50, deixando 24 mm de
   papel em branco em toda folha. */
const medir = grab('exMedirMascara');
ok(medir.length > 0, 'ha uma funcao que MEDE o desenho da mascara');
ok(/getImageData/.test(medir), 'e ela olha os pontos da imagem, nao um numero digitado');
ok(/terco/.test(medir) && /A\/3/.test(medir),
   'olha o TERCO de cima e o de baixo — a marca dagua do meio nao pode entrar na conta');
ok(/if\(\+\+n>=3\) return true/.test(medir),
   'e exige tres pontos escuros na linha: um respingo nao e cabecalho');
const prev = grab('exCadPreview');
ok(/exMedirMascara\(a4\.img\)/.test(prev), 'o cadastro mede a imagem escolhida');
ok(/cT\.value=_t/.test(prev) && /cB\.value=_b/.test(prev),
   'e PREENCHE as faixas com o que mediu — o campo continua editavel, ele e quem manda');
ok(/EX_RESPIRO_MM/.test(prev) && /var EX_RESPIRO_MM=/.test(HTML),
   'com um respiro entre o fim do desenho e a primeira linha do laudo');
ok(/Medi o desenho/.test(prev), 'e diz na tela o que mediu e o que reservou');
const salvar = grab('exCadSalvar');
ok(/medidoTopoMm/.test(salvar) && /medidoBaseMm/.test(salvar),
   'a medida da imagem e guardada junto do local — separada da reserva escolhida');
ok(/img===_ant\.img/.test(salvar),
   'e trocar so o nome ou as margens nao perde a medida da imagem que ficou');
const avisar = grab('exAvisarReserva');
ok(/padTopMm < fnd\.medidoTopoMm/.test(avisar) && /padBottomMm < fnd\.medidoBaseMm/.test(avisar),
   'reserva menor que o desenho vira aviso');
ok(/_exAvisouReserva\[k\]/.test(avisar),
   'uma vez por local — aviso repetido vira ruido, e ruido deixa de ser lido');
ok(/exAvisarReserva\(_k, _fnd\)/.test(HTML),
   'e o aviso sai ao montar o laudo, ANTES do papel');
const conferir = grab('exConferirMascaras');
ok(/l\.medidoTopoMm!=null\) continue/.test(conferir),
   'os timbrados antigos sao medidos UMA vez, e a medida fica guardada');
ok(/dadoSalvar\('glocais'/.test(conferir), 'no computador, nao so no navegador');
ok(/exConferirMascaras\(\)\.catch/.test(HTML),
   'e isso roda na abertura, em segundo plano — a tela nao espera decodificar imagem');

console.log('\n=== distorcao visivel exige confirmacao ===');
const preview = grab('exCadPreview');
ok(/aviso:0\.05/.test(cfg), 'o limite do aviso e 5%');
ok(/a4\.distorcao>=EX_MASCARA_A4\.aviso/.test(preview), 'a proporcao e conferida antes de aceitar');
ok(/confirm\(/.test(preview) && /Logos e letras podem ficar esticados/.test(preview),
   'o programa explica o risco e pede confirmacao');
ok(/if\(!seguir\)/.test(preview) && /A máscara não foi alterada/.test(preview),
   'cancelar preserva a mascara anterior');
ok(/p\.src=a4\.img/.test(preview), 'confirmar usa a copia ja ajustada para A4');
ok(/exCadMascaraOcupada\(true\)/.test(preview) && /exCadMascaraOcupada\(false\)/.test(preview),
   'salvar fica bloqueado enquanto a conversao esta em andamento');
ok(/_exCadMascaraPreparando/.test(grab('exCadSalvar')),
   'um clique antecipado em Salvar aguarda a mascara ficar pronta');

console.log('\n=== todos os caminhos desenham o fundo preenchendo a pagina ===');
ok(/\.fundoLaudo\{[^}]*object-fit:fill/.test(HTML), 'primeira folha preenche o papel');
ok(/\.fundoFolhaTela\{[^}]*object-fit:fill/.test(HTML), 'folhas seguintes tambem preenchem o papel');
ok(/ajustado automaticamente para A4/.test(HTML), 'o cadastro avisa o que fara com o arquivo');

console.log('\n=== a visualizacao nao inventa margem branca fora da folha ===');
ok(/#rv2Final #rv2FinalHost\{width:210mm;max-width:210mm\}/.test(HTML),
   'o suporte da visualizacao tem a largura exata de uma folha A4');
ok(/#rv2Final #areaImpressao\{width:210mm;max-width:210mm!important;flex:0 0 210mm!important/.test(HTML),
   'a caixa que carrega a folha nao fica mais larga que ela');
ok(/#rv2Final #areaImpressao>\.laudoFolha\{box-shadow:/.test(HTML),
   'a sombra marca a borda da folha verdadeira, nao a caixa externa');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);
