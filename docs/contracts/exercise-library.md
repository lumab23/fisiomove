# Biblioteca externa de exercícios (referência)

> Estado: implementada (Fase 8 do plano `docs/plans/2026-11-06-mvp-login-demo-biblioteca.md`)
> com busca ao vivo; desde a DEC-006 (plano
> `docs/plans/2026-11-06-conquistas-configuracoes-catalogo-biblioteca.md`) o
> fisioterapeuta pode adicionar um item ao catálogo para uso acadêmico.

## Natureza do conteúdo

- **Consultar não altera nada.** `GET /exercise-library` e o detalhe não
  gravam no banco. Só `POST /exercise-library/{external_id}/catalog` cria um
  registro em `exercises`, por decisão explícita do fisioterapeuta (DEC-006).
- **Adicionar ao catálogo não é validação clínica.** A aprovação é registrada em
  nome do fisioterapeuta pela governança existente e significa "escolhido pelo
  fisioterapeuta para uso acadêmico". Rever antes de qualquer uso clínico ou
  comercial (licença não comercial).
- O item adicionado nunca recebe prescrição da fonte: `supported_parameters`
  fica vazio, `rule_version` indica ausência de regra de câmera (o
  `MovementEngine` e a calibração não o usam) e séries, repetições, descanso e
  lados são sempre definidos pelo fisioterapeuta.
- A busca e o detalhe são **somente do fisioterapeuta**. O paciente só vê um
  item depois que ele foi adicionado ao catálogo e prescrito em treino publicado
  (nome original, tradução pt-BR se houver, imagens pela API e atribuição no
  `exercise_snapshot`). Nenhum dado de paciente é
  enviado ao provedor (as chamadas não levam identificação de usuário).
- Nome e instruções originais ficam em inglês, sem edição. A tradução pt-BR é
  opcional, escrita ou revisada pelo fisioterapeuta e guardada à parte
  (DEC-011, ver "Tradução pt-BR"); não há tradução automática.
- Toda resposta traz `usage_notice` e o bloco `attribution`; a tela que exibe o
  conteúdo **deve** mostrar a atribuição e o aviso.

## Fonte e licença

- Provedor: **OpenExerciseBase** (Ludwig Boltzmann Institute for Digital Health
  and Prevention).
- Licença dos dados: **CC BY-NC 4.0** — <https://creativecommons.org/licenses/by-nc/4.0/>.
  Uso não comercial, com atribuição, link da licença e indicação de alterações.
- Lista: `GET https://www.openexercisedatabase.at/api/exercises` →
  `{ "validated": [...], "community": [...], "communityError": bool }`.
  **Só a trilha `validated` é usada**; `community` é ignorada.
- Detalhe: `https://raw.githubusercontent.com/OpenExerciseBase/OpenExerciseBase-Database/main/exercises/{id}.json`
  (branch `main`; não há versão fixada pelo provedor, por isso a fonte é citada
  com a URL completa do arquivo lido).
- Imagens: `https://raw.githubusercontent.com/OpenExerciseBase/OpenExerciseBase-Database/main/images/{id}/{arquivo}`.
  Na busca e no detalhe da biblioteca, são carregadas diretamente pelo aparelho
  do fisioterapeuta (Q-T4). Ao adicionar ao catálogo, o backend copia as
  imagens para `exercise_images` e as serve pela API autenticada (DEC-010,
  ver "Imagens do catálogo"); itens do catálogo não usam mais a URL do
  provedor. Parte das imagens e textos foi gerada por IA e revisada pelo
  provedor (`created_by`, `review_status`).

## Campos usados e proibidos

| Origem (provedor) | Exposto como | Observação |
| --- | --- | --- |
| `id` | `external_id` | validado por `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$` |
| `name` | `name` | |
| `categories` | `categories` | |
| `bodyParts` | `body_parts` | valores originais (o provedor mistura `full_body`/`full body`) |
| `equipment` | `equipment` | |
| `instructions[{stepNumber, description}]` | `instructions[{step_number, description}]` | ordenadas por `step_number`; idioma em `instructions_language` (`"en"`) |
| `imageUrl` (lista) / `mediaContent.imageURLs` (detalhe) | `image_url` / `image_urls` | só arquivos dentro de `images/{id}/`; outros hosts ou `..` são descartados |
| `reviewStatus` (lista) / `metadata.reviewStatus` (detalhe) | `review_status` | |
| `metadata.createdBy` | `created_by` | só no detalhe |

