# Validação — estabilização M01/M02

## Baseline em `d59653c`

| Comando | Resultado |
|---|---|
| `npm run type-check` | aprovado |
| `npm run lint` | aprovado |
| `npm test -- --runInBand` | 11 suites, 34 testes aprovados |
| `npm run format:check` | reprovado em três arquivos de Kaylany |

Arquivos preexistentes fora do padrão:

- `src/features/exercise-engine/calibration.ts`;
- `src/features/exercise-engine/CalibrationStore.ts`;
- `src/features/vision/types.ts`.

## Resultado final

| Comando | Resultado real |
|---|---|
| `npm run type-check` | aprovado |
| `npm run lint` | aprovado |
| `npm test -- --runInBand` | 15 suites, 54 testes aprovados, 0 falhas |
| Prettier somente nos arquivos de Luma | aprovado |
| `npm run format:check` global | reprovado somente nos três arquivos preexistentes de Kaylany listados acima |
| `git diff --check` | aprovado |
| pytest de health/auth/sessions/progress | 39 testes aprovados, 0 falhas |

Os testes adicionados comprovam:

- compatibilidade da saída pública de `SessionExecution` com M02 para sessão
  concluída e interrompida;
- preservação de UUID, treino, revisão e início;
- recuperação de rascunho por proprietário;
- single-flight, cancelamento na troca de identidade e preservação da fila;
- refresh de token durante a sincronização;
- classificação de falhas transitórias e permanentes;
- estado público de sincronização por UUID;
- configuração de produção ausente, HTTPS obrigatório e rejeição de URL com
  credenciais, query ou fragmento.

## Validação HTTP temporária

Uma API isolada foi migrada até a revisão atual e iniciada em
`127.0.0.1:8017`. `GET /health` respondeu `200`. A primeira tentativa de login
retornou corretamente `422` porque o domínio fictício `.test` é reservado e
rejeitado pelo validador de e-mail. A repetição do roteiro com endereço válido
não foi executada: a ferramenta bloqueou uma nova autorização local por limite
de uso. Nenhum token foi exibido.

Os 39 testes FastAPI selecionados validaram, sem essa limitação, health, login,
identidade, refresh, logout, autorização, sessões, histórico e progresso.

## Validações externas

- VoiceOver/TalkBack: não executados; nenhum aparelho/emulador estava conectado.
- Dispositivo Android/iOS: não executado; `adb devices` e simuladores iniciados
  não retornaram dispositivo disponível.
- API HTTPS implantada: URL não fornecida; apenas validação fail-closed e de
  esquema foi executada.
- PostgreSQL: `FISIOMOVE_TEST_POSTGRES_URL` não estava configurada. Docker estava
  ativo, mas sem instância PostgreSQL do projeto; não foi criada infraestrutura
  nova porque o backend não foi alterado nesta tarefa.
