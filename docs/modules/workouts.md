# Treinos e observações — B04, B05 e B06

## Estado e dependências

B01–B03 estão na base develop d4ac402. Os módulos usam SQLAlchemy, sessões
transacionais, autenticação e vínculo existentes. Não há fixture de identidade
nem exercício fictício em produção. Não foi encontrado planejamento separado
no repositório/anexo; os requisitos fornecidos e docs/contracts/ foram usados.

O primeiro exercício depende de definição clínica aprovada (identificador,
código, nome, instruções, lados, versão e contrato de parâmetros). O catálogo
fica vazio até esse cadastro. Contratos de parâmetros não vazios falham com
409 parameter_contract_pending; parâmetros enviados sem suporte falham com
422 unsupported_parameters. Isso não é um validador clínico concluído.

Os routers estão implementados e testados com autenticação real, mas **não estão
registrados na aplicação de produção**. A Luma deve revisar e integrar os
patches de docs/integration/ e as migrações especificadas, sem usar create_all
em produção. Não foram alterados main, core, db, dependências, contratos,
migrações compartilhadas ou módulos das colegas. A suíte usa SQLite temporário;
a cadeia nova de migrações e os bloqueios concorrentes precisam de validação
no PostgreSQL após integração. Não há verificador de tipos configurado.

## Usar treinos e notas em conjunto

O profissional autenticado escolhe um paciente vinculado e consulta catálogo,
treinos e observações. A prescrição contém instruções e itens ordenados, com
lado, séries, repetições, descanso em milissegundos e orientações específicas.
A regra do exercício e seu snapshot ficam separados dos parâmetros prescritos.
As notas pertencem ao paciente, não a uma revisão: acompanham o cuidado sem
alterar o treino nem o snapshot de sessões passadas.

Criar e editar treino gera revisão nova. Publicar cria uma revisão identificada
por current_revision_id com published_at. Editar um publicado move o agregado
para draft até republicação. O paciente só consulta publicados, e arquivar não
apaga revisões. WorkoutService.published_snapshot é a interface autorizada para
B07 obter uma cópia da revisão publicada antiga; B07 decide a elegibilidade de
novas sessões. B06 não implementa sessões, histórico de sessões nem progresso.

Observações usam content não vazio e visibility explícita: patient_visible ou
professional_only. Autor e datas vêm do servidor. Profissionais vinculados
podem ler as notas, mas somente o autor ainda vinculado pode editar. O paciente
vê somente suas notas patient_visible; a filtragem ocorre antes de paginação e
contagem. Mudar visibilidade para professional_only remove imediatamente a nota
da consulta do paciente. Notas não oferecem exclusão nem edição por paciente.
A edição preserva autor e created_at; updated_at é atualizado em UTC.

PATCH aceita apenas campos conhecidos; omissão preserva valores. No treino,
null limpa apenas instructions/professional_guidance (este último dentro de um
item completo); items deve ser uma lista completa não vazia. Nas notas, null
não é aceito. As listas usam page >= 1 e page_size entre 1 e 100; página fora
do total retorna items vazio. Sem observações: items=[], total=0, pages=0.

## Verificação manual após integração pela Luma

1. Aplicar os patches de rotas e registro de modelos, gerar/revisar migrações
   conforme docs/integration/b04.md e b06.md, testar upgrade/downgrade e subir API.
2. Provisionar profissional e trocar senha; criar paciente/vínculo e acesso
   pelas rotas B02/B03. Cadastrar somente exercício aprovado no catálogo.
3. GET /api/v1/exercises e /api/v1/exercises/{id}. Sem definição aprovada,
   verificar apenas lista vazia; não inserir o exercício usado nos testes.
4. POST /api/v1/patients/{id}/workouts com instructions e items. Cada item exige
   position, exercise_id, side, sets, repetitions, rest_duration_ms; parameters
   é objeto (vazio para o único formato estrutural hoje suportado).
5. PATCH /api/v1/workouts/{id}; POST /api/v1/workouts/{id}/publish. Conferir como
   paciente em GET /api/v1/me/workouts e GET /api/v1/workouts/{id}.
6. POST /api/v1/patients/{id}/notes com
   {"content":"Orientação compartilhada","visibility":"patient_visible"}; criar
   outra professional_only. GET no mesmo caminho deve mostrar ambas ao autor
   e somente a primeira ao paciente. PATCH /api/v1/notes/{id} edita pelo autor.
7. Repetir leitura/edição com profissional sem vínculo e paciente alheio:
   esperar 404. Paciente nas mutações: 403. Outro profissional vinculado tentando
   editar nota: 403 note_author_required. Autor após revogação do vínculo: 404.
8. Editar treino publicado: confirmar draft oculto ao paciente e revisão antiga
   preservada; republicar e arquivar via POST /api/v1/workouts/{id}/archive.
   GET /api/v1/me/workouts não deve mais oferecer o treino arquivado.

## Validação automatizada

Executar no backend com Python >= 3.12: ruff check ., ruff format --check .,
pytest. Os testes em tests/workouts/ registram os três routers explicitamente
em uma aplicação isolada, criam dados fictícios apenas no banco temporário e
usam tokens reais de B02 e vínculos persistidos de B03. Isso verifica integração
com autenticação/vínculo, mas não registro de rotas ou migrações em produção.

Para integrar todas as tarefas juntas, a proposta consolidada é
[../integration/b04-b06-integration.patch](../integration/b04-b06-integration.patch).
Ela substitui os patches individuais de rotas/registro de modelos. A Luma deve
revisar as migrações separadamente conforme as especificações B04 e B06.
