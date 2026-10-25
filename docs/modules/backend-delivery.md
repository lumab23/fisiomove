# Entrega de backend — integração B04–B06

A entrega inicial separou implementação e patches conforme os limites do pedido.
Em 20/10/2026, Amanda autorizou concluir os arquivos compartilhados e integrar
na develop. Agora os routers/modelos estão registrados, há migrações executáveis
e os testes usam a aplicação real com banco migrado.

## Commits anteriores

- B04: 1f02ab3, branch featAmanda/b04-workouts.
- B05: f22c301, branch featAmanda/b05-workout-management (inclui B04).
- B06: 9e22b3e, branch featAmanda/b06-notes (inclui B04/B05).
- A integração adicional está no commit seguinte da branch B06; consultar git log.

## Integração adicional

- backend/app/api/router.py: registro efetivo dos três routers.
- backend/app/db/models.py: registro de Exercise, Workout, WorkoutRevision,
  WorkoutItem e Note para metadados/Alembic.
- backend/migrations/versions/20261020_0004_workouts.py: catálogo, agregados,
  revisões, itens, índices, checks e FK cíclica compatível com PostgreSQL/SQLite.
- backend/migrations/versions/20261020_0005_notes.py: notas e suas constraints.
- backend/tests/workouts/conftest.py: aplicação real e Alembic upgrade head.
- backend/tests/test_migrations.py: upgrade, metadados sem diff, downgrade/reupgrade.
- backend/tests/test_postgresql_integration.py: banco descartável PostgreSQL,
  login real, acesso de paciente/troca de senha, API de treinos/notas,
  privacidade, duas edições concorrentes, snapshot antigo e downgrade completo.
- Documentação atualizada; patches antigos removidos porque já foram aplicados.

## Validação

Python 3.12.15. Ruff lint e formatação aprovados. Suíte final completa:
79 testes passaram, incluindo a integração PostgreSQL (nenhum ignorado).
PostgreSQL 15 isolado em /private/tmp: migração B03 -> head, comparação de
metadados sem diff, downgrade com dados -> B03, reupgrade e downgrade até base
aprovados. Fluxo HTTP e revisões concorrentes aprovados. O aviso de depreciação
Starlette/httpx permanece sem afetar o resultado. Nenhuma dependência alterada.
Não há verificador de tipos configurado.

Repetir em backend: `ruff check .`, `ruff format --check .` e `pytest`.
Para incluir o teste PostgreSQL, definir FISIOMOVE_TEST_POSTGRES_URL apontando
para servidor de testes exclusivo; a fixture cria/remove banco próprio.

## Pendência clínica explícita

Não existe definição aprovada do primeiro exercício nem do formato versionado
de parâmetros. O catálogo de produção fica vazio e contratos não vazios falham
fechados até aprovação e implementação de seu validador. Não foram inventados
exercícios, limites, ângulos ou regras clínicas. Isso impede declarar o catálogo
clínico completo; não impede executar a API e suas migrações.

Nenhuma integração de routers/modelos/migrações daquela entrega permaneceu para
a Luma aplicar. Sessões, progresso e conquistas foram implementados depois, nas
entregas B07-B09; a pontuação individual foi acrescentada na finalização técnica
do MVP. Mobile, câmera e calibração em tempo real continuam fora do backend.
Ver [workouts.md](workouts.md) para o estado atual e o roteiro manual.
