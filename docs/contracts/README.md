# Contratos da API

Estes documentos são a referência versionada para a integração do backend. Devem ser revisados pelas responsáveis antes da implementação dos módulos consumidores.

## Estado do backend após B09

Implementado:

- `GET /health`, sem prefixo e com resposta `{"status":"ok"}`;
- configuração por ambiente;
- infraestrutura SQLAlchemy/Alembic;
- formato uniforme de erros;
- prefixo `/api/v1`;
- autenticação, renovação rotativa, logout, identidade e troca de senha;
- dependências reutilizáveis de identidade e perfis;
- provisionamento administrativo do primeiro fisioterapeuta;
- serviço interno de acesso do paciente integrado por B03;
- cadastro, consulta, paginação, edição e desativação de pacientes;
- vínculo paciente-profissional e função reutilizável de autorização;
- criação, ativação e redefinição de acesso do paciente integradas a B02.

B04–B06 implementam catálogo autenticado, treinos/revisões, publicação, edição,
arquivamento e observações com privacidade. B07 implementa registro idempotente
de sessões e snapshot histórico; B08 implementa histórico e progresso; B09
implementa a conquista técnica `session_goal_reached` e um seed fictício,
recusado em produção. Migrações executáveis até `20261022_0007`.

A definição clínica do primeiro exercício e seu contrato de parâmetros seguem
pendentes de aprovação profissional. Portanto, o catálogo de produção deve
permanecer vazio; fixtures `fictional-test-only` existem somente em bancos
temporários de teste e não são exercícios clínicos.

As tabelas `patients` e `professional_patient_links` pertencem a B03. B04–B06 referenciam essas tabelas sem reimplementar autenticação ou vínculo.

## Documentos

- [`api-conventions.md`](api-conventions.md): transporte, tipos, paginação, permissões e erros.
- [`authentication.md`](authentication.md): segurança, tokens, senha temporária e integração B03.
- [`patients.md`](patients.md): pacientes, vínculo, autorização e acesso temporário.
- [`endpoint-catalog.md`](endpoint-catalog.md): inventário proposto de rotas e DTOs.
- [`domain-contracts.md`](domain-contracts.md): DTOs e regras propostas para os módulos futuros.
- [`integration-fixtures.md`](integration-fixtures.md): exemplos estáveis e interfaces entre módulos.
- [`clinical-catalog.md`](clinical-catalog.md): dados ainda necessários para aprovar o primeiro exercício.
- [`../modules/sessions.md`](../modules/sessions.md): registro e consulta de sessões B07.
- [`../modules/progress.md`](../modules/progress.md): histórico e agregação de progresso B08.
- [`../modules/results.md`](../modules/results.md): conquista e seed fictício B09.
