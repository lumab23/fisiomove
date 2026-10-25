# Backend do FisioMove

API FastAPI com PostgreSQL, SQLAlchemy, Alembic, autenticação de contas e gestão de pacientes vinculados. B04–B09 implementam catálogo, treinos versionados, observações, registro de sessões, histórico, progresso, conquistas e seed fictício. A conclusão técnica do MVP acrescenta pontuação individual e governança auditável do catálogo, sem transferir visão computacional ou calibração para o servidor.

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

Rotas B09 registradas sob `/api/v1`:

- `GET /me/achievements`
- `GET /patients/{patient_id}/achievements`

As rotas existentes de sessões e progresso também retornam `score`. Não existe
endpoint de pontuação separado: o paciente consulta sua sessão/progresso, e o
profissional usa as rotas equivalentes do paciente vinculado.

Execute `alembic upgrade head` para criar todas as tabelas. As revisões
`20261024_0008` e `20261024_0009` adicionam, respectivamente, pontuação de
sessões e governança do catálogo. O catálogo
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
remove seu próprio banco temporário e valida migrações, downgrade/reupgrade,
transações, API, isolamento e concorrência de treinos e sessões.
Sem a variável, o teste PostgreSQL é ignorado; SQLite continua sendo executado.

Exemplo com um servidor PostgreSQL de teste local, sem reutilizar o banco de
desenvolvimento:

```bash
export FISIOMOVE_TEST_POSTGRES_URL='postgresql+psycopg://usuario@127.0.0.1:5432/postgres'
pytest -q -rs tests/test_postgresql_integration.py
```

A conta informada precisa poder criar bancos. A fixture usa um nome aleatório e
remove apenas o banco que ela própria criou; nunca aponte a variável para um
servidor de produção.

## Seed fictício de demonstração (B09)

Depois das migrações, defina `DEMO_PRO_EMAIL`, `DEMO_PRO_PASSWORD`,
`DEMO_MARIA_EMAIL`, `DEMO_MARIA_PASSWORD`, `DEMO_ANA_EMAIL` e `DEMO_ANA_PASSWORD`
no ambiente local e execute `python -m scripts.seed_demo`. O seed é idempotente,
recusa produção, deixa Ana sem sessões e identifica o resultado fictício de Maria.
Ela não cria exercício: exige um registro ativo com contrato de parâmetros
vazio. O operador deve disponibilizar somente um exercício aprovado para a
demonstração; na ausência dele, o seed falha sem inventar dados clínicos.

## Integração do mobile

O mobile deve persistir localmente, antes de iniciar uma execução,
`client_session_id`, `workout_id`, `workout_revision_id` e `started_at`. Um
upload atrasado é aceito somente se a revisão estava vigente nesse horário e é
validado contra o snapshot histórico, mesmo após edição ou arquivamento. Consulte
[`docs/modules/sessions.md`](../docs/modules/sessions.md) para idempotência e
erros que precisam de tratamento explícito.

A pontuação é calculada pelo servidor: um ponto por repetição aceita, limitada
à prescrição de cada item. O mobile não envia `score`. Repetições acima do plano
são rejeitadas e retries não geram novos pontos.

A calibração permanece no motor local do mobile, conforme o plano de
desenvolvimento. O backend fornece revisão, `rule_version`, parâmetros e
snapshot do exercício; não recebe imagens, landmarks nem um objeto arbitrário
de calibração. O contrato de armazenamento local e invalidação está em
[`docs/modules/calibration.md`](../docs/modules/calibration.md).

## Governança do catálogo

`is_active` não significa aprovação clínica. Somente exercícios com
`approval_status=approved` e `approved_rule_version` igual à versão atual são
listados e aceitos em novos treinos. Aprovação e revogação deixam eventos
imutáveis em `exercise_approval_events`; não existe rota pública para registrar
essas decisões. A infraestrutura registra evidência, mas não substitui a
política institucional nem a validação efetiva do fisioterapeuta.
