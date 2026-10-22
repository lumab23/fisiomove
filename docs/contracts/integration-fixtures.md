# Interfaces e fixtures de integração

> Fixtures são exemplos fictícios para desenvolvimento e testes. Não comprovam integração e não são seeds de produção.

## Identidades estáveis

```json
{
  "physiotherapist": {
    "id": "11111111-1111-4111-8111-111111111111",
    "role": "physiotherapist",
    "is_active": true
  },
  "patient": {
    "id": "22222222-2222-4222-8222-222222222222",
    "role": "patient",
    "is_active": true
  }
}
```

Nomes, contatos e senhas reais não devem aparecer em fixtures. B02 fornece `get_authenticated_user`, `get_current_user` e `require_role`; B03 fornece `get_authorized_patient(session, physiotherapist_id, patient_id)`.

## Interfaces esperadas pelos módulos futuros

- B04-B06 recebem o `User.id` do profissional autenticado e chamam `get_authorized_patient` antes de ler ou escrever recursos de um paciente.
- Rotas de negócio devem depender de `get_current_user`, que bloqueia conta inativa, token invalidado e senha temporária pendente.
- Rotas profissionais combinam `require_role(UserRole.PHYSIOTHERAPIST)` com `get_authorized_patient`. Rotas do próprio paciente obtêm a identidade da conta e não aceitam `patient_id` do corpo para conceder acesso.
- B05 fornece a B07 uma revisão publicada e um snapshot imutável do treino.
- B07 implementa `POST /api/v1/me/sessions` com resultados persistidos e idempotentes, diferenciando `completed` de `interrupted`; B08/B09 consomem esses resultados.
- B08 fornece resumos derivados; não duplica persistência de sessões.
- B09 usa a sessão persistida como origem e impõe unicidade para evitar recompensa duplicada.

As assinaturas Python dos domínios B04-B09 serão adicionadas pelas responsáveis. B03 não cria imports, tabelas, repositórios ou endpoints fictícios desses domínios.

## Exemplo de lista vazia

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0,
  "pages": 0
}
```

## Exemplo de conflito idempotente

```json
{
  "code": "idempotency_conflict",
  "message": "The client_session_id was already used with different content.",
  "details": {
    "field": "client_session_id"
  }
}
```
