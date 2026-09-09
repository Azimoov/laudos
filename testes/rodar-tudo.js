/* Roda a bateria inteira de testes. Use ANTES de publicar.
 *
 *   node testes/rodar-tudo.js
 *
 * Os testes de agente (buffer, cache) e o de backup precisam do Python do
 * ditado-local e do agente no ar; se faltarem, sao PULADOS, nao contados como falha.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
// Sai da propria localizacao deste arquivo, nunca de um caminho gravado a mao.
// Em 17/08/2026 o projeto MUDOU DE ENDERECO (o medico desligou a sincronizacao
// da Area de Trabalho com o OneDrive e o Windows devolveu o Desktop ao lugar
// original). O caminho fixo daqui apontava para uma pasta que nem existia mais,
// e as suites de Python passaram a ser PULADAS em silencio — verde por ausencia,
// que e o pior tipo de verde.
const PY = path.join(AQUI, '..', '..', 'ditado-local', '.venv', 'Scripts', 'python.exe');

const SUITE = [
  { arq: 'checar-sintaxe.js', o: 'sintaxe do index.html' },
  { arq: 'teste-auditoria.js', o: 'XSS, JSON da IA, registro de consumo' },
  { arq: 'teste-fila.js', o: 'fila de reprocessamento' },
  { arq: 'teste-captura-completa.js', o: 'captura ao vivo: exame que chega em partes nao fica pela metade' },
  { arq: 'teste-historico-indice.js', o: 'busca do exame anterior pelo indice leve' },
  { arq: 'teste-onda.js', o: 'grafico do microfone' },
  { arq: 'teste-bipe.js', o: 'aviso sonoro' },
  { arq: 'teste-birads.js', o: 'calculadora BI-RADS (lexico v2025 conferido no manual)' },
  { arq: 'teste-classif.js', o: 'classificacao automatica TI-RADS/BI-RADS/O-RADS' },
  { arq: 'teste-voz-img.js', o: 'ponte VOZ/IMG da tela de revisao (procedencia conferida)' },
  { arq: 'teste-formatacao.js', o: 'barra de formatacao da tela de revisao (ida e volta)' },
  { arq: 'teste-tela-revisao.js', o: 'tela de revisao: descritor recalcula e assinar registra' },
  { arq: 'teste-visual-revisao.js', o: 'aparencia da tela de revisao (cores, destaque, mouse)' },
  { arq: 'teste-tela-antigos.js', o: 'tela de fotos e audios antigos (porta nova, esteira de sempre)' },
  { arq: 'teste-conferente.js', o: 'conferente: segunda leitura do laudo antes de entregar' },
  { arq: 'teste-birads-cat.js', o: 'categoria BI-RADS: rotulo, probabilidade e conduta (tabela local)' },
  { arq: 'teste-ref-volume.js', o: 'asterisco e fonte no julgamento de tamanho' },
  { arq: 'teste-tireoide-esquema.js', o: 'tireoide: duas vistas junto ao lobo/istmo, sem posição inventada' },
  { arq: 'teste-mama-reativacao.js', o: 'mama: recurso reativado, opcional por laudo e por lado' },
  { arq: 'teste-mama-esquema.js', o: 'esquema anatomico da mama (bloco 2)' },
  { arq: 'teste-utero-figo.js', o: 'útero: esquema anatômico bidirecional e classificação FIGO de miomas' },
  { arq: 'teste-historico-reabrir.js', o: 'reabrir laudo antigo na tela de liberacao' },
  { arq: 'teste-historico-abrir.js', o: 'abrir laudo antigo do historico (sem window.open)' },
  { arq: 'teste-dicom-importar.js', o: 'buscar exame no aparelho (caminho religado)' },
  { arq: 'teste-impressao.js', o: 'impressao automatica (laudo e imagens, uma ou duas impressoras)' },
  { arq: 'teste-impressao-verhist.js', o: 'plaquinha verHist presa: imprimir devolvia folhas em branco' },
  { arq: 'teste-papel-em-branco.js', o: 'o laudo chega ao papel (medido em midia de impressao, num Chrome)' },
  { arq: 'teste-modelos-mesclados.js', o: 'modelo novo do programa nao nasce invisivel para quem personalizou' },
  { arq: 'teste-abertura-vigia-agente.js', o: 'tela de abertura se corrige sozinha quando o agente volta' },
  { arq: 'teste-fundo-modal.js', o: 'modal "Fundo dos laudos" nao empilha (travava o gerar)' },
  { arq: 'teste-sem-probabilidade.js', o: 'BI-RADS: probabilidade de malignidade fora do laudo' },
  { arq: 'teste-sem-auditoria-cbr.js', o: 'AUDITORIA-CBR nao volta como fonte oficial' },
  { arq: 'teste-ducto-so-patologico.js', o: 'calibre ductal so referenciado quando ha achado' },
  { arq: 'teste-ver-laudo-final.js', o: 'ver o laudo final: editavel, com salvar e liberar' },
  { arq: 'teste-mama-esquema-sem-dist.js', o: 'esquema da mama desenha sem a distancia da papila' },
  { arq: 'teste-idade-zero.js', o: '"0 anos" nao vira idade (tabela pediatrica em adulto)' },
  { arq: 'teste-mama-esquema-real.js', o: 'esquema da mama com laudo REAL do banco (formato de hoje)' },
  { arq: 'teste-mama-multiplos-na-frase.js', o: 'varios achados numa frase so (horas e medidas distribuidas, 26/08)' },
  { arq: 'teste-cisto-simples.js', o: 'cisto simples sem checklist BI-RADS (frases reais, 25/08)' },
  { arq: 'teste-mama-cinco-correcoes.js', o: 'as cinco correcoes de 24/08 (formatacao, rotulo, distancia, legenda, categoria)' },
  { arq: 'teste-dicom-tipo.js', o: 'exame do aparelho nasce COM tipo (sem tipo nao gerava laudo)' },
  { arq: 'teste-mama-auditoria-24-08.js', o: 'erros achados na auditoria de 24/08 (biopsia falsa, dupla distancia)' },
  { arq: 'teste-mama-paciente.js', o: 'secao para a paciente (frases fixas, desligada por padrao)' },
  { arq: 'teste-mama-bloco4.js', o: 'bloco 4: registro pos-biopsia e validador de lexico' },
  { arq: 'teste-mama-bloco3.js', o: 'bloco 3: lista de multiplos, ordenacao e correlacao' },
  { arq: 'teste-mama-evolucao.js', o: 'grafico de evolucao do achado (bloco 2)' },
  { arq: 'teste-mama-arraste.js', o: 'arraste do marcador do esquema (bloco 2)' },
  { arq: 'teste-mama-bloco1.js', o: 'pacote de mama bloco 1: modelo e dizeres padrao' },
  { arq: 'teste-bizus-guarda.js', o: 'dizeres padrao (BIZUS): guarda contra valor salvo ilegivel' },
  { arq: 'teste-rede.js', o: 'rede debaixo da transcricao (placa->CPU->nuvem)' },
  { arq: 'teste-provedor.js', o: 'endereco do provedor de IA configuravel' },
  { arq: 'teste-referencia.js', o: 'medidas de referencia por idade (pediatrico)' },
  { arq: 'teste-medida-uma-casa.js', o: 'medidas com UMA casa decimal (regua dele: 0-5 cai, 6-9 sobe)' },
  { arq: 'teste-obst-numeros.js', o: 'obstetrico: "25 semanas e 0 dias" e percentil/peso inteiros' },
  { arq: 'teste-moldura-protegida.js', o: '"DESCRIÇÃO:" nao pode ser apagado por acidente (caso Jacilene, 26/08)' },
  { arq: 'teste-audio-patologia.js', o: 'recorte curto por achado (o que o botao VOZ toca)' },
  { arq: 'teste-ouvir-audio.js', o: 'ouvir o audio: o exame inteiro, sem os silencios' },
  { arq: 'teste-audio-bloco.js', o: 'áudio por bloco: o trecho do órgão, sem os silêncios' },
  { arq: 'teste-trazer-exame.js', o: 'trazer na mao um exame que o aparelho ja tem' },
  { arq: 'teste-fotos-nao-somem.js', o: 'as fotos do exame nao somem num recarregamento' },
  { arq: 'teste-repositorio.js', o: 'repositorio unico de exames (dias que abrem, tres sinais, audio e fotos)' },
  { arq: 'teste-reabrir-exame.js', o: 'Reabrir exame nao joga o medico na interface antiga' },
  { arq: 'teste-moldura-timbrado-proprio.js', o: 'a caixa do texto nao descola do texto (timbrado proprio, medido em papel)' },
  { arq: 'teste-bancada-impressao.js', o: 'bancada de impressao: as 4 regras de layout, na folha composta', lento: true },
  { arq: 'teste-orads-diametro.js', o: 'O-RADS: o maior diametro escrito no laudo vale, e da para responder' },
  { arq: 'teste-faixa-apontada.js', o: 'a IA aponta a POSICAO no ditado (fim da caca a citacao)' },
  { arq: 'teste-tela-provedor-ia.js', o: 'tela nova do Provedor de IA (espelha os campos antigos, um salvar so)' },
  { arq: 'teste-telas-config.js', o: 'telas novas de Configuracoes (blocos movidos, nao copiados)' },
  { arq: 'teste-locais-editar.js', o: 'editar os locais de atendimento (a chave nao muda ao renomear)' },
  { arq: 'teste-mascara-a4.js', o: 'mascara enviada preenche a folha A4 e avisa sobre distorcao' },
  { arq: 'teste-formatacao-liberacao.js', o: 'as DUAS barras de formatacao (foco preso, zerar que zera)' },
  { arq: 'teste-rede.py', o: 'queda da placa para a CPU, exercitada de verdade', py: true },
  { arq: 'teste-placa.py', o: 'reserva da placa: dois agentes nao carregam juntos', py: true },
  { arq: 'teste-volta-placa.py', o: 'volta automatica para a placa depois de cair para a CPU', py: true },
  { arq: 'teste-microfone-ocioso.py', o: 'microfone fecha sozinho quando ninguem esta atendendo', py: true },
  { arq: 'teste-listar-modelos.py', o: 'listar os modelos da conta (a chave nao sai do agente)', py: true },
  { arq: 'teste-reiniciar.js', o: 'botao de reiniciar o agente (lado do app)' },
  { arq: 'teste-reiniciar.py', o: 'reiniciar o agente: recusa, espera e sucessor', py: true },
  { arq: 'teste-anterior.js', o: 'comparacao com o exame anterior (F2b)' },
  { arq: 'teste-alertas.js', o: 'painel de alertas por categoria' },
  { arq: 'teste-faltando.js', o: 'medidas em branco no laudo (F2e)' },
  { arq: 'teste-caixapreta.js', o: 'caixa-preta da gravacao (janela fechou)' },
  { arq: 'teste-gravagente.js', o: 'gravacao continua pelo agente' },
  { arq: 'teste-obstetrico.js', o: 'idade gestacional (AUA x GA) do obstetrico' },
  { arq: 'teste-doppler-arterial.js', o: 'Doppler arterial de MMII: modelo, dizeres e velocidade ausente' },
  { arq: 'teste-salvar-pasta.js', o: 'salvar na pasta do dia: permissao antes do PDF, e plano B que avisa' },
  { arq: 'teste-historico-tela.js', o: 'tela de Historico (pastas do dia) e a porta de Liberar laudos' },
  { arq: 'teste-blocos-revisao.js', o: 'retangulos da revisao: negrito de medida x titulo x achado' },
  { arq: 'teste-correcoes-1908.js', o: 'leva de correcoes de 19/08: audio, fotos, fila e botoes' },
  { arq: 'teste-fila-banco.js', o: 'banco estruturado - lado do app (payload e fila)' },
  { arq: 'teste-buffer.py', o: 'fita de audio do agente', py: true },
  { arq: 'teste-cache.py', o: 'cache da listagem DICOM', py: true },
  { arq: 'teste-banco.py', o: 'banco estruturado - modulo SQLite do agente', py: true },
  { arq: 'teste-backup.js', o: 'backup externo (precisa do agente no ar)', agente: true },
  { arq: 'teste-chave.js', o: 'chave da OpenAI no agente (precisa do agente no ar)', agente: true },
  // Esta abre o programa INTEIRO num Chrome de verdade. As de cima testam funcoes soltas e
  // por isso deixaram passar, com tudo verde, as falhas de montagem de 04-05/08.
  { arq: 'teste-navegador.js', o: 'programa rodando no navegador (ponta a ponta)' },
];

let ok = 0, falhou = 0, pulou = 0;
const problemas = [];

/* 09/09/2026 — PROCURA O AGENTE EM TODAS AS LINHAS VIVAS, NAO SO NUMA PORTA.
   Ate hoje a bateria batia so na 8977. Essa porta e da linha estavel, DESATIVADA em
   02/09 — ninguem mais atende ali. O resultado: as duas suites que precisam do agente
   apareciam "puladas" todo dia, e ninguem mais rodou nenhuma delas por uma semana.
   Teste pulado todo dia deixa de ser teste; vira enfeite.
   Agora procura na ordem: o que mandarem por AGENTE_URL, depois a 3.0 (reforma, banco
   vazio — o lugar certo para um teste escrever), depois a 2.0. A porta encontrada e
   REPASSADA as suites, para elas conversarem com o mesmo agente que a bateria achou. */
