// ESQUEMA ANATÔMICO DO ÚTERO E CLASSIFICAÇÃO FIGO DE MIOMAS
// Exames: transvaginal e pelvica
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

const ini = HTML.indexOf('/* ============ ESQUEMA ANATÔMICO DO ÚTERO / MIOMA FIGO ============');
const fim = HTML.indexOf('/* ===================== TELA DE ABERTURA', ini);
if (ini < 0 || fim < 0) throw new Error('não achei o módulo do útero no index.html');
/* `cmTxt` (o milimetro escrito em centimetros) mora fora do modulo do utero, e a bancada
   nao a fornecia. Ela so e chamada quando a lesao TEM medida -- e ate 10/09/2026 a lesao
   do laudo de exemplo vinha da CONCLUSAO, que nao tem medida nenhuma. Corrigido o gatilho,
   a lesao passou a vir da DESCRICAO, com medida, e a falta apareceu na hora.
   Vem recortada do proprio index.html, nunca reescrita aqui: copia de regra passa verde
   depois de o programa mudar de ideia. */
function recortarFuncao(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei a função ' + nome);
  let d = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; comecou = true; }
    else if (HTML[j] === '}') { d--; if (comecou && d === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('função ' + nome + ' não fecha');
}
const MOD = recortarFuncao('cmTxt') + '\n' + HTML.slice(ini, fim);

const holder = { ex: null, logs: [] };
const api = new Function('esc', 'negrito', 'imagensRevisaoLigadas', 'rev2TemAchado', 'rev2Ex', 'log', 'agendarSalvarSessao', 'rev2Render',
  MOD + '\nreturn {uteroNorm, uteroFigoDesc, uteroFigoGrupo, uteroFigoCor, uteroParede, uteroTerco, uteroFigo, uteroMedidasMm,' +
  ' _uteroRaioPx, uteroSagitalXY, uteroTransversalXY, uteroLesoes, uteroReescreverLocal, uteroLocalEstruturadaAtualizar,' +
  ' _uteroSagitalSVG, _uteroTransversalSVG, uteroEsquemaHTML, uteroLayoutDo, uteroHostHTML, uteroCorpoHTML, uteroCaixaHTML, uteroTemSelecao};')(
  s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])),
  s => String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'),
  () => true, () => true, () => holder.ex, m => holder.logs.push(m), () => {}, () => {}
);

console.log('=== classificação FIGO e identificação de descritores ===');
ok(api.uteroFigo('FIGO 0') === '0', 'lê FIGO 0');
ok(api.uteroFigo('FIGO 4') === '4', 'lê FIGO 4');
ok(api.uteroFigo('FIGO 2-5') === '2-5', 'lê híbrido FIGO 2-5');
ok(api.uteroFigo('submucoso pedunculado intracavitário') === '0', 'infere FIGO 0 de submucoso intracavitário');
ok(api.uteroFigo('submucoso < 50% intramural') === '1', 'infere FIGO 1 de submucoso < 50%');
ok(api.uteroFigo('submucoso com mais de 50% intramural') === '2', 'infere FIGO 2 de submucoso >= 50%');
ok(api.uteroFigo('intramural com contato endometrial') === '3', 'infere FIGO 3 de intramural com contato');
ok(api.uteroFigo('nódulo intramural') === '4', 'infere FIGO 4 de intramural puro');
ok(api.uteroFigo('subseroso com mais de 50% intramural') === '5', 'infere FIGO 5 de subseroso >= 50%');
ok(api.uteroFigo('subseroso < 50% intramural') === '6', 'infere FIGO 6 de subseroso < 50%');
ok(api.uteroFigo('subseroso pedunculado') === '7', 'infere FIGO 7 de subseroso pedunculado');

console.log('\n=== E QUANDO A FRASE NAO DIZ, ELA NAO INVENTA (09/09/2026) ===');
/* Ate 09/09 esta funcao terminava em `return '4'`: frase nenhuma saia classificada como
   FIGO 4 (intramural puro), e esse numero entra no TEXTO do laudo e na legenda impressa.
   FIGO 4 nao e palpite prudente — e afirmacao clinica, e o tipo decide a via cirurgica.
   Medido no artigo de referencia (Liu et al., Abdom Radiol 2025, acesso aberto, texto
   completo lido — ver conhecimento\mioma-figo.md): com RESSONANCIA no protocolo comum,
   dois radiologistas treinados acertaram 58,9% dos tipos contra a cirurgia.
   Estas linhas existem para que ninguem devolva o chute achando que corrige um "vazio". */
