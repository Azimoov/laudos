// F2b — comparacao com o exame anterior.
// Testa (1) a extracao do texto do laudo antigo guardado no historico e
//       (2) a ligacao desse texto no prompt, com as travas contra invencao.
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

const textoDoLaudoAnterior = new Function('return ' + grab('textoDoLaudoAnterior'))();

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
ok(!/\n{3,}/.test(t), 'sem blocos de linhas em branco sobrando');

console.log('=== bordas ===');
ok(textoDoLaudoAnterior(null) === '', 'registro nulo vira vazio');
ok(textoDoLaudoAnterior({}) === '', 'registro sem html vira vazio');
ok(textoDoLaudoAnterior({ html: '' }) === '', 'html vazio vira vazio');
const sujo = textoDoLaudoAnterior({ html: '<div>antes<script>alert(1)</script><style>b{color:red}</style>depois</div>' });
ok(!sujo.includes('alert(1)') && !sujo.includes('color:red'), 'script e style nao entram no prompt');
ok(sujo.includes('antes') && sujo.includes('depois'), 'o texto em volta do script continua');

console.log('=== corte por tamanho (a conclusao nunca se perde) ===');
const gigante = '<div class="laudoTexto">' + 'medida repetida. '.repeat(900)
              + '<b>CONCLUSÃO: exame sem alteracoes. FIM DO LAUDO ANTERIOR.</b></div>';
const cortado = textoDoLaudoAnterior({ html: gigante }, 200);
ok(cortado.length <= 200 + 50, 'respeita o limite pedido (' + cortado.length + ' caracteres)');
ok(cortado.includes('omitido por tamanho'), 'avisa que cortou');
ok(cortado.trim().endsWith('FIM DO LAUDO ANTERIOR.'), 'corta o MIOLO e preserva o fim (a conclusao)');
const curto = textoDoLaudoAnterior({ html: '<div>laudo curto</div>' }, 200);
ok(curto === 'laudo curto', 'laudo dentro do limite passa inteiro, sem aviso de corte');

console.log('=== ligacao no prompt do gerarLaudo ===');
ok(/const anterior = exameAnteriorDoPaciente\(/.test(HTML), 'ainda procura o exame anterior do paciente');
ok(/const anteriorTxt = anterior \? textoDoLaudoAnterior\(anterior\) : ''/.test(HTML),
   'so extrai o texto quando existe exame anterior');
ok(/anteriorTxt \? "EXAME ANTERIOR DO MESMO PACIENTE/.test(HTML),
   'bloco do exame anterior so entra no prompt se houver texto');
const iAnt = HTML.indexOf('EXAME ANTERIOR DO MESMO PACIENTE');
const iSeg = HTML.indexOf('PACIENTE JÁ EXAMINADO NESTE SERVIÇO');
ok(iAnt > 0 && iSeg > 0 && iAnt < iSeg, 'o laudo anterior vem ANTES das regras de seguimento (que dizem "acima")');

console.log('=== travas contra inventar achado ===');
const bloco = HTML.slice(iAnt, iSeg);
ok(/PROIBIDO trazer para o laudo de hoje/.test(bloco), 'proibe copiar achado que so existe no exame antigo');
ok(/exclusivamente o que está no DITADO DE HOJE e nas IMAGENS DE HOJE/.test(bloco), 'fonte do laudo continua sendo o exame de hoje');
ok(/quando o achado existir NOS DOIS exames/.test(bloco), 'so compara quando ha os dois lados da comparacao');
ok(/NÃO afirme que desapareceu nem que persiste/.test(bloco), 'achado antigo nao citado hoje nao vira conclusao');
ok(/vale sempre o ditado de hoje/.test(bloco), 'em divergencia, manda o ditado de hoje');
ok(/observacoes_para_o_medico/.test(bloco), 'divergencias sao avisadas ao medico');
ok(/NÃO copie a redação do laudo anterior/.test(bloco), 'nao deixa copiar o texto antigo');
ok(/anteriorTxt \? "O laudo anterior completo está no bloco EXAME ANTERIOR/.test(HTML),
   'sem o conteudo do laudo antigo, volta a proibir afirmar estabilidade');

console.log('=== aviso na tela ===');
ok(/if\(anteriorTxt\) log\('Exame anterior de '/.test(HTML), 'o medico e avisado quando o laudo usou comparacao');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
