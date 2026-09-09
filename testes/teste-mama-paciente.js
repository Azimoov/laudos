// SEÇÃO "PARA A PACIENTE" — especificação 01 §4 (21/08/2026).
//
// A decisão que sustenta tudo aqui é ZERO GERAÇÃO LIVRE: se a IA escrevesse esta seção,
// mais cedo ou mais tarde ela suavizaria ou endureceria algo em relação ao texto técnico —
// e o documento passaria a se contradizer, no papel, assinado.
//
// E a segunda, mais importante que a seção inteira: nas categorias 4, 5 e 6 ela NÃO
// explica a suspeita. Escrever "provavelmente é câncer" num laudo entregue no balcão não é
// defensável.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function fatia(de, ate) {
  const i = HTML.indexOf(de), f = HTML.indexOf(ate, i);
  if (i < 0 || f < 0) throw new Error('não achei ' + de);
  return HTML.slice(i, f);
}
// 29/08/2026 — O FIM DA FATIA ERA GANANCIOSO. Ia ate o BLOCO 4, e no meio do caminho
// engolia TODA a tela de Configuracoes (modCfg*, bzRender e, a partir de hoje, a tela do
// Provedor de IA). Enquanto nada ali tinha `await`, passou despercebido; a tela nova do
// provedor tem, e a assercao "nenhuma chamada a IA na secao da paciente" reprovou codigo
// que nao e da secao da paciente. O fim CERTO e onde a proxima secao comeca.
const PAC = fatia('/* ============ SEÇÃO "PARA A PACIENTE" ============',
                  '/* ============ TELA 1 — GRADE DE MODELOS DE LAUDO (22/08/2026) ============');

let guardado = {};
const api = new Function('esc', 'localStorage', 'log', 'dadoSalvar',
  'const MAMA_RANK={"5":90,"4C":80,"4B":70,"4A":60,"4":55,"0":50,"6":95,"3":30,"2":20,"1":10};'
  + 'function _mamaRank(c){ var v=MAMA_RANK[String(c||"").toUpperCase()]; return v==null?-1:v; }\n'
  + PAC + '\nreturn {pacienteHTML, pacienteFolhaHTML, pacienteLigada, pacienteAlternar, PACIENTE_TXT, _pacienteChave};'
)(s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  { getItem: k => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = v; } },
  () => {}, (k, v) => { guardado[k] = v; });

const exame = (cat) => ({ tipo: 'mama', laudo: { conclusao: 'Categoria: BI-RADS ' + cat + '.' } });

console.log('=== nasce DESLIGADA ===');
// Decisão do médico: muitos solicitantes preferem dar a notícia na consulta, não pelo
// papel, e um laudo que explica BI-RADS 4 na sala de espera gera reclamação legítima.
guardado = {};
ok(api.pacienteLigada() === false, 'sem escolha guardada, está desligada');
ok(api.pacienteHTML(exame('2')) === '', 'e não sai nada no laudo');
ok(/gpaciente/.test(HTML) && /'gpaciente'\]/.test(HTML.replace(/\s/g, '')) === false || /gpaciente/.test(HTML),
   'a escolha tem chave própria para ser guardada');
ok(/DADOS_SINCRONIZADOS[^\]]*gpaciente/.test(HTML.replace(/\n/g, ' ')),
   'e ela é sincronizada — senão a escolha se perderia a cada abertura (porta sorteada)');

console.log('\n=== ligada, ela sai — e só em mama ===');
guardado.gpaciente = '1';
ok(api.pacienteHTML(exame('2')).indexOf('Informações para você sobre seu exame') > 0,
   'ligada, a seção aparece com o título amigável');
ok(api.pacienteHTML({ tipo: 'tireoide', laudo: { conclusao: 'Categoria: TI-RADS 3.' } }) === '',
   'e NÃO aparece em exame que não é de mama — as redações são de mama');
ok(api.pacienteHTML({ tipo: 'mama', laudo: { conclusao: 'Sem categoria.' } }) === '',
   'categoria não reconhecida: não fala com a paciente (na dúvida, silêncio)');

console.log('\n=== as redações tranquilas (1, 2 e 3) ===');
ok(/não mostrou nada fora do normal/.test(api.pacienteHTML(exame('1'))), 'categoria 1: nada fora do normal');
ok(/não é câncer/.test(api.pacienteHTML(exame('2'))), 'categoria 2: diz que é benigno, sem rodeio');
const t3 = api.pacienteHTML(exame('3'));
ok(/até 2 em cada 100/.test(t3), 'categoria 3: a chance em linguagem de gente, não em percentual técnico');
ok(/6 meses/.test(t3) && /não é urgência/.test(t3),
   'com o prazo e a tranquilização — é acompanhamento, não urgência');

