# Tarefas — estabilização M01/M02

| ID | Objetivo | Arquivos principais | Dependências | Testes | Estado |
|---|---|---|---|---|---|
| T01 | Formalizar requisitos e desenho | `docs/specs/luma-mobile-integration/` | auditoria | revisão documental | concluída |
| T02 | Recuperar rascunho por proprietário e UUID | `sync/SessionSyncService.ts`, `SessionSyncContext.tsx` | store atual | recuperação/reinício/isolamento | concluída |
| T03 | Cancelar sync na troca de identidade | `services/sessions.ts`, `sync/SessionSyncService.ts`, contexto | AbortSignal do cliente | cancelamento e single-flight | concluída |
| T04 | Expor estados públicos e IDs enviados | `sync/types.ts`, novo seletor, integração pública | fila atual | mapeamento de estados | concluída |
| T05 | Disparar tentativa após persistência | `SessionSyncContext.tsx` | T03 | persistência antes da rede | concluída |
| T06 | Endurecer configuração HTTPS | `config/environment.ts` | origem fornecida no release | ambiente/URL/esquema | concluída |
| T07 | Provar contrato M07 → M02 | testes mobile | saída pública M07 | concluída/interrompida/DTO | concluída |
| T08 | Auditar M01 e navegação | autenticação/navegação | código atual | regressão existente | concluída |
| T09 | Executar validação final | mobile e Git | T02–T08 | tipos/lint/format/Jest/diff | concluída com bloqueios externos registrados |

Arquivos internos de Amanda e Kaylany não serão modificados. A falha Prettier já
existente nesses módulos será registrada, não corrigida por esta tarefa.
