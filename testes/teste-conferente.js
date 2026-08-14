// O CONFERENTE — segunda leitura do laudo, por quem nao o escreveu (12/08/2026).
//
// A ideia que estes testes protegem: o conferente recebe SO O TEXTO PRONTO. Nao ve as
// imagens nem o ditado. Um conferente que le as mesmas fontes do redator repete o erro
// do redator; um que le so o produto enxerga a contradicao entre o corpo e a conclusao.
//
// E protegem, acima de tudo, que o painel NAO MINTA: laudo antigo, conferente desligado,
// conferencia que falhou ou laudo editado depois NAO podem aparecer como "conferido".
const fs = require('fs');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

function grab(name) {
  let i = HTML.indexOf('async function ' + name + '(');
  if (i < 0) i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nao achei ' + name);
  let d = 0, on = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) return HTML.slice(i, j + 1); }
  }
}
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

// ---- caixa de areia ----
let ultima = null;
const respostas = [];
async function openai(conteudo, querJson, opts) {
  ultima = { conteudo, querJson, opts };
  const r = respostas.shift();
  if (r instanceof Error) throw r;
  return r;
}
const guardado = {};
const localStorage = { getItem: k => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = String(v); } };
const cfg = { modelo: 'gpt-5.5', modeloAux: 'gpt-5-mini' };
const log = () => {};

const src = [
  (HTML.match(/const CONFERENTE_TIPOS = \[[^\]]*\];/) || [])[0],
  (HTML.match(/const ALERTAS = \[[\s\S]*?\n\];/) || [])[0],
  grab('conferenteLigado'), grab('conferenteAlternar'), grab('conferenteTipoValido'),
  grab('conferenteGravidade'), grab('conferenteMarca'), grab('conferentePrompt'),
  grab('conferirLaudo'), grab('alertasConferente'), grab('alertaTipoValido')
].join('\n');
const A = new Function('openai', 'localStorage', 'cfg', 'log', src
  + '\nreturn {conferenteLigado, conferenteAlternar, conferenteTipoValido, conferenteGravidade,'
  + ' conferenteMarca, conferentePrompt, conferirLaudo, alertasConferente, alertaTipoValido, ALERTAS, CONFERENTE_TIPOS};'
)(openai, localStorage, cfg, log);
const { conferenteLigado, conferenteAlternar, conferenteTipoValido, conferenteGravidade,
        conferenteMarca, conferentePrompt, conferirLaudo, alertasConferente,
        alertaTipoValido, ALERTAS, CONFERENTE_TIPOS } = A;

const laudoNovo = () => ({
  titulo: 'RELATORIO ULTRASSONOGRAFICO ABDOMINAL',
  cab: { nome: 'Fulano', idade: '4 anos', dados_clinicos: 'dor abdominal' },
  corpo: '**Figado** com dimensoes normais. Lobo direito mede 14,2 cm.\n\n**Rim direito** sem alteracoes.',
  conclusao: 'Exame ecografico compativel com a normalidade.'
});
const soTexto = a => (a.length === 1 ? a[0].texto : '(nenhum aviso)');

