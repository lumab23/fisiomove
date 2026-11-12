# Estabilidade e validação do backend — 31/10/2026

## Correções implementadas

- Sessões SQLAlchemy confirmam a transação **antes** de enviar sucesso HTTP,
  utilizando `Depends(get_db_session, scope="function")`. Falhas de conexão,
  timeout do pool e erros operacionais retornam `503 database_unavailable`, sem
  expor SQL/parâmetros, com `Retry-After: 1`. A fila deve repetir o mesmo UUID e
  conteúdo, pois uma queda durante commit pode ter resultado indeterminado.
- Pool PostgreSQL com pré-verificação, reciclagem, tamanho/overflow/espera
  configuráveis. Conexões têm timezone UTC e limites de conexão, statement e lock.
  API e job de migração compartilham os parâmetros de `Settings`.
- Em produção, debug/echo SQL e chave-placeholder são recusados. Falhas de
  configuração não imprimem os valores dos campos sensíveis.
- Login, renovação e redefinição de senha usam ordem de lock **conta → tokens**.
  Leituras após espera atualizam o identity map. Uma renovação não pode deixar
  credencial ativa depois da redefinição. Login de e-mail desconhecido também
  executa Argon2 para reduzir diferença de tempo por existência da conta.
- JWT mantém algoritmo HS256 fixo, emissor/audiência/expiração obrigatórios,
  versão positiva inteira, JTI UUID, tipos e datas válidos. Tokens inválidos
  retornam 401; perfil, conta ativa e troca obrigatória seguem verificados no banco.
- Sessões preservam a unicidade `(patient_id, client_session_id)`, hash canônico,
  savepoint e snapshot histórico. Retries idênticos retornam o mesmo registro;
  conteúdo divergente retorna `409 idempotency_conflict`, inclusive em concorrência.
  Conquistas e pontuação não são duplicadas. Valores JSON não finitos e booleanos
  textuais são recusados antes da gravação, com 422.
- Logs de aplicação são JSON com ID próprio de requisição, método, rota parametrizada,
  status e duração. Não contêm corpos, query strings, tokens, senhas ou parâmetros SQL.
  Respostas recebem `X-Request-ID`, `Cache-Control: no-store` e `nosniff`.

## Banco e migrações

Nenhuma revisão aplicada foi reescrita. O head continua `20261024_0009`; não houve
necessidade de modificar o schema. `scripts/migrate.py` usa uma conexão partilhada
com Alembic e advisory lock PostgreSQL entre migradores, executa `upgrade head`
e `alembic check`. Dois jobs concorrentes foram testados no PostgreSQL real.

`GET /health` verifica o processo. `GET /ready` exige banco acessível e Alembic no
head esperado. Produção recusa inicialização com migrações pendentes; o processo
web não executa migrações implicitamente. O Compose ordena banco saudável → job de
migração concluído → API. Para futuras mudanças, criar uma nova revisão, nunca
alterar `0001`–`0009` já aplicadas.

As fixtures de autenticação, pacientes, treinos, sessões, progresso e conquistas
agora usam bancos PostgreSQL descartáveis quando `FISIOMOVE_TEST_POSTGRES_URL`
está definida. Cada teste cria um banco `fisiomove_test_<uuid>`, aplica as migrações
e remove somente esse banco. O banco administrativo da URL não é migrado/apagado.
O usuário de testes precisa de `CREATEDB`. Testes específicos de SQLite permanecem
como testes unitários desse adaptador; não substituem os testes de negócio PostgreSQL.

## Execução reproduzível