**Nunca lidos nem expostos:** `performanceMetrics`, `variations`,
`exerciseEffects`, `relationships`, `commentsNotes`, `location`, demais campos de
`metadata`. Séries, repetições, duração, descanso, ângulos, amplitude,
dificuldade ou progressão vindos de terceiros não são prescrição e não são
mostrados. Textos do provedor não são usados como feedback corretivo (RN18).

## Rotas

Ambas exigem `require_role(physiotherapist)` com senha temporária já trocada. A
checagem de papel roda antes de qualquer chamada ao provedor.

### `GET /api/v1/exercise-library`

Query: `query?` (até 100 caracteres; trecho do nome), `body_part?` (até 50
caracteres; igualdade com um item de `body_parts`), `page` (≥ 1, padrão 1),
`page_size` (1–100, padrão 20). Comparações ignoram maiúsculas, `_` e espaços
repetidos; valores vazios equivalem a "sem filtro". Filtro, ordenação (nome,
depois `external_id`) e paginação são feitos no servidor sobre a lista.

`200 LibraryExercisePage`:

```json
{
  "items": [
    {
      "external_id": "EX-ab-hold-01KZ3V3DYS3422TGERTFBDCBSP",
      "name": "Ab Hold",
      "categories": ["strength_and_resistance"],
      "body_parts": ["core", "hip_flexors"],
      "equipment": ["yoga mat"],
      "image_url": "https://raw.githubusercontent.com/OpenExerciseBase/OpenExerciseBase-Database/main/images/EX-ab-hold-01KZ3V3DYS3422TGERTFBDCBSP/image_1.png",
      "review_status": "accepted"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1,
  "pages": 1,
  "usage_notice": "External reference material. A physiotherapist may add it to the FisioMove catalog for academic use; prescription values are always set by the physiotherapist.",
  "attribution": {
    "source": "OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and Prevention)",
    "license": "CC BY-NC 4.0",
    "license_url": "https://creativecommons.org/licenses/by-nc/4.0/",
    "source_url": "https://www.openexercisedatabase.at/api/exercises",
    "changes": "Only selected descriptive fields are shown; text is kept in the original language without edits. Performance metrics and variations are omitted."
  }
}
```

### `GET /api/v1/exercise-library/{external_id}`

O `external_id` é validado pelo padrão acima **antes** de qualquer URL ser
montada (sem `/`, `.` ou `..`); formato inválido → `422 validation_error`. O id
precisa estar na trilha `validated` da lista (que funciona como allowlist);
caso contrário → `404`.

`200 LibraryExerciseDetailResponse`: os campos do item da lista (com
`image_urls: string[]` no lugar de `image_url`), mais `instructions`,
`instructions_language`, `created_by`, `usage_notice`, `attribution`
(`source_url` = URL do JSON do exercício lido) e `catalog_exercise`:

```json
"catalog_exercise": {
  "exercise_id": "55555555-5555-4555-8555-555555555555",
  "approval_status": "approved",
  "added_by_me": true
}
```

`catalog_exercise` é `null` enquanto o item não foi adicionado ao catálogo.
`approval_status` segue o catálogo (`approved` ou `revoked` quando retirado);
`added_by_me` é `true` quando a aprovação vigente foi registrada pelo
fisioterapeuta autenticado (`approved_by_id`).

### `POST /api/v1/exercise-library/{external_id}/catalog`

Adiciona o item ao catálogo do FisioMove (DEC-006). Mesmas exigências das rotas
de leitura (fisioterapeuta, senha trocada, papel checado antes do provedor, id
validado antes de montar URL).

Corpo (`CatalogImportRequest`):

```json
{
  "allowed_sides": ["left", "right"],
  "name_pt_br": "Nome em português",
  "instructions_pt_br": ["Primeiro passo.", "Segundo passo."]
}
```

`allowed_sides`: 1 a 3 valores de `left | right | bilateral`, sem repetição e
sem valor padrão; é escolha do fisioterapeuta.

`name_pt_br` e `instructions_pt_br` são opcionais, mas **ambos ou nenhum**
(senão `422 validation_error`, antes de chamar o provedor). Mesmas regras de
`PUT /exercises/{id}/localization` (ver "Tradução pt-BR"); a autoria é o
fisioterapeuta autenticado. Se o item já está no catálogo (`200`), a tradução
do corpo é ignorada como os lados; use a rota `PUT`.

O servidor não confia em dados descritivos do cliente: busca o detalhe no
provedor e grava, numa única transação:

