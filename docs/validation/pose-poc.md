# M05 — prova de conceito de câmera e pose local

## Decisão técnica para integração

O mobile usa React Native 0.87.1. A proposta é usar `react-native-vision-camera`
5.2.3 para preview e saída de frames, com `react-native-vision-camera-worklets`
5.2.3 e `react-native-worklets` para processar frames fora da thread de UI. O
VisionCamera 5 usa AVFoundation no iOS, CameraX no Android e oferece `CameraFrameOutput`.
O fluxo de pose deve usar o plugin nativo da câmera para chamar o MediaPipe Tasks
Pose Landmarker localmente, sem atravessar frames pelo bridge JS ou rede.

Dependências nativas propostas:

- Android: `com.google.mediapipe:tasks-vision:1.1.1`;
- iOS: pacote Swift `google-ai-edge/mediapipe`, produto `MediaPipeTasksVision`,
  release 1.1.1 (iOS 15 ou superior).

O MediaPipe informa que inferência e imagens permanecem no dispositivo, mas a
biblioteca também envia métricas de desempenho/uso ao Google. A integração deve
revisar o aviso de privacidade e consentimento aplicável antes da distribuição.

No Android, a documentação do MediaPipe informa SDK 24 ou superior. A compatibilidade
do plugin Nitro, da toolchain Gradle e dos targets deste aplicativo precisa ser
confirmada pela integração do projeto antes de escolher a versão final das
dependências. Estas bibliotecas ainda não estão instaladas neste app.

## Handoff para integração nativa

O plano reserva para Luma as alterações em `package.json`, lockfile, Gradle,
Podfile, permissões e composição compartilhada. Este módulo define o contrato
TypeScript esperado em `PoseCameraAdapter.ts`: `FisioMovePose` solicita permissão,
inicia/para o stream e emite somente landmarks normalizados, orientação, estado de
espelhamento e duração de inferência. O adaptador retorna um erro explícito quando
o módulo nativo ainda não está no build.

Permissão proposta: câmera. A POC não grava áudio e não pede permissão de microfone.
O plugin deve descartar o frame após processá-lo, descartar frames enquanto estiver
ocupado, reportar perdas e nunca persistir imagem, vídeo ou buffer.

## Tratamento local de pose

`poseAssessment.ts` seleciona ombro, cotovelo e punho conforme o lado prescrito,
distingue landmark ausente de baixa confiança e transforma coordenadas para o
preview considerando orientação e espelhamento. A taxa de inferência é calculada
por timestamps observados; não há número de desempenho presumido no código.

O motor recebe landmarks somente em memória. `PoseCameraAdapter` não conhece
`ApiClient`, sessão sincronizada nem armazenamento persistente.

## Validação física pendente

O critério M05 exige câmera e landmarks em celular físico, coordenadas alinhadas à
imagem, perda de ponto e medições de dispositivo/sistema. Este ambiente de trabalho
não dispõe de Xcode, simulador iOS ou dispositivo físico conectado; por isso, não há
resultado de câmera ou medição a registrar como concluído. Preencher a tabela em
`technical-report.md` depois da integração nativa e da execução no aparelho.

## Referências oficiais

- [VisionCamera — Frame Output](https://visioncamera.margelo.com/docs/frame-output):
  uso de `CameraFrameOutput`, descarte dos frames e dependências Worklets;
- [MediaPipe — Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker):
  execução de imagem/vídeo/live stream e landmarks normalizados;
- [MediaPipe — guia iOS](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/ios):
  requisitos do listener para processamento em live stream.
