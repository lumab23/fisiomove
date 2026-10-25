# Calibração individual — contrato do MVP

## Decisão arquitetural

A calibração pertence ao motor de exercícios do mobile (M06). O Plano de
Desenvolvimento define o fluxo `regras e calibração local → resumo da sessão →
FastAPI`, e o Relatório de Viabilidade recomenda enviar somente resultados
derivados. Portanto, o backend do MVP não cria tabela ou endpoint de calibração.

Essa decisão reduz coleta de dados, permite execução durante perda de conexão e
evita aceitar referências arbitrárias que poderiam contornar a prescrição.

## Chave e conteúdo local

Quando um exercício clinicamente aprovado exigir calibração, o mobile deve
armazenar em área protegida, no mínimo, uma chave composta por:

- identidade autenticada do paciente;
- `exercise_id`;
- `workout_id`, `workout_revision_id` e `workout_item_id`;
- `rule_version`.

O valor contém somente referências computacionais derivadas previstas pela
implementação aprovada daquela regra. O contrato exato, seus tipos e unidades
dependem da especificação clínica ainda pendente. Não se admite objeto genérico
livre, imagem, vídeo, áudio ou sequência de landmarks.

## Validação no mobile

- invalidar a calibração se usuário, item, revisão ou `rule_version` mudar;
- comparar a referência com o contrato versionado e com os parâmetros do
  snapshot antes de utilizá-la;
- nunca ampliar metas, repetições, amplitude ou limites profissionais;
- recusar ou limitar localmente valores fora da prescrição, com mensagem clara;
- interromper atualização de contagem e pontuação enquanto a sessão estiver em
  pausa;
- separar baixa confiança de captura de desvio de execução.

O backend continua validando autorização, revisão, limites de séries/repetições,
idempotência e pontuação. Ele não prova que a calibração ou o movimento ocorreu
corretamente. Se futuramente vários dispositivos precisarem compartilhar a
referência, será necessária uma decisão explícita de produto, contrato clínico
versionado e nova análise de privacidade antes de adicionar persistência remota.
