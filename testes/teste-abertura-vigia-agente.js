// A TELA DE ABERTURA SE CORRIGE SOZINHA QUANDO O AGENTE VOLTA — 02/09/2026.
//
// O QUE ELE VIU: abriu o programa as 16:31 e a tela de abertura disse que nao conseguia
// falar com o agente. O agente subiu as 16:36 (registrado no agente-diario.log) e a tela
// continuou vermelha. Do lado dele isso e indistinguivel de "o agente nao liga" — ele
// pediu justamente isso: "o agente nao ta ligando".
//
// A CAUSA: as tres confericoes da tela (microfone, aparelho, transcricao) rodavam UMA VEZ
// SO, quando a tela abria. Uma tela que afirma no presente uma coisa que so era verdade
// cinco minutos atras e pior que uma tela que nao diz nada.
//
// POR QUE O AGENTE DEMOROU: o lancador espera 40 s por ele antes de abrir a janela
// (esperar_agente, em laudos.py) e desiste depois disso. O agente daquele momento estava
// carregando o modelo grande NO PROCESSADOR — a placa estava tomada pela linha estavel —
// e carregar large-v3 na CPU leva minutos.
//
// A REGRA QUE ESTA SUITE PROTEGE: quando uma confericao nao alcanca o agente, fica um
// vigia batendo ate ele responder, e ai a tela se refaz sozinha. E o vigia tem de MORRER
// quando a tela sai da frente — temporizador rodando para sempre atras de uma tela que
// ninguem ve e defeito, nao zelo.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };

function pegar(nome) {
  const i = HTML.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('nao achei ' + nome);
  let d = 0, c = false;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') { d++; c = true; }
    else if (HTML[j] === '}') { d--; if (c && d === 0) return HTML.slice(i, j + 1); }
  }
}

console.log('=== o vigia existe ===');
const vigia = pegar('abVigiarAgente');
ok(!!vigia, 'ha uma funcao que fica esperando o agente voltar');
ok(/setInterval/.test(vigia), 'ela repete a tentativa, em vez de desistir na primeira');
ok(/abAtualizarTudo\(\)/.test(vigia), 'e refaz as conferencias quando ele responde');

console.log('\n=== um vigia so, mesmo com as tres conferencias falhando ===');
// As tres chamam abVigiarAgente ao mesmo tempo quando o agente esta fora. Sem esta
// guarda seriam tres temporizadores batendo no mesmo agente.
ok(/if\(_abVigiaAgente\) return;/.test(vigia),
   'a funcao nao cria um segundo temporizador se ja houver um');

console.log('\n=== o vigia morre quando a tela sai da frente ===');
ok(/clearInterval\(_abVigiaAgente\)/.test(vigia), 'ele se cancela');
ok(/telaAbertura/.test(vigia) && /display!=='none'/.test(vigia),
   'e a condicao de parada olha se a tela de abertura ainda esta visivel');
ok((vigia.match(/clearInterval/g) || []).length >= 2,
   'cancela nos DOIS caminhos: agente voltou, e tela saiu da frente');

console.log('\n=== as tres conferencias chamam o vigia quando falham ===');
[['abConferirMicrofone', 'microfone'],
 ['abConferirAparelho', 'aparelho'],
 ['abCarregarTranscricao', 'transcricao']].forEach(function (par) {
  const f = pegar(par[0]);
  ok(/abVigiarAgente\(\)/.test(f), par[0] + ' pede o vigia quando nao alcanca o agente');
});

console.log('\n=== a tela diz que esta tentando, em vez de so acusar ===');
// "Nao consegui falar com o agente." e um veredito; "tentando de novo..." e o que esta
// acontecendo de verdade, e evita que ele va reiniciar o que ja vai se resolver.
const cont = (HTML.match(/tentando de novo…/g) || []).length;
ok(cont >= 3, 'as tres mensagens de falha avisam que a tentativa continua  [' + cont + ']');

console.log('\n=== a checagem do agente nao trava a tela ===');
const resp = pegar('abAgenteResponde');
ok(/AbortController/.test(resp) && /setTimeout/.test(resp),
   'a batida no agente tem prazo — agente travado nao pendura a tela');
ok(/catch\(e\)\{ return false; \}/.test(resp),
   'e falhar ali devolve "nao respondeu", nunca uma excecao solta');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