| Campo em `exercises` | Valor |
| --- | --- |
| `code` | `"oeb-"` + `uuid5(NAMESPACE_URL, "openexercisebase:" + external_id).hex` (estável) |
| `name` | nome original, sem edição |
| `instructions` | passos originais em inglês, um por linha, no formato `"{step_number}. {description}"` |
| `allowed_sides` | escolhidos no corpo |
| `supported_parameters` | `{}` |
| `rule_version` | `"library-reference-no-camera-rule:v1"` (não existe regra de câmera) |
| `source`, `source_external_id`, `source_url`, `source_license` | `"openexercisebase"`, `external_id`, URL do JSON lido, `"CC BY-NC 4.0"` |
| `name_pt_br`, `instructions_pt_br`, `translated_by_id`, `translated_at` | do corpo (passos como `"n. passo"`), fisioterapeuta autenticado e agora; ou todos nulos |
| `exercise_images` | até 6 imagens válidas da fonte (ver "Imagens do catálogo") |

A aprovação é registrada por `ExerciseGovernanceService.approve` em nome do
fisioterapeuta autenticado, com a referência
`fisiomove:library-import:openexercisebase:{external_id}; DEC-006 (uso acadêmico)`,
e gera um `ExerciseApprovalEvent` append-only.

Idempotência: a chave é `(source, source_external_id)` (índice único). Se o item
já está no catálogo, a rota devolve o registro existente com `200`, **sem**
consultar o provedor e **sem** sobrescrever lados ou textos (o catálogo é
global; a escolha de lados da primeira adição vale para todos). Corridas são
resolvidas pelo índice único: quem perde relê o registro e recebe `200`.

Resposta: `ExerciseResponse` (ver `domain-contracts.md`), com `source`
preenchido:

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "code": "oeb-a64d726e61a659e2b949b9be2a989de4",
  "name": "Ab Hold",
  "instructions": "1. Lie on your back.\n2. Lift your upper back.",
  "allowed_sides": ["bilateral"],
  "rule_version": "library-reference-no-camera-rule:v1",
  "supported_parameters": {},
  "is_active": true,
  "approval_status": "approved",
  "approved_rule_version": "library-reference-no-camera-rule:v1",
  "source": {
    "source": "OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and Prevention)",
    "external_id": "EX-ab-hold-01KZ3V3DYS3422TGERTFBDCBSP",
    "source_url": "https://raw.githubusercontent.com/OpenExerciseBase/OpenExerciseBase-Database/main/exercises/EX-ab-hold-01KZ3V3DYS3422TGERTFBDCBSP.json",
    "license": "CC BY-NC 4.0",
    "license_url": "https://creativecommons.org/licenses/by-nc/4.0/",
    "attribution": "Name and instructions from OpenExerciseBase (Ludwig Boltzmann Institute for Digital Health and Prevention), licensed under CC BY-NC 4.0. Text is kept in the original language without edits."
  },
  "images": [
    { "position": 1, "url": "/api/v1/exercises/55555555-5555-4555-8555-555555555555/images/1" }
  ],
  "localization": null
}
```

Com tradução, `localization` vem preenchido e `source.attribution` indica a
alteração (formato em `domain-contracts.md`):

```json
"localization": {
  "language": "pt-BR",
  "name": "Nome em português",
  "instructions": "1. Primeiro passo.\n2. Segundo passo.",
  "translated_by_name": "Nome do perfil do fisioterapeuta (sem perfil: \"fisioterapeuta do FisioMove\"; nunca o e-mail — DEC-005)",
  "translated_at": "2026-11-06T12:00:00Z"
}
```

| HTTP | Quando |
| --- | --- |
| `201` | item adicionado agora |
| `200` | item já estava no catálogo (aprovado e ativo) |
| `404 library_exercise_not_found` | id fora da trilha `validated` ou inexistente |
| `409 catalog_exercise_revoked` | item já adicionado e depois retirado (revogado ou inativo); não é reaprovado por esta rota |
| `422 library_exercise_without_instructions` | o provedor não traz passos de instrução (Q-T1) |
| `422 library_exercise_too_long` | nome do provedor > 200 caracteres ou URL de origem > 500 (o texto é copiado sem edição, então é recusado antes de gravar) |
| `422 validation_error` | corpo inválido ou id malformado |
| `503 external_library_unavailable` | provedor indisponível; nada é gravado |

## Imagens do catálogo (DEC-010)

Na adição ao catálogo, depois de ler o detalhe e **antes** de abrir a escrita
(nenhuma trava de banco fica presa durante a rede), o backend tenta baixar as
**6 primeiras** URLs distintas de `image_urls` e grava as válidas em
`exercise_images` na mesma transação do exercício. Cada imagem:

- só é baixada se a URL for exatamente `<EXERCISE_LIBRARY_IMAGE_BASE_URL>/<external_id>/<arquivo>`
  (allowlist do provedor; outro host, outro id, `..`, `http://` → recusada);
