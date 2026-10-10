# CAMPING V2 · Fase 5: backend, Control Room e conteúdo

## Estado actual

**Schema reconciliado. Certificação funcional ainda em curso.** Auditoria em 2026-10-10 sobre o commit `a94dc67e23214207c97be9472510663150e94e98`, projecto Supabase `hhipwyixtbleiulfnvvm` (`sindicato do trap`).

A inspecção directa encontrou 33 tabelas base no schema público, duas vistas, RLS activo nas 33 tabelas e dez migrações registadas no ledger remoto. O repositório contém dezoito ficheiros SQL, incluindo a baseline aditiva da Fase 5 e três migrações de segurança/public view/deduplicação. As tabelas e dependências centrais já existem no backend real.

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
| Perfis administrativos | 1 OWNER activo | O perfil administrativo existe. |

Os catálogos vazios não devem ser preenchidos com informação de demonstração. A aplicação tem de apresentar um estado vazio correcto até os dados reais serem inseridos no Control Room.

## Segurança verificada

- RLS está activo nas 33 tabelas base do schema público.
- `artist_status` e `site_flags` estão na publicação Realtime.
- A vista `beats_public` tem `security_invoker=true` e não expõe o campo de áudio completo/licenciado.
- Os contadores operacionais da Frequência e as notificações LIVE não têm acesso directo a partir do cliente; são tratados por RPC.
- `create_public_merch_reservation` resolve produto, variante, tamanho, preço e stock no servidor, bloqueia a linha da variante e regista a reserva e o movimento de inventário na mesma transacção.
- A vista `partnership_public` usa `security_invoker=true`; o papel `anon` não tem SELECT na tabela de origem `partnership_requests`.
- O bucket `syndicate-media` é público. Só pode conter ficheiros aprovados para acesso público. Não usar esse bucket para material confidencial ou não publicado.

O advisor Supabase indica que a protecção contra passwords comprometidas está desactivada. Não é uma alteração SQL e não está disponível através do conector de gestão do projecto nesta execução. Deve ser activada nas definições de Auth antes de uma certificação de segurança completa.

## Correcções feitas nesta execução

- Corrigido o padrão de teclado do listener de entrada CAMPING. O código anterior usava uma expressão regular escapada de forma errada e os testes Playwright ficavam presos em `ACCESS LOCKED`.
- Substituída a fixture PNG do teste por uma imagem de 16 × 16 válida. O teste anterior falhava ao abrir a imagem, sem atingir o fluxo pretendido.
- O workflow de contrato de backend e o CI principal foram executados novamente no commit `a94dc67e23214207c97be9472510663150e94e98`. Testes de engenharia e build passaram; o resultado final Playwright está a ser confirmado.

## Critérios ainda necessários

1. CI principal e Playwright verdes com os testes de teclado CAMPING e fotografia a passar.
2. Deployment Vercel em `READY` para o mesmo commit e sincronização Lovable confirmada.
3. Verificação visual do percurso `/camping`, entrada 808 e fallback acessível.
4. Teste CRUD autenticado no Control Room para confirmar a ida e volta Editor → Supabase → conteúdo publicado. A sessão OWNER existe, mas este conector não expõe a palavra-passe do proprietário, por isso não se deve simular uma sessão administrativa.
5. Os catálogos de sessões, galerias, beats e merch devem permanecer vazios até haver dados editoriais e comerciais legítimos.

**Resultado:** o bloqueio antigo de schema ausente já foi resolvido no Supabase. A Fase 5 não deve ser marcada como integralmente certificada até passarem os testes do browser e a validação autenticada do Control Room. O issue #32 mantém-se aberto para acompanhar estes últimos critérios.
