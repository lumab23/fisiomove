# Pendências da experiência do paciente

Estado em 05/11/2026, após a navegação em abas (Início, Exercícios, Perfil), o
refinamento visual e a tela de execução imersiva. Atualizado em 06/11/2026 com
as Fases 1 e 2 de `docs/plans/2026-11-06-mvp-login-demo-biblioteca.md` (o app
abre no Login e as abas do paciente leem a API) e com a execução do treino real
(`docs/plans/2026-11-06-execucao-treino-real.md`). Este documento lista o que
ainda está mockado, simulado ou ausente, e o que é preciso para cada item virar
funcionalidade real.

## Resumo

| Área | Situação hoje | O que falta |
| --- | --- | --- |
| Dados do paciente nas abas | API (`/me/workouts`, `/me/sessions`, `/me/progress`) com carregamento, vazio e erro | — (o fisioterapeuta adiciona exercícios ao catálogo pela biblioteca de referência, DEC-006) |
| Iniciar treino | Ativo: "Iniciar"/"Continuar treino" → preparação → câmera → enquadramento → execução com os valores do `WorkoutItem` → conclusão com status de envio | Validar no iPhone com câmera real (KI-006); progresso perdido se o app for encerrado (Q-T2) |
| Nome do paciente | API (`GET /me/profile`) | — |
| Fisioterapeuta | Nome via `GET /me/physiotherapist`; estado vazio sem nome ou sem vínculo | — (só o nome existe; Q-P5) |
| Conversar com o fisioterapeuta | Inexistente | Canal autorizado (WhatsApp ou chat) |
| Câmera ao vivo | Real (vision-camera, frontal) | Validar em Android |
| Pose | Real, no aparelho (YOLO26 via ExecuTorch) | Validar desempenho em aparelhos antigos |
| Contagem de repetições | Manual, por toque, enviada como `completed_repetitions` (DEC-008) | Ligar `MovementEngine` a uma regra aprovada |
| Demonstração do movimento | "Como fazer" com os passos em pt-BR revisados pelo fisioterapeuta, imagens da fonte pela API (DEC-010), orientação profissional e fonte | Animação aprovada pelo profissional; validar imagens no iPhone |
| Idioma dos exercícios da biblioteca | O app exige nome e passos em pt-BR para salvar um treino com exercício da biblioteca; sem tradução, não mostra os passos ingleses ao paciente | Traduzir itens já publicados e republicar os treinos antigos |
| Configurações da conta | Inexistente | Definir escopo (senha, fonte, voz) |
| Comandos de voz | Fora do fluxo (DEC-009); controles manuais | Implementar reconhecimento de voz |

## 1. Telas do paciente ligadas à API (06/11/2026)

O modo demonstração saiu do runtime: `App.tsx` monta `AppProviders` e o app
abre no Login. No fluxo autenticado do paciente, `RootNavigator` monta o stack
do paciente; Início, Exercícios e Perfil leem a API. Os dados vêm dos hooks de `src/integration/usePatientData.ts`
(`usePatientProfile`, `useMyWorkouts`, `useMySessions`, `useMyProgress`), que
devolvem `AsyncState`, `reload` e `refresh` (recarga sem esconder o conteúdo,
usada ao voltar à tela):

- Início: saudação com o primeiro nome de `/me/profile` ("Olá!" enquanto
  carrega ou se falhar), o treino publicado mais recente (`Workout.items`, com
  nome do `exercise_snapshot`, séries, repetições e lado exatamente como
  publicados) e a última sessão (`/me/sessions?page_size=1`).
- Exercícios > Meu treino: todos os treinos publicados, itens, orientação do
  profissional (`instructions` e `professional_guidance`).
- Exercício vindo da biblioteca de referência mostra o nome em pt-BR
  (`exercise_snapshot.localization`, DEC-011) ou, sem tradução, mantém o nome
  original para identificação, sem exibir as instruções inglesas ao paciente;
  usa `accessibilityLanguage="en"`; a primeira
  imagem (pela API, DEC-010) com texto alternativo e legenda de fonte/licença;
  e a atribuição: "Fonte: OpenExerciseBase (CC BY-NC 4.0)" ou, traduzido,
  "Adaptado de … Nome e passos traduzidos para o português por <nome> em
  <data>." (Início e Exercícios).
- Exercícios > Histórico: as 50 sessões mais recentes (`SessionSummary`), com
  filtro local por status. Sessões mais antigas que isso ainda não aparecem
  (sem paginação na tela).
