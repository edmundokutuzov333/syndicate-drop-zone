# DECISIONS

## Fase 5 · Carteira de Sindicalizado

- O top 3 de Delegados terá direito ao zine gratuito apenas como regra editorial proposta. O sistema não automatiza a atribuição do prémio nesta fase.
- A API pública nunca devolve telefone/email. A tabela `members` é privada para `anon` e `authenticated`; a verificação pública usa apenas funções RPC que devolvem código, número, codinome e data.
- O mesmo contacto normalizado só pode gerar uma filiação. Segunda tentativa devolve `already_member=true` sem devolver o código existente.
- A fotografia é processada no cliente para o cartão 1080×1920 e não é publicada como dado pessoal na API pública.
- O fluxo inclui honeypot silencioso para submissões automatizadas.
- Não foi activado rate limit por IP/dispositivo nesta fase porque o backend activo ainda não tem uma camada Edge dedicada para essa política. A unicidade de contacto e o RLS ficam activos como controlos de base. Antes de campanhas de aquisição pagas, activar rate limiting no Edge/WAF.

## Fase 7 · Sala de Revelação v2

- A fonte editorial primária passou a ser `gallery_items`; `revelation_media` é mantida como fallback compatível para não interromper a sala enquanto a migration está pendente.
- A galeria pública só lê linhas publicadas; criação/upload de ficheiros permanece reservado para a Fase 11 / cofre.
- O projector usa `dialog` nativo, navegação por teclado/swipe e vídeo mudo por defeito. O autoplay é desligado em `data-lite`.
- O halftone real usa canvas com cache e mantém `Halftone` CSS como fallback de primeiro paint/rede.
- A luz vermelha é um estado de UI temporário apenas na rota de Revelação e é removida ao sair da rota.
