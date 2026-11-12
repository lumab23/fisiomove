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
├── screens/      # autenticação, paciente e fisioterapeuta
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
- dispositivo físico: configure `FISIOMOVE_DEV_API_ORIGIN` em `mobile/.env`
  com o IP do Mac, por exemplo `http://192.168.1.20:8000` (passo a passo abaixo);
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

O app abre no Login; não há modo demonstração nem cadastro público. Depois da
autenticação, o `role` define o fluxo:

- paciente: abas Início, Exercícios e Perfil, lidas de `/me/*`;
- fisioterapeuta: três abas fixas — Pacientes (listagem sem contador, contato,
  edição cadastral, liberação de acesso e nova senha provisória), Acompanhamento
  (a mesma listagem, com detalhes exclusivos de treinos e observações; sessões e
  progresso acessíveis dentro de Treinos) e
  Configurações ("Meu perfil", "Biblioteca de referência" e "Sair da conta",
  com alerta nativo antes de sair).

A senha provisória aparece uma única vez, na ficha do paciente, com o aviso de
entregá-la por canal seguro. Ela fica só na memória da tela, é descartada ao
sair dela e nunca vai para parâmetros de rota, logs ou armazenamento. Se o
paciente esquecer a senha, o fisioterapeuta gera uma nova senha provisória
(`reset_temporary_password`).

O editor de treino começa vazio. "Adicionar exercício" abre a pesquisa do catálogo
clínico (`GET /exercises`), em português ou inglês, incluindo todas as páginas.
Selecionar um item apenas o adiciona ao treino em edição: não cria catálogo nem
salva a prescrição. Cada exercício aparece em um card com lateralidade permitida,
séries, repetições, descanso e orientação opcional. Os controles +/− ajustam as
séries; também é possível digitar a quantidade. Valores e lado começam vazios.
As instruções e imagens completas ficam em "Ver orientações do exercício".

O contrato clínico atual tem uma quantidade de séries com repetições e descanso
uniformes por exercício; não aceita duração nem valores distintos por série.
Esses parâmetros não são inventados no editor. "Adicionar outro exercício",
"Trocar exercício" e a remoção de cards preservam os demais dados. "Criar treino"
fica ao final do conteúdo, sem rodapé fixo, e salva o rascunho completo. Editar
usa "Salvar rascunho". Revisão, publicação e validações permanecem separadas.

Se faltar um exercício, o seletor oferece "Buscar na biblioteca de referência".
No detalhe externo, o fisioterapeuta escolhe os lados permitidos (nenhum vem
marcado) e toca "Adicionar e usar neste treino"
(`POST /exercise-library/{external_id}/catalog`, DEC-006). Essa ação importa
explicitamente para o catálogo e volta ao mesmo editor com `popTo(...,
{ merge: true })`, sem perder a prescrição já digitada nos outros cards ou as
orientações gerais. Tradução em português continua obrigatória para exercícios
da fonte externa antes de salvar; importação não publica o treino.
Itens da biblioteca mantêm a atribuição da fonte no editor, na revisão e no app
do paciente (`exercise_snapshot.source`).

Imagens e português (DEC-010, DEC-011): itens do catálogo trazem `images`
(URLs relativas da API) e `localization` (pt-BR). `ExerciseImageGallery`
(`src/components`) monta a URL com `ApiClient.imageSource` (só aceita caminhos
sob `/api/v1`, para o token não ir a outro host) e renova a sessão uma vez se a
imagem falhar. A busca e o detalhe da biblioteca continuam com as URLs do
provedor. Ao adicionar ao catálogo, o fisioterapeuta pode preencher "Nome em
português" e "Passos em português" (um passo por linha; ambos ou nenhum). A
tela `CatalogExerciseTranslation` (aberta pelo editor, pela revisão ou pelo
detalhe da biblioteca de um item já no catálogo) mostra o original em inglês e
grava `PUT /exercises/{id}/localization`. O paciente vê pt-BR quando existe;
senão o original com "Texto original em inglês" e `accessibilityLanguage="en"`.
Para o snapshot receber a tradução e as imagens, o treino precisa ser salvo de
novo (o editor reenvia os itens) e publicado.

## Serviços para Amanda

Use a API pública, sem criar outro cliente HTTP:

