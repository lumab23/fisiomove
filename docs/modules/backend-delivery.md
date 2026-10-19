# Entrega de backend — Amanda (B04–B06)

## Branches e bases de PR

| Tarefa | Branch | Commit | Base do PR enquanto a anterior não foi integrada |
| --- | --- | --- | --- |
| B04 | featAmanda/b04-workouts | 1f02ab3 | develop |
| B05 | featAmanda/b05-workout-management | f22c301 | featAmanda/b04-workouts |
| B06 | featAmanda/b06-notes | consultar git log -1 na branch | featAmanda/b05-workout-management |

Depois que a dependência entrar em develop, atualizar a base do PR seguinte
para develop e verificar o diff antes de integrar. Nenhum push ou merge commit
foi feito. develop foi criada acompanhando origin/develop em d4ac402, sem
commits de implementação nela; ahead/behind verificado: 0/0. A branch B04 já
existia no commit inicial sem trabalho local, e recebeu fast-forward até a base.
B05 e B06 foram criadas em sequência após commit da tarefa anterior.

## Implementação e validação

B04: catálogo autenticado paginado/detalhe; modelos persistidos de exercícios,
workouts, revisões e itens; DTOs estritos; ordem contígua; rejeição de exercício
desconhecido/inativo, lado inválido e parâmetros sem suporte; versão/snapshot
da regra separados da prescrição. Nenhum exercício de produção inventado.

B05: rascunho, consulta, edição, publicação, arquivamento e lista do paciente.
Autenticação B02 e vínculo B03 reais. Revisões append-only no serviço, bloqueio
do agregado nas mutações, snapshot publicado autorizado para integração B07.
Edição de publicado retorna a draft até nova publicação. Arquivar retém tudo.

B06: criação, leitura paginada e edição de observações; autor e datas do
servidor; autor vinculado é o único editor. Notas privadas são filtradas antes
da paginação e contagem; paciente recebe apenas suas notas visíveis. Estados
vazios e datas UTC testados. Documentação conjunta: workouts.md.

Comandos realmente executados em backend com Python 3.12.15:

- ruff check . — aprovado em cada etapa final.
- ruff format --check . — aprovado em cada etapa final.
- pytest — B04: 51 passed; B05: 59 passed; B06: 77 passed.
- git diff --check — aprovado.
- git apply --check nos patches propostos — aprovado; patch consolidado aplicado
  em cópias temporárias e validado por Ruff (lint e formato).

A suíte emite um aviso de depreciação de Starlette/TestClient com httpx; os testes
passam. Nenhuma dependência foi alterada para suprimir o aviso. Não há comando
ou configuração de verificação estática de tipos no projeto. Não foi executado
teste PostgreSQL. O ambiente foi criado em /private/tmp/fisiomove-venv, sem
refazer setup do repositório nem alterar pyproject.toml. Para repetir:

```sh
cd backend
/private/tmp/fisiomove-venv/bin/ruff check .
/private/tmp/fisiomove-venv/bin/ruff format --check .
/private/tmp/fisiomove-venv/bin/pytest
```

## Critérios pendentes

- Não há planejamento separado nem definição clínica aprovada do exercício
  inicial. Catálogo/validação clínica não estão completos sem essa definição.
- O formato versionado de parâmetros ainda precisa ser definido e ter validador
  aprovado. Contratos não vazios falham fechados; valores clínicos não são
  inferidos nem aceitos como se estivessem validados.
- Luma deve integrar o patch consolidado ../integration/b04-b06-integration.patch
  (alternativo aos patches individuais), registrar modelos e routers, criar
  migrações segundo ../integration/b04.md e ../integration/b06.md e validar
  upgrade/downgrade/concorrência no PostgreSQL. As migrações são especificações,
  não revisões já aplicadas. As rotas ainda não aparecem no app/OpenAPI padrão.
- Autenticação e vínculo foram exercitados em aplicação isolada com persistência
  SQLite e tokens reais; isso não representa integração em produção.
- Não foram implementados sessões, progresso, conquistas, mobile ou câmera.

A sequência de verificação manual e os formatos de payload estão em
[workouts.md](workouts.md). Enquanto faltar o exercício aprovado, a verificação
manual do catálogo deve resultar em lista vazia; os dados fictícios dos testes
não são seeds.

## Arquivos por tarefa

### B04

- `backend/app/modules/exercises/__init__.py`
- `backend/app/modules/exercises/models.py`
- `backend/app/modules/exercises/router.py`
- `backend/app/modules/exercises/schemas.py`
- `backend/app/modules/exercises/services.py`
- `backend/app/modules/workouts/__init__.py`
- `backend/app/modules/workouts/models.py`
- `backend/app/modules/workouts/prescriptions.py`
- `backend/app/modules/workouts/schemas.py`
- `backend/tests/workouts/conftest.py`
- `backend/tests/workouts/test_catalog_model.py`
- `docs/integration/b04-routing.patch`
- `docs/integration/b04.md`

### B05

- `backend/app/modules/workouts/router.py`
- `backend/app/modules/workouts/schemas.py`
- `backend/app/modules/workouts/services.py`
- `backend/tests/workouts/conftest.py`
- `backend/tests/workouts/test_management.py`
- `docs/integration/b04-routing.patch`
- `docs/integration/b05-routing.patch`
- `docs/integration/b05.md`

### B06

- `backend/app/modules/notes/__init__.py`
- `backend/app/modules/notes/models.py`
- `backend/app/modules/notes/router.py`
- `backend/app/modules/notes/schemas.py`
- `backend/app/modules/notes/services.py`
- `backend/tests/workouts/conftest.py`
- `backend/tests/workouts/test_notes.py`
- `docs/integration/b04-b06-models.patch`
- `docs/integration/b04-b06-integration.patch`
- `docs/integration/b06-routing.patch`
- `docs/integration/b06.md`
- `docs/modules/workouts.md`
- `docs/modules/backend-delivery.md`
