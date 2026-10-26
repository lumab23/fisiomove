# Mobile FisioMove

Aplicação React Native CLI com TypeScript estrito. M01 e M02 fornecem acesso,
navegação, cliente HTTP, contratos da API e sincronização offline. Câmera,
estimativa de pose, regras de movimento e as telas de negócio não fazem parte
desta entrega.

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
- produção: configure `productionApiOrigin` com HTTPS antes do build. O app
  falha explicitamente se uma origem de produção não estiver definida.

Não use `localhost` em um dispositivo físico: ele aponta para o próprio celular.
A URL não deve conter `/api/v1`, porque o cliente acrescenta o prefixo.

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

- telas de paciente, profissional, preparação, execução, conclusão e progresso
  continuam sob responsabilidade de Amanda e Kaylany;
- nenhuma captura de câmera, visão computacional, voz ou regra clínica foi
  implementada;
- o catálogo real continuará vazio até existir exercício clinicamente aprovado;
- a calibração deve permanecer local e seguir `docs/modules/calibration.md`.
