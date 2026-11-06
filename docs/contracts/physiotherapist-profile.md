# Perfil do fisioterapeuta

> Estado: implementado (Fase 7 do plano `docs/plans/2026-11-06-mvp-login-demo-biblioteca.md`).

O perfil guarda **somente** o nome de exibição do profissional (decisão Q-P5).
Não há CREFITO, foto, telefone, especialidade nem qualquer outro campo; nenhum
valor é preenchido automaticamente (a migração não faz backfill).

## Persistência

Tabela `physiotherapist_profiles` (revisão `20261106_0010`), 1:1 com `users`:

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `user_id` | UUID, PK, FK `users.id` `ON DELETE CASCADE` | conta do profissional |
| `full_name` | `varchar(200)`, obrigatório | 2–200 caracteres após `strip` |
| `created_at`, `updated_at` | `timestamptz` | mantidos pelo servidor |

A linha só existe depois do primeiro `PUT`. Ausência de linha = nome não definido.

## Rotas do fisioterapeuta

Ambas exigem `require_role(physiotherapist)` com senha temporária já trocada.
A conta vem do token; o corpo não aceita IDs.

### `GET /api/v1/me/physiotherapist-profile`

`200 PhysiotherapistProfileResponse`:

```json
{"full_name": "Dra. Ficticia"}
```

`full_name` é `null` enquanto o profissional não definiu o nome.

### `PUT /api/v1/me/physiotherapist-profile`

Entrada `PhysiotherapistProfileUpdate` (campos desconhecidos são rejeitados):

```json
{"full_name": "Dra. Ficticia"}
```

Cria ou substitui o nome e devolve `200` com o mesmo formato do `GET`. Nome com
menos de 2 ou mais de 200 caracteres (após remover espaços nas pontas), `null`,
ausente ou campo extra → `422 validation_error`.

## Rota do paciente

### `GET /api/v1/me/physiotherapist`

Exige `require_role(patient)` com senha temporária já trocada. O servidor
resolve o paciente por `get_own_patient` (registro ativo da conta autenticada) e
o vínculo ativo em `professional_patient_links`.

`200 LinkedPhysiotherapistResponse`:

```json
{"full_name": "Dra. Ficticia"}
```

- `full_name` é `null` se o profissional vinculado ainda não definiu o nome.
- Nunca são devolvidos e-mail, IDs, `is_active`, `must_change_password` ou
  qualquer outro dado da conta do profissional.
- Se houver mais de um vínculo ativo (hoje o produto cria um único vínculo por
  paciente), usa-se o **mais antigo** por `created_at` e, em empate, por `id` do
  vínculo. O estado da conta do profissional (ativa/inativa) não é considerado.

## Erros

| HTTP | `code` | Quando |
| --- | --- | --- |
| 401 | `authentication_required` (e demais códigos de token) | sem Bearer válido |
| 403 | `password_change_required` | senha temporária não trocada |
| 403 | `insufficient_role` | paciente nas rotas do profissional ou vice-versa |
| 404 | `patient_not_found` | conta de paciente sem registro ativo |
| 404 | `physiotherapist_not_found` | paciente sem vínculo ativo |
| 422 | `validation_error` | corpo inválido no `PUT` |