console.log('\n=== 4, 5 e 6: NÃO explicam a suspeita ===');
// Esta é a asserção mais importante do arquivo.
['4A', '4B', '4C', '5', '6'].forEach(c => {
  const h = api.pacienteHTML(exame(c));
  ok(h.indexOf('Informações para você sobre seu exame') > 0, 'categoria ' + c + ': a seção existe');
  ok(!/c[âa]ncer|maligno|malignidade|tumor|suspeit/i.test(h),
     '   e NÃO usa "câncer", "maligno", "tumor" nem "suspeito"');
  ok(/investiga(ção|cao) adicional/i.test(h), '   diz que precisa de investigação adicional');
  ok(/o quanto antes/.test(h), '   e orienta procurar o médico solicitante o quanto antes');
  ok(!/%/.test(h), '   sem percentual de malignidade — isso é informação técnica, para o médico');
});
ok(api.pacienteHTML(exame('4A')) === api.pacienteHTML(exame('5')),
   '4, 5 e 6 compartilham a MESMA redação — a paciente não descobre a gravidade pelo texto');

console.log('\n=== a ressalva legal não é enfeite ===');
// Uma vez impressa, a explicação é do médico também.
const h2 = api.pacienteHTML(exame('2'));
ok(/não substitui/.test(h2), 'diz que não substitui o texto técnico');
ok(/consulta com o seu médico/.test(h2), 'nem a consulta');
ok(/<u>Levar esse exame para seu médico\.<\/u><br>/.test(h2),
   'o próximo passo começa com a orientação sublinhada');
ok(/laudo técnico apresentado nas páginas seguintes/.test(h2) && !/texto técnico acima/.test(h2),
   'a ressalva aponta para o laudo técnico nas páginas seguintes, não para cima');
ok(/Leve este laudo/.test(h2), 'e manda levar o laudo à consulta');
ok(/ondas de som, não usa radiação/.test(h2), 'e explica o método sem jargão');

console.log('\n=== zero geração livre ===');
ok(/PACIENTE_TXT/.test(PAC) && Object.keys(api.PACIENTE_TXT).length === 5,
   'as redações são tabela fixa (' + Object.keys(api.PACIENTE_TXT).length + ' entradas para revisar uma vez)');
// Cobra CÓDIGO, não comentário: a primeira versão desta asserção procurava "IA escreve" e
// batia no próprio comentário que EXPLICA por que a IA não escreve aqui. Teste que lê
// prosa em vez de comportamento é teste que erra dos dois lados.
const soCodigo = PAC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok(!/\bopenai\s*\(/.test(soCodigo) && !/\bawait\b/.test(soCodigo),
   'nenhuma chamada à IA no código da seção');
ok(!/resp\./.test(soCodigo), 'e nada vem da resposta da IA — só dos campos já calculados');
ok(/ZERO GERAÇÃO LIVRE/.test(PAC), 'e o porquê está escrito no código');

console.log('\n=== a categoria usada é a MAIS ALTA do laudo ===');
// Regra do §6 do modelo: com várias lesões, a categoria do EXAME é a mais alta.
const varias = { tipo: 'mama', laudo: { conclusao: 'Nódulo 1 — Categoria: BI-RADS 2.\nNódulo 2 — Categoria: BI-RADS 4B.' } };
const hv = api.pacienteHTML(varias);
ok(/investiga(ção|cao) adicional/i.test(hv),
   'com um achado 2 e outro 4B, vale a redação do 4B — nunca a mais tranquila');

console.log('\n=== onde ela entra no laudo ===');
const montagem=HTML.slice(HTML.indexOf('function abrirRevisao('),HTML.indexOf('function revMarcarEditado',HTML.indexOf('function abrirRevisao(')));
ok(montagem.indexOf('_folhaPaciente+_folhaAbre')>=0,
   'a folha da paciente entra ANTES da primeira folha técnica');
ok(!/pacienteHTML\(ex\)[\s\S]{0,300}<\/div><\/div>/.test(montagem),
   'a explicação não continua anexada ao fim do corpo técnico');
ok(/contenteditable="false"/.test(api.pacienteFolhaHTML(exame('2'))),
   'e não editável — editá-la à mão faria o que o desenho dela evita: divergir do técnico');
ok(api.pacienteFolhaHTML(exame('2')).indexOf(api.pacienteHTML(exame('2')))>=0,
   'a folha nova reutiliza exatamente os dizeres existentes, sem gerar outra versão');
guardado={};
ok(api.pacienteFolhaHTML(exame('2'))==='',
   'com a opção desligada, não nasce uma primeira página vazia');

console.log('\n=== a folha amigável é A4 e clara ===');
const cssFolha=HTML.slice(HTML.indexOf('.pacienteFolha{'),HTML.indexOf('/* Mama e Tireoide:',HTML.indexOf('.pacienteFolha{')));
ok(/height:297mm/.test(cssFolha) && /width:210mm/.test(cssFolha),
   'tem dimensões exatas de uma folha A4');
ok(/page-break-after:always/.test(cssFolha) && /break-after:page/.test(cssFolha),
   'obriga o laudo técnico a começar na página seguinte');
ok(/background:#F4FAF9!important/.test(cssFolha) && !/background:\s*#(?:000|111|121|151)/i.test(cssFolha),
   'usa fundo claro opaco, sem o cartão preto');
ok(/\.pacienteFolha \.pacBox[\s\S]*background:#FFFFFF!important/.test(cssFolha),
   'o conteúdo fica em cartão branco de alto contraste');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
