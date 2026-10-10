# CAMPING V2 · Fase 5: backend, Control Room e conteúdo

## Estado actual

**Schema reconciliado. Contrato de colunas reforçado. Certificação funcional ainda pendente.**

Auditoria ao Supabase de produção em 2026-10-10. O projecto é `hhipwyixtbleiulfnvvm` (`sindicato do trap`), região `eu-west-1`. O código da aplicação verificado está no commit `44afcef0ed8d4cd2142414e09cf2d7b48ad6effc`.

A Vercel concluiu o deployment desse commit com estado `READY` e atribuiu os aliases `syndicate-drop-zone.vercel.app`, `syndicate-drop-zone-kutuzov.vercel.app` e `syndicate-drop-zone-git-main-kutuzov.vercel.app`. Referência: [deployment 3EdZGQeKPsqyYayGTNaRjHiRvkJg](https://vercel.com/kutuzov/syndicate-drop-zone/3EdZGQeKPsqyYayGTNaRjHiRvkJg). O estado READY confirma build e atribuição de aliases, mas não substitui os testes de browser ou a verificação autenticada do Control Room.

A inspecção directa encontrou 33 tabelas base no schema público, duas vistas, RLS activo nas 33 tabelas e dez migrações registadas no ledger remoto. O repositório contém dezoito ficheiros SQL. Não foi reaplicada nenhuma migração na base de dados durante esta execução.

## Dados reais encontrados

| Área | Contagem observada | Implicação |
|---|---:|---|
| Artistas | 17 | Roster oficial disponível. Não inventar membro 018. |
| Lançamentos de artistas | 51 | Relações de lançamento presentes. |
| Tapes / releases | 4 / 4 | Catálogo musical publicado disponível. |
| Eventos CAMPING | 6 | Eventos publicados disponíveis. |
| Sessões CAMPING | 0 | Ainda não existem sessões agendadas. |
| Media assets | 17 | Assets publicados disponíveis. |
| Gallery items / revelation media | 0 / 0 | As galerias continuam sem entradas editoriais. |
| Beats | 0 | O catálogo existe, mas não tem beats publicados. |
| Produtos / variantes merch | 0 / 0 | Não existe catálogo publicável nem stock real para vender. |
| Faixas de rádio | 9 | Catálogo da Frequência 808 presente. |
| Site settings / sections | 5 / 8 | Configuração editorial disponível. |
| Perfis administrativos | 1 OWNER activo | O perfil administrativo existe, mas o roundtrip CRUD ainda não foi autenticado nesta execução. |

Os catálogos vazios não devem ser preenchidos com informação de demonstração. A aplicação tem de apresentar um estado vazio correcto até os dados reais serem inseridos no Control Room.

## Contratos de dados e segurança

- RLS está activo nas 33 tabelas base do schema público.
- `artist_status` e `site_flags` estão na publicação Realtime.
- A vista `beats_public` tem `security_invoker=true` e não expõe o campo de áudio completo/licenciado.
- Os contadores operacionais da Frequência e as notificações LIVE não têm acesso directo a partir do cliente; são tratados por RPC.
- `create_public_merch_reservation` resolve produto, variante, tamanho, preço e stock no servidor, bloqueia a linha da variante e regista a reserva e o movimento de inventário na mesma transacção.
- A vista `partnership_public` usa `security_invoker=true`; o papel `anon` não tem SELECT na tabela de origem `partnership_requests`.
- O bucket `syndicate-media` é público. Só pode conter ficheiros aprovados para acesso público. Não usar esse bucket para material confidencial ou não publicado.
- O advisor Supabase reporta a protecção contra passwords comprometidas como desactivada. Esta definição tem de ser alterada nas definições de Auth, não através de uma migração SQL.

## Correcções feitas nesta execução

- `src/lib/backend-schema-contract.ts` passou a verificar colunas concretas com pedidos de leitura de zero linhas, em vez de aceitar apenas um `SELECT *` bem-sucedido.
- O contrato inclui as colunas exigidas pelos adaptadores de artistas, música, CAMPING, media, merch, rádio, membros e Control Room.
- Códigos PostgREST/PostgreSQL de coluna ou objecto ausente, incluindo `PGRST204` e `42703`, passam a ser classificados como ausentes.
- O contrato público `beats_public` exige `preview_url` e exclui `audio_url`; o URL completo do beat continua apenas no contrato autenticado `beats`.
- `src/lib/backend-schema-contract.test.ts` passou a cobrir colunas obrigatórias, classificação de colunas ausentes, separação do URL privado de beats e geração dos pedidos por colunas.
- Os commits de implementação são `ebd4c165f8f62c8afb2d3391a5853f3533999004` e `44afcef0ed8d4cd2142414e09cf2d7b48ad6effc`. O deployment Vercel do segundo commit ficou READY.

## Critérios ainda necessários

1. Confirmar o resultado dos workflows GitHub Actions de push para a `main`, incluindo `backend-schema-contract.yml`, CI de engenharia, build e Playwright. O conector disponível nesta execução não devolveu os runs de push, pelo que não declaro os testes verdes apenas com base na publicação Vercel.
2. Verificar visualmente `/camping` no browser, entrada 808, carregamento do GLB, modo alternativo acessível e controlos mobile. A URL de preview da aplicação não foi inspeccionável pela ferramenta de browser usada nesta execução.
3. Testar o ciclo autenticado Editor/OWNER: alteração no Control Room, escrita no Supabase, leitura posterior e conteúdo publicado. A sessão OWNER existe, mas não foi disponibilizada uma credencial de login para executar esse percurso. Não simular uma sessão administrativa.
4. Activar a protecção contra passwords comprometidas nas definições de Auth antes da certificação de segurança completa.
5. Manter sessões, galerias, beats e merch vazios até existirem dados editoriais e comerciais reais. Não criar produtos ou stock de teste em produção.

**Resultado:** o schema de produção está reconciliado, o contrato de colunas foi reforçado e o código actualizado foi publicado na Vercel. A Fase 5 continua aberta para certificação funcional, roundtrip autenticado do Control Room e validação de segurança. O issue #32 deve permanecer aberto até haver evidência dos critérios acima.
