# Backend do FisioMove

API FastAPI com PostgreSQL, SQLAlchemy, Alembic, autenticação de contas e gestão de pacientes vinculados. B04–B09 implementam catálogo, treinos versionados, observações, registro de sessões, histórico, progresso e seed fictício (conquistas foram removidas pela DEC-007). A conclusão técnica do MVP acrescenta pontuação individual e governança auditável do catálogo, sem transferir visão computacional ou calibração para o servidor.

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
- `EXERCISE_LIBRARY_*`: habilitação, URLs HTTPS, timeout e cache da biblioteca externa de referência; sem chave (ver [`exercise-library.md`](../docs/contracts/exercise-library.md)).

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

## Fisioterapeutas adicionais

Não existe cadastro público. Outros fisioterapeutas são criados localmente:

```bash
python -m app.modules.auth.cli add-physiotherapist \
  --email outro.profissional@example.com
```

A senha temporária (12 a 128 caracteres) é pedida de forma oculta e confirmada; a conta exige troca no primeiro acesso. E-mail já usado por qualquer conta é recusado. Cada fisioterapeuta só vê os pacientes que ele próprio cadastrou (vínculo ativo).

Paciente que esqueceu a senha pede uma nova ao fisioterapeuta, que usa `POST /api/v1/patients/{id}/access` com `{"operation":"reset_temporary_password"}`. Não há recuperação de senha do fisioterapeuta pelo app.

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

Perfil do fisioterapeuta (somente nome), sob `/api/v1`:

- `GET` e `PUT /me/physiotherapist-profile` (fisioterapeuta)
- `GET /me/physiotherapist` (paciente; nome do profissional vinculado ou `null`)

Contrato em [`physiotherapist-profile.md`](../docs/contracts/physiotherapist-profile.md).

Biblioteca externa de referência (OpenExerciseBase, CC BY-NC 4.0), só para
fisioterapeuta, consultada ao vivo:

- `GET /exercise-library` e `GET /exercise-library/{external_id}` (só leitura;
  o detalhe informa `catalog_exercise`)
- `POST /exercise-library/{external_id}/catalog` com `{ "allowed_sides": [...] }`
  (DEC-006, uso acadêmico)

Consultar não altera `/exercises`. A rota `POST` busca o item no provedor e o
adiciona ao catálogo com nome e instruções originais, lados escolhidos pelo
fisioterapeuta, `supported_parameters = {}`, `rule_version` sem regra de câmera,
proveniência e aprovação registrada em nome dele (evento append-only). É
idempotente (`201` cria, `200` existente). Séries, repetições e descanso
continuam definidos pelo fisioterapeuta em cada treino. Contrato em
[`exercise-library.md`](../docs/contracts/exercise-library.md).

Na adição, até 6 imagens da fonte (PNG/JPEG/WebP, até 2 MiB cada, só da pasta
`images/{id}/` do provedor) são copiadas para `exercise_images` (DEC-010);
imagem inválida ou indisponível é pulada e registrada em log, sem falhar a
adição. O corpo também aceita `name_pt_br` e `instructions_pt_br` (ambos ou
nenhum, DEC-011). Rotas do catálogo relacionadas, sob `/api/v1`:

- `GET /exercises/{exercise_id}/images/{position}` (qualquer conta autenticada;
  bytes com `Cache-Control: private, max-age=86400`)
- `PUT /exercises/{exercise_id}/localization` com
  `{ "name": "...", "instructions": ["...", "..."] }` (qualquer fisioterapeuta;
  não altera `rule_version` nem aprovação)

Para copiar as imagens dos exercícios adicionados antes da migração
`20261106_0013` (só os que não têm nenhuma imagem; idempotente; não mexe em
nome, texto, lados, tradução ou aprovação):

```bash
python -m app.modules.exercise_library.cli backfill-images
```

O comando usa `DATABASE_URL` e as variáveis `EXERCISE_LIBRARY_*`, grava um
exercício por transação e termina com código `1` se o provedor ficou
indisponível para algum item (basta repetir).

