# Front-end FisioMove: paciente e profissional

## Estado desta entrega

O pull de backend e mobile foi feito em `develop` (`9543ec5`). As alterações locais
anteriores foram guardadas no stash
`codex-preserve-local-before-frontend-pdf-2026-10-30` e conciliadas com o remoto.
O stash continua disponível como backup. Não foi criado commit nem realizado push.
A alteração preexistente em `backend/app/modules/sessions/services.py` foi preservada.

A aplicação é React Native CLI, não Expo. As bibliotecas React Navigation já
vieram no pull; nenhuma dependência de execução nova foi adicionada. A primeira
fase abre diretamente uma demonstração visual, sem login, rede ou persistência.
`Acessar minha conta` mantém disponível a autenticação existente; após autenticar,
as telas de negócio desta fase ainda exibem dados fictícios, não dados da API.

## Executar

Na pasta `mobile/`:

```bash
npm ci
npm start
```

Em outro terminal: `npm run android` ou `npm run ios`. São necessários os SDKs
nativos e, para iOS, Xcode/CocoaPods conforme o README do mobile. A fonte Atkinson
Hyperlegible está incluída com licença OFL e registrada no Android/iOS; faça uma
nova compilação nativa para carregá-la.

## Organização

- `src/navigation/FrontendNavigator.tsx`: 25 rotas reais do fluxo visual.
- `src/navigation/frontendTypes.ts`: parâmetros de navegação tipados.
- `src/screens/patient/`: início, treino, preparação, permissões, calibração,
  exercício, pausa, descanso, orientação, encerramento, resultado e histórico.
- `src/screens/professional/`: lista/busca, cadastro, ficha, configuração,
  revisão/publicação, acompanhamento e escrita/revisão de observações.
- `src/demo/`: modelos fictícios, reducer e estado compartilhado em memória.
- `src/components/`: cabeçalho, campos, estrutura responsiva e prévia simulada.
- `src/ui.tsx` e `src/theme/theme.ts`: componentes visuais e tokens compartilhados.
- `src/assets/`: ilustrações locais e fonte. Não há URLs temporárias em execução.

As 31 composições do PDF são representadas por telas e estados, sem duplicar um
arquivo para cada combinação de ficha, repetições e observação. Histórico e
revisão/publicação estendem o visual do PDF porque foram pedidos explicitamente.
A auditoria anterior à implementação está em `pdf-screen-audit.md`.

## Roteiro de teste

1. Abra início → histórico/progresso: confirme os estados vazios.
2. Abra treino → preparação; configure voz, volte e confira o estado ativado.
3. Negue a câmera, tente novamente e permita na simulação. Nenhum hardware é ativado.
4. Confira a calibração e comece o exercício. Toque no contador para simular uma
   repetição; abra pausa, ajuste da câmera e orientação. Ao voltar, a contagem permanece.
5. Use `Ver 1ª série concluída`, passe pelo descanso e inicie série 2.
6. Veja o resultado simulado, progresso e histórico; filtre sessões.
7. Em outra sessão, cancele a saída e depois confirme a interrupção. Não deve
   aparecer conquista de conclusão. Colocar o app em segundo plano pausa a execução.
8. Abra a área profissional e busque um nome inexistente. Limpe a busca.
9. Abra Maria → alterar exercício → selecione 10 → salvar → publicar.
10. Abra observação: tente revisar vazia, digite ou use o exemplo do PDF, revise
    e salve. Confira a ficha atualizada e a mensagem de sucesso.
11. No acompanhamento, confira o treino atual e o resultado original da última sessão.
12. Cadastre Ana com dados fictícios; valide erros, salve rascunho e confira que
    o treino não fica disponível ao paciente antes da publicação.
13. Publique o treino de Ana e use `Ver como paciente (demo)` na ficha.
14. Teste notas longas, fontes ampliadas, teclado, rolagem, tablet e leitor de tela.

## Limites da primeira fase

Não há câmera, microfone, calibração ou avaliação clínica reais neste fluxo. O
botão de resultado completa a contagem ilustrativa, conforme o protótipo. As únicas
opções de prescrição visual são 2 séries com 8 ou 10 repetições, presentes no PDF.
Não são criados ângulos, tolerâncias ou regras clínicas novas. O texto de orientação
é digitado pelo usuário ou copiado do exemplo explicitamente identificado no PDF.

Dados são apagados ao reiniciar. Um resultado guarda a meta vigente no começo da
sessão e não é recalculado quando o treino muda. Os serviços de autenticação, API,
visão e sincronização recebidos no pull permanecem disponíveis para a fase seguinte.
Não há afirmação de sincronização com o servidor nesta demonstração.

A inspeção nativa de Android/iOS, área segura, teclado e leitor de tela depende
que o projeto seja executado em um simulador ou dispositivo com os SDKs instalados.

## Evidências e verificações

- 63 testes Jest passaram em 18 suítes, incluindo serviços e integração recebidos
  no pull e novos testes do estado de demonstração e formulários.
- TypeScript strict e ESLint passaram.
- Prettier passou para os arquivos criados/alterados nesta entrega. A checagem
  global ainda sinaliza três arquivos inalterados recebidos no pull:
  `src/features/exercise-engine/calibration.ts`, `CalibrationStore.ts` e
  `src/features/vision/types.ts`. Não foram formatados fora do escopo desta fase.
- A navegação real via React Native Web/Chromium foi exercitada em larguras de
  320, 390 e 768 px: 117 capturas cobrindo os dois fluxos, erros de formulário,
  filtros vazios, rascunho não publicado e revisão de texto longo.
- A prévia web foi usada apenas para QA, com ferramentas temporárias fora do
  repositório; não foi adicionada como nova plataforma de execução do aplicativo.
- `plutil` validou a sintaxe do projeto iOS e de `Info.plist`. Não houve compilação
  nem teste nativo: `simctl` e Android SDK/`adb` não estão disponíveis no ambiente.

Uma seleção das capturas está em
[`previews/frontend-overview.jpg`](previews/frontend-overview.jpg).
