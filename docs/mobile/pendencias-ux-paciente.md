# Pendências da experiência do paciente

Estado em 05/11/2026, após a navegação em abas (Início, Exercícios, Perfil), o
refinamento visual e a tela de execução imersiva. Este documento lista o que
ainda está mockado, simulado ou ausente, e o que é preciso para cada item virar
funcionalidade real.

## Resumo

| Área | Situação hoje | O que falta |
| --- | --- | --- |
| Dados do paciente nas telas | Dados de demonstração (`src/demo/`) | Ligar telas à API |
| Nome do paciente | Fixo na demo | Endpoint de perfil do paciente |
| Fisioterapeuta | Mockado (`demoPhysiotherapist`) | Perfil profissional no backend |
| Conversar com o fisioterapeuta | Aviso de indisponível | Canal autorizado (WhatsApp ou chat) |
| Câmera ao vivo | Real (vision-camera, frontal) | Validar em Android |
| Pose | Real, no aparelho (YOLO26 via ExecuTorch) | Validar desempenho em aparelhos antigos |
| Contagem de repetições | Manual, por toque | Ligar `MovementEngine` a uma regra aprovada |
| Demonstração do movimento | Figura estática | Animação aprovada pelo profissional |
| Configurações da conta | Inexistente | Definir escopo (senha, fonte, voz) |
| Comandos de voz | Simulados, microfone inativo | Implementar reconhecimento de voz |

## 1. Telas do paciente ainda usam dados de demonstração

Início, Exercícios e Perfil leem `DemoContext`. Os serviços e endpoints já
existem (`/me/workouts`, `/me/sessions`, `/me/progress`, `/me/achievements`),
mas nenhuma tela os chama.

Para ligar:

- Trocar `useDemoPatient`/`useDemo` por hooks de dados com estados de
  carregamento, erro e vazio (os componentes `EmptyState` já existem).
- Mapear `Workout.items` para a lista de "Exercícios prescritos" e o card do
  Início.
- Usar `SessionSummary` no Histórico e `ProgressSummary` no Progresso; os
  indicadores atuais já seguem os mesmos campos (`completed_sessions`,
  `interrupted_sessions`, `performed_repetitions`).
- Bloqueio clínico: o catálogo de produção está vazio até o fisioterapeuta
  aprovar o primeiro exercício (`docs/contracts/clinical-catalog.md`). Sem isso,
  `/me/workouts` volta vazio e o app mostra o estado "Nenhum treino publicado".

## 2. Nome do paciente

`GET /auth/me` devolve só `email`, `role` e flags. A saudação "Olá, Maria!" vem
da demo. Proposta: incluir `full_name` em uma rota `GET /me/profile` a partir do
registro em `patients`, sem expor dados de outros pacientes.

## 3. Fisioterapeuta (mockado)

O Perfil mostra "Dra. Ana Ribeiro" com o selo **Dados de exemplo**. O backend
guarda apenas o vínculo (`physiotherapist_id`) e o usuário profissional tem só
email e senha: não há nome, foto, registro no CREFITO, especialidade ou telefone.

Proposta:

1. Tabela `physiotherapist_profiles` (nome, CREFITO, especialidade, foto
   opcional, telefone de contato opcional com consentimento explícito do
   profissional), editável apenas pelo próprio profissional.
2. Rota `GET /me/physiotherapist` para o paciente, que resolve o vínculo ativo
   no servidor e devolve somente esses campos.
3. Trocar `demoPhysiotherapist` pelos dados da rota; manter o card e a tela
   "Informações" como estão.

## 4. Conversar

O botão "Conversar" abre um aviso de indisponibilidade; não há chat fictício.
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

Hoje o paciente toca em "Contar repetição" a cada repetição. O texto da tela
deixa isso claro e o progresso só avança com o toque. O motor de movimento
(`MovementEngine`) e a execução da sessão (`SessionExecution`) já existem e
estão testados, mas exigem uma regra de movimento aprovada (ângulos, tolerâncias,
fases), que não pode ser inventada.

Para ligar: o fisioterapeuta define e aprova a regra do primeiro exercício; a
tela passa `onObservation` do `LocalPoseCamera` para o `MovementEngine`, que
substitui o botão manual (o botão pode ficar como alternativa acessível).

## 7. Demonstração do movimento

O espaço "Como fazer" no topo da tela de execução mostra uma figura estática.
Não existe animação nem vídeo no projeto, e uma animação inventada poderia
ensinar o movimento errado.

Proposta: para cada exercício aprovado, o profissional valida um asset curto
(vídeo MP4 em loop ou animação Lottie) ligado à versão do exercício
(`rule_version`). O mobile exibe o asset no mesmo espaço. Lottie exigiria a
dependência `lottie-react-native`; vídeo exigiria `react-native-video`.

## 8. Configurações da conta

Não há tela de configurações. A troca de senha existe apenas no primeiro login
obrigatório. Itens candidatos: trocar senha, tamanho de fonte do app, ativar voz.
Nada foi exibido no Perfil para não mostrar funções inexistentes.

## 9. Comandos de voz

A preparação oferece "Usar comandos", mas o microfone não é ativado. O texto da
tela informa isso. Implementar exige reconhecimento de fala no aparelho e
permissão de microfone.

## 10. Itens técnicos

- `react-native-svg` e as bibliotecas de câmera exigem recompilar o app nativo
  sempre que forem atualizadas; sem isso, os ícones aparecem como caixas rosa
  ("Unimplemented component").
- O Jest transforma `@react-navigation`, `@sbaiahmed1` e usa o build CommonJS do
  `lucide-react-native` (`jest.config.js`).
- `FrontendScreens.test.tsx` recebeu o mock de `useIsFocused`, usado pela nova
  versão de `Screen`.
