# CAMPING V2 · Fase 1 — auditoria, arquitectura e contratos

**Estado da fase:** auditoria executada e contratos documentados. **Gate de saída: BLOQUEADO** até à reconciliação do schema Supabase descrita na issue #32. Não foram feitas alterações de runtime nem DDL na base de dados nesta fase.

## 1. Snapshot auditável

- Repositório: edmundokutuzov333/syndicate-drop-zone
- Branch: main
- Commit auditado: b694bb87dab5aefdf5b48f76802a0fbf31a9395e
- Projecto Supabase apontado pelo frontend: hhipwyixtbleiulfnvvm (sindicato do trap), estado ACTIVE_HEALTHY.
- Lovable: projecto publicado, status ready e latest_commit_sha igual ao commit auditado.
- Vercel: deployment production READY para o mesmo SHA; URL observada: https://syndicate-drop-zone-7ff5dz3gj-kutuzov.vercel.app
- CI do SHA auditado: Camera Production CI terminou em failure no passo global “Radio browser smoke tests”. Instalação, FFmpeg smoke test, Camera lint, Engineering tests e Production build passaram. Este estado não certifica um percurso visual da futura cena 3D.
- A tentativa de abrir /camping no preview Lovable e no URL público através do browser de validação disponível não foi bem sucedida. O preview existe no registo Lovable, mas o teste browser directo fica por executar.

## 2. Arquitectura actual de /camping

### Rota e shell

A rota permanece em src/routes/camping.tsx. Usa loader para carregar em paralelo:

- getLiveCampingSessions()
- getLiveFlags()
- getLiveCampingGallery()
- getLiveRevelationMedia()

Se a galeria de CAMPING vier vazia, o loader usa media de Revelação como fallback. O componente calcula sessão actual e próxima, actualiza o relógio a cada segundo e muda a sala seleccionada para a sala da sessão activa.

A shell global está em src/routes/__root.tsx. Envolve as rotas com CodeGate, TacticalNav, MiniPlayer, preparação da Frequência 808, footer global e tratamento global de erros. Na futura experiência imersiva, a navegação e o footer convencionais devem sair do campo de visão enquanto o utilizador está dentro do estúdio, sem remover o controlo de saída, os requisitos do CodeGate ou os elementos de áudio necessários.

### Componentes actuais

- src/components/BunkerMap.tsx: planta SVG 2D. Declara seis zonas rectangulares estáticas: ESTÚDIO, ESTAMPA, VISUALIZER, FOTO, NETWORKING e LIVE. Não existe cena tridimensional nesta implementação.
- src/components/CampingSessions.tsx: lista e selecção de sessões.
- src/components/CampingLive.tsx: estado LIVE e próxima sessão.
- src/components/ArtistPresence.tsx: presença de artistas.
- src/lib/camping-data.ts: adaptadores de sessões, flags, galeria, presença, URL LIVE, notificações e subscrição.
- src/components/control-room/CampingControlRoom.tsx: gere flags LIVE/CAMP, artistas e estados de presença.
- src/components/control-room/ControlRoomModule.tsx: define também o módulo editorial CAMPING com tabelas camping_events e camping_sessions.
- src/routes/control-room.camping.tsx: rota do Control Room para CAMPING.

O adaptador LIVE usa Supabase Realtime e um polling de 1500 ms. Na Fase 5, a estratégia deve ser revista com base na latência requerida e no custo de rede; não copiar automaticamente este polling para todos os objectos 3D.

## 3. Árvore de rotas que deve continuar intacta

Rotas identificadas no router actual:

- /
- /camera
- /camping
- /carteira/$code
- /control-room
- /control-room/actividade
- /control-room/artistas
- /control-room/camping
- /control-room/drop
- /control-room/login
- /control-room/media
- /control-room/merch
- /control-room/musica
- /control-room/parcerias
- /control-room/radio
- /control-room/revelacao
- /control-room/seo
- /control-room/sindicalizados
- /control-room/sistema
- /control-room/site
- /control-room/utilizadores
- /filiar
- /frequencia
- /membros
- /membros/$slug
- /merch
- /revelacao

A reconstrução não cria uma rota paralela para substituir CAMPING. A implementação 3D entra por /camping e mantém os contratos de URL existentes, incluindo o parâmetro de pesquisa media, enquanto estes continuarem necessários.

## 4. Stack alvo e compatibilidade

### Estado encontrado no package.json

- React: ^19.2.0
- React DOM: ^19.2.0
- Three.js: ^0.185.1
- TypeScript: ^5.8.3
- Vite: 8.1.5
- TanStack Start: 1.168.60
- TanStack Router: 1.170.41
- Tailwind CSS: ^4.2.0

Ainda não constam do package.json @react-three/fiber, @react-three/drei, @react-three/rapier, @react-three/postprocessing, GSAP ou Framer Motion. Também não há assets de geometria GLB/GLTF/FBX/OBJ/BLEND nem texturas KTX2 no tree do repositório.

