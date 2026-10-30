# M08 — validação técnica e estabilização

Este documento é um protocolo em aberto. Não preencher resultados antes de executar
o build integrado em aparelhos reais.

## Ambiente e método

| Campo                                | Registro |
| ------------------------------------ | -------- |
| Versão do aplicativo / commit        | Pendente |
| Aparelho e modelo                    | Pendente |
| Sistema e versão                     | Pendente |
| Versão do modelo/runtime de pose     | Pendente |
| Exercício e versão de regra aprovada | Pendente |
| Protocolo e referência manual        | Pendente |
| Quantidade de ciclos observados      | Pendente |

## Medidas

| Medida                   | Como registrar                                                                | Resultado |
| ------------------------ | ----------------------------------------------------------------------------- | --------- |
| Contagem                 | Comparar ciclos completos do motor com a referência manual                    | Pendente  |
| Latência de inferência   | Registrar `inference_duration_ms` por resultado; informar mediana e dispersão | Pendente  |
| Frequência de inferência | Calcular pelos timestamps recebidos em janela identificada                    | Pendente  |
| Estabilidade             | Registrar duração, frames perdidos e falhas da câmera                         | Pendente  |
| Alertas falsos           | Contar alertas por captura/execução usando protocolo controlado               | Pendente  |
| Interrupção              | Confirmar encerramento de câmera e preservação do resumo parcial              | Pendente  |
| Segundo plano            | Confirmar pausa/release e comportamento ao retornar                           | Pendente  |
| Iluminação/enquadramento | Descrever condições e perdas de pontos observadas                             | Pendente  |
| Ruído de landmarks       | Registrar pontos ausentes/baixa confiança sem atribuir desvio clínico         | Pendente  |

Testar Android e iOS quando ambos fizerem parte da entrega. Se um sistema não for
testado, registrar explicitamente. Não fabricar métricas nem declarar validação
clínica a partir de sequência sintética.

## Achados e responsáveis

| Achado reproduzível                 | Impacto técnico | Responsável               | Estado |
| ----------------------------------- | --------------- | ------------------------- | ------ |
| Pendente de execução em dispositivo | Pendente        | Kaylany / integração Luma | Aberto |
