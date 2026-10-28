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

O `SessionExecution` é a máquina de estados local; `SessionController` encaminha
repetições completas do motor para ela e produz o `SessionCompletion` consumido por
M02. Alertas não navegam para outra área e usam intervalo mínimo explícito para
evitar repetição excessiva. `SessionExecutionFeature` conecta conclusão e
interrupção à persistência, para a câmera e expõe slots/callbacks de mascote e
áudio para a integração da interface.
