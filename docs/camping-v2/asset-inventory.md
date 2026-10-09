# CAMPING V2 · inventário de assets

**Base auditada:** main @ b694bb87dab5aefdf5b48f76802a0fbf31a9395e

Este inventário distingue os ficheiros binários existentes no Git dos manifestos de assets geridos pelo sistema de assets do projecto. Os ficheiros *.asset.json são contratos de asset e não devem ser tratados como fotografias ou movidos sem actualizar as importações.

## 1. Referência arquitectónica principal

- Origem: referência visual Xoyens enviada na conversa de 09-10-2026.
- Dimensões da imagem enviada: 1774 × 887 px.
- Estado no repositório: não existe cópia desta imagem no tree de main.
- Uso previsto: referência de modelação para proporções, madeira curva no tecto, pavimento, parede preta com logo, zona de produção, fundo de fotografia, roupa, luzes e paredes.
- Limitação: uma única perspectiva panorâmica não revela a geometria completa das paredes ou as dimensões reais. A Fase 2 deve recolher vistas adicionais e medidas, sem alterar arbitrariamente a composição reconhecível.

## 2. Branding real disponível

| Asset | Manifesto | Asset ID | Tamanho original declarado | Uso |
|---|---|---|---:|---|
| Logo oficial Sindicato | src/assets/brand/sindicato-logo.png.asset.json | 8d1c8b73-1330-4900-8723-85f98946699a | 343251 bytes | Logo aplicado à parede preta e aos objectos autorizados |
| Carimbo/selo oficial | src/assets/brand/sindicato-selo.png.asset.json | 1fa67bdd-f452-442e-a0d5-a9fb482388de | 683177 bytes | Papel, roupa, caixas, vinis e outros objectos seleccionados |
| Logo Xoyens | src/assets/brand/xoyens.png.asset.json | b0478989-7ffd-43dd-92e0-a801662907ae | 59569 bytes | Referência da marca do estúdio |
| PHANTOM | src/assets/brand/phantom-clean.png | ficheiro binário no Git | 48673 bytes | Marca parceira já usada no footer |
| Ícone SDT | public/icons/sdt-192.png, public/icons/sdt-512.png, public/apple-touch-icon.png | ficheiros binários no Git | 3393 bytes cada | Ícones PWA, não substituem necessariamente o logo de parede |

Os três manifestos Sindicato/Xoyens apontam para assets geridos sob /__l5e/assets-v1/ e contêm chaves R2. Devem continuar a ser importados como manifestos e usar o URL fornecido pelo asset loader. Não redesenhar, recriar nem substituir estes ficheiros por versões geradas.

## 3. Retratos e pessoas

- src/assets/artists/a01.jpg.asset.json até a17.jpg.asset.json: 17 referências de retratos actualmente importadas por src/lib/artist-profiles.ts.
- src/assets/artists/a05b.jpg.asset.json também existe e é a referência actualmente importada no slot a05.
- src/assets/artists/a05.jpg.asset.json existe em paralelo e não é a importação usada pelo perfil actual; confirmar se é legado antes de o remover.
- Roster estático em src/lib/artist-profiles.ts: 17 perfis.
- O brief alterna entre 17 e 18 membros. A parede deve ser alimentada por entidades do backend quando o schema estiver reconciliado; nunca preencher a lacuna com um retrato inventado.
- src/assets/m1.jpg…m6.jpg: imagens usadas pelo array estático MEMBERS em src/lib/data.ts, com codinomes ficcionais operacionais. Não as tomar automaticamente como retratos oficiais dos artistas.
- Conteúdo público oficial adicional: tabela artists e photo_url, quando acessíveis no backend.

## 4. Galeria, vídeo, merch e música existentes

- src/assets/gallery/g1.jpg…g4.jpg: quatro imagens no Git.
- src/assets/gallery/v1.mp4.asset.json: manifesto de vídeo gerido.
- src/assets/p1.jpg…p4.jpg: quatro imagens de produtos, usadas no array estático MERCH.
- src/assets/tapes/nova-wave.mp3.asset.json
- src/assets/tapes/phantom-mode.mp3.asset.json
- src/assets/tapes/fashiion.mp3.asset.json
- src/assets/tapes/intro.mp3.asset.json

Em public/audio existem nove ficheiros musicais para a Frequência 808 e a tag Frequencia_808_tag.mp3. O WAV KHRYIS - A Bag.wav tem aproximadamente 21,3 MB, por isso não deve ser duplicado dentro de GLB ou carregado no início da cena. Música e assets de áudio mantêm-se externos à geometria 3D e são carregados apenas quando solicitados.

Os nove ficheiros de rádio não são automaticamente o catálogo de MUSIC nem o catálogo de BEATS. A Fase 5 deve resolver IDs e direitos de acesso a partir das tabelas e do catálogo de origem.

## 5. Assets 3D inexistentes no tree actual

A pesquisa recursiva ao repositório não encontrou ficheiros .glb, .gltf, .fbx, .obj, .blend, .ktx2 ou .basis. Não há geometria 3D pronta do estúdio, do iMac, do rack, dos cabides ou das portas.

A Fase 2 deverá criar:
- ficheiro-fonte Blender e versão GLB exportada da sala principal;
- modelos reutilizáveis de mobiliário e equipamento;
- materiais PBR para madeira, concreto, metal, couro, vidro, papel, tecido e espuma acústica;
- colliders simplificados separados da geometria visual;
- texturas KTX2 para o conteúdo com mais peso;
- LODs ou variantes simplificadas para dispositivos mais fracos;
- manifestos/versionamento para carregamento diferido por sala.

## 6. Pipeline e critérios de conservação

1. Assets oficiais são imutáveis do ponto de vista da identidade da marca; não redesenhar logos.
2. Todo asset 3D deve ter origem, licença/autor, dimensões e versão registados.
3. Separar geometria visual de colisão.
4. Objectos repetidos devem reutilizar mesh e materiais sempre que possível.
5. Evitar incluir áudio, ficheiros de vídeo longos ou texturas de alta resolução no modelo GLB principal.
6. Publicar primeiro a sala principal e carregar cada sala adicional apenas quando o utilizador se aproxima ou entra nela.
7. Manter a imagem de referência original arquivada durante o trabalho de modelação. Se a equipa precisar de a abrir fora desta conversa, versionar uma cópia de referência num commit dedicado na Fase 2.
