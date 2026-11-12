# Design — estabilização M01/M02

## Arquitetura preservada

`AuthProvider` mantém a identidade; `SessionSyncProvider` compõe a API pública;
`SessionSyncService` implementa fila e retry; `SessionSyncStore` usa Keychain em
um namespace por UUID; `SessionService` envia o DTO ao FastAPI.

M07 continua dono de `SessionExecution` e produz o tipo compartilhado
`SessionCompletion`. M02 não interpreta movimento nem altera resultados.

## Fluxo de dados

1. A preparação chama `prepare(owner, workout, revision)`.
2. M02 persiste `SessionDraft` antes da execução.
3. A rota de exercício recupera o rascunho por `clientSessionId` e proprietário.
4. M07 entrega `SessionCompletion`.
5. M02 combina apenas os identificadores imutáveis do rascunho com a conclusão.
6. O sanitizador aceita somente campos do FastAPI e persiste a fila.
7. A composição inicia sincronização em segundo plano; a persistência não espera
   a rede e M07 pode liberar a câmera.
8. Sucesso remove a entrada e registra seu UUID no `SyncReport`; falha preserva
   payload, erro e política de retry.

## Concorrência e troca de identidade

Há um `AbortController` por proprietário e uma única Promise ativa por conta.
Ao desmontar/trocar a identidade, o provider cancela o controlador anterior. A
entrada que estava `syncing` volta a `pending`, sem consumir tentativa. O
provider compara a identidade atual antes de publicar fila ou relatório na UI,
evitando que o término tardio de A atualize a tela de B.

A API continua sendo a autoridade de autorização. O cancelamento local é uma
camada adicional de minimização e isolamento, não substitui o backend.

## Estados públicos

O armazenamento conserva `pending`, `syncing`, `blocked` e `paused`. Um seletor
puro expõe:

- `pending`: ainda não houve falha;
- `syncing`: envio em andamento;
- `retryable_error`: falha transitória ou limite automático atingido;
- `permanent_error`: erro não transitório bloqueado;
- `synced`: UUID confirmado no último relatório.

Ausência de fila e de confirmação retorna `null`, pois não prova que uma sessão
jamais enfileirada foi sincronizada.

## Configuração e segurança

`createAppConfig` continua sendo a fronteira de composição. Builds locais usam
origens do emulador/simulador. `createReleaseAppConfig` adapta a variável de
build `FISIOMOVE_API_ORIGIN`; produção rejeita qualquer esquema diferente de
HTTPS e URLs com credenciais, query ou fragmento. A ausência de uma origem real
permanece fail-closed. A ligação da variável à ferramenta de build pertence à
implantação e não é declarada operacional sem um endpoint real.

Tokens permanecem no Keychain e nunca entram em logs. A fila não armazena mídia,
landmarks ou senha. Logout não elimina resultados pendentes: o namespace impede
que outra conta os leia e o usuário original pode retomá-los.

## Navegação

Os tipos atuais já contêm os identificadores mínimos. A composição não importa
componentes internos de M03–M09 enquanto seus pontos públicos não existirem.
`getDraft(clientSessionId)` permite que a futura tela M07 recupere o restante do
contexto sem duplicar dados nos parâmetros da rota.

## Estratégia de testes

- testes puros para DTO e seletor;
- testes do serviço para recuperação, idempotência, erros e cancelamento;
- integração controlada entre `SessionExecution` público e M02;
- testes de configuração para HTTPS e URLs inválidas;
- regressão completa de M01/M02 e módulos integrados;
- validações físicas e PostgreSQL registradas separadamente quando indisponíveis.
