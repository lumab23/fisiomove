# AGENTS.md

## Escopo e stack

- O mobile usa React Native com TypeScript.
- O backend usa Python com FastAPI.
- Mantenha TypeScript em modo `strict`.
- Use type hints no código Python.

## Decisões técnicas e clínicas

- Não envie imagens ou frames da câmera ao backend por padrão.
- A visão computacional em tempo real deve acontecer preferencialmente no dispositivo.
- Não implemente funcionalidades clínicas sem especificação explícita.
- Não altere parâmetros relacionados a exercícios fisioterapêuticos por conta própria.
- Não invente regras clínicas.

## Qualidade e segurança

- Antes de adicionar uma dependência, confirme que ela é necessária, compatível e mantida.
- Evite abstrações prematuras.
- Crie testes para regras de negócio quando elas começarem a existir.
- Nunca coloque credenciais, tokens ou outros secrets no Git.
- Execute lint, verificação de tipos e testes aplicáveis antes de considerar uma tarefa concluída.
