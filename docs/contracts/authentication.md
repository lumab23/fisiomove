# Autenticação e contas

> Estado: autenticação implementada por B02 e integrada a pacientes por B03.

## Access token

- JWT assinado com `HS256` e segredo exclusivo do ambiente.
- Validade padrão: 15 minutos, configurável por `AUTH_ACCESS_TOKEN_MINUTES`.
- Claims obrigatórias: `sub`, `role`, `type=access`, `auth_version`, `jti`, `iat`, `exp`, `iss` e `aud`.
- `sub` é o UUID do usuário; a API sempre recarrega a conta do banco.
- Conta inativa, perfil divergente ou `auth_version` alterada invalidam o token mesmo antes de `exp`.
- O JWT não contém senha, hash, dados clínicos ou token de renovação.

## Token de renovação

- Valor opaco e aleatório, com validade padrão de 30 dias.
- Apenas SHA-256 do valor é persistido; o valor completo não é recuperável do banco.
- Cada uso válido cria um novo token na mesma família, revoga o anterior e registra `replaced_by_id`.
- Token ausente, expirado ou revogado retorna `401` sem emitir novo par.
- Logout revoga o token apresentado e é idempotente para valores desconhecidos.
- Troca ou redefinição de senha revoga todas as renovações ativas do usuário.

## Senhas e primeiro acesso

- Hash Argon2id por `pwdlib`; senha nunca é armazenada em texto puro.
- Comprimento aceito: 12 a 128 caracteres.
- Contas criadas por provisionamento administrativo ou pelo serviço de paciente recebem `must_change_password=true`.
- `/auth/me` e `/auth/change-password` aceitam uma identidade com senha temporária.
- Rotas de negócio devem usar `get_current_user`, que retorna `403 password_change_required` até a troca.
- A troca exige a senha atual, rejeita reutilização, incrementa `auth_version` e revoga tokens de renovação.

## Dependências reutilizáveis

- `get_authenticated_user`: valida Bearer, JWT, conta ativa, perfil e versão; usado somente pelas rotas de identidade/troca inicial.
- `get_current_user`: acrescenta o bloqueio da senha temporária; uso obrigatório em funcionalidades de negócio.
- `require_role(...)`: acrescenta a autorização `patient`/`physiotherapist` e usa `get_current_user` internamente.

Autenticação não substitui o vínculo profissional-paciente de B03.

## Provisionamento

Não existe cadastro público de profissionais ou pacientes.

O primeiro fisioterapeuta é criado localmente por:

```bash
python -m app.modules.auth.cli create-physiotherapist \
  --email profissional@example.com
```

A senha temporária é lida por prompt oculto, não por argumento ou log. Uma segunda execução é recusada se já existir fisioterapeuta.

`PatientAccountService` é a interface interna consumida por B03:

- `create_access(email)` cria uma conta `patient` ativa com senha temporária;
- `activate_access(user_id)` reativa e gera nova senha temporária;
- `reset_temporary_password(user_id)` redefine a senha de conta ativa;
- `deactivate_access(user_id)` bloqueia a conta e revoga renovações;
- `change_email(user_id, email)` mantém a identidade sincronizada com o paciente;
- cada operação retorna a senha temporária uma única vez ao chamador.

B03 verifica identidade profissional e vínculo antes de chamar o serviço. As operações são expostas apenas pela rota protegida do paciente; continua inexistente um endpoint público de criação de contas.

## Erros relevantes

| HTTP | `code` |
| --- | --- |
| 400 | `current_password_invalid`, `password_reuse` |
| 401 | `invalid_credentials`, `authentication_required`, `invalid_access_token`, `access_token_expired`, `access_token_invalidated`, `invalid_refresh_token`, `refresh_token_expired`, `refresh_token_revoked` |
| 403 | `account_inactive`, `password_change_required`, `insufficient_role` |
| 404 | `account_not_found` |
| 409 | `email_conflict`, `role_mismatch`, `initial_physiotherapist_exists` |

Credenciais e tokens não devem ser incluídos em logs ou detalhes de erro.