```ts
import { mobileServices, useAuth } from './src/integration';

const { user } = useAuth();
const workouts = await mobileServices.workouts.listMine();
const patients = await mobileServices.patients.list({ page: 1, page_size: 20 });
```

Estão disponíveis serviços tipados para catálogo, treinos, pacientes, acesso
temporário, observações, histórico, detalhes de sessão, progresso e biblioteca
de referência (busca, detalhe e `addToCatalog`).
Listas vazias preservam `items: []` e os metadados de paginação. Use
`resolvedState` e `failureState` para distinguir carregando, sucesso, vazio,
offline, sessão expirada, acesso negado, validação, conflito e erro inesperado.

As telas leem a API pelos hooks de `src/integration` (`usePatientData.ts` e
`useProfessionalData.ts`), que já devolvem `AsyncState`. Os parâmetros de
navegação estão em `src/navigation/types.ts` e `frontendTypes.ts` e levam
apenas IDs.

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
- observações: lista, criação, edição e exclusão pelo autor vinculado ao paciente;
- sessões: envio idempotente, histórico próprio/profissional e detalhe;
- progresso: consultas próprias e por paciente autorizado;
- biblioteca de referência: busca, detalhe e adição ao catálogo com pt-BR
  opcional (fisioterapeuta);
- exercícios do catálogo: imagens autenticadas e tradução pt-BR
  (`PUT /exercises/{id}/localization`).

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
- o catálogo só recebe exercícios adicionados da biblioteca pelo fisioterapeuta
  (uso acadêmico, DEC-006); eles não têm regra de câmera (`supported_parameters`
  vazio) e não alimentam o `MovementEngine`;
- a calibração deve permanecer local e seguir `docs/modules/calibration.md`.

## Telas e dados

Não existe mais modo demonstração: sem backend, o app mostra o Login e, depois
dele, estados de erro com opção de tentar novamente. Dado sem fonte real aparece
como estado vazio, nunca como exemplo fictício (DEC-001). Para apresentar com
dados, use o backend local com o seed fictício descrito em `../backend/README.md`
(que depende de um exercício aprovado em ambiente não produtivo). A execução do
treino usa o treino publicado real: valores do `WorkoutItem`, contagem por toque
(DEC-008), resultado enviado por `finishDraft` e status de envio na conclusão.
Captura real no aparelho ainda não está validada (KI-006). Pendências do paciente:
`../docs/mobile/pendencias-ux-paciente.md`.

## Origem HTTPS de release

Configure `FISIOMOVE_API_ORIGIN` em `mobile/.env` ou no ambiente do build. Use apenas
`https://host[:porta]`, sem `/api/v1`; nenhuma chave privada pertence ao bundle.
Reinicie Metro com `npm start -- --reset-cache` e reconstrua o aplicativo. Consulte o
[guia de configuração e validação](../docs/validation/backend-production-hardening.md).

## Rodar no iPhone físico

1. Conecte Mac e iPhone à mesma rede Wi-Fi. Descubra o IP do Mac:

   ```bash
   ipconfig getifaddr en0
   ```

   Se não retornar endereço, consulte Ajustes do Sistema > Wi-Fi > Detalhes >
   TCP/IP; a interface ativa pode ser outra. O IP pode mudar ao reconectar.

2. Em `backend/`, com o ambiente virtual ativado, PostgreSQL configurado e
   migrações aplicadas, inicie:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0
   ```

   No Safari do iPhone, abra `http://IP_DO_MAC:8000/health`. Se não responder,
   confira firewall do Mac, VPN e isolamento de dispositivos no roteador.
   `0.0.0.0` é o endereço de escuta; use o IP real na URL do celular.

3. Crie ou edite `mobile/.env`, preservando configurações existentes:

   ```dotenv
   FISIOMOVE_DEV_API_ORIGIN=http://192.168.1.20:8000
   ```

   Substitua pelo IP do Mac, sem `/api/v1`. A variável pública vale somente em
   desenvolvimento e passa pela validação de URL existente. Sem ela, continuam
   os padrões do simulador iOS (`127.0.0.1`) e emulador Android (`10.0.2.2`).
   O ambiente do processo tem precedência sobre `.env`. Release usa exclusivamente
   `FISIOMOVE_API_ORIGIN` e exige HTTPS. Nunca coloque segredos nesses valores.

