# Auditoria em 3 ciclos — 25/08/2026

Você pediu: três defeitos, três ciclos de auditoria, um auditor diferente por ciclo,
cada um com abordagem própria, conferindo o anterior e caçando erros novos.
Feito. Marque `[x]` conforme conferir. **F5 na janela do 2.0 antes de testar.**

## Os 3 defeitos que você reportou

- [ ] **1. Cisto simples não passa mais pela classificação BI-RADS.** O programa agora
      LÊ da própria frase do laudo ("cisto simples", "formação cística simples",
      "microcistos agrupados") e dá a categoria 2 direto, sem cobrar forma/orientação
      e sem checklist. A observação declara: "reconhecido na própria frase do laudo".
      - Um nódulo sólido junto no mesmo exame continua cobrado normalmente, e a
        categoria do exame continua sendo a mais alta (testado: cisto D + nódulo
        espiculado E → BI-RADS 5).
      - "Cisto complicado", "não simples" e qualquer frase com descritor suspeito
        continuam no checklist — na dúvida, vale o caminho seguro.
- [ ] **2. Texto sobreposto ao timbrado.** A causa do laudo da sua foto: as margens
      eram calculadas pelo fundo da SESSÃO, não pelo laudo que estava na folha — abrir
      um laudo antigo com timbrado numa sessão de fundo branco imprimia com margem de
      10 mm. Agora a folha carrega o próprio fundo e TODA impressão (botão, Ctrl+P,
      salvar PDF, histórico, arquivo salvo) recalcula na hora, pela folha.
      Medido: o desenho do cabeçalho da Labita ocupa 30,5 mm; a margem de 34 mm cobre.
- [ ] **3. Marcador que corria para o canto e travava.** Causa: a correção de ontem
      ("seguir o dedo") redesenha o esquema a cada movimento, e a conta continuava
      medindo o desenho ANTIGO, que já tinha saído da tela — a divisão por zero virava
      infinito e cravava o marcador na borda. Agora a geometria é fotografada no
      início do arraste. Verificado com arraste real: o marcador segue o dedo e o
      texto recebe a posição do último movimento.

## O que os ciclos acharam além disso (já corrigido)

- [ ] **A impressão de DUAS OU MAIS fotos nunca funcionou** — o jeito de passar a
      lista de arquivos ao Windows só entregava a primeira. Com 2+ fotos, o pedido
      inteiro morria. Corrigido e testado com 3 fotos (uma corrompida de propósito no
      meio: as outras duas saem e você recebe o aviso "1 imagem ilegível foi pulada").
- [ ] **A impressão automática saía sem estilo nenhum e ~3 folhas em branco por
      laudo.** O pacote agora leva o texto formatado, as margens e o timbrado, que é
      desenhado no fundo de CADA página; a sobra branca é aparada. Conferido em PDF:
      conteúdo a 34,0 mm do topo em todas as páginas, timbrado inteiro em todas.
- [ ] **iPad: um gesto do sistema no meio do toque deixava um arraste fantasma
      armado** — o próximo toque em qualquer lugar REESCREVIA o laudo. Cancelou,
      descarta tudo.
- [ ] **iPad: o número da lesão roubava o toque** (lesão grande não arrastava pelo
      centro) e **o marcador tracejado (sem distância) só pegava pelo fio de 1,8 px**.
      Os dois corrigidos.
- [ ] **Clique parado no marcador dava aviso falso de defeito.** Agora só escreve (e
      só avisa) quando houve arraste de verdade.
- [ ] **Laudo salvo no iPad imprimia depois errado no computador** (margem de 8 mm).
      O arquivo agora leva sempre a regra completa de página.
- [ ] **Cadastrar um local podia apagar as margens do timbrado dele.** Preservadas.

## Como foi o processo (os 3 ciclos)

| Ciclo | Abordagem | Resultado |
|---|---|---|
| 1 | Análise estática (ler o código e seguir o fio) | Causas-raiz dos 3 defeitos + 6 achados novos |
| 2 | Dinâmica (executar e medir: Chrome real, PDF real) | **Derrubou a correção do cisto 2×** (o singular "formação cística" não casava; e um nódulo espiculado com "cisto" na frase virava BI-RADS 2). Confirmou impressão e arraste com números. |
| 3 | Adversarial + regressão (tentar quebrar; conferir os 16 itens de ontem) | Núcleo sobreviveu; **zero regressões sobre ontem**; 9 achados novos, dos quais 7 corrigidos hoje |

- A bateria terminou com **66 suítes, zero falhas** (uma suíte nova congela os tombos
  do ciclo 2 — roda contra as frases reais do teu dizer padrão).
- Repositório e cópias instaladas conferidos por md5: idênticos.

## O que ficou registrado SEM correção (para você decidir)

- [ ] **Corte lateral: a profundidade não vai para o texto.** Arrastar no corte muda a
      distância, mas a profundidade (anterior/média/posterior) volta ao que o texto
      diz — o laudo não tem uma frase de profundidade para o desenho reescrever.
      Se quiser que o arraste no corte escreva a profundidade, é uma frase nova no
      texto do laudo: me diga como você a redigiria.
- [ ] **iPad e laudo de 2+ páginas:** o Safari ignora a margem por página. A página 1
      sai certa; da 2 em diante o timbrado ainda é invadido SE você imprimir direto
      do iPad. Imprimindo pelo computador (ou pela impressão automática), sai certo.
- [ ] **"Sem componente sólido" na frase de um cisto derruba o atalho** (a palavra
      "sólido" aciona a guarda) — o cisto volta ao checklist. É o lado conservador da
      regra; se essa redação entrar no teu dizer padrão de cisto, me avise.

## O que continua dependendo de você (de antes)