(async function () {

console.log('=== leitor SEPARADO: so o texto, nunca a imagem, nunca o ditado ===');
respostas.push({ problemas: [] });
let L = laudoNovo();
let r = await conferirLaudo(L);
const enviado = JSON.stringify(ultima.conteudo);
ok(ultima.conteudo.every(x => x.type === 'text'), 'todas as partes enviadas sao de texto');
ok(!enviado.includes('data:image') && !enviado.includes('image_url') && !enviado.includes('base64'),
   'nenhuma imagem viaja junto — nem data:image, nem image_url, nem base64');
// SENTINELA: uma frase que so existiria se o ditado fosse anexado.
const SENT = 'ZZ_FRASE_DO_DITADO_QUE_NAO_PODE_VAZAR_ZZ';
L.transcricao = SENT; L._transcricao = SENT; L.ditado = SENT;
respostas.push({ problemas: [] });
await conferirLaudo(L);
ok(!JSON.stringify(ultima.conteudo).includes(SENT),
   'o ditado NAO vai junto — provado por sentinela, nao por procurar uma palavra');
ok(ultima.opts.modelo === 'gpt-5-mini', 'usa o modelo auxiliar quando ele esta configurado');

console.log('=== o custo real quando o campo auxiliar esta VAZIO ===');
cfg.modeloAux = '';
respostas.push({ problemas: [] });
await conferirLaudo(laudoNovo());
ok(ultima.opts.modelo === 'gpt-5.5',
   'sem modelo auxiliar, cai no PRINCIPAL — comportamento real, e a tela precisa dizer isso');
ok(/se aquele campo estiver vazio, ele roda no modelo principal/i.test(HTML),
   'e a tela de Configuracoes avisa que ai custa mais');
cfg.modeloAux = 'gpt-5-mini';

console.log('=== o cabecalho entra: idade e dados clinicos ===');
const p = conferentePrompt(laudoNovo());
ok(/IDADE: 4 anos/.test(p), 'a idade vai no prompt (medida de crianca nao e medida de adulto)');
ok(/DADOS CL[ÍI]NICOS: dor abdominal/.test(p), 'os dados clinicos tambem');
ok(p.includes('Lobo direito mede 14,2 cm') && p.includes('compativel com a normalidade'),
   'corpo e conclusao vao inteiros');
ok(/N[ÃA]O foi voc[êe] quem escreveu este laudo/.test(p), 'o prompt diz que ele nao e o redator');
ok(/N[ÃA]O tem acesso [àa]s imagens nem ao ditado/.test(p), 'e que nao tem imagens nem ditado');

console.log('=== os cinco assuntos pedidos pelo medico ===');
['coerencia', 'medida', 'conclusao', 'lateralidade', 'gramatica'].forEach(t => {
  ok(CONFERENTE_TIPOS.includes(t) && new RegExp('\\b' + t).test(p), 'confere ' + t);
});
ok(/N[ÃA]O reescreva o laudo/.test(p), 'aponta, nao conserta');
ok(/N[ÃA]O invente problema/.test(p), 'proibido inventar problema para parecer util');
ok(/Pontilhados/.test(p), 'pontilhado e campo a preencher, nao erro');
ok(/CALCULADOS PELO APLICATIVO/.test(p) && /N[ÃA]O os conteste/.test(p),
   'e nao pode contestar TI-RADS/BI-RADS/O-RADS: aquilo e conta do app, nao opiniao');

console.log('=== o painel NAO PODE MENTIR: os cinco estados ===');
const cxVazia = ALERTAS.find(a => a.k === 'conferente').vazio;
ok(!/leu e n[ãa]o achou|sem problema|tudo certo/i.test(cxVazia),
   'a caixa apagada nao se le como aprovacao: "' + cxVazia + '"');

ok(/N[ÃA]O passou pela segunda leitura/.test(soTexto(alertasConferente(laudoNovo()))),
   '1) laudo ANTIGO (sem campo conferencia) diz que nao foi conferido');

guardado['gconferente'] = '0';
L = laudoNovo(); L.conferencia = await conferirLaudo(L);
ok(L.conferencia.rodou === false && L.conferencia.motivo === 'desligado', 'desligado nao chama a IA');
ok(/N[ÃA]O foi feita/.test(soTexto(alertasConferente(L))) && /desligado/.test(soTexto(alertasConferente(L))),
   '2) DESLIGADO diz que nao foi conferido, e por que');
guardado['gconferente'] = '1';

respostas.push(new Error('rede caiu'));
L = laudoNovo(); L.conferencia = await conferirLaudo(L);
ok(L.conferencia.rodou === false, '3) FALHA de rede: rodou=false');
ok(/rede caiu/.test(soTexto(alertasConferente(L))) && /leia com mais aten/.test(soTexto(alertasConferente(L))),
   '   e o aviso diz o motivo e o que fazer');

respostas.push({ resultado: 'nenhum problema' });          // formato errado
L = laudoNovo(); L.conferencia = await conferirLaudo(L);
ok(L.conferencia.rodou === false, '4) RESPOSTA FORA DO FORMATO nao conta como conferido');
ok(/fora do formato/.test(soTexto(alertasConferente(L))), '   e o medico fica sabendo');

respostas.push({ problemas: [] });
L = laudoNovo(); L.conferencia = await conferirLaudo(L);
ok(L.conferencia.rodou === true, '5) conferiu de verdade e nao achou nada');
ok(/^✓ O conferente leu este texto/.test(soTexto(alertasConferente(L))),
   '   e SO nesse caso o painel diz que leu: "' + soTexto(alertasConferente(L)).slice(0, 40) + '..."');

console.log('=== o caso LIMPO nao pode acender a caixa (sinal de relance) ===');
// caixa acesa e para OCORRENCIA. Se o roxo acende todo dia, no dia do achado grave
// ele parece igual ao de ontem — foi a regressao apontada na 1a avaliacao.
const avisoLimpo = alertasConferente(L)[0];
ok(avisoLimpo.calmo === true, 'o aviso de "li e esta limpo" vem marcado como CALMO');
{
  const painel = { innerHTML: '' };
  const doc = { getElementById: id => (id === 'painelAlertas' ? painel : null) };
  const M = new Function('document', [
    (HTML.match(/const ALERTAS = \[[\s\S]*?\n\];/) || [])[0],
    grab('esc'), grab('alertaTipoValido'), grab('montarAlertas')
  ].join('\n') + '\nreturn montarAlertas;')(doc);
  M(alertasConferente(L));
  const caixa = painel.innerHTML.slice(painel.innerHTML.indexOf('--corAlerta:#6A4FB6') - 40);
  ok(!/class="alerta aceso"[^>]*>\s*<div class="alertaTit"><span class="alertaLed"><\/span>Revis/.test(painel.innerHTML),
     'e a caixa do conferente NAO vem acesa');
  ok(painel.innerHTML.includes('não encontrou problema'),
     'mas o texto do ✓ aparece dentro dela, no lugar da frase de caixa vazia');
  ok((painel.innerHTML.match(/class="alerta aceso"/g) || []).length === 0,
     'laudo limpo: nenhuma caixa acesa no painel inteiro');
  // e o contrario: achado de verdade TEM que acender
  M([{ tipo: 'conferente', texto: 'lateralidade trocada' }]);
  ok((painel.innerHTML.match(/class="alerta aceso"/g) || []).length === 1,
     'achado de verdade acende — o sinal de relance continua servindo');
}

console.log('=== a conferencia VENCE quando o laudo e editado depois ===');
ok(conferenteMarca(laudoNovo()) === conferenteMarca(laudoNovo()), 'mesmo texto, mesma marca');
L.corpo = L.corpo.replace('14,2', '8,2');                  // o medico corrigiu a medida
ok(/VENCEU/.test(soTexto(alertasConferente(L))),
   'texto mudou depois da leitura -> o aviso avisa que venceu, em vez de apontar trecho que sumiu');
L.conclusao = 'outra conclusao';
ok(/VENCEU/.test(soTexto(alertasConferente(L))), 'mudanca na conclusao tambem vence');
ok(conferenteMarca({ titulo: 'a', corpo: 'b', conclusao: 'c' })
   !== conferenteMarca({ titulo: 'ab', corpo: '', conclusao: 'c' }),
   'a marca nao confunde textos diferentes que se emendariam');
// a marca tem de cobrir TUDO o que foi enviado, nao so corpo/titulo/conclusao
{
  const base = laudoNovo();
  const idadeOutra = laudoNovo(); idadeOutra.cab = { ...idadeOutra.cab, idade: '40 anos' };
  ok(conferenteMarca(base) !== conferenteMarca(idadeOutra),
     'mudar so a IDADE ja vence a conferencia (medida de crianca nao e medida de adulto)');
  const clinOutro = laudoNovo(); clinOutro.cab = { ...clinOutro.cab, dados_clinicos: 'outra queixa' };
  ok(conferenteMarca(base) !== conferenteMarca(clinOutro), 'mudar os dados clinicos tambem');
  const extraOutro = laudoNovo(); extraOutro.extra = 'texto complementar novo';
  ok(conferenteMarca(base) !== conferenteMarca(extraOutro), 'mudar o texto complementar tambem');
}
// a tela 3 nao escreve de volta em L.corpo: por isso existe a bandeira editadoDepois
{
  const Led = laudoNovo();
  Led.conferencia = { itens: [], rodou: true, marca: conferenteMarca(Led), editadoDepois: true };
  ok(/VENCEU/.test(soTexto(alertasConferente(Led))),
     'digitou na tela 3 (texto so no DOM) -> a bandeira vence a conferencia do mesmo jeito');
}
// NAO contar quantos handlers existem: "exatamente 2" travaria o buraco no lugar —
// quebraria justamente no dia em que alguem acrescentasse o handler que falta.
// A regra certa e: TODO campo editavel do laudo avisa quando muda.
{
  const areaIni = HTML.indexOf("document.getElementById('areaImpressao').innerHTML");
  const areaFim = HTML.indexOf("montarAlertas(alertasDoLaudo(L)", areaIni);
  const montagem = HTML.slice(areaIni, areaFim);
  const editaveis = montagem.match(/contenteditable="true"[^>]*/g) || [];
  ok(editaveis.length >= 3, 'a folha do laudo tem varios campos editaveis (' + editaveis.length + ')');
  const semAviso = editaveis.filter(t => !/revMarcarEditado/.test(t));
  ok(semAviso.length === 0,
     'TODOS avisam quando o medico digita — inclusive o cabecalho, onde mora a IDADE'
     + (semAviso.length ? (' | sem handler: ' + semAviso.join(' ~ ').slice(0, 120)) : ''));
}
// so o CORPO da funcao, nao o resto do arquivo: antes o teste casava com o rev2Render()
// do fim e nao via o `return` antecipado do bloco da conclusao
{
  const i = HTML.indexOf('function rev2Editou');
  let d = 0, on = false, corpo = '';
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; on = true; }
    else if (HTML[j] === '}') { d--; if (on && d === 0) { corpo = HTML.slice(i, j + 1); break; } }
  }
  const saidas = corpo.split('return');
  ok(saidas.length >= 2, 'rev2Editou tem um caminho de saida antecipado (o bloco da conclusao)');
  ok(/rev2Render\(\);\s*return/.test(corpo),
     'o caminho da CONCLUSAO repinta antes de sair — era o unico bloco que nao repintava');
  ok(/rev2Render\(\);\s*\n?\}$/.test(corpo.trim()),
     'e o caminho normal repinta no fim');
}

