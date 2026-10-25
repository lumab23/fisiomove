# Pendência clínica do catálogo

Não foi localizada uma especificação de exercício explicitamente aprovada por
fisioterapeuta nos documentos disponíveis do projeto. O plano, o Documento de
Visão e o Relatório de Viabilidade descrevem a intenção de começar com até dois
exercícios de membro superior, mas deixam a escolha do movimento, amplitudes,
desvios e feedback dependentes de validação profissional.

Por isso, nenhuma migração ou seed de produção cadastra exercício. A fixture
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

Não existe endpoint público de aprovação. `ExerciseGovernanceService` é uma
interface interna para um futuro processo institucional autorizado. Chamá-la
registra a evidência informada, mas não prova que a avaliação clínica ocorreu;
a instituição ainda deve definir quem pode autorizar a chamada, quais documentos
são válidos e como devem ser retidos.

## Demonstração técnica

Testes podem usar exercício sintético criado no banco descartável. O seed
fictício `scripts.seed_demo` é recusado em produção, não cria exercício e só
funciona quando o ambiente não produtivo já contém um exercício ativo, aprovado
para a mesma `rule_version` e com contrato vazio. Fixtures usam referências
`test-fixture://...`, são criadas apenas em bancos descartáveis e não constituem
aprovação clínica.