Em `backend/`, com Python 3.12+:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
docker compose --env-file /dev/null -f compose.test.yaml up -d --wait
export FISIOMOVE_TEST_POSTGRES_URL=postgresql+psycopg://fisiomove_test@127.0.0.1:55432/postgres
ruff check .
ruff format --check .
pytest
docker compose --env-file /dev/null -f compose.test.yaml down
```

O Compose de testes usa autenticação `trust`, somente em loopback, armazenamento
volátil e projeto separado. Não serve para produção. Sem a variável PostgreSQL,
a suíte rápida usa SQLite e ignora apenas testes que dependem de PostgreSQL real.
O workflow `.github/workflows/backend.yml` executa a suíte com um serviço PostgreSQL.

## Preparar a implantação

1. Copiar `backend/.env.example` para `backend/.env` e substituir credenciais e
   `AUTH_SECRET_KEY` (gerar com `secrets.token_urlsafe(48)`). Manter `.env` fora do Git.
2. Para Compose, `POSTGRES_*` e `DOCKER_DATABASE_URL` devem apontar às mesmas
   credenciais; o host da URL é `db`. Codificar caracteres especiais da senha na URL.
   Para rodar fora dos containers, `DATABASE_URL` usa o host/porta reais.
3. Executar `docker compose up --build -d`. O banco não publica porta; a API publica
   somente `127.0.0.1:8000`. O volume PostgreSQL é persistente; não usar `down -v`
   em bases que devam ser preservadas.
4. Terminar TLS num proxy confiável e configurar `FORWARDED_ALLOW_IPS` com o IP/CIDR
   desse proxy. Não há domínio/certificado real configurado nesta entrega. Para
   PostgreSQL remoto, configurar TLS com `sslmode=verify-full` e certificado da CA.
5. Ajustar os limites de pool ao número de workers: `workers × (size + overflow)`
   mais conexões administrativas deve caber em `max_connections`. Statements
   longos de migração podem exigir `DB_STATEMENT_TIMEOUT_MS` maior no job.
6. Validar `/ready` e a origem HTTPS efetiva antes de liberar tráfego real.

## URL pública no mobile

`mobile/.env` aceita somente a configuração pública a ser embutida:

```dotenv
FISIOMOVE_API_ORIGIN=https://api.seu-dominio.example
```

É uma **origem**, sem `/api/v1`, credenciais, query ou fragmento. A variável do
processo de build tem precedência sobre o arquivo. O plugin Babel local injeta só
essa chave; outros segredos do `.env` não entram no bundle. Reiniciar Metro com
`npm start -- --reset-cache` e reconstruir o app depois de alterar a origem.
React Native não lê o `.env` do servidor em tempo de execução: mudanças posteriores
exigem um novo bundle. Release falha sem origem ou com HTTP. O domínio acima é
ilustrativo e precisa ser substituído pelo endereço real de Amanda.

## Evidência e limites

A validação local usa PostgreSQL **15.18** em instância temporária isolada,
Python 3.12 e dependências declaradas no projeto. Não usa o banco do `.env` pessoal.
O daemon Docker estava parado; foram validadas as configurações Compose, mas não
foi construída/executada a imagem Docker neste ambiente. O CI foi criado, mas sua
execução hospedada depende de commit/push posterior. Não houve deploy, alteração
clínica ou inserção de fixtures no catálogo de produção.

A suíte emite um aviso de depreciação do adaptador `httpx` no Starlette instalado;
isso não é uma falha de teste. Não foi ocultado nem foi trocada uma dependência
fora do escopo para mascarar o aviso. Os resultados finais ficam registrados abaixo.

## Referências técnicas

- [FastAPI: encerramento de dependências antes da resposta](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/).
- [SQLAlchemy: desconexões e limites de recuperação do pool](https://docs.sqlalchemy.org/en/20/faq/connections.html).
- [Alembic: conexão compartilhada e comparação de migrações](https://alembic.sqlalchemy.org/en/latest/cookbook.html).

### Resultado final

- Backend: **134 testes aprovados**, **0 falhas**, **0 erros**, **0 ignorados**,
  em PostgreSQL 15.18 real; duração registrada: 45,681 s. Evidência JUnit:
  [`backend-postgresql-results.xml`](backend-postgresql-results.xml).
- SQLAlchemy 2.1.6, psycopg 3.3.6, FastAPI 0.141.1 e Pydantic 2.14.2.
- Ruff: lint e formatação aprovados. Nenhuma revisão aplicada foi alterada e a
  comparação schema/modelos não detectou diferenças.
- Mobile: **70 testes aprovados**; TypeScript, ESLint e Prettier dos arquivos
  alterados aprovados. O módulo de configuração real foi compilado e executado
  com `__DEV__=false`: aceita HTTPS injetado, recusa HTTP e recusa origem ausente.
- Compose de teste e produção validados pelo CLI com `config --quiet` (sem build).
- Nenhum banco descartável permaneceu após os testes; o servidor temporário foi
  encerrado. O banco e as credenciais pessoais do projeto não foram utilizados.
