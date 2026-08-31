// O AUDITORIA-CBR NAO E REFERENCIA OFICIAL — 24/08/2026, decisao do medico.
//
// O documento apareceu na raiz do repositorio em 30/07, vindo de OUTRA sessao, e nunca
// foi avaliado por ele (esta na lista de pendencias desde entao). Mesmo assim virou fonte
// declarada em dois lugares: no rodape do LAUDO ASSINADO (referencia do calibre ductal) e
// no estado de auditoria da tela de Modelos. Num laudo assinado a assinatura e dele, e uma
// fonte que ele nunca leu nao pode sustentar numero nenhum.
//
// Esta suite trava a decisao: o nome nao volta como FONTE. O que continua permitido e
// cita-lo como historia no comentario do codigo (quem apontou o que, e quando) — isso e
// procedencia, nao autoridade.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const DADOS = fs.readFileSync(path.join(__dirname, '..', 'dados.js'), 'utf8');
let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

console.log('=== nao e fonte em lugar nenhum ===');
// Pega qualquer   fonte:'...AUDITORIA-CBR...'   independentemente do resto da string.
const comoFonte = /fonte\s*:\s*['"][^'"]*AUDITORIA[- ]?CBR[^'"]*['"]/i;
ok(!comoFonte.test(HTML), 'nenhum campo `fonte:` cita o AUDITORIA-CBR no app');
ok(!comoFonte.test(DADOS), 'nem nos modelos/dizeres do dados.js');
ok(!/AUDITORIA[- ]?CBR/i.test(DADOS), 'o dados.js nao menciona o documento de forma alguma');

console.log('=== o rodape do laudo (REF_VOLUME) esta limpo ===');
// Sem os COMENTARIOS: eles podem citar o documento (procedencia). A primeira versao desta
// suite proibia a palavra na regiao inteira e reprovava justamente o comentario que explica
// a remocao — o oposto do que se quer guardar.
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const refVol = semComentarios(HTML.slice(HTML.indexOf('const REF_VOLUME = {'),
                                         HTML.indexOf('const REF_VOLUME = {') + 6000));
ok(!/AUDITORIA[- ]?CBR/i.test(refVol),
   'nenhuma referencia de tamanho impressa no laudo credita o documento');
// 26/08/2026: o medico mandou ZERAR todas as referencias do laudo ("vamos ir colocando
// conforme formos editando os laudos") — o calibre ductal saiu JUNTO com a tabela.
// O valor e a fonte estao arquivados em REFERENCIAS-REMOVIDAS-2026-08-26.md para a volta.
ok(!/ductos mamários/.test(refVol),
   'o calibre ductal tambem saiu — tabela zerada em 26/08, decisao dele');
ok(/ZERADO em 26\/08\/2026 a pedido do médico/.test(HTML.slice(HTML.indexOf('const REF_VOLUME = {'), HTML.indexOf('const REF_VOLUME = {') + 800)),
   'e a tabela DIZ por que esta vazia, com a data e o pedido');
// 24/08, mesma tarde: a ressalva "nao conferido contra o atlas primario" foi apresentada
// a ele e ele mandou TIRAR. A fonte segue declarada (que e o que a regra da casa exige);
// o que saiu foi o comentario sobre a checagem. Este teste guarda a decisao dele.
ok(!/não conferido contra o atlas primário/.test(refVol),
   'e SEM a ressalva sobre conferencia do atlas — decisao dele em 24/08');

console.log('=== o estado de auditoria da tela de Modelos ===');
const modAud = semComentarios(HTML.slice(HTML.indexOf('const MOD_AUDITORIA = {'),
                                         HTML.indexOf('const MOD_ESTADO')));
ok(!/AUDITORIA[- ]?CBR/i.test(modAud), 'a grade de modelos nao cita mais o documento');
ok(/fonte:'ACR BI-RADS v2025'/.test(modAud), 'a mama fica creditada so ao manual do ACR');
ok(/mama:\s*\{n:3/.test(modAud),
   'e a nota de auditoria continua 3 — quem a sustenta e o manual primario, nao o documento removido');

console.log('=== citar como historia continua valendo ===');
// Apagar a memoria de POR QUE algo mudou seria trocar um exagero por outro: o comentario
// do microcisto conta quem apontou a inversao, e isso e verdade documental.
ok(/AUDITORIA-CBR\.md, mas ele deixou de valer/.test(HTML)
   || /quem APONTOU a inversão foi o AUDITORIA-CBR/.test(HTML),
   'o comentario do codigo pode lembrar quem apontou o que (procedencia != autoridade)');
ok(/§3\.3 do compilado v2025/.test(HTML),
   'mas o valor do microcisto passa a citar o compilado do lexico, que o sustenta sozinho');

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