### Decisão para a Fase 2

1. Usar @react-three/fiber v9, compatível com React 19 segundo a documentação oficial. Não começar por v10 alpha.
2. Usar @react-three/drei para carregar GLB, câmara, raycasting e HTML ancorado a objectos 3D, após confirmar peer dependencies com a versão exacta do projecto.
3. Avaliar @react-three/rapier v2 para colisões e movimento da câmara, compatível com Fiber v9 e React 19.
4. Usar animações nativas de Three.js para portas e trajectórias de câmara. Só adicionar GSAP se o prototype demonstrar uma vantagem clara sobre o bundle e a arquitectura existentes.
5. Adicionar postprocessing apenas depois de medir a cena base. O realismo principal deve vir da geometria, materiais PBR, textura e iluminação, não de uma cadeia longa de efeitos.
6. Modelar no Blender e exportar GLB. Optimizar com glTF Transform, Meshopt e KTX2/Basis Universal depois de avaliar qualidade e compatibilidade.
7. Carregar cada sala sob demanda. A sala oculta não deve consumir a mesma memória da sala activa.

Referências técnicas:
- https://r3f.docs.pmnd.rs/getting-started/installation
- https://drei.docs.pmnd.rs/
- https://github.com/pmndrs/react-three-rapier
- https://gltf-transform.dev/

## 5. Arquitectura-alvo

~~~text
src/routes/camping.tsx
  loader de dados reais
  shell da rota e estado de entrada
  Suspense / boundary de erro WebGL
  CampingExperience.client.tsx
    scene/
      CampingScene
      StudioEnvironment
      StudioLighting
      MaterialLibrary
    rooms/
      EntryRoom
      XoyensStudioRoom
      ArchiveRoom
      ListeningRoom
      SecretRoom
    objects/
      AccessKeypad
      ImacWorkstation
      ArtistsWall
      ClothingRack
      RecordingDesk
      AudioSystem
      ArchiveBoxes
      InteractiveDoor
    camera/
      FirstPersonController
      TouchController
      GuidedNavigation
      CameraTransitions
    interactions/
      InteractionRegistry
      RaycastInteractor
      ProximityHint
      InteractionStateMachine
    interface/
      DiegeticComputerUI
      ArtistDossierOverlay
      ProductOverlay
      AudioPlayerOverlay
      AccessibleNavigation
    audio/
      StudioAmbience
      InteractionSounds
      MusicPlaybackAdapter
    data/
      campingRepository
      artistsRepository
      musicRepository
      merchRepository
      mediaRepository
      roomManifest
    performance/
      AssetLifecycle
      QualityProfile
      DeviceCapabilities
~~~

A cena 3D corre apenas no cliente. Os dados necessários para SEO e carregamento da rota continuam no loader, sem importar WebGL ou tocar em APIs do browser no caminho de renderização do servidor. O erro de WebGL deve produzir uma mensagem funcional e uma alternativa de navegação acessível, não um ecrã preto.

## 6. Grafo espacial aprovado para o planeamento

~~~text
ENTRY / ACCESS 808
    |
    | código correcto + animação real da porta
    v
ROOM 01 / XOYENS STUDIO
    |-- iMac / MUSIC
    |-- iMac / BEATS
    |-- parede / ARTISTS
    |-- rack / MERCH
    |-- mesa / SESSIONS
    |-- sistema de som / LISTEN
    |-- porta / ROOM 02
    |       ARCHIVE
    |-- porta / ROOM 03
    |       LISTENING ROOM
    |-- gaveta ou armário escondido
            SECRET ROOM
~~~

Os objectos e salas são detalhados em scene-contract.json. ROOM 02, ROOM 03 e SECRET ROOM têm identificadores estáveis desde já, mas os modelos e a geometria não devem ser carregados durante a primeira entrada no estúdio.

## 7. Contratos de dados e fonte de verdade

O frontend não deve guardar nomes, preços, stock, capas ou URLs de música no modelo 3D. O modelo só contém identificadores espaciais e referências a entidades. A fonte de verdade é o backend ou o catálogo editorial existente, através de adaptadores tipados.

- Artistas: artists + artist_releases e os assets de fotografia. O perfil estático em src/lib/artist-profiles.ts contém actualmente 17 perfis e referências a a01…a17. O pedido de 18 retratos está em conflito com esta fonte: não inventar um 18.º membro. Confirmar o roster oficial antes de colocar os retratos na parede.
- Presença: artist_status, quando schema e políticas estiverem reconciliados.
- Sessões: camping_events e camping_sessions, conforme o Control Room existente.
- Estado CAMP/LIVE: site_flags.
- Galeria e assets: gallery_items, media_assets e fallback limitado de Revelação.
- MUSIC: catálogo de tapes/releases/artist_releases e os ficheiros reais. Não confundir o catálogo de tapes com um catálogo de beats.
- BEATS: a auditoria não encontrou uma fonte de catálogo de beats inequivocamente definida. O contrato de beats tem de ser fechado antes de ligar a pasta BEATS.
- MERCH: a página actual inclui quatro produtos estáticos e imagens p1…p4; o Control Room prevê merch_products, merch_variants e inventory_movements, além de reservations. O preço e o stock da experiência 3D não podem depender dos arrays estáticos.
- Membership: members e fan_memberships são conceitos diferentes e devem continuar separados.

