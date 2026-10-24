# Contratos da API

Estes documentos são a referência versionada para a integração do backend. Devem ser revisados pelas responsáveis antes da implementação dos módulos consumidores.

## Estado do backend após B08

Implementado:

- `GET /health`, sem prefixo e com resposta `{"status":"ok"}`;
- configuração por ambiente;
- infraestrutura SQLAlchemy/Alembic;
- formato uniforme de erros;
- prefixo `/api/v1`;
- autenticação, renovação rotativa, logout, identidade e troca de senha;
- dependências reutilizáveis de identidade e perfis;
- provisionamento administrativo do primeiro fisioterapeuta;
- serviço interno de acesso do paciente para integração por B03.
- cadastro, consulta, paginação, edição e desativação de pacientes;
- vínculo paciente-profissional e função reutilizável de autorização;
- criação, ativação e redefinição de acesso do paciente integradas a B02.

B04–B06 implementados: catálogo autenticado, treinos/revisões, publicação,
edição, arquivamento e observações com privacidade. B07 implementa registro e
idempotência de sessões; B08 implementa histórico e resumo de progresso.
Migrações executáveis até 20261022_0006.
Definição clínica do primeiro exercício e contrato de parâmetros permanecem
pendentes de aprovação.

Somente proposto, não implementado:

- conquistas (B09).

As tabelas `patients` e `professional_patient_links` pertencem a B03. B04–B06 referenciam essas tabelas sem reimplementar autenticação ou vínculo.

## Documentos

- [`api-conventions.md`](api-conventions.md): transporte, tipos, paginação, permissões e erros.
- [`authentication.md`](authentication.md): segurança, tokens, senha temporária e integração B03.
- [`patients.md`](patients.md): pacientes, vínculo, autorização e acesso temporário.
- [`endpoint-catalog.md`](endpoint-catalog.md): inventário proposto de rotas e DTOs.
- [`domain-contracts.md`](domain-contracts.md): DTOs e regras propostas para os módulos futuros.
- [`integration-fixtures.md`](integration-fixtures.md): exemplos estáveis e interfaces entre módulos.
- [`../modules/sessions.md`](../modules/sessions.md): registro e consulta de sessões B07.
- [`../modules/progress.md`](../modules/progress.md): histórico e agregação de progresso B08.
