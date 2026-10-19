# Pacientes e vínculo profissional

> Estado: implementado por B03. Integrações com treinos, observações, sessões, progresso e conquistas permanecem pendentes dos módulos B04-B09.

## Autorização

- Todas as rotas exigem `physiotherapist` autenticado por `require_role`.
- A senha temporária deve ter sido trocada antes do acesso às rotas de negócio.
- O profissional responsável é sempre o usuário autenticado; corpos e parâmetros não aceitam `physiotherapist_id`.
- `get_authorized_patient(session, physiotherapist_id, patient_id)` retorna somente pacientes com vínculo ativo.
- Recurso inexistente e paciente de outro profissional retornam igualmente `404 patient_not_found`.

Essa função é a interface que B04-B06 e as leituras profissionais de B07-B08 devem reutilizar. Ela autoriza o vínculo, mas não substitui regras específicas do recurso futuro.

## Registro e vínculo

`POST /api/v1/patients` cria o paciente e o vínculo na mesma transação. Entrada:

```json
{
  "full_name": "Ana Souza",
  "email": "ana@example.com",
  "phone": "+5585999999999"
}
```

`full_name` tem 2 a 200 caracteres. `email` e `phone` são opcionais; CPF não é solicitado. Campos desconhecidos são rejeitados.

O vínculo contém `physiotherapist_id`, `patient_id` e estado, com unicidade do par. Não existe rota para o cliente trocar o profissional responsável.

## Consulta e paginação

- `GET /api/v1/patients?page=1&page_size=20` lista somente vínculos ativos do profissional.
- `GET /api/v1/patients/{id}` aplica a mesma autorização.
- `page >= 1`, `1 <= page_size <= 100`; página além do total retorna lista vazia.
- Ordenação: `created_at` decrescente e `id` como desempate.

`PatientResponse` contém dados básicos e os indicadores `has_access`, `access_is_active` e `must_change_password`. Não contém `user_id`, hashes nem tokens.

## Edição e desativação

`PATCH /api/v1/patients/{id}` aceita ao menos um entre `full_name`, `email`, `phone` e `is_active`. Ausência significa não alterar; `null` limpa apenas os contatos opcionais.

Se houver uma conta associada, alterar o e-mail atualiza também a identidade de login. Nesse estado o e-mail não pode ser removido. Desativar o paciente:

- preserva paciente e vínculo para histórico e administração;
- desativa a conta associada;
- incrementa sua versão de autenticação e revoga renovações ativas;
- não executa exclusão em cascata.

Reativar `Patient.is_active` não reativa implicitamente a conta.

## Acesso temporário

`POST /api/v1/patients/{id}/access` aceita:

```json
{"operation": "activate"}
```

Se a conta não existir, ela é criada como `patient`; se estiver inativa, é reativada. Conta já ativa retorna `409 patient_access_already_active` para evitar redefinição acidental.

Para uma conta ativa, a redefinição é explícita:

```json
{"operation": "reset_temporary_password"}
```

A resposta inclui a senha temporária somente nessa chamada. O hash permanece interno, todas as renovações anteriores são revogadas e o paciente deve trocar a senha antes de acessar funcionalidades de negócio. O registro deve estar ativo e possuir e-mail.

## Erros relevantes

| HTTP | `code` | Situação |
| --- | --- | --- |
| 403 | `insufficient_role` | perfil não profissional |
| 404 | `patient_not_found` | ausente ou sem vínculo ativo |
| 409 | `patient_inactive` | gestão de acesso para registro inativo |
| 409 | `patient_email_required` | criação de acesso sem e-mail |
| 409 | `patient_email_required_for_access` | remoção do e-mail de conta existente |
| 409 | `patient_access_not_created` | redefinição antes da criação |
| 409 | `patient_access_already_active` | ativação redundante |
| 409 | `email_conflict` | e-mail já usado por outra conta |

## Integrações ainda pendentes

B03 não cria catálogo, treinos, observações, sessões, progresso ou conquistas. Esses módulos devem referenciar `patients.id`, preservar registros inativos e usar a autorização deste documento. O fluxo completo do produto só poderá ser declarado integrado após B04-B09.
