# Backend do FisioMove

API FastAPI com PostgreSQL, SQLAlchemy, Alembic, autenticação de contas e gestão de pacientes vinculados. B04–B09 implementam catálogo, treinos versionados, observações, registro de sessões, histórico, progresso, conquistas e seed fictício.

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

Rotas B04–B06 registradas sob `/api/v1`:

- `GET /exercises` e `GET /exercises/{exercise_id}`
- `POST` e `GET /patients/{patient_id}/workouts`
- `GET` e `PATCH /workouts/{workout_id}`
- `POST /workouts/{workout_id}/publish` e `/archive`
- `GET /me/workouts`
- `POST` e `GET /patients/{patient_id}/notes`
- `PATCH /notes/{note_id}`

Rotas B07 registradas sob `/api/v1`:

- `POST /me/sessions`

Rotas B08 registradas sob `/api/v1`:

- `GET /me/sessions` e `GET /me/sessions/{session_id}`
- `GET /patients/{patient_id}/sessions`
- `GET /patients/{patient_id}/sessions/{session_id}`
- `GET /me/progress` e `GET /patients/{patient_id}/progress`

Execute `alembic upgrade head` para criar as tabelas B04–B07. O catálogo
permanece vazio até aprovação da definição clínica do primeiro exercício;
nenhuma fixture é seed de produção. Contratos de parâmetros clínicos ainda não
aprovados são bloqueados. Consulte [treinos e observações](../docs/modules/workouts.md).
O contrato de sessões está em [registro de sessões](../docs/modules/sessions.md).
O contrato de histórico e progresso está em [resultados e progresso](../docs/modules/progress.md).
O contrato de conquistas e seed está em [resultados e conquista](../docs/modules/results.md).

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

O teste PostgreSQL opcional é ativado por `FISIOMOVE_TEST_POSTGRES_URL`, apontando
para servidor exclusivo de testes com permissão de criar bancos. Ele cria e
remove seu próprio banco temporário e valida migrações, API e concorrência.
Sem a variável, o teste PostgreSQL é ignorado; SQLite continua sendo executado.

## Seed fictício de demonstração (B09)

Depois das migrações, defina `DEMO_PRO_EMAIL`, `DEMO_PRO_PASSWORD`,
`DEMO_MARIA_EMAIL`, `DEMO_MARIA_PASSWORD`, `DEMO_ANA_EMAIL` e `DEMO_ANA_PASSWORD`
no ambiente local e execute `python -m scripts.seed_demo`. O seed é idempotente,
recusa produção, deixa Ana sem sessões e identifica o resultado fictício de Maria.
