# Auditoria e padrão visual do aplicativo mobile

## Diagnóstico

| Área | Descontinuidade encontrada | Padronização aplicada |
| --- | --- | --- |
| Espaçamento | O contêiner `Screen` e `ui.page` mantinham paddings e gaps duplicados; algumas telas também tinham valores próprios para cartões, câmeras, campos e rodapés. | O contêiner de página duplicado foi removido. `theme.ts` centraliza a escala de espaçamento, os raios, a largura de conteúdo e as alturas de controles. |
| Cabeçalho | O cabeçalho compartilhado mostrava somente a marca; título e voltar eram posicionados dentro da área rolável, enquanto autenticação tinha outra composição. | `AppHeader` mantém marca, voltar, título e espaço de ação alinhados em uma faixa fixa. `Screen` e as telas de autenticação usam o mesmo componente. |
| Navegação | A pilha visual usava `fade` para todas as rotas e desabilitava o gesto nativo. | As pilhas usam a transição nativa `slide_from_right`; a navegação por gesto foi habilitada. |
| Tipografia | Havia tamanhos e entrelinhas próprios por componente e mistura de `fontWeight` com a fonte Atkinson já incluída no app. | A hierarquia tipográfica agora fica em `typography`; componentes usam os arquivos regular e bold já presentes. |
| Estados | Os vazios eram cartões ad hoc, o bootstrap usava indicador circular e os erros de autenticação tinham caixas duplicadas. | Foram criados `LoadingState` com skeleton, `EmptyState`, `ErrorState` e `InlineError`. Vazios da lista, histórico e treinos e estados do bootstrap usam a mesma base. |
| Rodapés | Fixar todo rodapé na primeira revisão escondia parte do CTA da tela inicial em aparelho menor. | Cabeçalho permanece fixo. Rodapés de paciente rolam com o conteúdo; ações profissionais permanecem fixas acima das abas. |

## Tokens do FisioMove

### Espaçamento

Todos os valores seguem a grade de quatro pontos:

| Token | Valor |
| --- | ---: |
| `spacing.xs` | 4 |
| `spacing.sm` | 8 |
| `spacing.md` | 12 |
| `spacing.lg` | 16 |
| `spacing.xl` | 24 |
| `spacing.xxl` | 32 |
| `spacing.xxxl` | 40 |

### Tipografia

| Token | Tamanho / entrelinha | Uso |
| --- | --- | --- |
| `typography.brand` | 20 / 28 | Marca do app |
| `typography.display` | 32 / 40 | Número ou destaque principal |
| `typography.heading` | 28 / 36 | Saudação ou título de conteúdo |
| `typography.title` | 22 / 30 | Título de cabeçalho e cartões |
| `typography.body` | 18 / 26 | Texto principal e orientação |
| `typography.bodySmall` | 16 / 24 | Ações, abas e texto secundário |
| `typography.caption` | 14 / 20 | Explicações compactas |
| `typography.label` | 12 / 16 | Rótulos e metadados |

Usar `fonts.regular` para texto de leitura e `fonts.bold` para títulos, labels e
ações. Não combinar `fontWeight` com a família Atkinson para simular pesos que já
existem como arquivo.

### Cor, cantos e layout

Usar apenas nomes de `colors` definidos em `theme.ts` para componentes de UI.
As cores de câmera também são tokens, isolados para o preview e sua sobreposição.
Os cantos padrão são `radii.sm` (8), `radii.md` (12), `radii.lg` (16) e
`radii.xl` (24). O conteúdo usa largura máxima de 560 pontos, margem lateral de
24, cabeçalho de 104, controle primário de 56 e controle compacto de 48.

As combinações principais abaixo foram calculadas com a fórmula de luminância
relativa para contraste de texto. Todas excedem 4,5:1:

| Texto / fundo | Contraste |
| --- | ---: |
| `primary` / `background` | 6,86:1 |
| `text` / `background` | 14,56:1 |
| `textMuted` / `background` | 6,42:1 |
| `primary` / `surfaceMuted` | 5,98:1 |
| `success` / `successBackground` | 5,66:1 |
| `error` / `errorBackground` | 6,10:1 |
| `surface` / `primary` (texto do botão) | 7,20:1 |
| `text` / `accent` (CTA turquesa) | 6,24:1 |

## Regras por tela

1. Construir telas de produto com `Screen`; manter o cabeçalho fora do
   `ScrollView`. Título, voltar e área reservada à ação usam sempre o mesmo
   alinhamento.
2. Colocar subtítulo e conteúdo na área rolável. Usar os espaçamentos nomeados
   em `theme.ts`; não criar valores de margem ou gap isolados quando um token
   atende.
3. Usar `Button`/`PrimaryButton`, `Card` e `FormField` para os padrões já
   disponíveis. Primários têm 56 pontos de altura; ações compactas têm 48.
4. Usar `LoadingState`, `EmptyState` e `ErrorState` para carregamento, lista
   vazia e falha recuperável. Erros de formulário ficam junto ao campo; erros
   gerais usam `InlineError` ou `ErrorState` e oferecem uma ação de recuperação
   quando possível.
5. Manter ações de paciente após o conteúdo rolável para não ocultar o CTA em
   telas menores. Nas telas profissionais, manter o rodapé de ação acima das
   abas fixas.
6. Manter a transição nativa `slide_from_right`. Novas exceções precisam
   representar um fluxo que realmente exija outra transição.
7. Preservar rótulos de acessibilidade, estado desabilitado, anúncio de erro e
   área de toque mínima de 48 pontos. Não comunicar status somente por cor.

## Arquivos estruturais

- `mobile/src/theme/theme.ts`: paleta, escala, tipografia, cantos e layout.
- `mobile/src/components/AppHeader.tsx`: cabeçalho global fixo.
- `mobile/src/components/Screen.tsx`: moldura, rolagem, rodapé e abas.
- `mobile/src/components/ScreenStates.tsx`: skeleton, vazio e erro.
- `mobile/src/ui.tsx`: primitivos de botão, texto, cartão e elementos de apoio.
- `mobile/src/navigation/FrontendNavigator.tsx`: transição padrão das telas.

O protótipo ainda usa dados locais e fictícios em vários fluxos. Os estados
padronizados oferecem a base visual para telas conectadas à API; não simulam
carregamentos de dados que ainda não existem.
