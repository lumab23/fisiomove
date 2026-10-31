# Mobile FisioMove

Aplicação React Native CLI com TypeScript estrito. M01 e M02 fornecem acesso,
navegação, cliente HTTP, contratos da API e sincronização offline. M05–M08
acrescentam módulos locais de pose, motor de movimento, execução de sessão e
documentação técnica; a integração nativa e a validação em aparelhos continuam
pendentes.

## Estrutura

```text
src/
├── api/          # cliente HTTP, query strings e erros uniformes
├── app/          # composição e dependências compartilhadas
├── auth/         # sessão, autenticação e validações
├── components/   # componentes acessíveis das telas de acesso
├── config/       # URL, prefixo e timeout por ambiente
├── contracts/    # DTOs alinhados ao FastAPI
├── integration/  # API pública para os módulos da equipe
├── features/
│   ├── vision/          # contrato do adaptador, landmarks e ciclo de vida
│   ├── exercise-engine/ # geometria, regras aprovadas e calibração local
│   └── session/         # execução, feedback e componente de sessão
├── navigation/   # stacks e parâmetros tipados
├── screens/      # telas M01 e destinos técnicos temporários
├── services/     # exercícios, treinos, pacientes, notas e resultados
├── storage/      # armazenamento criptografado
├── sync/         # preparação, fila e reenvio de sessões
└── theme/        # cores e espaçamentos do protótipo
```

## Preparação

Requisitos: Node.js 22.11 ou superior, npm, ambiente React Native e, conforme a
plataforma, Android Studio/SDK ou Xcode/CocoaPods.

```bash
npm install
```

No macOS, depois de instalar ou atualizar dependências nativas:

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

Inicie o backend e depois o Metro:

```bash
npm start
```

Em outro terminal:

```bash
npm run android
# ou
npm run ios
```

## Conexão com a API

A configuração fica em `src/config/environment.ts` e usa `/api/v1`:

- Android Emulator: `http://10.0.2.2:8000`;
- iOS Simulator: `http://127.0.0.1:8000`;
- dispositivo físico: substitua a origem de desenvolvimento pelo IP da máquina
  na mesma rede, por exemplo `http://192.168.1.20:8000`;
- produção/homologação: a composição do build deve fornecer
  `FISIOMOVE_API_ORIGIN` ao adaptador `createReleaseAppConfig`. Nenhum domínio é
  inventado ou versionado neste repositório. O app falha explicitamente se a
  origem não estiver definida ou não usar HTTPS.

Não use `localhost` em um dispositivo físico: ele aponta para o próprio celular.
A URL não deve conter `/api/v1`, porque o cliente acrescenta o prefixo.
Origens com credenciais, query string ou fragmento são rejeitadas para evitar
que tokens ou configuração sensível sejam incorporados à URL. A implantação
precisa ligar sua ferramenta de build à variável `FISIOMOVE_API_ORIGIN` antes do
release; até isso ocorrer, o comportamento de produção permanece
deliberadamente fail-closed. A variável é configuração pública de endpoint, não
um local para credenciais ou tokens.

## Autenticação

`AuthProvider` restaura a sessão antes de renderizar conteúdo protegido. Tokens
são guardados pelo `react-native-keychain` no Keychain do iOS ou Keystore do
Android; senhas nunca são persistidas. O cliente:

- envia o Bearer token automaticamente;
- realiza uma única rotação de refresh para requisições concorrentes;
- repete a requisição original somente uma vez;
- limpa tokens expirados, revogados ou de conta desativada;
- mantém usuário com senha temporária exclusivamente na tela de troca;
- seleciona o stack usando o `role` devolvido por `/auth/me`.

As únicas telas definitivas desta entrega são login, carregamento/restauração e
troca de senha temporária. Os destinos autenticados mostram explicitamente que
o conteúdo será implementado por Amanda ou Kaylany.

## Serviços para Amanda

Use a API pública, sem criar outro cliente HTTP:

```ts
import { mobileServices, useAuth } from './src/integration';

const { user } = useAuth();
const workouts = await mobileServices.workouts.listMine();
const patients = await mobileServices.patients.list({ page: 1, page_size: 20 });
```

Estão disponíveis serviços tipados para catálogo, treinos, pacientes, acesso
temporário, observações, histórico, detalhes de sessão, progresso e conquistas.
Listas vazias preservam `items: []` e os metadados de paginação. Use
`resolvedState` e `failureState` para distinguir carregando, sucesso, vazio,
offline, sessão expirada, acesso negado, validação, conflito e erro inesperado.

Os parâmetros de navegação estão em `src/navigation/types.ts`. Substitua cada
destino técnico pelo componente real mantendo o nome e o contrato da rota.

## Contratos para Kaylany

Antes de iniciar a execução, preserve os identificadores recebidos do treino:

```ts
const sync = useSessionSync();
const draft = await sync.prepare(workout.id, workout.current_revision_id);
```

A futura tela de execução recebe `clientSessionId` pela navegação e recupera o
rascunho protegido sem duplicar os demais dados na rota:

```ts
const draft = await sync.getDraft(route.params.clientSessionId);
if (!draft) {
  // Tratar sessão local ausente; não gerar outro UUID silenciosamente.
}
```

Ao concluir ou interromper, entregue somente resultados derivados:

