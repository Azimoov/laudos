// A REDE DEBAIXO DA TRANSCRICAO (13/08/2026) — tarefa 2 do medico.
//
// Tres camadas, e a pergunta de cada uma e "o ditado se perde?":
//   1. placa de video -> processador   (asr.py)
//   2. agente local   -> nuvem, por impaciencia   (index.html)
//   3. agente local   -> nuvem, de dentro do agente   (agente-laudos.py)
//
// A camada 3 e a que faltava por inteiro, e era a mais grave: no exame ao vivo o audio
// mora na memoria do AGENTE. O navegador nunca o teve. Entao "cair para a nuvem" do
// lado do app nao resolvia nada — ele nao tinha o que mandar.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const RAIZ = 'C:/Users/serru';
// O projeto sai da localizacao DESTE arquivo (mudou de endereco em 17/08/2026)
const PROJETO = path.join(__dirname, '..', '..');
const ASR = path.join(PROJETO, 'ditado-local', 'src', 'asr.py');
const AG = path.join(RAIZ, 'Laudos USG 2.0/agente/agente-laudos.py');

let falhas = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FALHA ') + m); if (!c) falhas++; };
const leia = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } };

// Recorta UMA funcao Python: do `def nome(` ate o proximo `def` na coluna 0.
// Fatiar por numero de caracteres (era o que estava aqui) quebra sozinho quando a
// funcao cresce — e ai o teste passa a olhar meia funcao sem avisar ninguem.
function defPy(src, nome) {
  const i = src.indexOf('def ' + nome + '(');
  if (i < 0) return '';
  const j = src.indexOf('\ndef ', i + 1);
  return src.slice(i, j < 0 ? src.length : j);
}

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, on = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; on = true; }
    else if (src[j] === '}') { d--; if (on && d === 0) return src.slice(i, j + 1); }
  }
  return '';
}

console.log('=== CAMADA 1: placa de video -> processador ===');
const asr = leia(ASR);
if (!asr) { console.log('  FALHA nao achei o asr.py em ' + ASR); process.exit(1); }
ok(/def __init__[\s\S]*?voltando para a CPU/.test(asr),
   'ao LIGAR o motor, a falha da placa ja caia para o processador (isso ja existia)');
