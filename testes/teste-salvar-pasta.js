// Salvar na pasta do dia: a ordem das operacoes e o aviso quando cai no plano B.
//
// 19/08/2026 — dois laudos do dia (Raimundo 18:15 e Maria de Fatima 19:01) foram parar em
// AppData\Local\Temp em vez da pasta do dia, e NADA disse ao medico. Causa: a permissao de
// escrever na pasta precisa do GESTO do clique, e o codigo gerava o PDF das imagens ANTES
// de pedi-la — com 8 imagens o gesto expira, requestPermission nao vale mais, e o salvar
// caia calado no caminho de baixar arquivo (que no programa e a pasta temporaria).
// Temp e o pior destino: o Windows limpa quando quer, e o CLAUDE.md proibe dado do projeto
// dentro de AppData\Local.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
const SALVAR = corpoDe('salvarLaudoPasta');

console.log('=== a pasta e pedida ANTES do trabalho lento (o gesto do clique) ===');
const posPermissao = SALVAR.indexOf('fsPermissao');
const posGarantir  = SALVAR.indexOf('garantirPasta');
const posPdf       = SALVAR.indexOf('gerarPdfImagens');
ok(posGarantir > 0, 'salvarLaudoPasta chama garantirPasta (antes nao chamava: caia calado)');
ok(posPermissao > 0 && posPdf > 0, 'ha checagem de permissao e geracao de PDF na funcao');
ok(posGarantir < posPdf, 'garantirPasta vem ANTES de gerar o PDF');
ok(posPermissao < posPdf, 'a permissao e conferida ANTES de gerar o PDF — com o gesto ainda fresco');

console.log('=== o plano B nao e mais silencioso ===');
ok(/⚠ ATENÇÃO: NÃO salvei na pasta do dia/.test(SALVAR), 'avisa em alto e bom som que nao salvou na pasta');
ok(/pasta temporária do Windows, que se apaga sozinha/.test(SALVAR),
   'explica o efeito pratico: o arquivo pode sumir');
ok(/log\([^)]*NÃO salvei na pasta do dia[\s\S]{0,220}, true\)/.test(SALVAR),
   'o aviso entra como ERRO (true), nao como recado comum');

console.log('=== a funcao devolve se deu certo, para quem chamou reagir ===');
ok(/return true;/.test(SALVAR), 'devolve true quando salvou');
ok(/return false;/.test(SALVAR), 'devolve false quando caiu no plano B');
ok(/window\.__ultimoSalvar=\{ok:true/.test(SALVAR) && /window\.__ultimoSalvar=\{ok:false/.test(SALVAR),
   'registra o resultado para a tela mostrar o nome da pasta');
ok(/if\(!area\|\|!area\.innerHTML\)\{ log\('Nada para salvar\.', true\); return false; \}/.test(SALVAR),
   '"nada para salvar" tambem devolve false (antes devolvia undefined)');

console.log('=== a tela de revisao nova mostra o resultado NELA MESMA ===');
const APROVAR = corpoDe('rev2Aprovar');
ok(/_okSalvar=await salvarLaudoPasta\(\)/.test(APROVAR), 'rev2Aprovar olha o resultado do salvar');
ok(/rev2Status\('⚠ NÃO foi salvo na pasta do dia/.test(APROVAR),
   'o aviso aparece na propria tela cheia, nao so no diario atras dela');
ok(/confirm\(/.test(APROVAR), 'e pergunta antes de assinar um laudo que nao foi para a pasta');
ok(/return;   \/\/ sai SEM assinar/.test(APROVAR), 'se o medico recusar, NAO assina');
ok(APROVAR.indexOf('_okSalvar=await salvarLaudoPasta') < APROVAR.indexOf('ex._liberado=true'),
   'a conferencia acontece ANTES de marcar como liberado');
const SALVAR_APENAS = corpoDe('rev2SalvarApenas');
ok(/var ok=await salvarLaudoPasta\(\)/.test(SALVAR_APENAS), '"Salvar apenas" tambem confere');
ok(/rev2Status\('⚠ NÃO foi salvo na pasta do dia/.test(SALVAR_APENAS), 'e avisa na tela');

console.log('=== nada disso pode ter quebrado o caminho feliz ===');
ok(/pastaLivre\(destino, base\)/.test(SALVAR), 'continua criando a subpasta do paciente sem sobrescrever');
ok(/'Laudo - '\+base\+'\.html'/.test(SALVAR), 'o nome do arquivo do laudo nao mudou');
ok(/'foto-'\+\(i\+1\)\+'\.jpg'/.test(SALVAR), 'as fotos continuam saindo numeradas');
ok(/'Fotos - '\+base\+'\.pdf'/.test(SALVAR), 'o PDF das imagens continua igual');

console.log('=== 24/08: o AGENTE salva primeiro (a pasta do navegador nao sobrevive) ===');
// Falhou em atendimento DE VERDADE: a janela abre em porta sorteada, a escolha de pasta
// morre a cada abertura, e o laudo do Wilson (24/08, 11:43) caiu na pasta temporaria.
// O agente grava direto no disco e a pasta fica em config-agente.json — escolhe uma vez.
const posAgente = SALVAR.indexOf('impSalvarPeloAgente');
ok(posAgente > 0, 'salvarLaudoPasta tenta o agente');
ok(posAgente < SALVAR.indexOf('if(destino)'),
   'ANTES do caminho do navegador — o navegador virou o plano B de quem nao tem agente');
ok(/semPasta/.test(SALVAR),
   'agente sem pasta configurada abre o Explorer NA HORA e tenta de novo — nao manda o medico procurar configuracao no meio do atendimento');
ok(/catch\(e\)\{ \/\* agente fora do ar/.test(SALVAR),
   'agente fora do ar cai no caminho antigo em silencio (o iPad continua funcionando)');
const AG = fs.readFileSync(path.join(__dirname, '..', '..', 'laudos-programa', 'agente', 'agente-laudos.py'), 'utf8');
ok(/rota == "\/laudo\/salvar"/.test(AG), 'a rota de salvar existe no agente');
ok(/rota == "\/laudo\/pasta\/escolher"/.test(AG), 'e a de escolher a pasta pelo Explorer');
ok(/p == "\/laudo\/pasta"/.test(AG), 'e a de consultar a pasta atual');
ok(/d\["pastaLaudos"\] = /.test(AG), 'a pasta escolhida e gravada no config do agente (disco)');
ok(/\.laudos-teste-escrita/.test(AG.slice(AG.indexOf('/laudo/pasta'))),
   'so aceita pasta onde consegue MESMO escrever (testa antes de prometer)');
ok(/while os\.path\.exists\(os\.path\.join\(pasta, nome\)\)/.test(AG),
   'a subpasta do paciente ganha nome livre — nunca sobrescreve laudo ja salvo');
ok(/re\.sub\(r'\[\\\\\/:\*\?"<>\|\]\+'/.test(AG),
   'o nome vindo do app e saneado no agente (nao confia em ../ nem em caractere proibido)');
const ESCOLHER = corpoDe('escolherPastaDestino');
ok(/laudo\/pasta\/escolher/.test(ESCOLHER),
   'o botao "Pasta" abre o Explorer pelo agente quando ele esta no ar');
ok(/showDirectoryPicker/.test(ESCOLHER), 'e o seletor do navegador continua como plano B');

console.log('\n' + (falhas ? falhas + ' FALHA(S)' : 'TODOS OS TESTES PASSARAM'));
process.exit(falhas ? 1 : 0);
