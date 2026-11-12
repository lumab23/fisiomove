# Auditoria visual anterior à implementação

Referência: `Group 1.pdf`, recebido em 30/10/2026: uma página panorâmica de
14790 × 844 pontos, contendo 31 telas de 390 × 844, separadas por 90 pontos.
Análise realizada após pull de `develop`, commit `9543ec5`.

O remoto oferecia autenticação implementada e 11 destinos de negócio como
placeholders em `src/screens/dev/DevelopmentDestinationScreen.tsx`. O trabalho
local anterior continha uma demonstração do paciente em um único `App.tsx`,
sem React Navigation, preservada no stash
`codex-preserve-local-before-frontend-pdf-2026-10-30`. Nenhuma tela profissional
final estava implementada. Os serviços e o motor técnico não constituem telas.

| PDF, da esquerda para a direita                                             | Lacuna encontrada                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 01 Início; 02 Meu treino                                                    | Placeholders remotos; versões locais a modularizar              |
| 03 Preparação; 31 preparação com voz                                        | Somente demonstração local; estado de voz a integrar            |
| 04 Câmera; 05 recusa; 06 microfone; 07 calibração                           | Sem telas/rotas modulares; versões locais parciais              |
| 08 Série 1; 10 Série 2                                                      | Destino remoto placeholder; motor técnico sem composição do PDF |
| 09 Descanso; 11 Pausa                                                       | Somente demonstração local; layout e navegação a adequar        |
| 12 Ajuste de câmera                                                         | Versão local diferente; feedback do PDF ausente                 |
| 13 Orientação de movimento                                                  | Tela ausente                                                    |
| 14 Confirmar saída; 15 Interrompido                                         | Somente demonstração local; layout a adequar                    |
| 16 Conclusão; 17 Progresso                                                  | Placeholders remotos; versões locais a modularizar              |
| 18 Pacientes; 19 Cadastro                                                   | Placeholders sem formulário/lista reais                         |
| 20 Configuração; 25 opção de 10 repetições                                  | Placeholder sem edição local                                    |
| 21 Acompanhamento                                                           | Placeholder sem interface final                                 |
| 22 Ficha; 24 ficha com observação; 26 ficha atualizada; 28 ambas alterações | Placeholder; estados compartilhados ausentes                    |
| 23 e 27 Revisão de observação                                               | Ausentes                                                        |
| 29 e 30 Escrita de observação                                               | Ausentes                                                        |

M03/M04/M09 não possuem correspondência documentada nos arquivos consultados;
esta auditoria usa os nomes efetivos das telas e não atribui códigos por inferência.
Histórico e revisão/publicação são requisitos adicionais do pedido, sem tela
própria desenhada no PDF. Serão extensões do mesmo design system.

## Resultado da implementação

| Composições                           | Implementação física                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| 01                                    | `src/screens/patient/PatientHomeScreen.tsx`                                                   |
| 02                                    | `src/screens/patient/PatientWorkoutScreen.tsx`                                                |
| 03–07 e 31                            | `src/screens/patient/PreparationScreens.tsx`                                                  |
| 08 e 10                               | `src/screens/patient/PatientExerciseScreen.tsx`, série e meta no estado                       |
| 09 e 11–16                            | `src/screens/patient/SessionScreens.tsx`                                                      |
| 17 e histórico adicional              | `src/screens/patient/ProgressScreens.tsx`                                                     |
| 18                                    | `src/screens/professional/PatientListScreen.tsx`                                              |
| 19                                    | `src/screens/professional/PatientCreateScreen.tsx`                                            |
| 20, 25 e revisão/publicação adicional | `src/screens/professional/WorkoutScreens.tsx`                                                 |
| 21                                    | `src/screens/professional/PatientMonitoringScreen.tsx`                                        |
| 22, 24, 26 e 28                       | `src/screens/professional/PatientDetailsScreen.tsx`, com repetições/observação compartilhadas |
| 23, 27, 29 e 30                       | `src/screens/professional/NoteScreens.tsx`                                                    |

As 25 rotas são registradas em `src/navigation/FrontendNavigator.tsx` com tipos
em `frontendTypes.ts`. `DevelopmentDestinationScreen.tsx` agora só mantém exports
de compatibilidade para as telas reais; não renderiza placeholders.

A composição usa conteúdo adaptável e rolagem, em vez das coordenadas absolutas
do PDF. Ações profissionais permanecem fixas acima das abas. A fonte original,
paleta, ilustrações e hierarquia foram reutilizadas; cabeçalhos de sistema/relógio
não foram desenhados dentro do conteúdo. Há extensões de UX para pesquisa,
validação, confirmação de publicação e estados vazios.

Referências a M03–M09 existem nos documentos de integração, mas não fornecem uma
matriz completa de nomes de telas por módulo. M09 é citado como consumidor de
estados de sincronização. A fase visual usa dados locais e não representa uma
operação como sincronizada com a API.
