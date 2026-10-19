# Contratos da API

Estes documentos são a referência versionada para a integração do backend. Devem ser revisados pelas responsáveis antes da implementação dos módulos consumidores.

## Estado em B01

Implementado:

- `GET /health`, sem prefixo e com resposta `{"status":"ok"}`;
- configuração por ambiente;
- infraestrutura SQLAlchemy/Alembic;
- formato uniforme de erros;
- prefixo reservado `/api/v1`.

Somente proposto, não implementado:

- autenticação e contas (B02);
- pacientes e vínculo (B03);
- exercícios, treinos e observações (B04-B06);
- sessões, progresso e conquistas (B07-B09).

Nenhuma rota, tabela ou serviço desses domínios foi criado em B01.

## Documentos

- [`api-conventions.md`](api-conventions.md): transporte, tipos, paginação, permissões e erros.
- [`endpoint-catalog.md`](endpoint-catalog.md): inventário proposto de rotas e DTOs.
- [`domain-contracts.md`](domain-contracts.md): DTOs e regras propostas para os módulos futuros.
- [`integration-fixtures.md`](integration-fixtures.md): exemplos estáveis e interfaces entre módulos.
