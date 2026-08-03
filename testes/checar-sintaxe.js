// Checa a sintaxe de todos os blocos <script> inline do index.html.
const fs = require('fs');
const vm = require('vm');
const HTML = fs.readFileSync('C:/Users/serru/OneDrive/Desktop/Projeto WBOT/_repo/index.html', 'utf8');
const blocos = [...HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
console.log('blocos <script> inline:', blocos.length);
let erros = 0;
blocos.forEach((m, i) => {
  const linha = HTML.slice(0, m.index).split('\n').length;
  try { new vm.Script(m[1], { filename: 'bloco' + i }); console.log('  bloco ' + i + ' (linha ~' + linha + ', ' + m[1].length + ' chars): OK'); }
  catch (e) { erros++; console.error('  bloco ' + i + ' (linha ~' + linha + '): ERRO -> ' + e.message); }
});
process.exit(erros ? 1 : 0);