4. Abra `mobile/ios/FisioMove.xcworkspace` no Xcode. Conecte o iPhone inicialmente
   por USB, desbloqueie e confirme **Confiar neste computador**. Em Settings >
   Accounts do Xcode, adicione seu Apple ID. No target FisioMove > **Signing &
   Capabilities**, habilite assinatura automática, escolha **Team = seu Apple ID
   pessoal (Personal Team)** e configure manualmente um **bundle id único**.
   Selecione o iPhone como destino e a configuração **Debug**. Este ajuste não
   modifica Team nem bundle id; faça a assinatura manualmente no Xcode.

5. No iPhone, ative **Ajustes > Privacidade e Segurança > Modo de Desenvolvedor**,
   reinicie e confirme quando solicitado. Se aparecer desenvolvedor não confiável,
   acesse **Ajustes > Geral > VPN e Gerenciamento de Dispositivos**, selecione o
   perfil do seu Apple ID e toque em **Confiar**. O perfil aparece após instalar
   o app assinado. Para dispensar o cabo depois do pareamento, habilite **Connect
   via network** no Xcode > Window > Devices and Simulators, quando disponível.

6. Em `mobile/`, reinicie Metro após alterar `.env` e deixe o terminal aberto:

   ```bash
   npm start -- --reset-cache
   ```

   Em outro terminal, também em `mobile/`:

   ```bash
   npm run ios -- --device
   # Se houver mais de um aparelho:
   npm run ios -- --device "Nome do iPhone"
   ```

   Permita acesso à **Rede Local** quando solicitado. Se negado, habilite em
   Ajustes > Privacidade e Segurança > Rede Local > FisioMove. API (porta 8000)
   e Metro (porta 8081) precisam estar acessíveis no Mac. Mantenha Metro aberto
   durante o debug e reconstrua o app para aplicar mudanças nativas de plist.

Debug usa `ios/FisioMove/Info-Debug.plist`, com descrição de uso em português e
`NSAllowsLocalNetworking=true`. Release usa `Info.plist`, com essa exceção
desabilitada; ambos mantêm `NSAllowsArbitraryLoads=false`. Ao adicionar chaves
compartilhadas, mantenha os dois plists alinhados. Consulte a
[documentação de ATS da Apple](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking).
O app abre no Login e usa a API configurada acima. Imagens da câmera permanecem
no aparelho.

## Confirmações e feedback

Confirmações usam `useNativeConfirmation`, com `Alert.alert` do React Native,
sem modais personalizados. Os botões são Cancelar e Confirmar, com estilo
`destructive` nas ações destrutivas. Isso inclui saída da conta (aluno, professor
e troca de senha provisória), exclusão de paciente, redefinição de senha,
arquivamento de treino e encerramento de sessão. As ações só são chamadas após
confirmar, com proteção contra cliques repetidos; falhas mantêm o feedback atual.

`ScreenMessageProvider` mantém um único toast global, inclusive nas telas de
acesso e após mudanças de navegação. Use `show(texto, tom)`, com `success`,
`error`, `warning` ou `info`. Uma nova mensagem substitui a anterior. O componente
reserva espaço acima da área inferior segura, sem cobrir botões, e acompanha o
teclado. Sucessos permanecem por pelo menos 4,5 segundos; erros, 8 segundos;
textos longos recebem mais tempo. Com leitor de tela ativo, o fechamento é
manual. As animações respeitam Reduzir Movimento.

Erros de formulário continuam visíveis junto aos campos, além do feedback global.
As ações de cadastro, edição, publicação, arquivamento e autenticação compartilham
o mesmo componente; não há fluxo de exclusão definitiva nas telas atuais.

### Treinos arquivados

A revisão mantém os ícones Editar, Desarquivar e Apagar nos treinos arquivados.
Desarquivar cria uma revisão em rascunho, preserva os dados anteriores e exige
publicação explícita. Abrir a edição não muda o status; salvar as alterações
cria o rascunho. A exclusão aceita rascunhos e arquivados sem sessões registradas;
o histórico do paciente permanece protegido. Todas as ações exigem o mesmo
vínculo profissional ativo já validado pelo backend.