ok(/def _rodar\(/.test(asr) && /def _rodar_uma_vez\(/.test(asr),
   'a transcricao foi partida em duas: a que tenta e a que faz');
const rodar = asr.slice(asr.indexOf('def _rodar('), asr.indexOf('def _rodar_uma_vez('));
ok(/except Exception/.test(rodar), 'e agora a falha DURANTE a transcricao tambem e apanhada');
ok(/self\.device != "cuda"[\s\S]{0,60}raise/.test(rodar),
   'na CPU nao ha para onde cair: o erro sobe, em vez de tentar de novo em circulo');
ok(/audio\.seek\(0\)/.test(rodar),
   'o arquivo volta ao comeco antes da 2a leitura — senao a tentativa na CPU leria o resto');
ok(/WhisperModel\(self\.model_size, device="cpu"/.test(rodar), 'o motor e refeito na CPU');
ok(/self\.model_size = model_size/.test(asr),
   'e o tamanho do modelo fica guardado, senao nao havia como refazer');
const umaVez = asr.slice(asr.indexOf('def _rodar_uma_vez('));
ok(/return list\(segments\)/.test(umaVez),
   'os segmentos sao materializados DENTRO da tentativa — o transcribe devolve um gerador, '
   + 'e o erro so acontece quando alguem itera');

console.log('=== CAMADA 2: o app desiste do agente afogado e vai para a nuvem ===');
const pac = new Function(grab(HTML, 'paciencia') + '\nreturn paciencia;')();
ok(typeof pac === 'function', 'existe uma regra de paciencia');
ok(pac({ size: 0 }) === 25000, 'piso de 25 s: ditado curto nao e cortado por um solucinho');
ok(pac({ size: 32000 * 600 }) === 120000, 'teto de 120 s, que era o limite antigo');
ok(pac({ size: 32000 * 20 }) === 50000, '20 s de audio -> espera 50 s (2,5x a duracao)');
ok(pac({ size: 32000 * 30 }) === 75000, '30 s de audio -> 75 s');
ok(pac(null) === 25000 && pac(undefined) === 25000, 'entrada torta cai no piso, nao quebra');
for (let s = 1; s <= 300; s += 7) {
  const v = pac({ size: 32000 * s });
  if (v < 25000 || v > 120000) { ok(false, 'paciencia fora da faixa para ' + s + 's: ' + v); break; }
}
ok(true, 'em nenhuma duracao de 1 a 300 s a espera sai da faixa 25-120 s');
const tl = grab(HTML, 'transcreverLocal');
ok(/paciencia\(wavBlob\)/.test(tl), 'a espera do fetch usa essa regra, nao mais 120 s fixos');
ok(/estourou=true/.test(tl) && /passou de/.test(tl),
   'quando estoura, a mensagem diz o que houve — "AbortError" nao serve a quem esta atendendo');
ok(/clearTimeout/.test(tl), 'e o relogio e desarmado nos dois caminhos');
const ta = grab(HTML, 'transcreverAudio');
ok(/Motor de voz local n[ãa]o deu conta/.test(ta),
   'a troca de motor NAO e silenciosa: fica escrito no diario do dia');
ok(/_agenteLocalOk=null/.test(ta), 'e o agente e reavaliado na proxima, em vez de ficar condenado');

console.log('=== CAMADA 3: o agente tem caminho proprio para a nuvem ===');
const ag = leia(AG);
if (!ag) { console.log('  FALHA nao achei o agente em ' + AG); process.exit(1); }
ok(/def transcrever_na_nuvem\(/.test(ag), 'existe a funcao que manda o audio para a nuvem');
const nuvem = defPy(ag, 'transcrever_na_nuvem') + defPy(ag, 'transcrever_na_nuvem_bytes');
ok(/ia_encaminhar\("\/audio\/transcriptions"/.test(nuvem),
   'usando o encanamento que ja existia, com a chave que ja mora no agente');
ok(/multipart\/form-data; boundary=/.test(nuvem), 'monta o envio de arquivo na mao (sem dependencia nova)');
ok(/name="file"; filename="audio.wav"/.test(nuvem), 'com o WAV dentro');
ok(/name="language"[\s\S]{0,40}pt|campo\("language", "pt"\)/.test(nuvem), 'em portugues');
ok(/Termos: /.test(nuvem), 'e leva o vocabulario de ultrassom junto, para nao errar termo medico');
ok(/if st == 200:/.test(nuvem) && /raise RuntimeError\("a nuvem nao transcreveu/.test(nuvem),
   'so o 200 vira texto; o resto vira erro claro, nunca texto vazio');
// \s+ entre as palavras de proposito: estas frases vivem em docstring e QUEBRAM de
// linha. Ja mordeu duas vezes nesta tarefa — a assercao falhava por causa do "\n    "
// no meio da frase, e nao porque o texto tivesse sumido.
ok(/nao\s+marca\s+tempo|nao\s+sabe\s+marcar\s+tempo|sem\s+marcacao\s+de\s+tempo/i.test(nuvem),
   'o LIMITE continua escrito: modelo que nao marca tempo devolve trechos vazios');
ok(/`trechos`\s+(vazio|so\s+vem\s+vazio)/i.test(nuvem),
   'e o contrato diz o que sai nesse caso, em vez de deixar quem chama adivinhar');
ok(/perder\s+a\s+hora\s+e\s+aceitavel,\s+perder\s+o\s+ditado\s+nao/i.test(nuvem),
   'com a ordem de prioridade escrita: a hora nunca custa o ditado');
// 19/08/2026: o formato deixou de ser fixo. verbose_json (o unico que traz `segments`)
// so vale para o whisper-1; pedi-lo aos dois modelos novos derruba a cadeia inteira num
// 400 logo na primeira tentativa — trocaria "ditado sem hora" por "ditado nenhum".
ok(/NUVEM_MODELOS_COM_HORA/.test(ag), 'existe a lista de quem sabe marcar tempo');
ok(/NUVEM_MODELOS_COM_HORA = \{"whisper-1"\}/.test(ag),
   'e so o whisper-1 esta nela — os dois modelos novos recusam verbose_json');
ok(/"verbose_json" if com_hora else "json"/.test(nuvem),
   'o formato e escolhido POR MODELO, nunca fixado para todos');
ok(/com_hora = modelo in NUVEM_MODELOS_COM_HORA/.test(nuvem),
   'e quem decide e a lista, dentro do laco de tentativas');
// 20/08/2026, decisao do medico: a VOZ por trecho tem de valer SEMPRE que a nuvem
// atender, e nao so quando os dois modelos novos tambem falharem.
const cad = defPy(ag, '_cadeia_da_nuvem');
ok(/return com \+ sem/.test(cad),
   'com preferir_hora, quem marca tempo vai para a FRENTE da fila');
ok(/if not preferir_hora:[\s\S]{0,60}return list\(NUVEM_MODELOS\)/.test(cad),
   'e sem ela a ordem antiga (melhor termo medico primeiro) fica intacta');
ok(/for m in NUVEM_MODELOS if m not in NUVEM_MODELOS_COM_HORA/.test(cad),
   'os que nao marcam tempo continuam na fila DEPOIS — nunca removidos');
ok(/transcrever_na_nuvem_bytes\(wav_bytes\(audio\), boost, preferir_hora=True\)/.test(nuvem),
   'o DITADO DE EXAME pede hora: e dele que a tela de revisao depende');
ok(/def transcrever_na_nuvem_bytes\(wav, boost, preferir_hora=False\)/.test(nuvem),
   'e o padrao e nao pedir — quem precisa da hora pede, em vez de todos pagarem');
ok(/return texto, trechos/.test(nuvem), 'a funcao devolve (texto, trechos), nao so o texto');
const trad = defPy(ag, '_trechos_da_nuvem');
ok(/"inicio":[\s\S]{0,200}"fim":[\s\S]{0,200}"texto":/.test(trad),
   'e traduz os segments para o MESMO formato do motor local (inicio/fim/texto)');
ok(/seg\.get\("start"\)/.test(trad) && /seg\.get\("end"\)/.test(trad),
   'lendo start/end, que sao os nomes que a OpenAI usa');
ok(/except \(AttributeError, TypeError, ValueError\)/.test(trad),
   'segmento torto nao contamina os que vieram certos, nem derruba o ditado');

const tf = defPy(ag, 'transcrever_audio_f32');
ok(/except Exception[\s\S]{0,700}transcrever_na_nuvem\(audio, boost\)/.test(tf),
   'o motor local falhou -> a nuvem entra, com o audio que so existe aqui dentro');
ok(/cru, trechos = transcrever_na_nuvem\(audio, boost\)/.test(tf),
   'e a hora que a nuvem devolveu e APROVEITADA, em vez de zerada na marra');
ok(!/trechos, origem = \[\], "nuvem"/.test(tf),
   'a forma antiga (trechos sempre vazios) nao sobrou em lugar nenhum');
ok(/return texto, trechos, origem/.test(tf), 'quem chama recebe tambem POR ONDE o ditado saiu');
ok((ag.match(/texto, trechos, motor = transcrever_audio_f32/g) || []).length === 2,
   'as duas chamadas de exame do agente foram atualizadas (botao e exame fechado)');
ok((ag.match(/"motor": motor/g) || []).length === 3, 'e as TRES respostas dizem o motor ao app');
ok(!/texto, trechos = transcrever_audio_f32/.test(ag), 'nenhuma chamada ficou com a forma antiga');
ok(/o motor de voz local falhou e o ditado foi transcrito na NUVEM/.test(ag),
   'no fechamento do exame o medico e avisado, com a consequencia pratica junto');

console.log('=== o TERCEIRO caminho (/transcrever) tambem entrou na fila e ganhou rede ===');
// Era o unico sem trava e sem rede: podia moer na placa de 4 GB ao mesmo tempo que um
// exame ao vivo, e disputava self.model/self.device do motor — que virou estado
// compartilhado mutavel quando a queda para a CPU foi criada.
const rota = ag.slice(ag.indexOf('if rota != "/transcrever"'));
ok(/with _transcr_lock:/.test(rota.slice(0, 3200)),
   'o ditado avulso entra na MESMA fila do exame ao vivo — nao disputa a placa nem o motor');
ok(/cru, _ = transcrever_na_nuvem_bytes\(buf, boost\)/.test(rota.slice(0, 3200)),
   'e tem a mesma rede: motor local falhou, vai para a nuvem (a hora aqui nao serve)');
ok(/sincronizar_rotulo\(\)/.test(rota.slice(0, 3200)), 'e acerta o rotulo do motor depois');

console.log('=== instalacao desencontrada NAO pode virar nuvem calada ===');
// Foi o defeito mais grave apontado na 1a avaliacao desta tarefa: com um except largo,
// um asr.py velho (sem transcribe_segments) daria AttributeError, cairia na nuvem paga
// e TODO exame sairia por la, em silencio — erro barulhento virando falha muda e cara.
ok(/except \(AttributeError, ImportError, TypeError\)/.test(ag),
   'esses erros tem ramo proprio, antes do except largo');
ok((ag.match(/except \(AttributeError, ImportError, TypeError\)/g) || []).length === 2,
   'nos DOIS caminhos que chamam o motor');
ok(/MOTOR DE VOZ DESENCONTRADO/.test(ag), 'e a mensagem diz que nao e falha de placa');
ok(/Confira DITADO_DIR/.test(ag), 'apontando onde olhar');
const tfDes = ag.slice(ag.indexOf('MOTOR DE VOZ DESENCONTRADO'), ag.indexOf('MOTOR DE VOZ DESENCONTRADO') + 700);
ok(/raise/.test(tfDes), 'o erro SOBE, em vez de virar sucesso silencioso');

console.log('=== o audio e gravado ANTES de transcrever ===');
// Antes, o WAV so ia para o disco DEPOIS. Local falhava + nuvem falhava = a excecao
// subia, a marca de inicio ja tinha sido zerada, e o som daquele exame sumia inteiro.
ok(/def transcrever_audio_f32\(audio, salvar_antes=None\)/.test(ag), 'a funcao aceita gravar antes');
ok(/guardar_ditado\(salvar_antes, audio, "", "pre-transcricao", arquivar=False\)/.test(ag),
   'e grava o WAV antes de qualquer tentativa — SEM duplicar a copia da pasta clinica');
ok((ag.match(/transcrever_audio_f32\(audio, salvar_antes=/g) || []).length === 3,
   'as duas chamadas passam a identificacao (mais a definicao)');
const posGravar = ag.indexOf('guardar_ditado(salvar_antes');
ok(posGravar > 0 && posGravar < ag.indexOf('with _transcr_lock:', posGravar - 900),
   'e grava ANTES de entrar na fila do motor, nao depois');

console.log('=== o /health nao mente sobre o motor ===');
ok(/def sincronizar_rotulo\(\)/.test(ag), 'existe quem acerte o rotulo do motor');
ok(/ASR\.device not in MODELO_ROTULO/.test(ag), 'compara o que esta rodando com o que esta escrito');
ok((ag.match(/sincronizar_rotulo\(\)/g) || []).length >= 3,
   'e e chamado depois das transcricoes, nao so no carregamento');

console.log('=== o motor que nao carrega tambem tem rede ===');
ok(/garantir_motor\(\)[\s\S]{0,400}indo direto para a nuvem/.test(ag),
   'garantir_motor foi para DENTRO do try: a falha mais completa era a unica sem rede');

console.log('=== a nuvem tem lista de modelos e limite de tamanho ===');
ok(/NUVEM_MODELOS = \[/.test(ag), 'uma lista de modelos, como o app ja tinha');
ok(/NUVEM_LIMITE_BYTES/.test(ag) && /25 \* 1024 \* 1024/.test(ag), 'e o limite de 25 MB da OpenAI');
ok(/grande demais para a nuvem/.test(ag), 'que vira aviso explicado, nao um 413 cru');
ok(/if st in \(401, 403, 413\)/.test(ag),
   'chave errada ou arquivo grande nao melhoram com outro modelo: desiste na hora');

console.log('=== a corda que o prazo joga TEM de alcancar (13/08) ===');
// O prazo de 5 min manda o medico usar "Recuperar exames". So que a recuperacao pulava
// os exames que ja estavam na tela — e o exame ENTRA na lista antes de o fechamento ser
// tentado. Resultado: o ditado no disco, o exame na tela sem ditado, e o app respondendo
// "nada a recuperar: os exames com ditado guardado ja estao carregados".
// Pior: recarregar a pagina resolvia (a lista nascia vazia), e a mensagem afastava disso.
const cap = grab(HTML, 'capRecuperarDoAgente') || HTML.slice(HTML.indexOf('var jaTem={}') - 2000, HTML.indexOf('var jaTem={}') + 4000);
ok(/\(e\.audios\|\|\[\]\)\.length/.test(cap),
   '"ja tenho" exige ter DITADO, nao so estar na tela');
{
  // a regra, exercitada: exame na tela sem audio TEM de ser alvo da recuperacao
  const m = cap.match(/var jaTem=\{\};[\s\S]*?\}\);/);
  ok(!!m, 'achei a regra do jaTem para exercitar');
  const monta = new Function('exames', m[0] + '\nreturn jaTem;');
  const semAudio = monta([{ _estudoId: 'E1', audios: [] }]);
  ok(!semAudio['E1'], 'exame na tela SEM ditado nao conta como "ja tenho" — sera recuperado');
  const comAudio = monta([{ _estudoId: 'E1', audios: [{ idx: 0 }] }]);
  ok(comAudio['E1'] === true, 'exame na tela COM ditado conta — nao vira duplicata');
  const semNada = monta([{ _estudoId: 'E1' }]);
  ok(!semNada['E1'], 'exame sem a lista de audios tampouco quebra');
}
ok(/exames\.filter\(function\(e\)\{ return e\._estudoId===est\.id; \}\)\[0\]/.test(cap),
   'e ao recuperar, ADOTA o exame que ja estava na tela');
ok(/j[áa] estava na lista/.test(cap), 'dizendo isso no diario, para o medico entender o que houve');
const criaNovo = cap.indexOf('exames.push(ex)');
const adota = cap.indexOf('if(ex){');
ok(adota > 0 && adota < criaNovo, 'a adocao vem ANTES de criar cartao novo — sem exame em dobro');
// a frase esta quebrada em concatenacao no fonte: procurar as pontas, nao a frase inteira
ok(/O [áa]udio N[ÃA]O se/.test(HTML) && /guardado no computador/.test(HTML)
   && /entra neste mesmo exame/.test(HTML),
   'e a mensagem do prazo promete o que a recuperacao agora cumpre');

console.log('=== o ditado que voltou sem texto diz POR QUE ===');
ok(/'pre-transcricao'\) && !String\(dit\.texto\|\|''\)\.trim\(\)/.test(HTML),
   'reconhece a marca que o agente deixa quando so o pre-salvamento aconteceu');
ok(/SEM TEXTO[\s\S]{0,120}a transcri[çc][ãa]o falhou/.test(HTML),
   'e a etiqueta separa "a transcricao falhou" de "nao houve fala"');
ok(/ou[çc]a o [áa]udio e dite de novo/.test(HTML), 'dizendo o que fazer');

console.log('=== a guarda do montador cobre TODO o pacote de src ===');
const MONTAR = leia(path.join(PROJETO, 'laudos-programa', 'instalador', 'montar.ps1'));
ok(!!MONTAR, 'achei o montar.ps1');
ok(/foreach \(\$arq in @\('src\\asr\.py', 'src\\dictionary\.py', 'src\\__init__\.py'\)\)/.test(MONTAR),
   'confere os TRES arquivos que o agente importa, nao so o asr.py');
ok(/Get-FileHash/.test(MONTAR) && /DESENCONTRADO/.test(MONTAR), 'comparando o conteudo, e recusando montar');
ok(MONTAR.indexOf('DESENCONTRADO') < MONTAR.indexOf('Copy-Item $ditado $Payload'),
   'e a guarda vem ANTES de copiar para o payload');
ok(!/[^\x00-\x7F]/.test(MONTAR), 'o montar.ps1 continua em ASCII puro (regra do CLAUDE.md)');

console.log('=== aquecer o motor: SO o agente do programa que foi aberto (13/08) ===');
// Ideia do medico, e melhor que "aquecer sempre": a placa tem 4 GB e cada motor ocupa
// ~1,9 GB. Aquecer os dois desde o boot fabricaria o estouro que esta rede socorre.
// Quem abre o programa e quem vai atender; o agente do outro programa fica frio.
const LP = leia(path.join(RAIZ, 'Laudos USG 2.0/programa/laudos.py'));
ok(!!LP, 'achei o laudos.py do programa');
ok(/env\['AQUECER_MOTOR'\] = '1'/.test(LP), 'o programa marca o agente que ELE levantou');
ok(LP.indexOf("env['AQUECER_MOTOR']") < LP.indexOf('return env'),
   'a marca entra no ambiente que vai para o agente');
ok(/def aquecer_motor\(\)/.test(ag), 'o agente sabe aquecer');
const aq = defPy(ag, 'aquecer_motor');
ok(/os\.environ\.get\("AQUECER_MOTOR"\) != "1"/.test(aq) && /return/.test(aq.split('AQUECER_MOTOR')[1].slice(0, 40)),
   'e so aquece se tiver sido marcado — agente subido a mao continua frio');
ok(/garantir_motor\(\)/.test(aq) && /_transcr_lock/.test(aq),
   'carrega e faz uma passada de verdade, dentro da fila do motor');
ok(/except Exception/.test(aq) && /carrega na 1a/.test(aq),
   'e se falhar nao derruba nada: o motor carrega na 1a transcricao, como antes');
ok(/threading\.Thread\(target=aquecer_motor/.test(ag), 'roda em segundo plano, nao segura o boot');

// 13/08: o "perguntar ao vizinho" saiu. Era verificar-e-agir e nao fechava a corrida —
// perguntar leva 2 s, carregar leva 11-15 s. Quem decide agora e a RESERVA da placa,
// atomica, e ela vale para QUALQUER carregamento, nao so para o aquecimento.
// A cobertura funda (inclusive oito concorrentes disputando) esta em teste-placa.py.
ok(!/outro_agente_com_motor/.test(ag), 'o "perguntar ao vizinho" foi removido de vez');
ok(!/outro_agente_com_motor/.test(aq), 'e o aquecimento nao decide mais isso sozinho');
ok(/os\.O_CREAT \| os\.O_EXCL/.test(ag),
   'a reserva usa a criacao atomica do sistema: nao ha janela entre perguntar e agir');
const gm2 = defPy(ag, 'garantir_motor');
ok(/not reservar_placa\(\)/.test(gm2), 'e quem tenta reservar e o carregamento do motor...');
ok(/"cpu", "int8"/.test(gm2), '...caindo para o processador quando a placa ja e de outro');

console.log('=== o aquecimento chegou na instalacao que ATENDE ===');
const appEstavel = leia(path.join(PROJETO, '_repo', 'index.html'));
ok(!!appEstavel, 'achei o app estavel');
ok(/transcritor\/carregar/.test(appEstavel),
   'o app que atende pede o carregamento do motor ao abrir — antes ninguem pedia');
ok((appEstavel.match(/transcritor\/carregar/g) || []).length === 1, 'uma vez so');
const agEstavel = leia(path.join(RAIZ, 'Laudos USG/agente/agente-laudos.py'));
ok(/transcritor\/carregar/.test(agEstavel),
   'e o agente que atende JA tinha a rota: nao foi preciso mexer nele');
ok(!/AQUECER_MOTOR/.test(leia(path.join(RAIZ, 'Laudos USG 2.0/programa/laudos.py')) || 'AQUECER_MOTOR')
   || /#\s*env\['AQUECER_MOTOR'\]/.test(leia(path.join(RAIZ, 'Laudos USG 2.0/programa/laudos.py'))),
   'e a 2.0 NAO aquece: ela nao atende paciente e seguraria metade da placa');

console.log('=== a frase errada sobre a pasta apagada foi corrigida ===');
ok(!/copia antiga em "Claude code" foi\s*\n#\s*apagada/.test(ag),
   'o comentario nao afirma mais que a pasta foi apagada');
ok(/NAO foi — ela esta la/.test(ag), 'ele diz a verdade: a pasta existe');
ok(/Copias vivas do asr\.py/.test(ag), 'e lista onde estao as copias que valem');

console.log('=== a ordem das camadas, que e o que importa ===');
ok(asr.indexOf('def _rodar(') < asr.indexOf('def _rodar_uma_vez('),
   'placa -> processador acontece DENTRO do motor, antes de qualquer coisa sair de la');
ok(/motor local falhou[\s\S]{0,200}tentando a nuvem/.test(ag),
   'so depois de o motor local esgotar (placa E processador) e que a nuvem entra');
ok(/tentando a nuvem/.test(ag) && /Transcrevendo na nuvem/.test(HTML),
   'e os dois lados registram quando isso acontece — a rede nao pode ser invisivel');

console.log('');
console.log(falhas ? ('  ' + falhas + ' FALHA(S)') : '  tudo certo');
process.exit(falhas ? 1 : 0);
