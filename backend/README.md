# Backend do FisioMove

Fundação da API FastAPI com PostgreSQL, SQLAlchemy e Alembic. B01 não implementa autenticação, pacientes, treinos, sessões ou progresso.

## Preparação

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
```

Edite `.env` e substitua a URL de exemplo por uma credencial PostgreSQL local. O arquivo `.env` é ignorado pelo Git.

## Variáveis

- `APP_ENV`: `development`, `test` ou `production`.
- `APP_DEBUG`: ativa o modo de debug do FastAPI.
- `API_PREFIX`: prefixo versionado, por padrão `/api/v1`.
- `DATABASE_URL`: obrigatória; use `postgresql+psycopg://...` fora dos testes.
- `DB_ECHO`: registra SQL quando habilitada; mantenha desabilitada normalmente.

SQLite é aceito somente com `APP_ENV=test`, para bancos temporários e isolados da suíte automatizada.

## Banco e migrações

Crie previamente o banco PostgreSQL indicado em `DATABASE_URL` e execute:

```bash
alembic upgrade head
```

A revisão inicial estabelece a cadeia do Alembic sem criar tabelas de domínios ainda não implementados. Novas migrações devem apontar para o `head` integrado e nunca reescrever revisões aplicadas.

## API

```bash
uvicorn app.main:app --reload
```

Verificação técnica:

```bash
curl http://127.0.0.1:8000/health
```

## Qualidade

```bash
ruff check .
ruff format --check .
pytest
```

Os contratos propostos para os módulos seguintes estão em `../docs/contracts/`. Eles não representam endpoints implementados em B01.