As rotas existentes de sessões e progresso também retornam `score`. Não existe
endpoint de pontuação separado: o paciente consulta sua sessão/progresso, e o
profissional usa as rotas equivalentes do paciente vinculado.

Execute `alembic upgrade head` para criar todas as tabelas. As revisões
`20261024_0008` e `20261024_0009` adicionam, respectivamente, pontuação de
sessões e governança do catálogo; `20261106_0010` cria `physiotherapist_profiles`
sem preencher dados; `20261106_0011` remove `achievements` (o downgrade recria a
tabela vazia); `20261106_0012` adiciona a proveniência anulável em `exercises`;
`20261106_0013` cria `exercise_images` e `20261106_0014` adiciona a tradução
pt-BR anulável em `exercises`, ambas sem preencher dados.
Nenhuma migração ou fixture cadastra exercício: o catálogo só recebe itens da
biblioteca adicionados pelo fisioterapeuta (DEC-006). Contratos de parâmetros
clínicos ainda não aprovados são bloqueados. Consulte [treinos e observações](../docs/modules/workouts.md).
O contrato de sessões está em [registro de sessões](../docs/modules/sessions.md).
O contrato de histórico e progresso está em [resultados e progresso](../docs/modules/progress.md).
A pontuação e o seed estão em [resultados](../docs/modules/results.md).

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

A variável `FISIOMOVE_TEST_POSTGRES_URL` ativa PostgreSQL real para todas as
fixtures de negócio (autenticação, pacientes, treinos, sessões, progresso e
catálogo), além dos testes de concorrência e migrações. Cada teste cria um banco
descartável e aplica Alembic até o head. Sem a variável, o modo rápido usa SQLite
e ignora somente os testes que exigem PostgreSQL real.

Exemplo com um servidor PostgreSQL de teste local, sem reutilizar o banco de
desenvolvimento:

```bash
export FISIOMOVE_TEST_POSTGRES_URL='postgresql+psycopg://usuario@127.0.0.1:5432/postgres'
pytest -q -rs
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
imutáveis em `exercise_approval_events`. A única rota que registra aprovação é
`POST /exercise-library/{external_id}/catalog` (DEC-006): nela, "aprovado"
significa "escolhido pelo fisioterapeuta para uso acadêmico", não validação
clínica. Não há rota de revogação. A infraestrutura registra evidência, mas não
substitui a política institucional nem a validação efetiva do fisioterapeuta.

## Hardening, PostgreSQL e Docker

O [guia de produção e validação](../docs/validation/backend-production-hardening.md)
descreve o Compose, o banco de testes descartável, a fila offline e a injeção da
origem HTTPS no mobile. Para implantação, prefira `python -m scripts.migrate`
(advisory lock + upgrade + verificação de drift) antes de iniciar os workers.
`/health` verifica o processo; `/ready` também verifica banco e revisão Alembic.

## Desenvolvimento na rede local (iPhone físico)

Com PostgreSQL e migrações prontos, execute no ambiente virtual de `backend/`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0
```

Use `http://IP_DO_MAC:8000/health` no Safari do iPhone na mesma rede e configure
`FISIOMOVE_DEV_API_ORIGIN=http://IP_DO_MAC:8000` em `mobile/.env` (sem `/api/v1`).
Descubra o IP com `ipconfig getifaddr en0`. O firewall deve permitir a conexão;
redes com isolamento de clientes ou VPN podem impedir o acesso.

A aplicação atual não instala `TrustedHostMiddleware` nem `CORSMiddleware`,
portanto não há allowlist de hosts bloqueando o IP da LAN. O cliente HTTP nativo
React Native não depende de CORS do navegador; não é necessário liberar `*`.
Autenticação JWT e autorização continuam obrigatórias nas rotas protegidas.
Use essa escuta com `--reload` somente no desenvolvimento em rede de confiança.
Os passos de assinatura e execução estão em
[Rodar no iPhone físico](../mobile/README.md#rodar-no-iphone-físico).
