# Backend do FisioMove

API FastAPI com PostgreSQL, SQLAlchemy, Alembic, autenticação de contas e gestão de pacientes vinculados. B03 implementa pacientes e vínculo profissional, mas não implementa treinos, observações, sessões, progresso ou conquistas.

## Preparação

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
```

Edite `.env` e substitua a URL de exemplo por uma credencial PostgreSQL local. O arquivo `.env` é ignorado pelo Git.

Gere uma chave de autenticação local, sem copiá-la para arquivos versionados:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Coloque o resultado em `AUTH_SECRET_KEY` no `.env`.

## Variáveis

- `APP_ENV`: `development`, `test` ou `production`.
- `APP_DEBUG`: ativa o modo de debug do FastAPI.
- `API_PREFIX`: prefixo versionado, por padrão `/api/v1`.
- `DATABASE_URL`: obrigatória; use `postgresql+psycopg://...` fora dos testes.
- `DB_ECHO`: registra SQL quando habilitada; mantenha desabilitada normalmente.
- `AUTH_SECRET_KEY`: chave obrigatória com pelo menos 32 caracteres; use valor aleatório.
- `AUTH_ACCESS_TOKEN_MINUTES`: validade do access token; padrão 15 minutos.
- `AUTH_REFRESH_TOKEN_DAYS`: validade da renovação; padrão 30 dias, máximo 90.
- `AUTH_ISSUER` e `AUTH_AUDIENCE`: emissor e destinatário esperados no JWT.

SQLite é aceito somente com `APP_ENV=test`, para bancos temporários e isolados da suíte automatizada.

## Banco e migrações

Crie previamente o banco PostgreSQL indicado em `DATABASE_URL` e execute:

```bash
alembic upgrade head
```

A revisão inicial estabelece a cadeia do Alembic sem criar tabelas de domínios ainda não implementados. Novas migrações devem apontar para o `head` integrado e nunca reescrever revisões aplicadas.

## Primeiro fisioterapeuta

Após as migrações, execute localmente:

```bash
python -m app.modules.auth.cli create-physiotherapist \
  --email profissional@example.com
```

A senha temporária é solicitada de forma oculta e confirmada interativamente; ela não é aceita como argumento de linha de comando. O comando cria somente o primeiro fisioterapeuta e exige troca da senha no primeiro acesso.

## API

```bash
uvicorn app.main:app --reload
```

Verificação técnica:

```bash
curl http://127.0.0.1:8000/health
```

Rotas implementadas:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/patients`
- `GET /api/v1/patients`
- `GET /api/v1/patients/{id}`
- `PATCH /api/v1/patients/{id}`
- `POST /api/v1/patients/{id}/access`

As rotas de pacientes exigem um fisioterapeuta autenticado, com senha temporária já trocada. O vínculo é criado pelo servidor a partir da identidade autenticada; nenhum ID profissional é aceito no corpo.

`POST /patients/{id}/access` aceita `{"operation":"activate"}` para criar ou reativar o acesso e `{"operation":"reset_temporary_password"}` para redefinir a credencial. A senha temporária é retornada uma única vez ao profissional autorizado e deve ser entregue ao paciente por canal seguro. Não há cadastro público de contas.

Desativar um paciente usa `PATCH` com `{"is_active":false}`. O registro e o vínculo são preservados, a conta associada é bloqueada e suas renovações são revogadas. Reativar o registro e reativar o acesso são operações separadas.

## Qualidade

```bash
ruff check .
ruff format --check .
pytest
```

Os contratos e estados de implementação estão em `../docs/contracts/`.