ok(api.uteroFigo('nódulo miometrial de 3,0 cm') === '',
   'nodulo sem descritor nenhum fica SEM tipo (antes virava FIGO 4)');
ok(api.uteroFigo('formação nodular sólida hipoecogênica') === '',
   'descricao generica fica sem tipo');
ok(api.uteroFigo('') === '', 'frase vazia nao classifica nada');
ok(api.uteroFigo('cisto de Naboth') === '', 'texto que nem fala de mioma nao classifica');
/* As duas mais importantes: submucoso e subseroso SOZINHOS. O que separa 0/1/2 e 5/6/7 e
   a proporcao intramural, e e exatamente a fronteira 1-2 que decide entre ressecao
   histeroscopica e cirurgia aberta. Sem o numero na frase, nao ha tipo. */
ok(api.uteroFigo('nódulo submucoso') === '',
   'submucoso SEM a proporcao nao vira FIGO 1 — a fronteira 1/2 muda a conduta');
ok(api.uteroFigo('nódulo subseroso') === '',
   'subseroso SEM a proporcao nao vira FIGO 6');
/* O caso em que a ausencia E informacao: o laudo diz "com contato endometrial" quando ha
   contato (tipo 3). "Intramural" sem essa ressalva descreve o tipo 4 — continua valendo. */
ok(api.uteroFigo('nódulo intramural') === '4',
   'mas "intramural" sozinho continua 4: aqui a ausencia da ressalva E informacao');

console.log('\n=== e o resto do programa aguenta o "sem tipo" ===');
ok(api.uteroFigoDesc('') === 'FIGO não classificado',
   'a legenda diz "nao classificado", nao um numero');
ok(api.uteroFigoGrupo('') === 'outro', 'o grupo cai em "outro", sem erro');
ok(api.uteroFigoCor('') === '#475569', 'e o marcador sai cinza, nao com a cor de um tipo');
const semTipo = api.uteroSagitalXY({ parede: 'anterior', figo: '', terco: 'medio' });
ok(Array.isArray(semTipo) && semTipo.length === 2 && semTipo.every(n => isFinite(n)),
   'o marcador ainda e desenhado (coordenadas validas), so que sem afirmar profundidade');

console.log('\n=== localização de parede e terço ===');
ok(api.uteroParede('parede anterior corporal') === 'anterior', 'parede anterior');
ok(api.uteroParede('parede posterior') === 'posterior', 'parede posterior');
ok(api.uteroParede('no fundo uterino') === 'fundo', 'fundo uterino');
ok(api.uteroParede('parede lateral direita') === 'lateral-direita', 'lateral direita');
ok(api.uteroParede('parede lateral esquerda') === 'lateral-esquerda', 'lateral esquerda');
ok(api.uteroParede('região cervical / colo') === 'colo', 'colo uterino');
ok(api.uteroTerco('terço superior') === 'superior', 'terço superior');
ok(api.uteroTerco('terço médio') === 'medio', 'terço médio');
ok(api.uteroTerco('terço inferior') === 'inferior', 'terço inferior');

console.log('\n=== extração de medidas e calibração de raio ===');
const m1 = api.uteroMedidasMm('medindo 2,5 x 2,0 cm');
ok(m1[0] === 25 && m1[1] === 20, 'medidas 2,5 x 2,0 cm convertidas para 25 e 20 mm');
const rPequeno = api._uteroRaioPx(8);
const rGrande = api._uteroRaioPx(35);
ok(rPequeno < rGrande, 'nódulo maior gera marcador com raio maior (escala proporcional)');
ok(rPequeno >= 10 && rGrande <= 24, 'respeita pisos e tetos de visibilidade');

console.log('\n=== leitura de lesões no laudo ===');
const laudoExemplo = {
  corpo: '**ÚTERO:** Anteversofletido, medindo 7,5 x 4,2 x 4,8 cm.\n' +
         'Textura miometrial heterogênea, à custa de imagem nodular, sólida, hipoecogênica, ' +
         'localizada na parede corporal anterior em seu terço médio, medindo 2,8 x 2,2 cm FIGO 4.\n\n' +
         '**Endométrio:** Espessura de 6,0 mm.\n\n' +
         '**Ovários:** Normais.\n\n' +
         'CONCLUSÃO: Exame ecográfico compatível com leiomioma uterino FIGO 4.',
  _uteroIlustracoes: { ativo: true }
};
const lesoes = api.uteroLesoes(laudoExemplo);
ok(lesoes.plot.length === 1, 'reconhece 1 mioma no laudo');
ok(lesoes.plot[0].parede === 'anterior', 'parede anterior identificada');
ok(lesoes.plot[0].figo === '4', 'FIGO 4 identificado');
ok(lesoes.plot[0].terco === 'medio', 'terço médio identificado');

