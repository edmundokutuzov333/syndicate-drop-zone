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

## FASE 12 · IMPLEMENTAÇÃO

- Implementação consolidada em branch de execução e PR #10, sem reescrever histórico publicado.


## FREQÜÊNCIA 808

- A emissão é sincronizada por relógio de servidor e seed determinística. Cada ouvinte calcula localmente a mesma posição da grelha.
- A rádio automática só reproduz áudio próprio/licenciado já servido pelo site. Os links e embeds Spotify são usados para descoberta e pré-visualização oficial; não são retransmitidos como emissão não-interactiva.
- A identificação oficial fornecida pelo dono é a referência editorial da estação. Enquanto o binário não estiver disponível no armazenamento público do site, a grelha usa um stinger/kick fallback para nunca interromper a emissão.
- A Frequência reutiliza o barramento de áudio e AnalyserNode existentes e o MiniPlayer global, mas bloqueia skip/seek no modo rádio.
- O contador de ouvintes usa apenas um SID de sessão pseudónimo e heartbeat temporário, sem PII ou fingerprinting.
