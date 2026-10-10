# CAMPING V2 · Fase 5

Estado da execução: diagnóstico e contrato de schema preparados; integração total ainda bloqueada.

Auditoria do Supabase `hhipwyixtbleiulfnvvm` em 2026-10-10: no schema público foram encontradas as tabelas `partnership_requests`, `reservations`, `members` e `fan_memberships`, e a vista `partnership_public`. O ledger remoto indica seis migrações; o repositório contém catorze ficheiros SQL.

O código de conteúdo e o Control Room dependem ainda de `artists`, `artist_releases`, `artist_status`, `camping_events`, `camping_sessions`, `site_flags`, `gallery_items`, `media_assets`, `tapes`, `releases`, `merch_products`, `merch_variants`, `inventory_movements`, tabelas da rádio, `admin_profiles`, `audit_logs`, `site_settings`, `site_sections` e `drop_campaigns`.

Foram adicionados o inventário tipado `src/lib/backend-schema-contract.ts`, o teste `src/lib/backend-schema-contract.test.ts`, o painel de diagnóstico e a rota `/control-room/schema-contract`. O diagnóstico verifica endpoints de tabela/vista com leitura limitada a zero linhas e verifica apenas RPCs de leitura.

Não foi aplicada qualquer migração ou alterado o schema. As migrações versionadas dependem de tabelas base que não aparecem no schema remoto. O issue #32 fica aberto até à reconciliação da baseline, revisão das políticas e passagem dos testes end-to-end.
