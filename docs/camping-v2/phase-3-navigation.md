# CAMPING V2: Fase 3, navegação e acesso 808

**Estado de implementação:** runtime Three.js ligado à rota existente `/camping`, com carregamento do GLB `/models/camping/xoyens-studio.glb`, porta de entrada animada, keypad 3D, máquina de estados, colisões por eixos, controlos desktop e tácteis, modo guiado e fallback WebGL.

## Percurso implementado

`LOCKED → CODE ENTRY → ACCESS GRANTED → DOOR OPENING → ENTERING STUDIO → EXPLORATION`

O código 808 funciona como acesso temático, não como autenticação de conteúdo privado. A entrada pode ser feita no keypad 3D ou por teclado. O teclado acessível do fallback também aceita dígitos, limpar e confirmar.

## Controlos

- Desktop: WASD/setas para andar, arrastar rato para olhar, clique para interagir, ESC para regressar/fechar foco.
- Mobile: arrastar para olhar, botões tácteis para movimento e toque para interagir.
- Alternativa guiada: pontos de entrada, produção, fotografia, roupa e parede de membros.
- Se WebGL falhar, o utilizador mantém acesso aos registos públicos e à saída.

## Colisões e interacções

A movimentação é limitada aos bounds da sala e aos volumes de colisão definidos para secretária, cadeira, subwoofer, sofá, rack, fundo fotográfico, sistema de áudio e unidade de ar condicionado. A resolução separada de X e Z permite deslizar ao longo dos obstáculos.

O raycasting selecciona apenas objectos com identificadores de interacção, além do keypad físico. Os objectos são focados por transições suaves de câmara e é possível regressar à posição anterior.

## Compatibilidade com a experiência existente

A rota `/camping` e os seus dados de sessões, estado LIVE, galeria, presença e subscrições Realtime foram preservados. O painel de registos continua acessível. Não foram alteradas tabelas ou políticas Supabase.

## Validação e bloqueadores

- Testes unitários da máquina de estados 808 e das colisões presentes no repositório.
- O Playwright executa `tests/radio/camping-entry.spec.ts` juntamente com os testes da rádio.
- A execução CI `37960901525` falhou nos dois testes E2E do Camping e no teste do Cartão de Fã. Os logs mostram erros SSR em `src/routes/__root.tsx` ao aceder a `location.pathname` quando `location` não está definido no contexto de head. Esta falha foi corrigida com fallback para `/`.
- O keypad de acessibilidade tinha uma expressão regular incorrecta para dígitos; corrigida para aceitar um único algarismo.
- A certificação só fica concluída depois de nova execução CI, carregamento do GLB e percurso E2E passarem. A publicação READY por si só não prova o percurso funcional.
