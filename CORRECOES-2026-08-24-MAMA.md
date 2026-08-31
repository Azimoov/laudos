# Correções pedidas em 24/08/2026 — exame de mama

> Marque `[x]` no que você conferiu e aprovou. O que não passar, me diga **o que apareceu
> na tela** — é isso que me leva à causa.
>
> **Antes de conferir: recarregue a janela (F5).** Os cinco consertos já estão no arquivo
> que o programa serve (conferido por md5 na porta em uso), mas a janela aberta só os
> carrega ao recarregar.

---

## 1. Formatação estragada acima e abaixo do texto

- [ ] O texto dos achados termina e o desenho começa **sem buraco** entre eles.
- [ ] Entre o desenho e a **CONCLUSÃO** não há espaço sobrando.
- [ ] O fim do laudo (assinatura/rodapé) não tem vão extra.

**O que era:** saíam sempre dois blocos, mesmo vazios. Sem exame anterior o gráfico de
evolução devolvia nada e sobrava um `<div>` oco no meio do laudo; com a seção da paciente
desligada (o padrão), outro no fim. Ainda por cima o `<br><br>` que abre a CONCLUSÃO se
somava à margem do bloco do desenho.

**O que ficou:** cada bloco só existe se tiver conteúdo, e o espaço em volta do desenho
passou a viver num lugar só (o CSS do próprio bloco), em vez de `<br>` soltos disputando
com a margem.

**Verificado:** o laudo real montado na tela — **zero blocos vazios** (antes: 2).

---

## 2. "MAMA DIREITA/ESQUERDA" escrito por cima das 6:00

- [ ] O rótulo da mama aparece **abaixo** do círculo, sem encostar no número 6.
- [ ] Nada mais ficou cortado no desenho depois do ajuste.

**O que era:** o número das 6 h ficava em y≈197,5 e o título em y=203 — 5,5 px entre eles,
com fontes de 10 e 10,5. Colavam.

**O que ficou:** a folha do desenho **cresceu** (210 → 226) e o título foi para o rodapé
dela. Não foi só empurrar o texto: sem crescer a folha, ele sairia cortado.

**Verificado:** medido no desenho renderizado — **9,5 px de folga**, sem sobreposição.

---

## 3. Nódulo da esquerda dizia "distância da papila não informada", mas foi informada

- [ ] O nódulo da mama esquerda mostra **"a 5 cm da papila"** na legenda.
- [ ] O cisto da direita continua dizendo "não informada" — porque o texto realmente não
      informa (confira se concorda).
- [ ] Em outros laudos, quando você dita a distância, ela aparece.

**O que era — e este era o defeito de fundo:** cada achado é casado com uma **frase do
corpo** do laudo para pegar medida, profundidade e distância. A busca usava só a primeira
parte do rótulo ("mama esquerda") e casava com a **primeira** frase que contivesse isso —
que num laudo real é o cabeçalho *"MAMA ESQUERDA / DESCRIÇÃO: / Mama simétrica."*, uma
frase que não fala do achado. Tudo que só existe na frase certa vinha vazio.

**O que ficou:** a busca passou a ser pela **hora** (é ela que identifica o achado dentro
da mama), presa à seção daquele lado — assim a hora de uma mama nunca casa com a frase da
outra. De quebra, a profundidade também passou a ser lida (1,09 cm da pele).

**Verificado:** no laudo real — esquerda `distCm = 5`, profundidade 10,9 mm, medidas certas.

---

## 4. O texto da legenda se repete

- [ ] Cada linha da legenda diz as coisas **uma vez só**.

**O que era:** a linha começava "Mama direita, 9h, ..." e no fim repetia o rótulo da IA,
"— mama direita, às 9 horas".

**O que ficou:** tira-se do rótulo o lado e a hora; só o que sobrar de informação nova
aparece. Se não sobrar nada, o rótulo não é escrito.

**Verificado:** as duas linhas do laudo real, sem repetição.

---

## 5. BI-RADS deve ser UM por exame, não por lesão

- [ ] A conclusão traz **uma única** "Categoria: BI-RADS ...".
- [ ] Ela **não** vem prefixada por lesão ("mama direita, às 9 horas — Categoria: ...").
- [ ] A categoria mostrada é a **mais alta** entre os achados.
- [ ] A conduta corresponde a essa categoria.

**O que era:** uma linha de categoria por lesão, cada uma prefixada com a localização. Com
dois ou três achados a conclusão virava uma colcha de retalhos — justamente no campo que o
médico solicitante lê primeiro.

**O que ficou:** cada lesão **contribui** com sua categoria; sai **uma** avaliação para o
exame, a mais alta entre elas (a mesma regra do §6 do modelo, que a seção da paciente já
seguia). As observações por lesão continuam no **painel de trabalho** — ali saber qual
achado puxou a categoria para cima é o que importa, e isso não vai para o papel. Quando as
categorias divergem, o painel diz qual venceu e por quê.

Regra de gravidade aplicada: `1 < 2 < 3 < 4A < 4B < 4C < 5 < 6`. A categoria **0**
(avaliação incompleta) não entra nessa escala — se houver qualquer categoria de verdade,
é ela que vale; um exame com um achado 4 não é "incompleto", é 4.

**Verificado:** 9 combinações testadas (incluindo `0 + 4A → 4A`) e o laudo real da Regiane,
que passou de duas linhas de categoria para uma: *"Categoria: BI-RADS 2 — Benigno."*

---

## Estado

- **63 suítes de teste, zero falhas.**
- Cinco suítes antigas acusaram durante o trabalho: elas guardavam as regras **anteriores**
  (categoria por lesão, os dois achados sem distância, o `<div>` sempre presente). Foram
  atualizadas registrando o motivo da mudança — não silenciadas.
- Uma suíte nova (`teste-mama-cinco-correcoes.js`) guarda estas cinco correções, e ela roda
  contra um **laudo real** exportado do banco, não contra dado inventado. Foi essa a lição
  das tentativas anteriores: eu testava um formato que o programa nunca produz.

---

## Nota — "ao regerar, não veio o exame anterior" (investigado, **sem alteração**)

Levantado por você depois destas cinco correções. **Não é defeito, e ficou como está** —
decisão sua em 24/08/2026.

O histórico guarda **um registro por exame**, e a busca do exame anterior exclui o próprio
laudo (senão ele se compararia consigo mesmo). Como o único registro de mama da Regiane no
histórico é o exame que estava sendo regerado, sobra zero para comparar. No banco há 4
laudos de mama dela hoje; no histórico, um só, porque as regerações gravam no mesmo
registro.

A busca em si está funcionando — verificado com uma paciente que tem dois exames do mesmo
tipo (acha o anterior normalmente), e o texto do laudo anterior carrega do agente sem
problema.

A alternativa (cada geração virar um registro próprio) foi apresentada e **recusada**:
encheria o histórico de versões do mesmo exame, e o "exame anterior" de amanhã poderia
casar com um rascunho de hoje em vez do exame real de meses atrás.

---

## Se algo ainda estiver errado

Me diga o **nome da paciente** e o que apareceu. Eu puxo o laudo dela do banco e reproduzo
com o dado de verdade — foi assim que o desenho finalmente saiu.
