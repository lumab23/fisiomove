# Migrações

As migrações Alembic do backend formam uma única cadeia neste diretório. A revisão inicial de B01 não cria tabelas de domínio; ela estabelece a infraestrutura e a versão-base. B02 adiciona `users` e `refresh_tokens` na revisão `20261019_0002`.

Módulos futuros devem adicionar novas revisões com `down_revision` apontando para o `head` integrado. Uma migração já aplicada nunca deve ser reescrita para acomodar outro módulo.
