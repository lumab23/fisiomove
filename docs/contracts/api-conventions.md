# Convenções da API

> Estado: contrato proposto em B01. Apenas `/health` está funcional nesta etapa.

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

## Perfis e permissões propostas

Perfis: `patient` e `physiotherapist`.

- O perfil vem da identidade autenticada e nunca de um ID ou papel enviado pelo cliente.
- Paciente acessa somente seus treinos publicados, suas sessões, progresso e conquistas.
- Fisioterapeuta acessa somente pacientes com vínculo ativo e os recursos desses pacientes.
- Cadastro público não pode conceder o perfil `physiotherapist`.
- Identidade sem permissão recebe `403` ou `404` quando ocultar a existência reduzir exposição de dados.

Autenticação e verificação de vínculo pertencem a B02/B03 e não existem em B01.
