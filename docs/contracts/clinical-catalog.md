# Pendência clínica do catálogo

Não foi localizada uma especificação de exercício explicitamente aprovada por
fisioterapeuta nos documentos disponíveis do projeto. O plano, o Documento de
Visão e o Relatório de Viabilidade descrevem a intenção de começar com até dois
exercícios de membro superior, mas deixam a escolha do movimento, amplitudes,
desvios e feedback dependentes de validação profissional.

Por isso, nenhuma migração ou seed de produção cadastra exercício (o catálogo só
recebe itens por decisão do fisioterapeuta; ver a exceção da DEC-006 abaixo). A fixture
`fictional-test-only` é criada somente dentro de bancos temporários da suíte e
não pode ser promovida ao catálogo real.

## Dados necessários para o primeiro exercício

O responsável clínico deve fornecer e versionar:

- nome e código estável;
- descrição e instruções de execução;
- lado permitido (`left`, `right` e/ou `bilateral`);
- versão da regra;
- parâmetros aceitos, tipos, unidades, intervalos e obrigatoriedade;
- critérios observáveis de execução, interrupção e feedback;
- referência, autor, data e versão da aprovação clínica.

O backend já preserva `rule_version`, snapshot do exercício e parâmetros em
cada revisão de treino. Isso não substitui a aprovação clínica nem autoriza o
backend a inventar ângulos, tolerâncias ou limites.

## Governança técnica

A infraestrutura armazena `approval_status`, versão aprovada, profissional,
data e referência documental, além de eventos append-only de aprovação e
revogação. Exercícios migrados recebem `pending`; nenhum dado é aprovado
automaticamente. O catálogo e novas prescrições aceitam somente estado
`approved` com versão coincidente.

Não existe endpoint genérico de aprovação ou revogação.
`ExerciseGovernanceService` registra a evidência informada, mas não prova que a
avaliação clínica ocorreu; para exercícios definidos clinicamente, a instituição
ainda deve definir quem pode autorizar a chamada, quais documentos são válidos e
como devem ser retidos.

### Exceção: material da biblioteca de referência (DEC-006, uso acadêmico)

Por decisão de Luma (DEC-006, que substitui a DEC-004 só no trecho "nunca entra
em `exercises`"), o fisioterapeuta pode adicionar um item da OpenExerciseBase ao
catálogo por `POST /api/v1/exercise-library/{external_id}/catalog`. A rota chama
`ExerciseGovernanceService.approve` em nome dele, com a referência
`fisiomove:library-import:openexercisebase:{external_id}; DEC-006 (uso acadêmico)`,
e grava proveniência e atribuição CC BY-NC 4.0 (`source`, `source_external_id`,
`source_url`, `source_license`).

- "Aprovado", nesse caso, significa "escolhido pelo fisioterapeuta para uso
  acadêmico", não validação clínica. Rever antes de qualquer uso clínico ou
  comercial.
- Nenhum valor clínico vem da fonte nem é inventado: `supported_parameters = {}`,
  `rule_version = "library-reference-no-camera-rule:v1"` (sem regra de câmera,
  `MovementEngine` desligado), lados escolhidos pelo fisioterapeuta, e séries,
  repetições e descanso digitados por ele em cada treino.
- Nome e instruções originais ficam em inglês, sem edição; parte do conteúdo da
  fonte foi gerada por IA e revisada pelo provedor. Uma tradução pt-BR opcional
  (DEC-011) é escrita ou revisada por um fisioterapeuta (na adição ou por
  `PUT /api/v1/exercises/{id}/localization`), fica em colunas separadas com
  autoria e data, e a atribuição passa a indicar a alteração. Traduzir não
  altera `rule_version`, aprovação nem eventos de governança; qualquer
  fisioterapeuta ativo pode editar (vale a última edição) e não há rota para
  apagar a tradução.
- Até 6 imagens da fonte (PNG/JPEG/WebP, até 2 MiB cada) são copiadas na adição
  (DEC-010) e servidas pela API; o aparelho do paciente não acessa o provedor.
  Imagens são material de referência, não critério de execução.
- O catálogo é global: o item adicionado aparece para todos os
  fisioterapeutas, com os lados da primeira adição.

Contrato completo em `exercise-library.md`.

## Demonstração técnica

Testes podem usar exercício sintético criado no banco descartável. O seed
fictício `scripts.seed_demo` é recusado em produção, não cria exercício e só
funciona quando o ambiente não produtivo já contém um exercício ativo, aprovado
para a mesma `rule_version` e com contrato vazio. Fixtures usam referências
`test-fixture://...`, são criadas apenas em bancos descartáveis e não constituem
aprovação clínica.
