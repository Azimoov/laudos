# Erros corrigidos — 24/08/2026

Marque `[x]` conforme conferir. **Recarregue a janela (F5) antes de testar.**

## Os 5 que você pediu

- [ ] **1. Descritores BI-RADS pré-preenchidos.** Forma, orientação e margem já escritas no
      texto deixam de ser cobradas — são lidas da frase. Padrão ecogênico entrou como
      *hipoecogênica* nos dizeres de nódulo BI-RADS 3 e 4. Achados posteriores vêm assumidos
      como *sem alteração*. Tudo continua trocável num toque, em caixa verde.
- [ ] **2. Cisto simples não exige mais a distância da papila.** Mantém a hora e as três
      medidas. Os outros dizeres continuam pedindo a distância.
- [ ] **3. Formatação sobreposta pelo timbrado.** O laudo pode usar mais de uma página: a
      margem passou a ser da PÁGINA, então toda página reserva o espaço do cabeçalho e do
      rodapé. O arquivo salvo na pasta leva a mesma regra.
- [ ] **4. Arraste dos marcadores.** Segue o dedo (não pula mais para posição fixa), encaixa
      em hora e centímetro inteiros só ao soltar, e a mudança agora aparece **também** na
      tela estruturada.
- [ ] **5. Legenda repetitiva.** Não repete mais lado, hora nem distância.

## Os 7 que a auditoria independente achou, e que você não tinha visto

- [ ] **6. "Orientação NÃO paralela" era lida como "paralela".** Um nódulo suspeito virava
      benigno: **BI-RADS 4A (biópsia) caía para 3 (seguimento em 6 meses)**, sem aviso.
- [ ] **7. "De forma irregular" inventava "margem circunscrita".** O sinônimo *regular* é
      pedaço de *irregular*, e o app afirmava um descritor benigno que ninguém escreveu.
- [ ] **8. Biópsia indicada por engano.** O pré-preenchimento lia *heterogêneo* da descrição
      do **parênquima** — que fica na mesma frase da lesão — e atribuía ao nódulo. Um nódulo
      oval, paralelo e circunscrito saía como **BI-RADS 4A com "Diagnóstico tecidual
      (biópsia)"**. Este erro fui eu que introduzi ao corrigir o item 1.
- [ ] **9. Arraste escrevia uma SEGUNDA distância.** O parágrafo ficava com duas
      localizações contradizendo uma à outra.
- [ ] **10. Trocar um descritor fazia os outros voltarem a ser pendência.** O recálculo
      perdia o texto do laudo.
- [ ] **11. Legenda com 6 casas decimais durante o arraste** ("5.373928h, a 4.128374 cm").
- [ ] **12. Preposição sobrando no rótulo** ("— distando —", "— a —", "cisto na").

## Dois de fundo, achados no caminho

- [ ] **13. "Hipoecogênica" (feminino) não era reconhecida** — só a forma masculina estava
      cadastrada. Sem isto, o item 1 não teria efeito nenhum, porque o laudo escreve no
      feminino.
- [ ] **14. Descritor da lesão escrito antes de "apresentando" era descartado** — um achado
      francamente suspeito virava pendência à toa. Agora sai BI-RADS 5 corretamente.

---

## Achados depois dos 3 ciclos, ao revisar o que tinha ficado de fora

- [ ] **15. Arrastar dizia o contrário do que você fazia.** Numa lesão sem distância
      informada, o marcador andava e a legenda continuava dizendo *"distância da papila não
      informada"* enquanto você o segurava. Arrastar **é** informar a distância.
      (O 3º auditor apontou; eu não tinha corrigido.)
- [ ] **16. Risco de quebra no iPad.** Eu tinha usado um recurso de expressão regular
      (*lookbehind*) que só existe no Safari 16.4 ou mais novo — num iPad mais antigo o
      esquema pararia de desenhar sem explicação. Trocado por algo que funciona em qualquer
      navegador. **Ninguém tinha visto isto**, nem os três ciclos.

## O que ainda depende de você

- **Impressão em papel não foi testada** — não tenho impressora aqui. A regra de margem por
  página está correta no código e conferida no navegador, mas só o papel responde se o
  laudo de duas páginas sai sem sobrepor o timbrado. **É o único item da lista que
  continua sem verificação de verdade.**
- **Uma observação sobre a largura do texto:** com a margem indo para a página, a lateral
  impressa passou a ser 8 mm (antes eram 8 mm + 10 mm de recuo interno). A coluna de texto
  ficou mais larga. Se preferir como era, é um número para eu ajustar.

## Estado

- **65 suítes de teste, zero falhas.**
- **3 ciclos de auditoria independente**, como você definiu. Ciclo 1: 3 erros. Ciclo 2: 4
  erros. Ciclo 3: confirmou as correções e apontou 2 pontos residuais no mesmo mecanismo,
  que foram fechados.
- A lição que fica registrada: a bateria dava **"tudo verde" enquanto o app indicava biópsia
  por engano**, porque os testes rodavam com dados que eu mesmo montava. A suíte nova
  (`teste-mama-auditoria-24-08.js`) roda contra as frases reais do laudo.
