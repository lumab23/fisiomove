# Requisitos — estabilização M01/M02

Escopo exclusivo de Luma. Os módulos M03–M09 são tratados apenas por seus
contratos públicos. Nenhum requisito abaixo autoriza parâmetros clínicos,
captura de mídia ou implementação de telas de outras integrantes.

## LMI-01 — compatibilidade M07 → M02

- **Prioridade:** P0.
- **Justificativa:** M07 produz `SessionCompletion`; M02 é responsável por
  persistir e transmitir esse resultado sem alterar a identidade da sessão.
- **Dependências:** `SessionCompletion`, `SessionDraft` e DTO
  `SessionResultInput` existentes.
- **Pré-condições:** paciente autenticado e rascunho preparado por M02.
- **Pós-condições:** resultado sanitizado fica persistido antes de qualquer
  tentativa de rede; treino, revisão, UUID e início permanecem inalterados.
- **Erros:** rascunho inexistente, identidade divergente ou DTO inválido são
  rejeitados sem remover o rascunho persistido.
- **Aceite:**
  - Given um `SessionCompletion` concluído ou interrompido, when M02 finaliza o
    rascunho, then o payload corresponde exatamente ao contrato FastAPI.
  - Given um `client_session_id` já enfileirado, when o mesmo conteúdo é
    repetido, then não surge uma segunda entrada.
  - Given conteúdo diferente com o mesmo identificador, then ocorre conflito.
- **Evidência:** testes de contrato usando a saída pública de M07.

## LMI-02 — recuperação segura do rascunho

- **Prioridade:** P0.
- **Justificativa:** a rota de exercício recebe `clientSessionId`; a composição
  precisa recuperar o rascunho persistido sem carregar objetos pela navegação.
- **Dependências:** armazenamento M02 isolado por usuário.
- **Aceite:** somente o proprietário recupera o rascunho; outra identidade
  recebe `null`; reinicialização não perde treino, revisão ou início.

## LMI-03 — isolamento durante troca de conta

- **Prioridade:** P0.
- **Justificativa:** uma sincronização iniciada por A não pode continuar depois
  que a sessão ativa muda para B.
- **Aceite:**
  - Given uma requisição de A em andamento, when A sai, then ela é cancelada e
    a entrada retorna a `pending` sem incrementar tentativas.
  - Given B autenticado no mesmo aparelho, then nenhuma entrada de A aparece ou
    é enviada pela composição de B.
  - Given dois gatilhos simultâneos para a mesma conta, then há uma única
    execução de rede.
- **Evidência:** testes determinísticos de cancelamento, single-flight e
  armazenamento separado.

## LMI-04 — estados públicos da sincronização

- **Prioridade:** P1.
- **Justificativa:** M09 precisa representar estado sem conhecer detalhes
  internos da fila.
- **Estados:** `pending`, `syncing`, `synced`, `retryable_error` e
  `permanent_error`.
- **Aceite:** um seletor puro traduz a fila existente; sucesso é comprovado pelo
  relatório contendo o `client_session_id` enviado; erro permanente nunca é
  traduzido como sucesso.

## LMI-05 — erros e retry

- **Prioridade:** P0.
- **Aceite:** rede, timeout e 5xx usam backoff limitado; 401 aguarda sessão
  válida; 403/404/409/422 ficam bloqueados; cancelamento por troca de identidade
  não vira falha permanente; nenhum resultado é descartado silenciosamente.

## LMI-06 — configuração segura da API

- **Prioridade:** P1.
- **Pré-condição:** a infraestrutura fornece a origem do ambiente de release.
- **Aceite:** desenvolvimento pode usar HTTP local; produção exige HTTPS; URL
  ausente, inválida, com credenciais, query ou fragmento falha antes de iniciar;
  nenhuma URL de produção é inventada ou versionada.
- **Limitação:** HTTPS operacional depende de endpoint externo implantado.

## LMI-07 — navegação compartilhada

- **Prioridade:** P0.
- **Aceite:** os contratos preservam `workoutId`, `workoutRevisionId` e
  `clientSessionId`; perfis continuam em stacks separados; placeholders não são
  substituídos até existirem componentes públicos das responsáveis.

## LMI-08 — acessibilidade M01

- **Prioridade:** P1.
- **Aceite:** campos têm rótulo, erros são anunciados, carregamento comunica
  estado, controles têm área mínima e nenhuma informação essencial depende só
  de cor. VoiceOver/TalkBack permanece validação manual obrigatória.

## Fora do escopo e bloqueios

- Câmera, pose, regras de movimento, calibração e tela de sessão: Kaylany.
- Telas da paciente, profissional, conclusão e progresso: Amanda.
- Primeiro exercício e correção observável: aprovação fisioterapêutica.
- PostgreSQL e dispositivo físico: dependem do ambiente disponível.