console.log('=== achou problema: ordem, categoria e conteudo ===');
respostas.push({ problemas: [
  { tipo: 'gramatica', gravidade: 'baixa', trecho: 'dimensoes', problema: 'falta o til', sugestao: 'dimensões' },
  { tipo: 'lateralidade', gravidade: ' ALTA. ', trecho: 'Rim direito', problema: 'corpo diz direito, conclusao diz esquerdo', sugestao: 'confira o lado' },
  { tipo: 'medida', gravidade: 'média', trecho: '14,2 cm', problema: 'no limite superior', sugestao: 'confira' }
] });
L = laudoNovo(); L.conferencia = await conferirLaudo(L);
const av = soTexto(alertasConferente(L));
ok(L.conferencia.itens.length === 3, 'os tres pontos entraram');
ok(L.conferencia.itens[0].gravidade === 'alta',
   '" ALTA. " com espaco e ponto ainda vale ALTA — e por isso vem primeiro');
ok(L.conferencia.itens[1].gravidade === 'media', '"média" com acento vale media');
ok(L.conferencia.itens[2].gravidade === 'baixa', 'e o acento errado fica por ultimo');
ok(av.includes('Rim direito') && av.includes('confira o lado'), 'o aviso traz o trecho e a sugestao');
ok(alertaTipoValido('conferente') === 'conferente', 'a categoria existe no painel');
ok(ALERTAS.some(a => a.k === 'conferente' && /^#[0-9a-f]{6}$/i.test(a.cor)), 'com cor propria');
ok(new Set(ALERTAS.map(a => a.cor)).size === ALERTAS.length, 'e sem repetir a cor de outra categoria');

console.log('=== entrada torta nao vira afirmacao errada ===');
ok(conferenteTipoValido('inventado') === 'outros',
   'tipo desconhecido cai em "outros", como o resto do app — nao vira "coerencia"');
['coerência', 'gramática', 'conclusão', 'CONCLUSÃO', 'Lateralidade '].forEach(t => {
  ok(conferenteTipoValido(t) !== 'outros', 'tipo acentuado "' + t + '" e reconhecido -> ' + conferenteTipoValido(t));
});
ok(conferenteTipoValido('coerência') === 'coerencia', 'e "coerência" cai em coerencia, nao em outros');
ok(conferenteGravidade(undefined) === 'media' && conferenteGravidade('gravissima') === 'media',
   'gravidade desconhecida vira media');
respostas.push({ problemas: [{ tipo: 'medida', problema: '   ' }] });
L = laudoNovo(); L.conferencia = await conferirLaudo(L);
ok(L.conferencia.itens.length === 0 && L.conferencia.rodou === true, 'problema sem texto e descartado');

console.log('=== laudo vazio e nulo ===');
const antes = respostas.length;
r = await conferirLaudo({ corpo: '' });
ok(r.rodou === false && respostas.length === antes, 'sem corpo, nem chama a IA');
ok((await conferirLaudo(null)).rodou === false, 'laudo nulo nao quebra');
ok(alertasConferente(null).length === 0, 'e nao gera aviso sobre laudo que nao existe');

console.log('=== o interruptor ===');
ok(conferenteLigado() === true, 'vem LIGADO de fabrica');
conferenteAlternar({ checked: false });
ok(conferenteLigado() === false, 'desligar grava mesmo');
conferenteAlternar({ checked: true });
ok(conferenteLigado() === true, 'religar tambem');
ok(/id="cfgConferente"/.test(HTML) && /_ck\.checked=conferenteLigado\(\)/.test(HTML),
   'a caixa existe nas Configuracoes E e inicializada com o valor guardado');

console.log('=== ligado no app ===');
ok(/ex\.laudo\.conferencia = await conferirLaudo\(ex\.laudo\)/.test(HTML),
   'roda na geracao, guardando o RESULTADO (nao o texto do aviso)');
const trecho = HTML.slice(HTML.indexOf('ex.laudo = {cab:resp.cabecalho'), HTML.indexOf('ex._liberado=false'));
ok(/conferirLaudo/.test(trecho), 'e DEPOIS de o laudo estar montado, nao antes');
ok((HTML.match(/alertasConferente\(L\)/g) || []).length >= 2,
   'o aviso e montado na hora nas DUAS telas de revisao (nao fica guardado envelhecendo)');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);

})().catch(function (e) { console.log('  FALHA inesperada: ' + e.message); process.exit(1); });
