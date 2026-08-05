# Instalar o banco estruturado no agente — roteiro da noite

O lado do **app** já está pronto e publicado no branch (gera os dados
estruturados, envia, enfileira quando o agente está fora e mostra o estado nas
Configurações). O lado do **agente** está pronto neste repositório
(`agente/banco.py`, testado pela suíte `teste-banco.py`) — falta só **instalar**,
que é o que este roteiro descreve. Tempo estimado: 15 minutos.

> Regras que continuam valendo: não reiniciar o agente com atendimento em curso;
> o banco fica FORA do git e FORA da nuvem (só o backup **cifrado** sobe).

## 1. Backup antes de mexer

```powershell
$dia = Get-Date -Format yyyyMMdd
$dst = "C:\Users\serru\OneDrive\Desktop\Claude code\conhecimento\backups\antes-banco-$dia"
New-Item -ItemType Directory -Force $dst
Copy-Item "C:\Users\serru\AppData\Local\LaudosLocal\agente-laudos.py" $dst
```

## 2. Copiar o módulo

```powershell
Copy-Item "C:\Users\serru\OneDrive\Desktop\Projeto WBOT\_repo\agente\banco.py" `
          "C:\Users\serru\AppData\Local\LaudosLocal\banco.py"
```

O banco será criado sozinho em `C:\Users\serru\AppData\Local\LaudosLocal\dados\laudos.db`
na primeira gravação.

## 3. Ligar no agente-laudos.py (a única edição no arquivo do agente)

**a)** No topo, junto dos outros imports:

```python
import banco
```

**b)** No ponto onde o servidor decide qual rota atender (onde já são tratados
`/dados/...`, `/dicom/...` etc.), **antes** de responder 404, acrescentar — uma
vez no tratador de GET e uma vez no de POST:

```python
r = banco.responder(metodo, caminho, corpo)   # corpo = dict do JSON recebido (ou {})
if r is not None:
    status, resposta = r
    # responder `resposta` como JSON com o codigo `status`, no padrao das outras rotas
    return
```

`banco.responder` cuida de tudo: `POST /exames`, `POST /exames/<id>/final`,
`GET /pacientes/buscar`, `GET /dados/saude`. Rota que não é dele devolve `None`
e o agente segue o fluxo normal. Erros viram 400/404/500 com `{"erro": "..."}` —
nunca exceção solta.

**c)** Na subida do agente (onde ele já imprime que está no ar), uma linha:

```python
banco.iniciar_rotinas()   # backup diario + copia cifrada (melhor-esforco, nunca trava)
```

## 4. Reiniciar o agente

⚠️ **Só sem atendimento em curso.** Fechar o processo atual e rodar o
`iniciar-agente.vbs` de novo (ou reiniciar a máquina).

## 5. Conferir que funcionou (2 minutos)

1. `node testes/rodar-tudo.js` no repositório — as suítes do agente saem de
   "puladas" para verdes (inclusive `teste-banco.py`).
2. Abrir o app → Configurações → deve aparecer **"🗄️ Banco local: OK — 0 exame(s)"**.
3. Gerar um laudo de teste → o contador vira 1.
4. Salvar/assinar o laudo → no banco, o exame ganha a versão final
   (`GET http://127.0.0.1:8977/dados/saude` mostra o total).
5. Desligar o agente, gerar um laudo, religar, recarregar o app → o pendente
   sobe sozinho e o indicador volta a OK.

## 6. Ativar a cópia cifrada para o iCloud (opcional, recomendado)

1. Instalar o 7-Zip (se ainda não tiver): https://www.7-zip.org
2. Criar `C:\Users\serru\AppData\Local\LaudosLocal\dados\backup-senha.txt` com a
   senha em **uma linha**.
3. **Guardar essa senha fora do computador** (gerenciador de senhas ou papel) —
   sem ela os backups da nuvem são irrecuperáveis.
4. No próximo início do agente: `dados\backup\laudos-AAAAMMDD.db` (local) e
   `iCloud Drive\Backups Laudos\laudos-AAAAMMDD.7z` (cifrado). Faltando
   qualquer peça, o agente avisa no log e pula — nunca quebra.

## 7. Enquanto estiver no agente (aproveita a viagem)

Duas pendências antigas do mesmo arquivo, se houver tempo:

- `/dicom/estudos` devolver também o **código do paciente** (PatientID) e a
  **data de nascimento** de cada estudo. O app já lê o código
  (`codigo`/`patientId`/`PatientID`, qualquer grafia serve) — é o que liga a
  identidade do F2b e do banco. O nascimento alimentará o cadastro do banco.
- Conferir se `/gravacao/iniciar` abre o microfone sozinho com o pré-buffer
  desligado (teste 1 do TESTES-PENDENTES.md).
