# Contratos da API

Estes documentos são a referência versionada para a integração do backend. Devem ser revisados pelas responsáveis antes da implementação dos módulos consumidores.

## Estado após B02

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

Somente proposto, não implementado:

- pacientes e vínculo (B03);
- exercícios, treinos e observações (B04-B06);
- sessões, progresso e conquistas (B07-B09).

Nenhuma rota, tabela ou serviço dos domínios B03-B09 foi criado por B02. As tabelas `users` e `refresh_tokens` pertencem exclusivamente à autenticação.

## Documentos

- [`api-conventions.md`](api-conventions.md): transporte, tipos, paginação, permissões e erros.
- [`authentication.md`](authentication.md): segurança, tokens, senha temporária e integração B03.
- [`endpoint-catalog.md`](endpoint-catalog.md): inventário proposto de rotas e DTOs.
- [`domain-contracts.md`](domain-contracts.md): DTOs e regras propostas para os módulos futuros.
- [`integration-fixtures.md`](integration-fixtures.md): exemplos estáveis e interfaces entre módulos.
