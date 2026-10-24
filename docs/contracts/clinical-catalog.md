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

## Demonstração técnica

Testes podem usar exercício sintético criado no banco descartável. O seed
fictício `scripts.seed_demo` é recusado em produção, não cria exercício e só
funciona quando o ambiente não produtivo já contém um exercício ativo com
contrato vazio. A versão atual não armazena a evidência de aprovação como campo;
portanto, selecionar somente um exercício aprovado é responsabilidade explícita
do operador até que o contrato clínico seja definido.
