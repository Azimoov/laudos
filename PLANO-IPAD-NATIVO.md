# Plano inicial — versão 100% nativa para iPad (chip M5)

> Registrado em 24/08/2026, a pedido do Dr. Daniel, para execução futura — nenhuma
> linha de código deste plano foi escrita ainda. É o rascunho de arquitetura discutido
> em conversa, para não se perder até ele decidir tocar o projeto.

## 1. Por que isto é uma REESCRITA, não uma migração

O programa atual (`_repo-2.0`) é: uma página HTML/JS (`index.html`+`dados.js`) exibida
por um wrapper Python (`pywebview`), mais um "agente" em Python que faz transcrição
local (faster-whisper, exige GPU **CUDA**), conversa DICOM com o aparelho de
ultrassom, guarda tudo em SQLite e faz backup em pasta externa.

Nada disso roda em iPadOS como está: iOS não tem CUDA (não é questão de driver, é
arquitetura — Apple não suporta GPU Nvidia), não roda processos Python arbitrários em
segundo plano, e o acesso a arquivo é sandboxed por app. **A única peça que sobrevive
quase intacta é o HTML/JS da tela** (via `WKWebView`, o componente nativo da Apple
para exibir conteúdo web dentro de um app). Todo o resto do agente precisa ser
reescrito em código nativo (Swift).

## 2. Por que o M5 destrava isso

A transcrição local deixa de depender de CUDA e passa a rodar no **Neural Engine**
do chip Apple, usando uma variante do Whisper compilada para Core ML (ex.:
`whisper.cpp` com encoder Core ML). Isso só é viável com boa margem em chips **M**
(M1 e acima) — o M5 tem sobra de força para isso, inclusive rodando o modelo
`large-v3` (o mesmo usado hoje) sem precisar baixar para uma versão menor.

## 3. Mapeamento peça por peça (o que existe hoje → o que vira no iPad)

| Peça atual (Windows) | Hoje | No iPad (M5) |
|---|---|---|
| Tela do laudo | `index.html`/`dados.js`/`fundos.js`, HTML/JS puro | Reaproveitada quase 1:1 dentro de um `WKWebView` — é o menor risco de toda a migração, porque é onde vive toda a lógica clínica já testada (BIZUS, MODELOS, classificação BI-RADS/TI-RADS/O-RADS, esquema anatômico, etc.) |
| Transcrição local | faster-whisper, CUDA, `agente-laudos.py` | `whisper.cpp` (ou equivalente) com encoder Core ML, rodando no Neural Engine — **precisa validar qualidade em vocabulário médico antes de confiar**, não é um "drop-in" |
| Transcrição em nuvem (rede de segurança) | chamada à API da OpenAI | igual, só muda a linguagem de rede (Swift/URLSession no lugar de Python/requests) |
| Busca de exame no aparelho (DICOM) | `agente-laudos.py`, biblioteca Python de DICOM, rede local (Ethernet/WiFi da clínica) | cliente DICOM nativo (Swift), usando **adaptador USB-C→Ethernet** (funciona bem em iPadOS, sem ressalva) — já existem apps DICOM no iOS, então o caminho é conhecido |
| Banco/histórico de exames | SQLite, arquivo no disco do PC | SQLite nativo (suporte de sistema no iOS, sem gargalo) — precisa portar o schema atual |
| Backup fora do computador | pasta de rede/OneDrive escolhida no agente | iCloud Drive ou pasta de rede via Files, com API nativa equivalente |
| Chave da OpenAI / configurações | `config-agente.json` em texto claro no disco | Keychain do iOS (mais seguro que hoje, de graça) |

## 4. Fases sugeridas (cada uma com um ponto de decisão antes de seguir)

**Fase 0 — prova de conceito da transcrição (sem UI nenhuma).**
Rodar `whisper.cpp`+Core ML num iPad M5 de teste, com áudios REAIS de exame já
gravados (não sintéticos), e comparar a transcrição contra o que o faster-whisper
atual devolveu para o MESMO áudio. Se a qualidade em termo médico cair muito, o
plano todo precisa ser revisto antes de continuar — este é o maior risco técnico
do projeto inteiro, e o mais barato de descobrir cedo.

**Fase 1 — cliente DICOM nativo isolado.**
Um app mínimo, sem tela de laudo nenhuma, que só conecta no aparelho pelo
adaptador Ethernet, lista os exames e baixa as imagens de um estudo de teste.
Prova a parte de rede antes de integrar com o resto.

**Fase 2 — casca do app com a tela atual dentro de um WKWebView.**
Reaproveitar `index.html`/`dados.js` como estão, rodando dentro do WebView, com
dados de mentira (sem agente nenhum por trás ainda). Confirma que a UI e toda a
lógica clínica já validada (as 53 suítes de hoje) sobrevivem ao ambiente novo.

**Fase 3 — ligar as três peças.**
Trocar as chamadas que hoje vão para `agenteBase()` (o agente Python via HTTP)
por chamadas para o código Swift nativo dentro do mesmo app — banco, DICOM e
transcrição local.

**Fase 4 — bateria de testes própria.**
A suíte atual (`testes/rodar-tudo.js`) testa o código Python/HTML de hoje — ela
**não vale nada** para validar o código Swift novo. Precisa de uma bateria
equivalente, escrita para a stack nova, antes de qualquer teste com paciente real.

**Fase 5 — piloto em paralelo, nunca em substituição.**
Rodar ao lado do sistema atual (que continua sendo o de produção), comparando
os mesmos exames nos dois caminhos, até haver confiança para considerar trocar.

## 5. Decisões em aberto (não resolvidas neste plano — decidir quando for tocar)

- **Reaproveitar o HTML/JS via WKWebView vs. reescrever a tela em SwiftUI nativo.**
  A Fase 2 assume WKWebView por ser o caminho de menor risco (evita reescrever toda
  a lógica clínica já testada), mas é uma escolha a confirmar, não uma certeza.
- **Distribuição do app**: TestFlight, sideload interno, ou App Store — cada um tem
  implicações diferentes de processo (revisão da Apple, categoria "aplicativo
  médico", etc.) que não foram avaliadas aqui.
- **Qualidade real da transcrição médica no Neural Engine** — é a Fase 0 que responde
  isso; nada abaixo dela deveria começar antes desse teste.
- **O quanto da rede da clínica** (Wi-Fi, cabo, aparelho de ultrassom) já suporta o
  adaptador Ethernet do iPad sem ajuste nenhum — não testado ainda.

## 6. O que este plano NÃO é

Não é uma estimativa de prazo, não é um orçamento, e não é uma recomendação de
COMEÇAR agora — é só o mapa para quando o Dr. Daniel decidir que quer tocar essa
frente. O sistema atual (Windows + agente) continua sendo o de produção até (e a
menos que) o piloto da Fase 5 prove que o caminho novo é confiável.