console.log('\n=== LAUDO NORMAL NAO GANHA MIOMA DE PRESENTE (09/09/2026) ===');
/* Ate 09/09, se o laudo NAO falasse de mioma e o medico ligasse a ilustracao, o programa
   inseria a frase fixa 'Mioma intramural na parede anterior FIGO 4'. Era para dar algo
   para arrastar. O efeito real: um laudo de utero normal, com conclusao "dentro dos
   limites da normalidade", saia IMPRESSO com a legenda
      • Mioma 1: FIGO 4 (intramural puro) — parede anterior
   Achado inventado em documento assinado, contradizendo a conclusao do proprio laudo.
   E nao servia nem para o que foi feito: arrasta-lo chamava uteroReescreverLocal, que
   procura a frase DENTRO do laudo; a frase nao estava la, a reescrita falhava e o
   marcador ficava preso, desenhando um mioma que ninguem conseguia corrigir nem apagar. */
const laudoNormal = {
  corpo: '**ÚTERO:** Anteversofletido, contornos regulares, medindo 7,1 x 3,9 x 4,4 cm.\n' +
         'Miométrio de ecotextura homogênea.\n\n' +
         '**Endométrio:** Espessura de 5,0 mm, regular.\n\n' +
         '**Ovários:** Tópicos, com dimensões preservadas.\n\n' +
         'CONCLUSÃO: Exame ecográfico dentro dos limites da normalidade.',
  _uteroIlustracoes: { ativo: true }   // o medico LIGOU a ilustracao
};
const semMioma = api.uteroLesoes(laudoNormal);
ok(semMioma.plot.length === 0,
   'laudo sem mioma continua sem mioma, mesmo com a ilustracao ligada');
const hostNormal = api.uteroHostHTML(laudoNormal);
ok(!/Mioma \d/.test(hostNormal),
   'e NADA de "Mioma 1" na legenda que vai para o papel');
ok(hostNormal === '',
   'sem achado, nao se desenha figura nenhuma (o botao e quem avisa o medico)');
/* A contraprova: com mioma no texto, tudo continua funcionando como antes. */
ok(/Mioma 1/.test(api.uteroHostHTML(laudoExemplo)),
   'contraprova: com mioma descrito, a legenda continua saindo');

console.log('\n=== coordenadas e ortogonalidade das duas vistas ===');
const xySag = api.uteroSagitalXY(lesoes.plot[0]);
const xyTra = api.uteroTransversalXY(lesoes.plot[0]);
ok(Array.isArray(xySag) && xySag.length === 2, 'coordenadas sagitais [x, y] geradas');
ok(Array.isArray(xyTra) && xyTra.length === 2, 'coordenadas transversais [x, y] geradas');
// Parede anterior fica superior no corte sagital e transversal
ok(xySag[1] < 100, 'parede anterior fica superior na vista sagital');
ok(xyTra[1] < 120, 'parede anterior fica superior (ventral) na vista transversal');

console.log('\n=== reescrita de frase com arraste do mioma ===');
const reescrito = api.uteroReescreverLocal(laudoExemplo.corpo, 'U1', 'posterior', 'medio', '6');
ok(reescrito.ok, 'reescrita efetuada com sucesso');
ok(/parede posterior corporal/.test(reescrito.corpo), 'parede atualizada para posterior');
ok(/FIGO 6/.test(reescrito.corpo), 'classificação atualizada para FIGO 6');
ok(/leiomioma uterino FIGO 6/.test(reescrito.corpo), 'conclusão também sincronizada para FIGO 6');
ok(/medindo 2,8 x 2,2 cm/.test(reescrito.corpo), 'medidas preservadas intactas');

console.log('\n=== geração de SVG e HTML do esquema ===');
const htmlHost = api.uteroHostHTML(laudoExemplo);
ok(htmlHost.includes('laudoUteroHost'), 'host encapsulado com classe laudoUteroHost');
ok((htmlHost.match(/<svg/g) || []).length === 2, 'gera exatamente 2 SVGs (corte sagital e corte transversal)');
ok(htmlHost.includes('CORTE SAGITAL') && htmlHost.includes('CORTE TRANSVERSAL'), 'contém rótulos das duas vistas');
ok(htmlHost.includes('Representação esquemática'), 'inclui ressalva clínica');
ok(htmlHost.includes('🔒 Travada'), 'nasce travada por padrão');

