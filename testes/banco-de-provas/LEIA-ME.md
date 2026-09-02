# Banco de provas do recorte de áudio

Mede, em **centenas de laudos reais já feitos**, se o recorte do áudio por patologia cai em
cima da fala certa. Existe porque em 31/08/2026 o recorte foi consertado cinco vezes
seguidas, **cada uma medida com um exemplo só** — e cada conserto revelava o caso seguinte.
Com régua, dá para julgar uma mudança por um número.

> ⚠️ **As fitas de palavras contêm o ditado do paciente, palavra por palavra.**
> Este repositório vai para o GitHub. Por isso o material fica **fora dele**, em
> `Projeto WBOT\_banco-de-provas\` (mude com a variável `WBOT_BANCO`).
> Aqui entram só os scripts. O `.gitignore` tem cinto e suspensório para o caso de alguém
> apontar o cache para dentro.

## Como rodar

**1. Colher as fitas** (uma vez; é resumível, rodar de novo pula o que já tem):

```bash
python testes/banco-de-provas/colher-fitas.py
```

Passa pela rota `/transcrever` do agente **de propósito**: reusa o motor já carregado na
placa (não cabe um segundo nos 4 GB) e entra na **mesma fila** do exame ao vivo — se o
médico começar a atender no meio, o exame dele espera no máximo uma transcrição.
~19,5 h de áudio saem em torno de 45 min, a ~25x o tempo real.

> **Efeito colateral conhecido:** a rota `/transcrever` chama `DIC.reinforce()` no texto —
> ela conta quantas vezes cada termo do dicionário aparece. Reprocessar os ditados antigos
> **incrementa esses contadores de novo**. Não cria termo nem apaga nada, e os termos
> reforçados são os que ele de fato usa, mas o efeito existe: na colheita de 01/09,
> **33 dos 124 termos** tiveram o contador somado outra vez. Se algum dia isso incomodar, o
> caminho é a rota ganhar um modo "só transcrever, não aprender".

**2. Medir:**

```bash
node testes/banco-de-provas/medir.js
```

## Como ele julga

A **verdade não sai do casador que está sendo medido** — seria o aluno corrigindo a própria
prova. Ela sai de um alinhamento estrito e independente entre a citação da IA e a fita.
Caso sem verdade clara fica **fora da nota**, em vez de virar acerto ou erro por chute.

Três baldes, porque "não começa no começo da fala" não é a mesma coisa que "toca outro
achado":

| Balde | O que é |
|---|---|
| **CERTO** | começa na fala e entrega os primeiros segundos |
| **PARCIAL** | cai dentro da fala, só no fim — o achado foi ditado por mais tempo do que cabe num recorte curto |
| **GRAVE** | não encosta na fala: ele ouve **outra coisa**. É o único que engana |

## A prova da faixa apontada

```bash
python testes/banco-de-provas/provar-faixa.py gpt-5.5 9
```

Monta a fita numerada de ditados reais e pergunta à IA as faixas
(`palavra_ini`/`palavra_fim`) das seções que ela mesma escreveu. **Faz chamadas pagas** —
poucas, e pelo `/ia/chat` do agente, então a chave não sai de lá.

Medido em 01/09/2026, 37 faixas: **20 acertos, 0 erros, 17 recusas** (`0-0` = "não veio do
ditado", tratado como inválido pelo app, que cai na busca).

## Números de 01/09/2026

| | |
|---|---|
| citações reais disponíveis | 695 |
| exames com áudio ainda em disco | 196 |
| citações medidas | 259 |
| busca — CERTO | 85,7% |
| busca — PARCIAL | 14,3% |
| busca — GRAVE | **0%** |

Foi com estes números que se decidiu **não mexer** no casador por busca: ele erra por
encurtar, não por enganar. O banco serve tanto para decidir mudar quanto para decidir
deixar quieto.