function acharAgente() {
  const tentativas = [process.env.AGENTE_URL, 'http://127.0.0.1:8999', 'http://127.0.0.1:8988']
    .filter(Boolean);
  for (const url of tentativas) {
    try {
      execFileSync('node', ['-e',
        "require('http').get(" + JSON.stringify(url + '/health') +
        ",r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"],
        { timeout: 5000 });
      return url;
    } catch (e) { /* essa linha nao esta no ar; tenta a proxima */ }
  }
  return '';
}
const temPy = fs.existsSync(PY);
const urlAgente = acharAgente();
const temAgente = !!urlAgente;

console.log('='.repeat(64));
console.log('  BATERIA DE TESTES — Laudos USG');
console.log('  Python do ditado-local: ' + (temPy ? 'ok' : 'AUSENTE (testes do agente serao pulados)'));
console.log('  Agente no ar: ' + (temAgente ? urlAgente : 'nao (teste de backup sera pulado)'));
console.log('='.repeat(64));

for (const t of SUITE) {
  const caminho = path.join(AQUI, t.arq);
  if (!fs.existsSync(caminho)) { console.log('  --   ' + t.o + ' (arquivo ausente)'); pulou++; continue; }
  if (t.py && !temPy) { console.log('  --   ' + t.o + ' (sem Python)'); pulou++; continue; }
  if (t.agente && !temAgente) { console.log('  --   ' + t.o + ' (agente fora do ar)'); pulou++; continue; }
  try {
    /* 07/09/2026 — SUITES LENTAS TEM PRAZO PROPRIO. A bancada de impressao compoe folhas
       DE VERDADE (Edge fotografa, o ps1 desenha pagina a pagina) e passa dos 2 minutos.
       Com o prazo unico ela era MORTA no meio e aparecia aqui como "X" sem uma linha de
       explicacao — uma suite verde sendo acusada de vermelha, que e o pior tipo de alarme:
       ensina a ignorar o alarme. */
    const prazo = t.lento ? 900000 : 120000;
    // A suite fala com o MESMO agente que a bateria encontrou — nunca com um escrito nela.
    const amb = urlAgente ? Object.assign({}, process.env, { AGENTE_URL: urlAgente }) : process.env;
    const saida = t.py ? execFileSync(PY, [caminho], { encoding: 'utf8', timeout: prazo, env: amb })
                       : execFileSync('node', [caminho], { encoding: 'utf8', timeout: prazo, env: amb });
    const n = (saida.match(/^\s*ok\s/gm) || []).length;
    console.log('  OK   ' + t.o + (n ? '  (' + n + ' verificacoes)' : ''));
    ok++;
  } catch (e) {
    console.log('  X    ' + t.o);
    const saida = ((e.stdout || '') + (e.stderr || '')).split('\n')
      .filter(l => /FALHA|Error|erro/i.test(l)).slice(0, 4);
    saida.forEach(l => console.log('         ' + l.trim()));
    problemas.push(t.o);
    falhou++;
  }
}

console.log('='.repeat(64));
console.log('  ' + ok + ' suite(s) passaram · ' + falhou + ' falharam · ' + pulou + ' puladas');
if (falhou) { console.log('  NAO PUBLIQUE: ' + problemas.join(', ')); }
else if (pulou) { console.log('  Tudo que rodou passou. Suba o agente para cobrir o resto.'); }
else { console.log('  Tudo verde.'); }
console.log('='.repeat(64));
process.exit(falhou ? 1 : 0);
