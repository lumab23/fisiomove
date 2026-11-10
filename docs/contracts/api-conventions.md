# Convenções da API

> Estado: convenções implementadas e utilizadas pelos módulos do backend do MVP.

## Transporte e versionamento

- Rotas de negócio usam o prefixo `/api/v1`.
- Requisições e respostas usam JSON UTF-8.
- `GET /health` permanece fora do prefixo e não depende de autenticação.
- Mudanças incompatíveis exigem novo prefixo ou plano de migração documentado.
- O backend recebe dados derivados das sessões; imagens, vídeos e áudio não fazem parte do contrato.

## Tipos e validações

- IDs: UUID v4 serializado em minúsculas com hífens.
- Datas e horas: ISO 8601 em UTC, por exemplo `2026-10-19T14:30:00Z`.
- Durações: inteiros em milissegundos, nunca negativos.
- Contagens e posições: inteiros; limites específicos pertencem ao DTO que os define.
- Enumerações: strings minúsculas em inglês.
- Campos desconhecidos devem ser rejeitados nos DTOs de escrita.
- Campos opcionais ausentes e campos explicitamente nulos não são equivalentes quando o PATCH precisar distinguir "não alterar" de "limpar".

## Paginação

Listas usam paginação por página:

- `page`: inteiro a partir de 1; padrão 1.
- `page_size`: inteiro de 1 a 100; padrão 20.
- ordenação padrão: `created_at` decrescente e `id` como desempate.

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0,
  "pages": 0
}
```

Filtros inválidos retornam `422`; página além do total retorna `items` vazio, não `404`.

## Erros

Todas as falhas HTTP usam:

```json
{
  "code": "validation_error",
  "message": "Request validation failed.",
  "details": [
    {
      "field": "body.name",
      "message": "Field required",
      "type": "missing"
    }
  ]
}
```

Classes previstas:

| HTTP | `code` de referência | Uso |
| --- | --- | --- |
| 400 | `bad_request` | requisição semanticamente inválida |
| 401 | `authentication_required` | credencial ausente ou inválida |
| 403 | `forbidden` | identidade conhecida sem permissão |
| 404 | `not_found` | recurso ausente ou deliberadamente ocultado |
| 409 | `conflict` | idempotência ou estado conflitante |
| 422 | `validation_error` | campo, tipo ou intervalo inválido |
| 500 | `internal_error` | falha inesperada sem detalhes internos |

Respostas nunca incluem stack trace, URL do banco, hash de senha ou token interno.

### Catálogo de `code`

Lista completa dos `code` que o backend pode devolver (levantada em
`backend/app` em 2026-11-09). O `message` continua em inglês e é só para
desenvolvedores; o app mostra texto em português mapeado por `code` (DEC-014).
Um `code` novo no backend exige uma linha nesta tabela e o texto correspondente
no mapa do mobile. `bad_request` (tabela acima) é apenas uma classe de
referência: nenhuma rota o devolve hoje.

| HTTP | `code` | Significado |
| --- | --- | --- |
| 400 | `current_password_invalid` | troca de senha com a senha atual incorreta |
| 400 | `password_reuse` | a nova senha é igual à atual |
| 401 | `authentication_required` | token ausente ou esquema diferente de Bearer (também fallback de `HTTPException` 401) |
| 401 | `invalid_access_token` | access token malformado, com assinatura inválida ou de usuário inexistente |
| 401 | `access_token_expired` | access token expirado |
| 401 | `access_token_invalidated` | token emitido antes de logout, troca de senha ou mudança de papel |
| 401 | `invalid_credentials` | login com e-mail ou senha incorretos |
| 401 | `invalid_refresh_token` | refresh token desconhecido ou inválido |
| 401 | `refresh_token_revoked` | refresh token já revogado |
| 401 | `refresh_token_expired` | refresh token expirado |
| 403 | `account_inactive` | conta desativada (login, refresh, rotas autenticadas, troca de senha) |
| 403 | `password_change_required` | senha temporária ainda não trocada |
| 403 | `insufficient_role` | o papel da conta não pode usar a rota |
| 403 | `clinical_approval_forbidden` | aprovação de exercício por quem não é fisioterapeuta ativo com senha trocada |
| 403 | `note_author_required` | só o autor pode editar a observação |
| 403 | `forbidden` | fallback de `HTTPException` 403 |
| 404 | `account_not_found` | conta de paciente inexistente na redefinição de acesso |
| 404 | `patient_not_found` | paciente inexistente, inativo, sem vínculo ativo ou de outra conta (existência ocultada) |
| 404 | `physiotherapist_not_found` | paciente sem fisioterapeuta vinculado |
| 404 | `exercise_not_found` | exercício inexistente ou não disponível no catálogo |
| 404 | `exercise_image_not_found` | imagem do exercício inexistente na posição pedida |
| 404 | `library_exercise_not_found` | exercício não encontrado na biblioteca externa |
| 404 | `workout_not_found` | treino inexistente ou inacessível |
| 404 | `revision_not_found` | revisão inexistente, de outro treino ou não publicada |
| 404 | `note_not_found` | observação inexistente |
| 404 | `session_not_found` | sessão inexistente ou inacessível |
| 404 | `not_found` | fallback de `HTTPException` 404 (por exemplo, rota inexistente) |
| 409 | `email_conflict` | e-mail já usado por outra conta |
| 409 | `initial_physiotherapist_exists` | o primeiro fisioterapeuta já foi provisionado |
| 409 | `role_mismatch` | a conta alvo não é de paciente |
| 409 | `account_inactive` | redefinir senha temporária de conta de paciente inativa |
| 409 | `patient_inactive` | operação de acesso sobre paciente inativo |
| 409 | `patient_email_required` | criar acesso para paciente sem e-mail |
| 409 | `patient_email_required_for_access` | remover o e-mail de paciente que já tem acesso |
| 409 | `patient_access_not_created` | redefinir acesso que ainda não foi criado |
| 409 | `patient_access_already_active` | criar acesso que já existe |
| 409 | `parameter_contract_pending` | exercício com parâmetros sem validador aprovado |
| 409 | `catalog_exercise_revoked` | exercício da biblioteca foi retirado do catálogo e não pode ser readicionado |
| 409 | `workout_archived` | editar treino arquivado |
| 409 | `workout_not_draft` | publicar treino que não está em rascunho |
| 409 | `idempotency_conflict` | `client_session_id` reutilizado com conteúdo diferente |
| 409 | `session_revision_not_active_at_start` | a revisão não era a vigente no início da sessão |
| 409 | `conflict` | fallback de `HTTPException` 409 |
| 422 | `validation_error` | corpo, query ou path inválidos (detalhes por campo) |
| 422 | `approval_document_reference_invalid` | referência do documento de aprovação inválida |
| 422 | `library_exercise_without_instructions` | exercício da biblioteca sem instruções |
| 422 | `library_exercise_too_long` | exercício da biblioteca excede os limites de tamanho do catálogo |
| 422 | `unsupported_side` | lado não permitido pelo exercício |
| 422 | `unsupported_parameters` | parâmetros enviados para exercício que não os aceita |
| 422 | `counting_rule_unsupported_side` | `counting_rule` em item `bilateral` (DEC-013) |
| 422 | `session_item_invalid` | item da sessão não pertence à revisão ou posição divergente |
| 422 | `counting_mode_unavailable` | `counting_mode` `automatic`/`mixed` em item sem `counting_rule` no snapshot (DEC-013) |
| 422 | `session_result_exceeds_plan` | séries ou repetições acima do prescrito |
| 422 | `session_item_duration_exceeds_total` | soma das durações dos itens maior que a da sessão |
| 422 | `completed_session_incomplete` | sessão `completed` sem o resultado completo |
| 422 | `invalid_datetime` | data sem fuso horário em filtro de período |
| 422 | `invalid_period` | `period_end` anterior a `period_start` |
| 500 | `internal_error` | falha inesperada, sem detalhes internos |
| 503 | `database_unavailable` | banco indisponível; repetir a mesma requisição (`Retry-After`) |
| 503 | `database_not_ready` | `/ready` com banco inacessível ou migração pendente |
| 503 | `external_library_unavailable` | biblioteca externa desativada ou indisponível |
| outro | `http_error` | fallback de `HTTPException` com status sem mapeamento (por exemplo, 405) |

## Perfis e permissões implementadas

Perfis: `patient` e `physiotherapist`.

- O perfil vem da identidade autenticada e nunca de um ID ou papel enviado pelo cliente.
- Paciente acessa somente seus treinos publicados, suas sessões e seu progresso.
- Fisioterapeuta acessa somente pacientes com vínculo ativo e os recursos desses pacientes.
- Cadastro público não pode conceder o perfil `physiotherapist`.
- Identidade sem permissão recebe `403` ou `404` quando ocultar a existência reduzir exposição de dados.

Autenticação e verificação de vínculo são implementadas por B02/B03 e
reutilizadas pelos demais módulos. Nenhuma rota confia em IDs profissionais
fornecidos pelo cliente.
