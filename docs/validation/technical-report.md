# M08 — validação técnica e estabilização

## Estado desta atualização

O protocolo foi atualizado para registrar o estado verificável do projeto. A
implementação nativa de câmera e estimativa local foi instalada e aberta em um
iPhone 15 Pro Max com iOS 27.0.1. A execução foi inspecionada pelo Espelhamento
do iPhone; a imagem da câmera apareceu preta e o macOS informou que a câmera do
iPhone não está disponível pelo Mac. Portanto, a abertura do fluxo foi
confirmada, mas frames reais e landmarks válidos ainda não foram confirmados.
Nenhum valor de desempenho ou contagem física foi inferido de testes sintéticos.

## Ambiente e método

| Campo                                | Registro |
| ------------------------------------ | -------- |
| Branch / base local                  | `develop` em `d02bf94` + alterações locais não commitadas |
| Aparelho e modelo                    | iPhone 15 Pro Max (inspeção por Espelhamento do iPhone) |
| Sistema e versão                     | iOS 27.0.1 |
| Modelo/runtime configurado           | YOLO26 Pose 384 / ExecuTorch 0.11.0 |
| Captura configurada                  | VisionCamera 5.2.4, câmera frontal |
| Exercício e versão de regra aprovada | Nenhum; aguardando especificação e aprovação do fisioterapeuta |
| Protocolo e referência manual        | Não executados; dependem da regra aprovada |
| Quantidade de ciclos físicos         | 0 |
| Ambiente de automação                | `npm run type-check`, `npm run lint`, `npm run format:check` e Jest executados |
| Build nativo Android                  | `./gradlew :app:assembleDebug` concluído; APK gerado em `mobile/android/app/build/outputs/apk/debug/app-debug.apk` |
| Build nativo iOS                      | `xcodebuild` para `generic/platform=iOS`, sem assinatura, concluído em Xcode 27.2 |
| Resultado automatizado               | 20 suítes / 83 testes passaram anteriormente; builds Android e iOS concluídos; alteração atual de tela verificada com TypeScript, ESLint e Prettier |

## Medidas

| Medida                   | Resultado |
| ------------------------ | --------- |
| Contagem física          | Pendente; motor ainda não conectado ao estimador sem contrato de confiança compatível e regra aprovada |
| Latência de inferência   | Não medida de forma controlada; tela mostrou momentaneamente 7–8 ms, sem frame/landmark confirmado |
| Frequência de inferência | Não medida em aparelho |
| Estabilidade e quadros descartados | Não medidos; a tela mostrou momentaneamente 20 quadros descartados |
| Alertas falsos           | Não medidos; sem protocolo ou desvio clínico aprovado |
| Liberação por perda de foco/segundo plano | Implementada na captura; comportamento nativo ainda não confirmado |
| Segundo plano e retomada | Captura configurada para parar quando app/tela não estão ativos; comportamento nativo ainda não confirmado |
| Iluminação e enquadramento | Não avaliados; prévia preta no Espelhamento do iPhone |
| Perda/ruído de landmarks | Não avaliados; a tela mostrou momentaneamente 0/3 pontos |

## Limitações do ambiente e dependências

- O build Android foi realizado com JDK e SDK instalados em diretório temporário;
  o APK não foi instalado nem executado em aparelho Android.
- O app iOS foi instalado e aberto no iPhone. O Espelhamento do iPhone não
  disponibilizou a imagem da câmera ao Mac; a confirmação de preview e de
  landmarks exige observação direta no aparelho.
- O YOLO26 fornece uma confiança por landmark; M06 atualmente exige medidas
  distintas de visibilidade e presença. A equipe não deve considerar esses
  valores equivalentes sem aprovação da especificação do contrato.
- O motor M06 ainda não consome as observações brutas. O fluxo autenticado atual
  usa `DemoProvider`, a contagem da tela de exercício é manual e os dados de
  treino/draft reais não chegam à composição M07. A execução e o envio de um
  resultado real dependem da integração dos contratos de treino e autorização,
  além da regra clínica aprovada.
- A câmera local está conectada às telas de preparação/calibração, execução do
  exercício, ajuste da câmera e orientação de movimento. Ela para quando a tela
  perde foco ou o app vai para segundo plano; a liberação nativa ainda não foi
  medida em aparelho.
- A contagem na tela de exercício continua manual/demonstrativa. O resultado da
  sessão ainda não representa uma execução real integrada ao M06/M02.
- O catálogo não contém exercício e desvio observável aprovados. Essa decisão
  cabe ao fisioterapeuta responsável e bloqueia calibração clínica, contagem
  física e validação de feedback.

Após obter a aprovação clínica e um aparelho, preencher as medidas com modelo,
sistema, versão da regra, referência manual, ciclos, iluminação, enquadramento,
latência, FPS, quadros descartados e alertas. Se somente uma plataforma for
testada, registrar a outra como não avaliada. Não reportar testes sintéticos
como desempenho clínico.
