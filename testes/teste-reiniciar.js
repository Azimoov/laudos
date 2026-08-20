// O BOTAO DE REINICIAR, do lado do app (20/08/2026, pedido do Dr. Daniel).
//
// O teste-reiniciar.py exercita a rota no agente. Este aqui cuida do que o MEDICO ve:
// o botao existe, avisa antes, distingue recusa de erro, e — a parte que quebra sozinha
// se ninguem olhar — nao diz "pronto" antes de o agente novo existir.
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const HTML = fs.readFileSync(path.join(AQUI, '..', 'index.html'), 'utf8');

let falhas = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   ' : '  FALHA ') + msg);
  if (!cond) falhas++;
}
function corpoDe(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) return '';
  let n = 0, comecou = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { n++; comecou = true; }
    else if (HTML[j] === '}') { n--; if (comecou && n === 0) return HTML.slice(i, j + 1); }
  }
  return '';
}

console.log('=== o botao existe e esta ao lado do endereco do agente ===');
ok(/id="btnReiniciarAgente"[^>]*onclick="reiniciarAgente\(\)"/.test(HTML),
   'o botao chama reiniciarAgente()');
ok(/id="reiniciarEstado"/.test(HTML), 'e ha onde escrever o que esta acontecendo');
ok(HTML.indexOf('cfgAgenteLocal') < HTML.indexOf('btnReiniciarAgente'),
   'fica junto do endereco do agente, que e o assunto dele');
ok(/É recusado com exame gravando/.test(HTML),
   'e a explicacao ja avisa que ha recusa — o medico nao descobre isso no susto');

const R = corpoDe('reiniciarAgente');
ok(R.length > 0, 'a funcao existe');

console.log('\n=== avisa ANTES, e nao some com o programa junto ===');
ok(/confirm\(/.test(R), 'pergunta antes de derrubar o servico de fundo');
ok(/programa continua aberto/i.test(R),
   'e diz que o PROGRAMA continua aberto — senao parece que vai fechar tudo');

console.log('\n=== recusa (409) nao pode ser pintada de erro ===');
// O agente recusa quando reiniciar custaria ditado. Chamar isso de "falhou" ensina o
// medico a ignorar o aviso — que e justamente o aviso que protege o exame dele.
ok(/409/.test(R), 'o app distingue o 409 do resto');
ok(/recusa\s*\?\s*'⛔|⛔/.test(R), 'e mostra a recusa com cara de recusa, nao de falha');
ok(/j&&j\.erro|j\.erro/.test(R), 'usando o motivo que o AGENTE deu, em vez de um texto generico');

console.log('\n=== o agente fora do ar nao vira "reiniciado" ===');
ok(/catch[\s\S]{0,120}Agente fora do ar/.test(R),
   'agente que nem responde da mensagem propria, nao silencio');

console.log('\n=== a armadilha: o agente VELHO ainda responde por ~1,5s ===');
// Ele sai DEPOIS de a resposta chegar ao navegador. Um /health imediato pegaria o velho,
// e o botao diria "pronto" antes de o novo existir — o pior tipo de mentira, a que
// parece sucesso.
const E = corpoDe('esperarAgenteVoltar');
ok(E.length > 0, 'existe a espera propria, em vez de um setTimeout chutado');
ok(/viCair/.test(E), 'ela guarda se JA VIU o agente cair');
ok(/if\(!ok\)\{\s*viCair=true;\s*continue;\s*\}/.test(E),
   'marca a queda e continua esperando, em vez de desistir');
ok(/if\(viCair\)\s*return true/.test(E),
   'e so aceita "voltou" DEPOIS de ter visto cair — esta e a linha que evita o falso pronto');
ok(/cache:'no-store'/.test(E), 'sem cache: /health guardado responderia pelo agente morto');
ok(/AbortController/.test(E), 'e com prazo, para nao ficar pendurada num agente mudo');
ok(/esperarAgenteVoltar\(60000\)/.test(R), 'a espera tem teto (60s), e nao e infinita');
ok(/não voltou em 60s/.test(R), 'e o estouro do prazo diz o que fazer, em vez de so falhar');

console.log('\n=== o cache do agente nao pode sobreviver ao agente ===');
ok(/_agenteLocalOk=null/.test(R),
   'a resposta guardada e do processo que morreu: e descartada no reinicio');
ok(R.indexOf('_agenteLocalOk=null') < R.indexOf('esperarAgenteVoltar'),
   'e descartada ANTES de esperar, nao depois');

console.log('\n=== o botao nao aceita dois cliques ===');
ok(/bt\.disabled=true/.test(R), 'desliga enquanto trabalha');
ok((R.match(/bt\.disabled=false/g) || []).length >= 3,
   'e volta a ligar em TODOS os caminhos de saida (%d), inclusive nos que deram errado'
     .replace('%d', (R.match(/bt\.disabled=false/g) || []).length));

console.log('\n' + (falhas ? '  ' + falhas + ' FALHA(S)' : '  tudo certo'));
process.exit(falhas ? 1 : 0);
