# Referências removidas do laudo — 26/08/2026

Decisão do Dr. Daniel: **"remova todas as referências. vamos ir colocando conforme
formos editando os laudos."**

O MECANISMO continua pronto (asterisco no julgamento + rodapé "Referências dos
julgamentos de tamanho assinalados com *"). Para reativar uma referência, basta
recolocar a entrada dela no `REF_VOLUME` do index.html. A tabela como estava:

```js
const REF_VOLUME = {
  figado: {
    termos:[/hepatomegalia/i, /f[íi]gado[^.]{0,80}?dimens[õo]es aumentad\w*/i],
    ref:'fígado, adulto: até 16 cm no lobo direito (longitudinal, linha hemiclavicular)',
    fonte:'Sienz M, Ignee A, Dietrich CF. Z Gastroenterol 2010;48(9):1141–52 — limite adotado pelo Dr. Daniel em 15/08/2026',
    ressalva:'a própria revisão propõe o valor com a ressalva de não estar suficientemente avaliado; num estudo com 2.080 adultos, 11,5% dos saudáveis passavam de 16 cm'
  },
  baco: {
    termos:[/esplenomegalia/i, /ba[çc]o[^.]{0,80}?dimens[õo]es aumentad\w*/i],
    ref:'baço, adulto: até 13 cm no maior eixo longitudinal',
    fonte:'valor dos modelos do próprio Dr. Daniel — NÃO localizado em fonte primária',
    ressalva:'contestado por Chow 2016 (Radiology, n=1.230): 26% dos homens adultos saudáveis passam de 12 cm'
  },
  ovario: {
    termos:[/ov[áa]rio\w*[^.]{0,80}?(aumentad\w*|volumos\w*)/i, /aumento do volume ovarian\w*/i],
    ref:'ovário: até 20 cm³ na pré-menopausa e 10 cm³ na pós-menopausa',
    fonte:'Pavlik EJ et al. Ovarian volume related to age. Gynecol Oncol 2000;77(3):410–2 (doi 10.1006/gyno.2000.5783) — 13.963 mulheres, 58.673 medidas',
    ressalva:''
  },
  /* PRÓSTATA SAIU DAQUI a pedido do médico (26/08/2026): a única literatura que havia
     era de homens férteis de ~35 anos — não a faixa em que a hiperplasia é avaliada — e
     ele preferiu laudo SEM nota de referência a laudo com referência que não serve.
     O "(Normal até 30 g)" que já vive no texto do modelo dele fica como está: é o valor
     de uso corrente, e valor de uso corrente vence literatura frágil. */
  utero: {
    termos:[/[úu]tero[^.]{0,80}?(aumentad\w*|volumos\w*)/i, /aumento do volume uterin\w*/i],
    /* O ÚTERO GRÁVIDO é aumentado por natureza — não é achado, é a gestação. Marcá-lo com
       asterisco e apontar a tabela pediátrica de 2 a 7 anos seria pior que não marcar: um
       rodapé fora de contexto ensina o médico a ignorar o rodapé. Achado pela revisão desta
       própria tarefa, no modelo obstétrico ("Útero aumentado de volume ... contendo feto"). */
    excecoes:[/\bfeto\b/i, /gesta[çc]/i, /gravíd/i, /concepto/i, /bcf\b/i],
    ref:'útero: o programa só tem referência por idade, dos 2 aos 7 anos (por volume)',
    fonte:'ver "Medidas por idade" nas referências do programa',
    ressalva:'para a mulher ADULTA não há corte único estabelecido — os estudos trazem médias por paridade e menopausa, não limite superior. O aumento aqui é julgamento clínico, não conferência contra tabela'
  },
  rim: {
    termos:[/atrofia renal/i, /ri[nm]s?[^.]{0,80}?dimens[õo]es (aumentad\w*|reduzid\w*)/i],
    ref:'rim: maior eixo longitudinal, faixa por idade',
    fonte:'ver "Medidas por idade" nas referências do programa',
    ressalva:''
  },
  vesicula: {
    termos:[/ves[íi]cula[^.]{0,80}?dimens[õo]es aumentad\w*/i, /hidr[óo]psia vesicular/i],
    ref:'vesícula biliar: SEM referência estabelecida neste programa',
    fonte:'',
    ressalva:'não foi localizado corte de tamanho em fonte primária; o julgamento é clínico'
  },
  ducto_mamario: {
    termos:[/ectasia ductal/i, /dilata[çc][ãa]o ductal/i],
    /* 24/08/2026, pedido do médico: a referência do calibre só entra no rodapé quando o
       laudo trata o ducto como PATOLÓGICO. Sem esta guarda, "sem dilatação ductal" e
       "ausência de ectasia ductal" — frases de laudo NORMAL — casavam com os termos acima,
       ganhavam asterisco e puxavam a referência. Pior que ruído: o asterisco marca um
       julgamento de tamanho onde o laudo afirma justamente que não há. A exceção lê a
       FRASE em volta (mesma mecânica do útero grávido logo acima). */
    excecoes:[/\bsem\b/i, /\bausência\b/i, /\bausencia\b/i, /\bnão\b/i, /\bnao\b/i,
              /\bpreservad\w*/i, /\bnormal\w*/i, /\bhabitua\w*/i],
    ref:'ductos mamários: retroareolares até 0,3 cm, periféricos até 0,2 cm',
    /* 24/08/2026 — O AUDITORIA-CBR SAIU DA ATRIBUIÇÃO, a pedido do médico: ele não é
       fonte oficial (é um documento de outra sessão, nunca avaliado por ele). O VALOR
       fica, porque não veio de lá — o corte de calibre é do léxico do BI-RADS, e é o
       que ele já usa. O que muda é a quem o laudo dá o crédito.
       Com a EDIÇÃO no nome, não só "léxico ACR BI-RADS": a regra do programa é que toda
       fonte seja rastreável (ano, acervo, ou a declaração de que não há) — e a suíte de
       referências reprovou a primeira versão desta linha por ela não datar nada.
       SEM RESSALVA, por decisão dele no mesmo dia: a ressalva sobre não ter conferido o
       atlas primário foi apresentada e ele mandou tirar. A fonte segue declarada, que é
       o que a regra da casa exige; o que saiu foi o comentário sobre a checagem. */
    fonte:'léxico ACR BI-RADS v2025',
    ressalva:''
  },
  nervo_mediano: {
    termos:[/nervo mediano[^.]{0,80}?(aumentad\w*|espessad\w*)/i],
    ref:'nervo mediano: o valor de 0,12 cm² usado no dizer NÃO tem fonte declarada',
    fonte:'',
    ressalva:'a literatura do túnel do carpo usa cortes entre 0,09 e 0,12 cm² conforme o estudo; enquanto a fonte não for fixada, o número vale como referência de serviço'
  },
  tendao: {
    termos:[/tend[ãa]o[^.]{0,80}?aumentad\w* de calibre/i, /espessamento tendine\w*/i],
    ref:'tendão: SEM referência estabelecida neste programa',
    fonte:'',
    ressalva:'o calibre normal varia por tendão e por porte do paciente; não há corte único, e o julgamento é comparativo com o lado contralateral'
  }
};
```

A anotação pediátrica no corpo ("(referência para X anos: ...)") também foi
desligada (`refEscreverNoCorpo` devolve o corpo intacto); os ALERTAS de medida
fora da faixa continuam na tela — alerta de tela não é laudo.