Os contratos legíveis por máquina encontram-se em data-contract.json. Nenhuma migração foi aplicada nesta fase.

## 8. Bloqueador de schema Supabase — não ignorar

A ligação configurada no frontend aponta para o projecto Supabase hhipwyixtbleiulfnvvm. A inspecção read-only do schema public devolveu quatro tabelas base — fan_memberships, members, partnership_requests e reservations — e a view partnership_public.

O código do site e do Control Room pede também artists, artist_releases, tapes, releases, camping_events, camping_sessions, site_flags, artist_status, gallery_items, media_assets, revelation_media, merch_products, merch_variants, inventory_movements, site_settings, site_sections, drop_campaigns, admin_profiles e audit_logs. Estas tabelas não apareceram no inventário remoto observado.

O ledger remoto devolveu seis migrações, enquanto o repositório contém catorze ficheiros SQL. A migração de CAMPING 20261008123000_phase8_camping.sql não aparece no ledger remoto. Existem ainda migrações de auditoria que pressupõem tabelas de conteúdo pré-existentes. Portanto, não é seguro repetir cegamente todos os ficheiros SQL nem assumir que o repositório contém a migração-base que criou essas tabelas.

A issue #32 regista a evidência e o trabalho obrigatório:
https://github.com/edmundokutuzov333/syndicate-drop-zone/issues/32

Até a reconciliação estar concluída, a Fase 1 tem os contratos documentados mas o gate de saída permanece bloqueado. Esta é uma discrepância real entre frontend, Control Room e database, não uma limitação do modelo 3D.

## 9. Segurança e direitos de acesso

- O código 808 é uma entrada temática, não autenticação real.
- Dados públicos podem aparecer na cena apenas através das regras de publicação actuais.
- Demos inéditas, arquivos restritos e media privados precisam de autorização no backend/RLS e URLs temporárias quando necessário.
- IDs de objectos 3D não são tokens de autorização.
- Produtos e stock são validados no backend no momento da operação.
- Nenhuma service-role key pode entrar no bundle do cliente.
- O estado de uma porta visual não substitui a política de acesso ao conteúdo atrás dela.

## 10. UX, acessibilidade e ciclo de vida

- Desktop: WASD, olhar com rato, clique para interagir, ESC para fechar interfaces; captura do rato com saída clara.
- Mobile: gesto de olhar e controlos tácteis explícitos; alvo táctil mínimo de 44 px para os controlos HTML auxiliares.
- Alternativa guiada: abrir salas e objectos através de uma lista discreta sem exigir movimento livre.
- Reforçar estados LOCKED, LOADING, ERROR, ACCESS GRANTED, INTERACT e RETURN.
- Respeitar prefers-reduced-motion; permitir reduzir efeitos e silenciar o ambiente.
- Perda de WebGL/contexto, falha de asset ou áudio bloqueado não pode bloquear o resto do site.
- Teclado e leitores de ecrã precisam de acesso aos principais destinos e de uma alternativa a cada hotspot 3D.
- Não colocar UI de SaaS genérica por cima do estúdio. Labels curtas, mono/industrial, linhas finas, creme sujo, carvão e vermelho-sangue apenas como sinalização.

## 11. Critérios de aceitação da Fase 1

- [x] A rota /camping e a sua shell foram lidas.
- [x] O SVG BunkerMap e os componentes actuais foram inventariados.
- [x] O Control Room CAMPING e o módulo genérico que gere tabelas foram lidos.
- [x] A árvore de rotas foi registada.
- [x] React, Three.js e dependências 3D presentes/ausentes foram confirmados em package.json.
- [x] Assets de marca, artistas, galeria, merchandise e áudio foram inventariados.
- [x] O Supabase remoto foi consultado apenas em leitura; schema e ledger de migrações foram registados.
- [x] O estado de sincronização Lovable/GitHub e o último deployment foram consultados.
- [x] Contrato espacial e contrato de dados versionados foram produzidos.
- [ ] Gate de saída: reconciliar o schema remoto e confirmar o roster oficial (17 vs 18).
- [ ] Testar directamente o preview Lovable e /camping em browser interactivo.

Não começar a modelação detalhada nem a integração 3D com o schema em estado incerto. A execução da Fase 2 só começa depois de fechar o bloqueador de dados e reunir referências geométricas adicionais do estúdio.