- [ ] **Imprimir em papel de verdade** — tudo acima foi provado em PDF; o papel da
      Brother/EPSON ainda não viu nada disto. Roteiro na seção 2b do TESTES-PENDENTES.md.
- [ ] Os 16 itens de ontem (ERROS-CORRIGIDOS-2026-08-24.md) seguem esperando teu tique.
- [ ] Nada disto está commitado ainda — nem o de ontem, nem o de hoje.

---

## Adendo — a TELA agora pagina como o papel (25/08, segunda leva)

Sua foto mostrou o laudo atravessando a máscara NA TELA. A causa era o próprio desenho
da tela: uma folha única que crescia com o laudo, com a máscara esticando junto — o
rodapé dela descia pelo meio do texto, e "folha 2" simplesmente não existia. O papel já
paginava certo; a tela é que mentia.

- [ ] **A tela agora mostra folhas de verdade.** A cada 297 mm começa outra folha, com a
      máscara inteira; o texto é empurrado por vãos invisíveis e nunca atravessa o rodapé
      de uma folha nem o cabeçalho da seguinte. A quebra acontece ENTRE parágrafos — a
      mesma regra do papel. Editou o texto, a paginação se refaz sozinha (meio segundo
      depois da última tecla).
- [ ] **Nada disso vai para fora da tela:** o arquivo salvo, o histórico, a impressão e o
      aprendizado recebem a folha limpa, sem os vãos — conferido por teste.
- [ ] **Laudo reaberto do histórico** também ganhou o espaço do cabeçalho na tela (era
      onde o nome da paciente nascia por cima do logo).
- Verificado no navegador real: laudo de 3 folhas, 104 linhas medidas uma a uma, ZERO
  invasões, três repaginações idênticas, conteúdo intacto caractere por caractere.
  Suíte permanente no teste ponta a ponta. Bateria: **66 suítes, zero falhas.**

⚠️ **Aperte F5 na janela do programa** antes de conferir — a janela aberta ontem à noite
ainda roda o código antigo (o laudo da sua foto foi gerado às 00:04, antes de tudo isto).

---

## Adendo 2 — assinatura no pé da última folha (25/08, terceira leva)

Sua foto mostrou a assinatura sozinha numa folha. Corrigido — e com a regra que você
ditou:

- [ ] **A assinatura (com a caixa de esclarecimento junto) ancora SEMPRE no pé da última
      folha.** As duas são um bloco indivisível: ou cabem juntas, ou descem juntas.
- [ ] **Quando faltar pouco espaço, o laudo inteiro aperta um degrau** — primeiro o
      espaço entre linhas, depois (se precisar) o tamanho da letra — **o MESMO padrão do
      início ao fim**, nunca um trecho espremido e o resto não. Para no primeiro degrau
      em que a assinatura volta para a folha do texto. Testado: um laudo que terminava
      rente ao fim da folha voltou de 3 para 2 folhas com um degrau de entrelinha, com a
      assinatura cravada na base.
- [ ] **A tela agora é o laudo final, de verdade:** a folha da tela passou a ter as
      medidas exatas do papel (210 mm de largura, laterais de 8 mm — as mesmas da
      impressão), e o papel quebra as páginas exatamente onde a tela quebra. O que você
      vê é o que sai — linha por linha.
- [ ] **A impressão automática fotografa a própria tela** e o computador só fatia nas
      fronteiras das folhas, pondo o timbrado atrás de cada uma, alinhado pela borda
      física do papel.
- Verificado em três cenários (laudo longo, laudo rente ao fim da folha, laudo curto):
  assinatura na base exata nos três, zero invasões da máscara, compactação uniforme.
  Bateria: **66 suítes, zero falhas.** Agente reiniciado com o código novo.

---

## Adendo 3 — a impressão que bagunçou, reproduzida e resolvida (25/08, tarde)

Você imprimiu e saiu bagunçado: logo no pé de outra página, espaços vazios. Reproduzi
com o TEU laudo real (o da Regiane, aberto pelo Histórico) e confirmei: **a impressão
do NAVEGADOR remonta o laudo com regras próprias e, no teu computador, ignorou as
quebras** — texto colado no topo, timbrado fora do lugar. Não era teoria: medi no PDF.

O conserto, em duas partes:

- [ ] **O botão 🖨 Imprimir agora imprime PELO COMPUTADOR** (o agente): ele fotografa a
      própria tela e só fatia nas fronteiras das folhas, pondo o timbrado atrás de cada
      uma. Comprovado com o teu laudo real: 2 páginas, timbrado inteiro nas duas, e o
      conteúdo da última terminando exatamente na base útil (273 mm) — assinatura no pé.
      **Para isso funcionar, escolha a impressora em Configurações → 🖨 Impressão.**
      Sem impressora escolhida (ou agente fora do ar), o botão volta a abrir a caixa do
      navegador, como sempre.
- [ ] A impressão pelo navegador (Ctrl+P / Salvar PDF) também foi simplificada (margem
      zero, a folha vai como está na tela), mas o motor dela continua menos previsível —
      fica como reserva, não como caminho principal.
- Robustez: se o desenhista da foto (Edge invisível) falhar por azar de timing, o agente
  agora tenta de novo sozinho antes de desistir.

**Como testar sem gastar papel:** em Configurações → Impressão, escolha "Microsoft
Print to PDF" como impressora do laudo, abra o laudo e toque 🖨 Imprimir — ele pede um
lugar para salvar o PDF e você confere na tela. Depois troque para a Brother/EPSON.

⚠️ De novo: **F5 na janela do programa** antes de qualquer teste. Bateria: 66 suítes,
zero falhas. Agente reiniciado com o código novo.