```ts
await sync.finishDraft(draft.client_session_id, {
  status: 'interrupted',
  finished_at: new Date().toISOString(),
  active_duration_ms: 42000,
  low_confidence_summary: null,
  feedback_summary: null,
  items: [],
});
await sync.syncNow();
```

Não envie pontuação, imagens, vídeo, áudio, landmarks ou calibração. O backend
calcula a pontuação e valida o resultado contra o snapshot histórico da revisão.

## Sincronização offline

Rascunhos e resultados pendentes são criptografados e separados pelo UUID da
conta. A fila conserva `client_session_id`, revisão e `started_at` após o app ser
encerrado. Logout remove tokens, mas não destrói resultados pendentes: outra
conta não consegue lê-los nem enviá-los, e a conta original retoma a fila ao
entrar novamente.

O hook também expõe `pending`, `syncing` e `loadError`, permitindo que a tela
mostre falha de leitura local sem descartar ou ocultar os resultados salvos.

Falhas de rede e servidor usam backoff exponencial, limitado a oito tentativas
automáticas. `401` aguarda nova autenticação. `404`, `409`, `422` e demais erros
permanentes ficam como `blocked`, com código original preservado; nunca são
marcados como sincronizados nem reenviados indefinidamente. `retryNow` exige uma
ação explícita para tentar novamente um item bloqueado ou pausado.

Ao finalizar um rascunho, o resultado é salvo antes da rede e uma tentativa de
sincronização é iniciada em segundo plano. A troca de conta cancela a requisição
da identidade anterior; cancelamento não consome retry nem transforma a
pendência em erro permanente. Dois gatilhos simultâneos para a mesma conta
compartilham a mesma execução.

Para apresentar o estado sem depender dos detalhes internos, use
`selectSessionSyncStatus(clientSessionId, pendingItem, lastReport)`. O seletor
retorna `pending`, `syncing`, `synced`, `retryable_error` ou `permanent_error`;
retorna `null` quando não existe fila nem confirmação de envio para aquele UUID.
`synced` só é produzido quando o último `SyncReport` confirma o identificador.

## Execução de exercício (M05–M08)

`features/vision` recebe somente resultados derivados do adaptador nativo e
avalia os landmarks do ombro, cotovelo e punho do lado selecionado. O hook
solicita permissão, interrompe a captura em segundo plano e retoma quando o app
volta ao primeiro plano. O bridge `FisioMovePose` é uma interface de integração;
até a implementação nativa ser entregue, o hook informa que a câmera está
indisponível. Não há envio de frames ou landmarks ao backend.

`features/exercise-engine` mede ângulos, aplica uma janela de suavização
informada pelo integrador e conta somente ciclos completos dentro da regra
recebida. A regra e seus limites precisam chegar aprovados e com a mesma versão;
o módulo não fornece valores clínicos padrão. A calibração é local, criptografada
e vinculada ao usuário, exercício, treino, revisão, item e versão da regra.

`features/session` controla séries, descanso, pausa, retomada e interrupção. A
duração ativa exclui pausas e descansos. `useSessionResult` entrega o resumo a
`useSessionSync().finishDraft` e encerra a câmera, sem criar uma fila de
persistência paralela. `SessionExecutionFeature` conecta esse fluxo ao painel,
expõe um slot para o mascote e encaminha avisos com intervalo configurável para
um callback de áudio. A navegação compartilhada ainda precisa fornecer os dados
da sessão e conectar essa composição.

O plano de integração do adaptador nativo e o protocolo de validação estão em
`docs/validation/pose-poc.md`; o relatório M08 em
`docs/validation/technical-report.md` permanece sem medições até existir acesso
a aparelhos e à integração M02/M05–M07. O contrato de resultado está em
`docs/contracts/session-result.md`.

## Endpoints integrados

- autenticação: login, refresh, logout, identidade e troca de senha;
- exercícios: lista e detalhe;
- treinos: lista própria, lista profissional, detalhe, criação, edição,
  publicação e arquivamento;
- pacientes: lista, detalhe, criação, edição e acesso temporário;
- observações: lista, criação e edição;
- sessões: envio idempotente, histórico próprio/profissional e detalhe;
- progresso e conquistas: consultas próprias e por paciente autorizado.

## Qualidade

```bash
npm run format:check
npm run type-check
npm run lint
npm test -- --runInBand
```

Os testes cobrem autenticação válida e inválida, persistência, refresh
single-flight, revogação, logout, troca de senha, seleção de perfil, lista vazia,
falha de rede, reinicialização com fila pendente, retry idempotente, conflito e
isolamento entre contas.

## Limites atuais

- a implementação nativa de câmera/pose, permissões de plataforma e preview
  ainda precisa ser integrada pela responsável pelos arquivos compartilhados;
- a execução e o motor estão disponíveis como módulos, mas dependem de
  composição com a navegação compartilhada e de uma regra aprovada para o
  exercício selecionado;
- validação empírica M05/M08 não foi realizada: protocolo e relatório identificam
  explicitamente os campos ainda pendentes;
- o catálogo real continuará vazio até existir exercício clinicamente aprovado;
- a calibração deve permanecer local e seguir `docs/modules/calibration.md`.

## Front-end navegável baseado no PDF

A demonstração visual abre sem backend e cobre os fluxos do paciente e do
fisioterapeuta. Consulte `../docs/mobile/pdf-screen-audit.md` para a auditoria e
`../docs/mobile/frontend-guide.md` para executar e testar. O login integrado
continua disponível pela opção de acesso à conta na demonstração.