console.log('\n=== inserção no laudo ===');
const corpoCompleto = api.uteroCorpoHTML(laudoExemplo);
ok(corpoCompleto.includes('laudoUteroSecao'), 'seção do útero criada no corpo do laudo');
ok(corpoCompleto.includes('laudoUteroHost'), 'host inserido dentro da seção do útero');
ok(corpoCompleto.indexOf('laudoUteroHost') < corpoCompleto.indexOf('Ovários'), 'figura fica antes dos ovários');

console.log('\n=== integração com a impressão e paginação ===');
ok(/laudoUteroSecao/.test(HTML) && /laudoUteroHost/.test(HTML), '_paginarPontos reconhece útero como ponto atômico');
ok(/laudoUteroLayoutControles/.test(HTML), 'controles do útero são expurgados na impressão');
ok(/uteroCaixaHTML/.test(HTML), 'tela de revisão inclui cartão para útero');
ok(/ex\.tipo==='transvaginal'/.test(HTML) && /uteroCorpoHTML/.test(HTML), 'areaImpressao injeta uteroCorpoHTML em transvaginal');

/* ⚠️ 10/09/2026 — O GATILHO: QUE FRASE VIRA MARCADOR.
   Relato dele: "fiz agora um teste e nao apareceu a opcao de incluir a imagem."
   A regra antiga era uma expressao so, e na pratica SO A PALAVRA "mioma" funcionava:
   ela exigia o qualificador colado na palavra nodulo ("nodulo miometrial hipoecogenico"
   nao passava, porque "miometrial" esta no meio), e as alternativas "hipoec" e "heterog"
   terminavam numa exigencia de FIM DE PALAVRA que "hipoecogenico" nunca cumpre -- estavam
   mortas desde que foram escritas. O laudo dizia o mioma com todas as letras e a opcao
   nao aparecia, sem erro e sem aviso.

   ESTE BLOCO TEM DOIS LADOS, e os dois importam. Alargar o gatilho e facil; alargar sem
   passar a marcar o que NAO e mioma e o trabalho. Marcador a mais e achado inventado num
   documento assinado -- foi o defeito de 09/09, que pos "Mioma FIGO 4" num utero normal. */
console.log('\n=== o gatilho: frases de laudo que DEVEM virar marcador ===');
[
  'Miométrio com ecotextura heterogênea, apresentando nódulo miometrial hipoecogênico na parede anterior, medindo 2,3 x 2,1 x 1,9 cm.',
  'Presença de mioma intramural na parede posterior, medindo 3,0 cm.',
  'Útero com contornos regulares, apresentando leiomioma subseroso na parede lateral direita.',
  'Miométrio heterogêneo, com nódulo hipoecogênico de 2,0 cm na parede anterior.',
  'Nódulo miometrial na parede posterior medindo 1,8 cm.',
  'Útero aumentado, com formação nodular hipoecogênica intramural anterior de 2,5 cm.',
  'Miométrio com nódulo sólido hipoecogênico na parede anterior.',
  'Presença de imagem nodular hipoecogênica no miométrio, parede posterior, de 2,2 cm.',
  'Dois miomas intramurais, o maior na parede anterior.',
  'Nódulo uterino hipoecogênico de 1,5 cm.',
].forEach(f => ok(api.uteroLesoes({ corpo: f }).plot.length > 0, f.slice(0, 78)));

console.log('\n=== e as que NAO podem: marcador a mais e achado inventado ===');
[
  'Útero de contornos regulares e ecotextura homogênea. Miométrio sem alterações.',
  'Ovário direito com cisto simples, anecoico, de 2,0 cm.',
  'Nódulo sólido no ovário esquerdo, medindo 1,8 cm.',
  'Formação anexial cística à direita.',
  'Endométrio linear, homogêneo, medindo 4 mm.',
  'Útero de paredes regulares, sem alterações.',
  'Endometrioma no ovário direito de 3 cm.',
].forEach(f => ok(api.uteroLesoes({ corpo: f }).plot.length === 0, f.slice(0, 78)));

console.log('\n' + (falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo'));
process.exit(falhas ? 1 : 0);