- usa o mesmo cliente `urllib` da biblioteca: redirecionamento só para
  `https://`, timeout `EXERCISE_LIBRARY_TIMEOUT_SECONDS`, `Accept: image/png, image/jpeg, image/webp`;
- tem no máximo **2 MiB** (o corpo é cortado em 2 MiB + 1 byte e recusado se
  passar) e não pode ser vazia;
- precisa declarar `Content-Type` `image/png`, `image/jpeg` ou `image/webp`
  (parâmetros como `; charset` são ignorados) **e** ter a assinatura (magic
  bytes) do mesmo formato.

**Falha de imagem não falha a adição.** Imagem fora da allowlist, com erro de
rede, 404, tamanho ou tipo inválido é pulada e registrada no log
`library_image_skipped` (`error_type`: `url_not_allowed`, `download_failed`,
`not_found`, `invalid_size`, `content_type_not_allowed`, `content_mismatch`;
sem URL nem dado de usuário). Justificativa: o texto é o conteúdo essencial e
as imagens são complementares; recusar a adição por uma imagem tornaria o item
inacessível por causa de um arquivo da fonte, e o backfill permite tentar de
novo. As válidas recebem `position` contígua (1..n) na ordem da fonte; `sha256`,
`byte_size` e `source_url` ficam registrados. A imagem gravada não muda depois
(o backfill só preenche exercício sem nenhuma imagem).

### `GET /api/v1/exercises/{exercise_id}/images/{position}`

Qualquer conta autenticada com senha trocada (`get_current_user`, mesma regra de
`GET /exercises`), paciente ou fisioterapeuta. Serve imagens de qualquer
exercício do catálogo, inclusive retirado: os snapshots de treinos publicados
guardam essas URLs e continuam válidos (Q-P6). O conteúdo é o material público
CC BY-NC da fonte, não dado de paciente.

- `200`: corpo com os bytes, `Content-Type` gravado,
  `Cache-Control: private, max-age=86400`, `ETag: "<sha256>"`,
  `X-Content-Type-Options: nosniff`.
- `404 exercise_image_not_found`: exercício ou posição sem imagem.
- `422 validation_error`: `position` fora de 1–6 ou UUID inválido.
- `401`/`403`: mesmos códigos de autenticação das demais rotas.

O cliente precisa mostrar a legenda de fonte/licença e texto alternativo (DEC-010).

### Backfill dos itens já adicionados

```bash
python -m app.modules.exercise_library.cli backfill-images
```

Para cada exercício com `source = "openexercisebase"` **sem nenhuma** imagem,
relê o detalhe no provedor (mesma allowlist da trilha `validated`) e grava as
imagens válidas com as regras acima, um exercício por transação. Não altera
nome, textos, lados, tradução nem aprovação. É idempotente (rodar de novo não
duplica nem substitui). Sai com código `1` se o provedor ficou indisponível para
algum item (pode ser repetido), senão `0`, e lista os itens sem imagem válida
ou que saíram da fonte.

## Tradução pt-BR (DEC-011)

### `PUT /api/v1/exercises/{exercise_id}/localization`

`require_role(physiotherapist)` com senha trocada; **qualquer** fisioterapeuta
ativo pode criar ou substituir a tradução (vale a última; a autoria registrada
é a do último a gravar). Só para exercício visível no catálogo (ativo, aprovado
e com versão vigente); senão `404 exercise_not_found`.

Corpo (`ExerciseLocalizationUpdate`, campos extras recusados):

```json
{ "name": "Nome em português", "instructions": ["Primeiro passo.", "Segundo passo."] }
```

- `name`: 1–200 caracteres após remover espaços nas pontas.
- `instructions`: 1–50 passos; cada um com 1–2000 caracteres após remover
  espaços nas pontas e **sem quebra de linha** (cada passo é uma linha).
- Grava `instructions_pt_br` como `"1. Primeiro passo.\n2. Segundo passo."`,
  `translated_by_id` = fisioterapeuta autenticado e `translated_at` = agora.
- Não altera `name`/`instructions` originais, `rule_version`, aprovação nem
  eventos de governança.
