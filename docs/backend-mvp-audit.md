# Auditoria de conclusão do backend do MVP

Data da auditoria: 24/10/2026. Base analisada: `develop` após o merge do PR #3.
Fontes: Documento de Visão, Relatório de Viabilidade, Plano de Desenvolvimento,
contratos versionados e implementação/testes do repositório.

Quando os documentos divergem, esta auditoria segue a regra do Plano de
Desenvolvimento: priorizar o núcleo incremental da Viabilidade, com um exercício
antes de voz, segundo exercício ou gamificação adicional.

## Rastreabilidade

| Requisito | Classificação | Evidência/decisão no backend |
| --- | --- | --- |
| Autenticação, perfis e senha temporária | Implementado e validado | B02, rotas `/auth/*`, tokens rotativos/revogáveis e testes de acesso |
| Pacientes e vínculo profissional | Implementado e validado | B03, autorização por vínculo, desativação sem apagar histórico |
| Catálogo limitado e treinos versionados | Implementado parcialmente | B04–B05 estão prontos; uso real depende do primeiro exercício aprovado |
| Evidência de aprovação clínica | Implementado nesta entrega | Estado por versão, responsável, data, documento e eventos append-only; sem rota pública |
| Observações com privacidade | Implementado e validado | B06 filtra `professional_only` antes de paginação e contagem |
| Sessões derivadas e idempotentes | Implementado e validado | B07, snapshot histórico, retry concorrente e revisão vigente no início |
| Histórico e progresso | Implementado e validado | B08, período, paginação, isolamento e estados vazios |
| Conquista por meta exata | Implementado e validado | B09, `session_goal_reached`, sem recompensa por excesso |
| Pontuação básica individual | Implementado nesta entrega | B10: um ponto por repetição aceita, limitado à prescrição, consultado em sessão/progresso |
| Calibração individual | Responsabilidade do mobile | M06 executa e persiste localmente; backend fornece snapshot/versão e rejeita objeto arbitrário |
| Câmera, pose, contagem e feedback em tempo real | Responsabilidade do mobile | M05–M07; nenhum endpoint de upload de mídia |
| Primeiro movimento e desvio observável | Dependente de aprovação clínica | Não há exercício, parâmetros, fases ou texto corretivo aprovados nos documentos |
| Comando de voz | Fora do núcleo do MVP | Plano classifica como etapa adicional após validação do núcleo |
| Segundo exercício | Fora do núcleo do MVP | Requer nova prova de observabilidade e validação profissional |
| Rankings e competição entre pacientes | Fora do MVP | Explicitamente excluídos por risco de incentivo inadequado |
| Níveis, desafios e conquistas adicionais | Fora do MVP | Documento de Visão/Plano classificam como evolução posterior |
| Retenção e exclusão de dados reais | Dependente de política institucional | MVP preserva histórico; prazo, base legal e procedimento de exclusão exigem decisão ética/LGPD antes de automação destrutiva |

## Decisões desta entrega

### Pontuação

O servidor calcula e persiste `score`; o cliente não o informa. Cada repetição
válida vale um ponto até o máximo do item prescrito. Essa regra usa somente
dados já aceitos por B07, não contém parâmetro clínico e não incentiva excesso.
Retry retorna a mesma sessão. O valor histórico acompanha o snapshot usado.

### Calibração

Não foi criada persistência remota. Os documentos colocam calibração e regras no
dispositivo e o backend recebe o resumo. Persistir um objeto genérico no servidor
sem contrato do exercício ampliaria a superfície de dados e permitiria tentar
contornar parâmetros profissionais. O contrato local está em
`docs/modules/calibration.md`.

### Catálogo clínico

`is_active` deixou de ser suficiente. Um exercício só pode ser listado e usado
em nova prescrição quando a versão atual possui evidência `approved`. Mudança de
regra invalida a aprovação anterior; revogação bloqueia uso futuro sem alterar
snapshots ou sessões passadas. A infraestrutura não aprova nenhum exercício e
não decide a validade clínica do documento registrado.

## Limites da validação

A API verifica autorização, consistência, limites prescritos, idempotência e
integridade do histórico. Resultados enviados pelo dispositivo não provam que o
movimento ocorreu nem demonstram benefício terapêutico. Testes com pessoas e
dados reais dependem da orientadora, do protocolo institucional e das medidas
éticas aplicáveis.
