# O áudio de conferência por patologia — o conserto de raiz

**01/09/2026.** Feito durante a noite, a pedido dele: *"tenta pensar em um plano pra
conseguir fazer isso ser mais confiável, sem precisar que eu fique dizendo uma
palavra-chave antes do que eu vou gravar"*.

> **Ele não mudou nada no jeito de ditar.** Nenhuma palavra-chave, nenhuma pausa
> combinada, nenhum "atenção, achado". O conserto é todo do lado do programa.

---

## 1. Por que era caótico

Em 31/08 o recorte foi consertado **cinco vezes seguidas**, e cada conserto revelava um
caso de borda novo:

| # | O caso | O que ele ouvia |
|---|---|---|
| 1 | citação de uma palavra só (`"esteatose 1"`) | o recorte caía na estimativa e tocava 8 s fora |
| 2 | palavra repetida em dois achados (`cálculo` na vesícula **e** no rim) | a busca de um alcançava o outro |
| 3 | pausa de 15 s no meio da frase | o recorte esticava 16 s e começava dentro do achado anterior |
| 4 | palavra colada na borda do trecho | a folga do começo era zerada e cortava a primeira sílaba |
| 5 | folga de 3 s invadindo o achado seguinte | dois achados viravam um; a tela dizia "2" havendo 3 |

Todos no **mesmo lugar**: o pedaço que procura a frase da patologia dentro da fita de
palavras.

**A causa era estrutural, não uma sequência de descuidos.** A IA *leu* o ditado para
escrever o parágrafo — ela sabe exatamente de onde tirou cada coisa. Mas contava isso em
**prosa** (uma citação), e o programa tinha de **reconstruir por busca**. Busca tem
infinitos casos de borda. Apontar não tem nenhum.

---

## 2. As três partes

### Parte 3 (feita primeiro) — o banco de provas

Sem régua não dá para saber se uma troca melhora. Montado a partir do que já existia em
disco, **sem ele gravar nada**:

- 365 exames com o JSON da IA guardado · 360 com ficha de procedência · **695 citações**
- **196 exames com o áudio ainda em disco** (~19,5 h) — colhidos em **48 min, 0 falhas**,
  a ~26x o tempo real
- **259 citações** com verdade confiável o bastante para entrar na nota
- as fitas de palavras colhidas pela rota `/transcrever` do agente — que **reusa o motor já
  carregado na placa** (não cabe um segundo nos 4 GB) e entra na **mesma fila** do exame ao
  vivo, então um exame de verdade espera no máximo uma transcrição

**A verdade não sai do casador que está sendo medido** — seria o aluno corrigindo a própria
prova. Ela sai de um alinhamento estrito e independente; caso sem verdade clara fica **fora
da nota**, em vez de virar acerto ou erro por chute.

**Três baldes, não dois** — porque "não começa no começo da fala" não é a mesma coisa que
"toca outro achado":

| | |
|---|---|
| **CERTO** | começa na fala e entrega os primeiros segundos |
| **PARCIAL** | cai dentro da fala, mas só no fim — acontece quando o achado foi ditado por mais tempo do que cabe num recorte curto |
| **GRAVE** | não encosta na fala: ele ouve **outra coisa**. É o único que engana |

### Parte 1 — a IA devolve a POSIÇÃO, não a citação

O ditado passa a ir **numerado**, palavra por palavra:

```
[25]Certo. [26]Esteatose [27]3, [28]cálculo [29]no [30]rim [31]direito,
```

e cada item de `procedencia` ganha `palavra_ini` / `palavra_fim`. **Não há mais busca**: o
recorte é exato por construção.

- A numeração é **global** e segue a ordem dos trechos — a mesma que `rev2Fita()`
  reconstrói na tela. **As duas pontas têm de andar juntas.**
- Só existe quando o ditado veio **com hora de palavra**. Sem ela, o pedido segue com o
  texto corrido de sempre.
- Os números levam o aviso de que **não são fala e nunca entram no laudo**.

**Conferência antes de aceitar** — os números são dela, e ela pode errar:

1. dentro da fita e em ordem;
2. a fala apontada não é o exame inteiro (achado nenhum dura 90 s);
3. havendo citação, as palavras apontadas têm de ter **algo em comum com ela** — é o que
   pega o erro de dez posições, o pior de todos: tocar **com confiança** o achado do órgão
   errado.

Reprovando em qualquer uma, cai na busca de antes.

### Parte 2 — o selo: a tela diz em qual caminho ele está pisando

| Selo | Como saiu | Confiança |
|---|---|---|
| *(a IA apontou as palavras)* | sem busca | exata |
| *(hora exata da fala)* | casada na fita | alta |
| *(recorte estimado — pode sair deslocado)* | regra de três | baixa, e **avisa** |

Boa parte do caos de 31/08 foi ele descobrir o erro **ouvindo**. Erro que não se anuncia
vira trabalho dele.

---

## 3. Os números medidos

**A IA sabe apontar** — 37 faixas de laudos reais, com o modelo que ele usa:

| | |
|---|---|
| apontou e **acertou** | **20 de 20** (quase sempre dentro de uma palavra) |
| apontou **errado** | **0** |
| respondeu `0-0` ("não veio do ditado") | 17 → tratado como inválido, cai na busca |

**Ou aponta certo, ou não aponta.** É o modo de falha que se quer.

**A busca (a rede embaixo)**, medida no banco de provas:

| | |
|---|---|
| CERTO | **85,7%** |
| PARCIAL | 14,3% |
| GRAVE | **0%** — em 259 casos medidos |

O parcial acontece quando o achado foi ditado ao longo de mais tempo do que cabe no
recorte — aí nenhum recorte curto cobriria tudo. **A Parte 1 resolve justamente esses**,
porque a faixa apontada começa sempre na primeira palavra do achado.

**Custo da fita numerada:** ditado mediano de 132 palavras → ~400 tokens a mais →
**US$ 0,002 por exame**, ou **US$ 0,08/dia** em 40 exames.

---

## 4. O que NÃO foi feito, e por quê

- **Não mexi no casador por busca.** O banco de provas mostrou 0% de erro grave: ele erra
  por *encurtar*, não por *enganar*. Mexer sem necessidade era repetir o erro de 31/08 —
  trocar mecanismo no escuro. O banco existe também para saber quando **não** mudar.
- **Não detecto patologia por lista de palavras** (esteatose, cálculo…). Sai de graça, mas
  não sabe dizer **a qual órgão** a menção pertence quando a mesma palavra serve a dois
  achados — que foi exatamente o caso do "cálculo" na vesícula e no rim. Serve como
  conferência, não como caminho principal.

## 5. Onde mexer se precisar

| O quê | Onde |
|---|---|
| a fita numerada e o pedido | `fitaDeTrechos`, `fitaNumeradaTexto`, dentro de `gerarLaudo` |
| os números viram tempo | `rev2RecortePorFaixa` |
| a busca (rede) | `rev2AcharNasPalavras`, `rev2RecorteFino` |
| o selo | `rev2SeloDoRecorte` |
| folgas e teto | `RV2_FOLGA` (1,2 s) · `RV2_FOLGA_FIM` (1,5 s) · `RV2_TETO` (14 s) |
| a suíte | `testes/teste-faixa-apontada.js` e `testes/teste-audio-patologia.js` |

Os dois exames reais de 31/08 (22h21 e 22h43) estão **congelados como teste**, com as horas
de verdade e o nome do paciente trocado por genérico.
