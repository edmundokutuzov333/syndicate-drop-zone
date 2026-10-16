# Fase 12: UV2 e orçamento de lightmaps

Estado inicial: implementação em validação. A build substitui este ficheiro pelo plano calculado a partir das áreas reais do .blend reaberto.

Critérios: UVMap preservado e UV_Lightmap independente; Smart UV Project a 66 graus e island_margin 0.003; Pack Islands por lmGroup com margin 0.004; stretching máximo por ilha 1.15; padding de pelo menos 8 px no tier 4096; um atlas por grupo/tier (high 4096, mid 2048, low 1024); densidade alvo de 96 texels/m para casca/chão/tecto, 128 para heróis, 64 para props pequenos e 32 para superfícies pretas/escondidas.

Foam tiles e cabides mantêm UV2 partilhado e usam AO + IBL, sem lightmap individual. Memória total estimada com mipmaps: high até 24 MiB, mid até 10 MiB, low até 4 MiB. Esta fase não declara texturas baked, que pertencem à Fase 13. Os relatórios só certificam após execução real, promoção e verificação da produção.
