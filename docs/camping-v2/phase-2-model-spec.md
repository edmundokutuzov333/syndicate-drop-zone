# CAMPING V2: Fase 2, modelação do estúdio Xoyens

**Estado:** o asset 3D foi produzido e versionado na `main`. O GLB ainda não está ligado à rota `/camping`. Essa integração pertence à Fase 3. A discrepância de schema registada na [issue #32](https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/32) mantém-se isolada. Não foram executadas migrações de base de dados.

## Ficheiros entregues

- `public/models/camping/xoyens-studio.glb`: modelo binário glTF 2.0.
- `public/models/camping/xoyens-studio.model.json`: manifesto de objectos, geometria, IDs e contratos de interacção.

## Escala e geometria

- Unidade: metros.
- Envelope aproximado: 14,2 m de largura, 9,2 m de profundidade, paredes com 3,2 m e tecto abobadado até 4,35 m.
- 102 grupos de objectos, 102 meshes, 150 primitivas e 26 materiais.
- 13 imagens de textura PBR embebidas no GLB.

O modelo é geometria tridimensional, não usa a imagem panorâmica como ambiente plano.

## Elementos modelados

1. Casca arquitectónica com chão, paredes, rodapés, tecto abobadado em madeira e nervuras de suporte.
2. Parquet com tábuas individualizadas e variações de tonalidade.
3. Zona de produção com mesa, teclado MIDI, iMac, monitores de áudio, subwoofer, cadeira, cabos e elementos de uso.
4. Fundo fotográfico preto com suporte, tapete, softboxes e tripés.
5. Rack metálico com pés, cabides e peças de roupa em geometria 3D.
6. Sofá de couro, guitarra, vaso e planta, mural colorido, posters e arquivo visual.
7. Candeeiros, lâmpadas quentes, sinalização vermelha discreta, tomadas, interruptores e pequenos detalhes ambientais.
8. Dezassete molduras físicas de retratos, deixadas vazias para receber as entidades publicadas do backend.

## Materiais e identidade

O GLB inclui materiais PBR e mapas de base color e normal para madeira, parquet, gesso envelhecido, pintura preta, metal, tecido, couro, papel, borracha, vidro e ecrãs.

O logo e o selo oficiais são referenciados pelos manifestos de assets existentes. Não foram redesenhados. O runtime deve validar se os URIs são resolvidos no alojamento Lovable e Vercel. Se não forem, a Fase 3 deve carregar as imagens através dos manifestos originais e aplicar os materiais sem copiar nem recriar os símbolos.

- Logo: `/__l5e/assets-v1/8d1c8b73-1330-4900-8723-85f98946699a/sindicato-logo.png`
- Selo: `/__l5e/assets-v1/1fa67bdd-f452-442e-a0d5-a9fb482388de/sindicato-selo.png`

## Contratos preparados para fases seguintes

Objectos seleccionados têm IDs estáveis em `extras.interactionId`, incluindo:

- `studio.imac`
- `studio.artists-wall`
- `studio.artist-photo.001..017`
- `studio.merch-rack`
- `studio.photo-backdrop`
- `studio.production-desk`
- `studio.audio-system`
- `studio.inner-door`

O manifesto descreve fontes de dados previstas, mas não contém nomes de artistas, preços, stock, música privada ou perfis inventados.

## Limites da entrega

- A reconstrução parte de uma só imagem panorâmica, não de um levantamento arquitectónico métrico. A geometria escondida e as medidas reais precisam de referências adicionais.
- Esta entrega contém o GLB e o manifesto, mas não um ficheiro de projecto Blender `.blend`.
- O modelo ainda não está montado em `/camping`. Navegação em primeira pessoa, colisões, keypad 808, loading progressivo, interacções runtime e ligação a conteúdo real pertencem às fases seguintes.
- A produção do asset não comprova ainda a qualidade visual final dentro do browser. Isso exige carregar o GLB num renderer real, verificar enquadramentos, texturas e os dois assets de marca. O estado correcto é asset produzido, integração visual pendente.
- A contagem oficial mantém-se em 17 perfis no código observado. Nenhum 18.º artista foi criado para preencher espaço.
- Nenhuma migração Supabase foi executada.

## Critérios da Fase 2

- [x] Modelo GLB com geometria real, sem panorama como cenário.
- [x] Casca arquitectónica, tecto curvo, parquet e mobiliário principal.
- [x] Estação de produção com computador e monitores.
- [x] Fundo fotográfico, iluminação física, rack e peças de roupa.
- [x] Materiais PBR e texturas embebidas.
- [x] Referências ao logo e selo oficiais.
- [x] Dezassete retratos vazios, preparados para dados reais.
- [x] IDs e manifesto para futura integração.
- [ ] Inspecção visual do GLB montado no runtime, prevista para a Fase 3.
- [ ] Confirmação das dimensões reais com mais fotografias e medidas.