- Exercícios > Progresso: `ProgressSummary` da semana corrente, de segunda
  00:00 a domingo 23:59:59.999 no fuso do aparelho (decisão de apresentação
  Q-P7). Conquistas foram removidas do produto (DEC-007).
- Cada bloco tem `LoadingState`, `ErrorState` (ou `InlineError` com "Tentar
  novamente" em blocos secundários) e estado vazio.

Catálogo: desde a DEC-006, o fisioterapeuta adiciona exercícios ao catálogo a
partir da biblioteca de referência (uso acadêmico), direto do editor de treino.
Enquanto nenhum treino for publicado, `/me/workouts` volta vazio e o app mostra
"Nenhum treino publicado". Nenhum dado fictício substitui esse estado.

Execução do treino (plano `docs/plans/2026-11-06-execucao-treino-real.md`,
06/11/2026): o treino publicado mostra "Iniciar treino" (ou "Continuar treino"
se houver rascunho local da mesma revisão). As rotas ficam no stack do paciente
e carregam só IDs; o treino, o rascunho e o progresso ficam em memória
(`features/session/ActiveSession.tsx`).

- Preparação carrega `GET /workouts/{id}`; revisão diferente ou 404 mostra "Seu
  treino foi atualizado pelo fisioterapeuta" e descarta o rascunho antigo.
- "Confira o enquadramento" (antes "Calibração") mostra a câmera com o lado do
  primeiro item; não há calibração. O rascunho (`prepare`) só é criado em
  "Começar exercício".
- Execução: "Exercício X de Y", nome (pt-BR ou original), lado, "Série X de Y",
  "Repetição N de M", orientação do profissional e atribuição; câmera imersiva
  com status de enquadramento sobre `colors.cameraOverlay`; "Contar repetição"
  (56 pt) só com a série ativa; pausa, "Como fazer" e "Encerrar" sempre
  visíveis; descanso regressivo sem "pular" (Q-P4); sair da tela ou do app
  pausa (RN20); o teto é o prescrito (RN19).
- "Como fazer" pausa a sessão e mostra os passos em pt-BR
  (`localization.instructions`), todas as imagens do snapshot (busca a imagem
  atual do catálogo se o snapshot antigo não tiver imagens), a orientação do
  profissional e a fonte. Sem tradução, orienta o paciente a pedir ao
  fisioterapeuta que revise o texto; a publicação pelo app exige a tradução
  pt-BR. Não há textos corretivos.
- Sair antes da primeira repetição descarta o rascunho (DEC-009); depois,
  envia sessão interrompida. Conclusão e interrupção mostram o resumo por item
  e o status de envio (aguardando, enviando, enviado, erro) com "Tentar enviar
  agora".
- Início, Meu treino, Histórico e Progresso recarregam ao voltar à tela; o
  Histórico mostra sessões da fila local como "Aguardando envio".

O fluxo do fisioterapeuta lê a API desde a Fase 4 (pacientes, acesso e senha
provisória, treinos, observações e acompanhamento). `src/demo/` e `src/flow.ts`
foram removidos; não há dado de demonstração no app.

## 2. Nome do paciente

Resolvido: `GET /me/profile` devolve `{ full_name }` do próprio paciente
(`ProfileService.mine()`, `mobileServices.profile`). A saudação e o Perfil usam
esse nome; o e-mail vem da sessão autenticada.

## 3. Fisioterapeuta (nome do profissional)

Fase 7 (06/11/2026): o perfil do fisioterapeuta guarda somente o nome de
exibição (Q-P5; `docs/contracts/physiotherapist-profile.md`). Não há foto,
registro no CREFITO, especialidade nem telefone.

- Paciente: a seção "Meu fisioterapeuta" do Perfil e a tela
  `PhysiotherapistInfo` usam `useLinkedPhysiotherapist()`
  (`GET /me/physiotherapist`). Com nome, mostram o nome e "Seu
  fisioterapeuta". Com `full_name: null` ou 404 `physiotherapist_not_found`
  (sem vínculo), mantêm o `EmptyState` "Dados do fisioterapeuta". Outras falhas
  mostram `ErrorState` com "Tentar novamente".
- Fisioterapeuta: "Meu perfil" (na aba Configurações) lê `GET /me/physiotherapist-profile` e salva com `PUT`, validando
  2–200 caracteres após remover espaços.
- Continuam sem "Conversar" nem outros dados do profissional. O
  `AccountContext` guarda só o e-mail e a ação de sair.

## 4. Conversar

O botão "Conversar" saiu junto com o modo demonstração; não há chat fictício.
Caminho mais simples depois do item 3: se o profissional cadastrar um número e
autorizar o contato, abrir `https://wa.me/<número>` com `Linking.openURL`. Um
chat próprio exigiria mensagens, notificações e moderação, fora do escopo do MVP.

## 5. Câmera e pose

Integradas pela Kaylany (`LocalPoseCamera.tsx`): câmera frontal ao vivo e
detecção de pose no aparelho, sem enviar imagens ao servidor. A tela de execução
agora usa a câmera em tela ampla (cerca de 3/4 da altura) com o painel de
contagem na parte inferior.

Pendências:

- Validar em Android (o fluxo foi testado só em iOS).
- Medir desempenho em aparelhos mais antigos; o modelo roda em 384 × 384.
- No simulador iOS não há câmera; a tela mostra "Nenhuma câmera frontal
  encontrada".

## 6. Contagem automática de repetições

A execução continua manual para os exercícios publicados comuns. Foi adicionada
uma demonstração local e explicitamente identificada como não validada
clinicamente para flexão e extensão do cotovelo. Quando o treino contém o item
marcado exatamente como `demo-elbow-flexion` na versão
`demo-elbow-flexion:v1`, os landmarks da `LocalPoseCamera` alimentam o
`MovementEngine` e um ciclo reconhecido atualiza a repetição da sessão. O botão
manual não aparece nesse item para evitar contagem duplicada. A câmera e a
inferência permanecem locais; a sessão continua usando a fila de sincronização
existente.

As faixas de ângulo e tempo dessa demonstração são sintéticas e servem somente
para verificar a ligação técnica entre câmera, motor e sessão. Não são
parâmetros clínicos, não foram validadas por fisioterapeuta e não devem ser
usadas como prescrição. A tela de demonstração para desenvolvimento também
permite experimentar a contagem sem criar uma sessão.

## 7. Demonstração do movimento

"Como fazer" (aberto pela tela de execução) mostra só textos de origem
conhecida: os passos do snapshot do exercício, a orientação do profissional e a
fonte. Não existe animação nem vídeo no projeto, e uma animação inventada
poderia ensinar o movimento errado.

Imagens (DEC-010, 06/11/2026): itens da biblioteca trazem `images` no
snapshot; o app carrega cada uma de `/api/v1/exercises/{id}/images/{n}` com o
header `Authorization` (`Image` do RN, sem dependência nova), nunca do GitHub.
Texto alternativo "Imagem n de N do exercício <nome>" e legenda "Imagem:
OpenExerciseBase (CC BY-NC 4.0); parte do material da fonte pode ter sido
gerada por IA". Se a imagem falhar, a sessão é renovada uma vez e a imagem é
pedida de novo; depois aparece "Não foi possível carregar a imagem …". Início,
Exercícios, revisão e editor mostram a primeira; "Como fazer", todas. Não
verificado em aparelho (KI-006): carregamento com header e cache no iOS/Android.

Proposta: para cada exercício aprovado, o profissional valida um asset curto
(vídeo MP4 em loop ou animação Lottie) ligado à versão do exercício
(`rule_version`). O mobile exibe o asset no mesmo espaço. Lottie exigiria a
dependência `lottie-react-native`; vídeo exigiria `react-native-video`.

## 8. Configurações da conta

Não há tela de configurações. A troca de senha existe apenas no primeiro login
obrigatório. Itens candidatos: trocar senha, tamanho de fonte do app, ativar voz.
Nada foi exibido no Perfil para não mostrar funções inexistentes.

## 9. Comandos de voz

Fora do fluxo desde a DEC-009: a preparação não oferece mais comandos de voz e
não há tela de permissão de microfone. Pausar, continuar e encerrar são manuais
e sempre visíveis (RN21). Implementar exige reconhecimento de fala no aparelho e
permissão de microfone.

## 10. Itens técnicos

- `react-native-svg` e as bibliotecas de câmera exigem recompilar o app nativo
  sempre que forem atualizadas; sem isso, os ícones aparecem como caixas rosa
  ("Unimplemented component").
- O Jest transforma `@react-navigation`, `@sbaiahmed1` e usa o build CommonJS do
  `lucide-react-native` (`jest.config.js`).
- Os testes da execução ficam em `__tests__/ExecutionScreens.test.tsx` e
  montam o `FrontendNavigator` real com a sincronização simulada.
