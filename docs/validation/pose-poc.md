# M05 — câmera e estimativa local de pose

## Implementação na branch `develop`

O aplicativo usa React Native 0.87.1 e a implementação mantida do VisionCamera
5.2.4 para preview e captura de quadros. O pipeline redimensiona localmente cada
quadro e executa o modelo YOLO26 Pose 384 do React Native ExecuTorch 0.11.0 no
runtime local do aparelho. O modelo estima 17 pontos COCO; o aplicativo expõe
ombro, cotovelo e punho de cada lado. Somente coordenadas, confiança do ponto,
orientação, espelhamento e tempo de inferência saem do pipeline de câmera para a
interface. Imagens e buffers não são persistidos nem enviados à API.

O código descarta os quadros e buffers de GPU após cada inferência, descarta
quadros quando o processamento está ocupado, encerra a captura quando a tela
perde foco ou o app vai para segundo plano e libera o redimensionador ao
desmontar o componente. A orientação e o espelhamento fornecidos pelo
VisionCamera são preservados; a transformação de letterbox é desfeita ao
normalizar coordenadas. A pré-visualização exibe os pontos da pose e a duração
medida da inferência. O evento de download anônimo de modelo do ExecuTorch foi
desativado.

O mesmo componente de captura local é utilizado na calibração, durante a
execução do exercício e nas telas de ajuste da câmera e orientação. A captura
usa a câmera frontal, de modo que a pessoa possa olhar para a tela enquanto o
celular permanece voltado para ela. A câmera é
ativada somente quando a respectiva tela está em foco; a tela de pausa não a
mantém aberta. A contagem apresentada na demonstração continua manual e
ilustrativa, pois ainda não há regra de movimento aprovada nem contrato de
confiança validado para ligar os landmarks ao motor M06.

## Contrato do modelo e dependência clínica

O YOLO26 Pose fornece uma confiança única por ponto e profundidade relativa
opcional. O contrato anterior do motor M06 espera `visibility` e `presence`
distintas. Esses valores não são equivalentes e o adaptador não os inventa. Por
isso, o resultado bruto usa um contrato próprio (`RawPoseObservation`) e ainda
não alimenta o motor de contagem.

O catálogo atual não possui exercício nem desvio observável aprovados por
fisioterapeuta. A calibração clínica, os parâmetros do movimento, a conexão ao
M06 e a validação de contagem física ficam bloqueadas até que essa especificação
seja fornecida e versionada. Os dados do app de demonstração não são prescrições
clínicas.

## Dependências e configuração nativa

Dependências fixadas em `mobile/package.json`: `react-native-vision-camera`
5.2.4, `react-native-vision-camera-resizer` 5.2.3,
`react-native-vision-camera-worklets` 5.2.4, `react-native-worklets` 0.13.1,
`react-native-executorch` 0.11.0, `react-native-nitro-modules` 0.37.1 e
`react-native-blob-util` 0.24.11. O app requer a Nova Arquitetura, câmera
autorizada, Android `minSdkVersion` 26 e iOS 17.0. O modelo é baixado na
primeira utilização e executado localmente depois disso.

## Validação realizada e pendente

O código nativo iOS foi compilado, assinado para desenvolvimento e instalado em
um iPhone 15 Pro Max com iOS 27.0.1. O app abriu após a migração para o ciclo de
vida de cenas exigido pelo iOS 27. O fluxo percorreu preparação, autorização da
câmera, calibração e execução; na tela de execução, a prévia deixou de ser a
ilustração estática e passou a renderizar `LocalPoseCamera`. TypeScript,
ESLint e Prettier foram verificados nos dois arquivos de tela alterados nesta
integração. A suíte Jest não foi executada novamente após esta alteração.

Durante a inspeção pelo Espelhamento do iPhone, o sistema informou que a câmera
do iPhone não está disponível pelo Mac e a região de vídeo apareceu preta. A
tela reportou momentaneamente 5 ms de inferência, 0 quadros descartados e 0/3
pontos do braço; esses números são uma leitura pontual da interface, não uma
medição controlada. Ainda não foi confirmado visualmente no aparelho que um
frame real mostre o paciente nem que landmarks válidos sejam produzidos. A
captura precisa ser conferida olhando diretamente para a tela física do iPhone,
sem depender do Espelhamento do iPhone.

Foram anteriormente concluídas as verificações `npm run type-check`, lint,
`npm run format:check` e 20 suítes Jest com 83 testes. O teste
`RawPoseObservation.test.ts` cobre normalização e letterbox com dados
controlados; não valida câmera ou inferência nativa. Também houve builds Android
e iOS, mas a compilação isoladamente não comprova funcionamento em dispositivo.

## Referências oficiais

- [VisionCamera — documentação e configuração](https://visioncamera.margelo.com/docs)
- [VisionCamera — processamento de frames](https://visioncamera.margelo.com/docs/frame-output)
- [React Native ExecuTorch — pose e keypoints](https://docs.swmansion.com/react-native-executorch/docs/extensions/pose-and-keypoints)
- [React Native ExecuTorch — configuração](https://docs.swmansion.com/react-native-executorch/docs/fundamentals/getting-started)
