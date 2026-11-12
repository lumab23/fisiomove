# Contrato de execução e resumo de sessão mobile

## Identificadores

Antes de iniciar, a camada de composição prepara a sessão por M01/M02 e mantém
`client_session_id`, `workout_id`, `workout_revision_id` e `started_at`. M07 usa o
rascunho já salvo e `useSessionResult` chama
`useSessionSync().finishDraft(...)` ao concluir ou interromper e para a câmera;
não cria outro identificador nem mantém uma segunda fila.

## Resultado enviado

O mobile entrega apenas `completed` ou `interrupted`, horários com fuso,
`active_duration_ms`, resumos derivados opcionais e itens com IDs da prescrição,
séries completas, repetições concluídas, duração ativa e indicador de interrupção.
O servidor calcula a pontuação e valida o resultado contra o snapshot e limites da
revisão. O mobile não envia score, frames, landmarks, vídeo, áudio ou calibração.

Pausa e descanso não somam duração ativa. Somente ciclos completos do motor contam
como repetição; movimento parcial não fecha uma série. Interrupção conserva os
ciclos completos e séries parciais que já ocorreram. O fim da sessão desativa o
stream da câmera e libera o microfone se uma integração futura o tiver aberto.

Exceção acadêmica (DEC-008): repetições contadas por toque do paciente são
enviadas como `completed_repetitions` e pontuam normalmente; os itens importados
da biblioteca têm `rule_version = "library-reference-no-camera-rule:v1"`. Isso
relaxa a RN06 e a RN08 apenas no uso acadêmico (DEC-006) e precisa ser revisto
antes de qualquer uso clínico.

### Origem da contagem (`counting_mode`, DEC-013)

O fisioterapeuta pode ativar, por item unilateral do treino,
`counting_rule = "demo-elbow-flexion:v1"` — regra **demonstrativa, não validada
clinicamente**. O valor vai no snapshot do item publicado; itens sem a regra têm
`counting_rule: null` e só aceitam contagem manual. Um treino publicado antes da
regra existir só passa a oferecê-la depois de editado e republicado com o campo.

Cada item do resultado leva `counting_mode`:

| Valor | Uso |
| --- | --- |
| `manual` | padrão; todas as repetições do item contadas por toque |
| `automatic` | todas as repetições do item contadas pelo motor |
| `mixed` | o motor contou parte e o paciente passou para "Contar manualmente" |

- O campo é opcional no envio e vale `manual` quando omitido, para que resultados
  da fila offline gravados antes dele continuem válidos.
- `automatic` e `mixed` só são aceitos se o item do snapshot da revisão tiver
  `counting_rule`; caso contrário a API devolve `422 counting_mode_unavailable`
  com `details = { "field": "counting_mode", "position": <posição> }`.
- A pontuação não depende da origem: todas as origens pontuam como na DEC-008.
- `counting_mode` faz parte do conteúdo idempotente: reenviar o mesmo
  `client_session_id` com outra origem devolve `409 idempotency_conflict`. Para
  compatibilidade com o hash dos resultados anteriores ao campo, o valor `manual`
  é desconsiderado no cálculo do hash (omitir ou enviar `manual` é equivalente).
- Resultados gravados antes do campo são lidos com `counting_mode = "manual"`;
  não há backfill.

O `SessionExecution` é a máquina de estados local; `SessionController` encaminha
repetições completas do motor para ela e produz o `SessionCompletion` consumido por
M02. Alertas não navegam para outra área e usam intervalo mínimo explícito para
evitar repetição excessiva. `SessionExecutionFeature` conecta conclusão e
interrupção à persistência, para a câmera e expõe slots/callbacks de mascote e
áudio para a integração da interface.
