# Resultados e conquista simples (B09)

Uma sessão concluída recebe `session_goal_reached` quando cada item da revisão
imutável tem exatamente os sets e repetições prescritos. Sessões interrompidas não
recebem essa conquista. A unicidade por paciente, sessão e código torna retries
idempotentes. A conquista é criada na mesma transação do resultado da sessão.

O paciente autenticado consulta `GET /api/v1/me/achievements`. Um fisioterapeuta
autenticado consulta `GET /api/v1/patients/{patient_id}/achievements` somente para
pacientes com vínculo ativo.

## Pontuação individual (B10)

Cada resultado persistido recebe `score`, calculado pelo servidor como um ponto
por repetição aceita, limitado ao total prescrito de cada item no snapshot. O
cliente não envia esse campo. Uma sessão interrompida recebe apenas os pontos
das repetições parciais; uma concluída recebe a meta completa porque resultados
incompletos são rejeitados para esse estado.

Repetições acima da prescrição retornam `422 session_result_exceeds_plan` e não
geram pontos. Retry idêntico devolve a mesma sessão e o mesmo valor. A pontuação
fica no histórico da sessão mesmo se o treino for editado ou arquivado. Não há
ranking, competição, bônus clínico, multiplicador ou inferência de recuperação.

O paciente e o profissional consultam `score` nas rotas existentes de sessão,
histórico e progresso. `ProgressSummary.score` soma somente as sessões do
período autorizado.

## Dados fictícios de demonstração

Em ambiente local ou de teste, depois de `alembic upgrade head`, execute
`python -m scripts.seed_demo` no diretório `backend`. O seed exige
`DEMO_PRO_EMAIL`, `DEMO_PRO_PASSWORD`, `DEMO_MARIA_EMAIL`, `DEMO_MARIA_PASSWORD`,
`DEMO_ANA_EMAIL` e `DEMO_ANA_PASSWORD`. Nenhuma senha é definida no código. O seed
recusa `APP_ENV=production`, usa os serviços públicos de provisionamento e é
idempotente.

Maria recebe um resultado de demonstração identificado no treino e no resumo da
sessão. O seed não cria exercício: exige que o ambiente não produtivo já possua
um exercício ativo, aprovado para a versão atual e com contrato de parâmetros
vazio; o operador é responsável
por usar somente um registro aprovado para a demonstração. Se não houver, o
seed falha com mensagem explicativa. O exercício
`fictional-test-only` da suíte automatizada não deve ser usado. Ana é criada sem
sessões. Os dados são fictícios e não constituem prescrição ou orientação clínica.
