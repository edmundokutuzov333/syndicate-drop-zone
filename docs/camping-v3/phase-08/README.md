Fase 08, Zona de Produção

Estado actual: IMPLEMENTAÇÃO EM VALIDAÇÃO. Os relatórios e capturas publicados pelo workflow são artefactos de execução, não exemplos manuais.

Contrato de modelação
A fonte de verdade é docs/camping-v3/scene-bible.json. scripts/blender/phase08_production.py fornece geometria da secretária em L, ecrã de DAW vivo, colunas com cones e bass-reflex, subwoofer, teclado MIDI de 61 teclas, cadeira executiva de alta densidade, painéis e espuma acústica, parede de tábuas com LED superior/inferior, quatro pendentes industriais, espelho, interface/caneca e cabos/ferragens. scripts/blender/build_production.py integra o módulo no construtor Blender já existente.

Gates obrigatórios
- scripts/blender/validate_production.py valida os 19 elementos prod.*, interacções, materiais cerâmico/espelho/LED, 36 teclas brancas + 25 pretas, cadeira de 14k–18k triângulos de fonte, três painéis, 30 elementos de espuma e quatro lâmpadas.
- scripts/verify-glb-contract.mjs e scripts/3d/promote-frontend-model.mjs recusam exportações que percam o ecrã DAW, materiais obrigatórios ou interacções.
- A optimização valida high/mid/low sem reduzir budgets; a promoção regista bytes e SHA-256 do GLB copiado para public/models/camping/xoyens-studio.glb.
- scripts/verify-deployed-camping-model.mjs verifica manifesto e bytes servidos por produção. A build Vite falha enquanto a rota canónica não tiver o manifesto certificado da Fase 08.

A fase só pode ser marcada como concluída depois dos gates 3D, testes de frontend, score de fidelidade do sector 100°–170° e deployment de produção terem evidência de execução. Não se assume fidelidade a partir da mera presença de geometria.