- Não há operação de "limpar" a tradução nesta versão: retirar texto revisado
  apagaria a indicação de alteração exigida pela licença sem decisão de
  produto; corrigir é feito sobrescrevendo.

Resposta `200 ExerciseResponse` com `localization` e a atribuição de alteração.
Erros: `401`/`403` de autenticação, `403 insufficient_role` (paciente),
`404 exercise_not_found`, `422 validation_error`.

Treinos já publicados não mudam: a tradução chega ao paciente quando o
fisioterapeuta redefine os itens do treino (`PATCH` com `items`) e publica a
nova revisão (Q-P6).

## Erros

| HTTP | `code` | Quando |
| --- | --- | --- |
| 401 | `authentication_required` (e demais códigos de token) | sem Bearer válido |
| 403 | `password_change_required` | senha temporária não trocada |
| 403 | `insufficient_role` | paciente |
| 404 | `library_exercise_not_found` | id fora da trilha `validated` ou inexistente no provedor |
| 409 | `catalog_exercise_revoked` | `POST .../catalog` de item retirado do catálogo |
| 422 | `validation_error` | id malformado, `page_size` fora de 1–100, filtros longos demais, `allowed_sides` inválido |
| 422 | `library_exercise_without_instructions` | `POST .../catalog` de item sem passos |
| 422 | `library_exercise_too_long` | `POST .../catalog` de item que excede os limites de coluna |
| 503 | `external_library_unavailable` | falha de rede, timeout, HTTP ≠ 2xx/404, resposta inválida ou maior que o limite, ou biblioteca desabilitada; inclui `Retry-After: 30` (falha ao baixar **imagem** não gera 503: a imagem é pulada) |
| 404 | `exercise_image_not_found` | `GET /exercises/{id}/images/{position}` sem imagem |
| 404 | `exercise_not_found` | `PUT /exercises/{id}/localization` de exercício fora do catálogo vigente |

## Configuração

Variáveis (sem segredo; o provedor não usa chave), em `app/core/config.py` e
`backend/.env.example`:

| Variável | Padrão |
| --- | --- |
| `EXERCISE_LIBRARY_ENABLED` | `true` |
| `EXERCISE_LIBRARY_LIST_URL` | URL da lista acima |
| `EXERCISE_LIBRARY_DETAIL_BASE_URL` | `.../OpenExerciseBase-Database/main/exercises` |
| `EXERCISE_LIBRARY_IMAGE_BASE_URL` | `.../OpenExerciseBase-Database/main/images` |
| `EXERCISE_LIBRARY_TIMEOUT_SECONDS` | `5` (0 < t ≤ 30) |
| `EXERCISE_LIBRARY_CACHE_SECONDS` | `300` (0–3600; `0` desliga o cache) |

URLs precisam começar com `https://`. HTTP usa `urllib` da biblioteca padrão
(Q-T1, sem dependência nova). A lista fica em cache em memória por processo
durante `EXERCISE_LIBRARY_CACHE_SECONDS`; falhas não são cacheadas; o detalhe
não é cacheado. Limites de corpo: 5 MiB (lista), 1 MiB (detalhe) e 2 MiB
(cada imagem; até 6 por exercício). Os limites de imagem são constantes em
`app/modules/exercises/models.py` e também restrições do banco.

## Implementação e testes

- `backend/app/modules/exercise_library/`: `providers.py` (protocolo
  `ExerciseLibraryProvider` + `OpenExerciseBaseProvider`), `services.py`
  (filtro/paginação/erros; não acessa o banco), `importing.py`
  (`CatalogImportService`: adição ao catálogo e `catalog_exercise`),
  `schemas.py`, `router.py` (dependência `get_exercise_library_provider`,
  substituível em testes), `images.py` (download/validação de imagens e
  backfill) e `cli.py` (`backfill-images`).
- `backend/app/modules/exercises/`: rota de imagem e `PUT .../localization`.
- Migração `20261106_0012` adiciona a proveniência em `exercises` (colunas
  anuláveis, todas nulas ou todas preenchidas, índice único
  `(source, source_external_id)`), sem preencher dados. `20261106_0013` cria
  `exercise_images`; `20261106_0014` adiciona as colunas pt-BR; ambas sem
  preencher dados (imagens só pelo backfill explícito).
- `backend/tests/exercise_library/`: provedor e fetcher falsos, sem rede;
  `test_catalog_import.py` cobre a adição ao catálogo, `test_images.py` as
  imagens, a rota e o backfill, `test_localization.py` a tradução e o snapshot.
