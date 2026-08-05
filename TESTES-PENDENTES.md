# Testes pendentes — a fazer no notebook da clínica

## ⚡ ORDEM DE ATAQUE (do mais importante para o menos)

0. **Trazer o branch para o notebook** — sem isso nada existe aí:
   `git fetch origin claude/laudos-usg-handoff-2g316v && git checkout claude/laudos-usg-handoff-2g316v`
   e abrir o app local (`python -m http.server 8080` → http://localhost:8080).
1. **Motor de transcrição local** (30 segundos) — para de pagar OpenAI à toa.
2. **Teste da gravação pelo agente** (seção 1) — protege contra a pior perda possível.
3. **Instalar o banco no agente** (seção 5 + `agente/INSTALAR-BANCO.md`) — reinício
   do agente SÓ sem atendimento.
4. **PatientID + nascimento no `/dicom/estudos`** (seção 7 do roteiro) — na mesma
   ida ao agente; destrava a identidade do F2b.
5. **Bateria completa**: `node testes/rodar-tudo.js` com o agente no ar.
6. **Comparação com exame anterior** (seção 2) — com um paciente real.
7. **Obstétrico** (seção 4) — os dois casos (trouxe / não trouxe).
8. **Painel de alertas + impressão limpa** (seção 3).
9. **Decidir o "pode publicar".**
10. Cópia cifrada para o iCloud (7-Zip + senha).
11. GPU na transcrição (comparativo CPU × GPU).
12. Avaliar o AUDITORIA-CBR.md.

---

Coisas que **só podem ser testadas na máquina real** (precisam do agente, do
aparelho de ultrassom ou de um paciente com exame antigo). Estão prontas no
código e passaram na bateria automática, mas ainda **não foram vistas
funcionando de verdade**.

Marque o `[ ]` quando testar. Se algo falhar, anote o que apareceu na tela —
é o que eu preciso para corrigir.

---

## 1. Gravação continua pelo agente, mesmo fechando o navegador

**Por que importa:** em 03/08 a janela do Chrome fechou no meio de um exame e o
ditado inteiro se perdeu. Esta é a correção.

**O que verificar primeiro (o ponto que decide tudo):**

- [ ] Com o modo **"Aguardar exame do aparelho" DESLIGADO**, aperte **🎙 Gravar
      ditado** na aba Captura ao vivo.
- [ ] Olhe a frase embaixo do botão:
  - **"Gravando pelo AGENTE — pode fechar o navegador"** → funcionou, siga para
    o teste seguinte.
  - **"Gravando pelo NAVEGADOR — NÃO feche esta janela"** → o agente não abriu o
    microfone sozinho. **Não está quebrado**, só não resolveu: o app avisou e caiu
    no plano B. Me diga que apareceu isso, e mande o arquivo
    `agente-laudos.py` — o ajuste é lá.

**Se apareceu "pelo AGENTE", teste o que interessa:**

- [ ] Comece uma gravação, fale alguma coisa, e **feche a janela do Chrome**.
- [ ] Abra o app de novo.
- [ ] Deve aparecer: **"O agente continuou gravando enquanto o navegador esteve
      fechado (desde HH:MM)"**, com o cronômetro contando desde o começo de verdade.
- [ ] Aperte parar e confira se o ditado inteiro está lá — inclusive o pedaço
      falado com a janela fechada.

**Teste do plano B (com o agente desligado de propósito):**

- [ ] Desligue o agente, grave alguma coisa e feche a janela.
- [ ] Ao reabrir, deve aparecer no topo uma **faixa vermelha**: "gravação
      interrompida", com duração e horário, e três botões (recuperar e transcrever /
      só baixar o áudio / descartar).
- [ ] Aperte "Recuperar e transcrever" e confira se o áudio veio quase inteiro
      (pode faltar no máximo os últimos 5 segundos).

---

## 2. Comparação com o exame anterior (F2b)

**Por que importa:** o conteúdo do laudo antigo agora entra no pedido à IA. O
risco é comparar com a pessoa errada, ou a IA trazer achado que não foi ditado hoje.

**Escolha um paciente que você sabe que já fez exame aí antes, do mesmo tipo.**

- [ ] Com o exame na lista, antes de ditar: o cartão do paciente deve mostrar a
      etiqueta **🔁 já examinado aqui · (data)** (azul) ou **🔁 já examinado aqui?
      confirmar** (âmbar).
- [ ] Clique na etiqueta: deve abrir o **laudo anterior inteiro** para conferir.
- [ ] Se for a versão âmbar, responda **"É a mesma pessoa"** ou **"É outra
      pessoa"**. Confira que ele **não pergunta de novo** no próximo exame do
      mesmo paciente.
- [ ] Gere o laudo. Na tela de revisão, coluna da **esquerda**, deve aparecer
      "🔁 Comparado com o exame de (data)" e o botão **Ver laudo anterior**.

**O que conferir no texto do laudo (é aqui que mora o perigo):**

- [ ] O laudo **não** trouxe nenhum achado que só existe no exame antigo e que
      você **não ditou hoje**.
