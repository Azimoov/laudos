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
ok(/larg:794,alt:1123/.test(cfg), 'a grade e A4: 794 x 1123 px');
ok(/drawImage\(im,0,0,c\.width,c\.height\)/.test(normalizar),
   'a imagem e desenhada do primeiro ao ultimo pixel da folha');
ok(/fillStyle='#fff'/.test(normalizar), 'transparencia recebe fundo branco, sem surpresa no papel');
ok(/toDataURL\('image\/jpeg',0\.94\)/.test(normalizar),
   'imagem complexa tem alternativa compacta para nao estourar o armazenamento');

const ctx = {};
vm.runInNewContext(cfg + '\n' + dist, ctx);
ok(ctx.exMascaraDistorcao(794, 1123) < 0.001, 'uma imagem A4 nao dispara aviso');
ok(ctx.exMascaraDistorcao(1000, 1000) > 0.40, 'uma imagem quadrada e reconhecida como muito diferente');

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

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);