- [ ] Onde ele escreveu "estável / aumentou / diminuiu", havia mesmo medida nos
      **dois** exames.
- [ ] A data do exame anterior citada no texto está certa.

**Se algo veio errado, anote a frase exata do laudo** — a correção é no texto das
regras, e é rápida.

**Testes menores da mesma função:**

- [ ] Paciente com **vários** exames anteriores: o botão "➕ Trazer os 3 últimos
      e refazer" aparece e funciona.
- [ ] Paciente **antigo**, cujo laudo provavelmente já saiu do navegador: com o
      agente ligado, ele ainda é encontrado (a busca lê a cópia do computador).
- [ ] Com o **agente desligado**, gerar um laudo deve avisar: "busca de exame
      anterior INCOMPLETA".

---

## 3. Painel de alertas (de quebra, aparece nos testes acima)

- [ ] Na tela de revisão, no lugar da antiga faixa âmbar, deve haver uma fileira
      de caixinhas coloridas.
- [ ] Laudo sem problema nenhum: todas apagadas e pequenas, cada uma dizendo o
      que foi conferido.
- [ ] Laudo com aviso: a caixa da categoria **acende na cor dela e fica maior**.
- [ ] Confira que **nada disso sai na impressão** — imprima um laudo e veja.
- [ ] Se alguma cor ficar difícil de distinguir na sua tela, me diga qual.

---

## 4. Obstétrico 2º/3º trimestre — qual idade gestacional entra na conclusão

**Por que importa:** no exame de 05/08 saiu o número errado. A regra agora está no
app, e não mais a cargo da IA.

- [ ] Paciente que **NÃO trouxe** o USG de primeiro trimestre: a conclusão deve
      dizer *"A biometria fetal estima que a idade gestacional média seja de ..."*
      com o valor do campo **AUA** da worksheet, e a linha da data provável do parto
      deve ser substituída por *"Não contamos com ultrassonografia de primeiro
      trimestre para correta datação da gestação."* (a variação em dias sai junto).
- [ ] Paciente que **TROUXE**: a conclusão deve dizer *"A idade gestacional
      corrigida pela ultrassonografia de primeiro trimestre é de ..."* com o valor
      do campo **GA**, e a data do parto do **EDD(EDD)**.
- [ ] Confira na caixa **verde** do painel de alertas: ela diz de qual campo da
      worksheet cada número foi lido. É o jeito rápido de saber se a IA leu certo.
- [ ] Worksheet ilegível: os pontilhados devem **ficar** no laudo, e a caixa
      **âmbar** deve dizer qual campo faltou. Nada pode ser inventado.

**Confirmar comigo:** quando a paciente TROUXE o exame inicial, a data provável
do parto vem do **EDD(EDD)**, para casar com o GA. Se no seu aparelho essa coluna
significar outra coisa, me diga.

**Também:** mantive a redação exata do seu modelo ("A biometria fetal estima que a
idade gestacional média seja de..."). Você escreveu "A biometria fetal estima
idade gestacional de" — se quiser essa redação mais curta, eu troco no modelo.

---

## 5. Banco estruturado de laudos (rotina da noite — roteiro próprio)

O lado do app já está no branch; o lado do agente está pronto em
`agente/banco.py`. **Siga o passo a passo de `agente/INSTALAR-BANCO.md`**
(15 min: copiar 1 arquivo, ~8 linhas no agente-laudos.py, reiniciar o agente
SEM atendimento em curso, conferir).

- [ ] Instalar conforme `agente/INSTALAR-BANCO.md` e ver "🗄️ Banco local: OK"
      nas Configurações.
- [ ] Gerar um laudo de teste e ver o contador de exames subir.
- [ ] Testar a fila: agente desligado → gerar laudo → religar → recarregar o
      app → o pendente sobe sozinho.
- [ ] (Opcional, recomendado) Ativar a cópia cifrada para o iCloud: 7-Zip +
      arquivo de senha (seção 6 do roteiro). Guardar a senha FORA do computador.
- [ ] Aproveitar a ida ao agente: fazer `/dicom/estudos` devolver o código do
      paciente (PatientID) e a data de nascimento (seção 7 do roteiro).

---

## Pendências antigas, ainda suas (do handoff de 03/08)

- [ ] Preencher `http://127.0.0.1:8977` no campo **"Motor de transcrição local"**
      das Configurações. Enquanto isso não for feito, as **gravações manuais vão
      para a OpenAI e são pagas**.
- [ ] Instalar `nvidia-cudnn-cu12` e `nvidia-cublas-cu12` no venv do
      ditado-local e rodar o comparativo CPU × GPU. Se falhar, rodar `VOLTAR-ATRAS.ps1`.
- [ ] Avaliar o `AUDITORIA-CBR.md` que outra sessão deixou na raiz do repositório
      (segue fora dos commits até você decidir).

---

## Antes de publicar

- [ ] Rodar `node testes/rodar-tudo.js` no repositório, **com o agente no ar e o
      Python do ditado-local disponível**, para fechar as 4 suítes que não rodam
      fora da sua máquina.
- [ ] Publicar só com o seu "pode publicar" (merge ff-only em `main` + push).
