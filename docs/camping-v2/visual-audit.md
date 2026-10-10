# CAMPING V2 · Auditoria visual avançada

**Data:** 2026-10-10  
**Branch:** `main`  
**Estado:** correcções visuais implementadas no código. A validação no browser e a publicação integral do HEAD continuam pendentes.

## Referência e método

A panorâmica Xoyens fornecida é a referência da sala: tecto curvo em madeira, vigas, parquet, iluminação quente, zona de produção, mural de cores, área de fotografia preta e branding do Sindicato. O GLB continua a ser geometria glTF real, não uma imagem de fundo.

O modelo tem envelope declarado de 14,2 × 9,2 m, altura de parede de 3,2 m, 102 meshes, 150 primitivas, 26 materiais e 13 imagens embebidas. A estrutura foi inspeccionada pelo JSON interno do GLB. Como existe apenas uma panorâmica, as superfícies ocultas e as medidas exactas do espaço não podem ser provadas como réplicas métricas perfeitas; os ajustes mantêm o eixo, o envelope e a distribuição já aprovada no modelo.

## Problemas concretos encontrados

1. **Parede dos artistas:** os 17 slots físicos existiam, mas os nós `studio.artist-slot-001` até `studio.artist-slot-017` estavam marcados como placeholders. O runtime não estava a substituir as superfícies pretas pelas fotografias publicadas.
2. **Logo Xoyens:** o asset oficial `src/assets/brand/xoyens.png.asset.json` existia no repositório, mas não era usado pelo motor 3D.
3. **Pano do Sindicato:** o selo oficial estava representado por uma superfície plana sobre o fundo de fotografia preto. Faltava uma superfície de tecido com parallax, pregas e fixações físicas.
4. **Entrada 808:** antes da porta aparecer aberta, a interface repetia a descrição do protocolo, as instruções de teclado/rato, o código e vários labels de ambiente.

## Correcções efectuadas

### Retratos reais, visíveis sem clique

- O motor inicia a leitura do roster publicado enquanto o visitante ainda está na entrada.
- Os registos são mapeados por código canónico `SDT-01` a `SDT-17`, nunca pela posição de um array não validado.
- A imagem `photo_url` de cada artista publicada é aplicada ao material da superfície fotográfica dentro da moldura física do GLB.
- O código reconhece tanto slots GLTF com primitivas separadas como meshes com múltiplos materiais; substitui somente a superfície preta da fotografia, preservando moldura, papel e madeira.
- A textura é configurada para os UVs do GLTF, espaço de cor sRGB e filtragem anisotrópica limitada.
- Se faltar um artista ou uma imagem, o runtime não desloca a fotografia de outro membro nem fabrica um retrato. O roster observado no Supabase tem 17 artistas publicados e URLs de fotografia presentes.

### Logo oficial Xoyens com backlight

- Foi usado o asset oficial existente, não foi redesenhado nem substituído por uma imitação.
- O letreiro é um conjunto físico no painel de madeira da zona de produção: caixa escura com espessura, moldura metálica, canal LED quente e luz de recorte por trás.
- O plano de imagem está à frente da caixa e usa o asset transparente `xoyens.png`. A iluminação é emitida por materiais e luzes 3D, não por um elemento HTML sobreposto ao ecrã.

### Bandeira preta com selo grande

- Foi acrescentado um pano de 5,25 × 2,78 m no suporte que já existe na zona de fotografia.
- A superfície tem 48 × 28 subdivisões, ondulação pequena e irregular, um material escuro derivado do material PBR de tecido do próprio GLB e cópias próprias dos mapas de cor e normal.
- Foram adicionados uma barra metálica e três grampos físicos.
- O selo é o PNG oficial do Sindicato, mapeado numa superfície própria sobre o tecido. O antigo plano do selo é ocultado para não gerar duas impressões sobrepostas.
- A área continua ligada ao identificador `studio.photo-backdrop`; a nova geometria mantém a interacção do fundo fotográfico.

### Entrada reduzida ao essencial

- A zona de entrada apresenta apenas `STUDIO XOYENS`, `808`, `Código de acesso` e os três dígitos.
- Os labels verticais de marketing e o bloco de instruções de teclado/rato desaparecem enquanto a porta está fechada.
- Durante a transição, a mensagem foi reduzida para `A preparar o estúdio` ou `Pode entrar`.
- As instruções de movimento ficam disponíveis quando o utilizador já está dentro. O modo de navegação guiada e o acesso aos registos mantêm-se para acessibilidade.

## Testes adicionados

`src/features/camping/scene/camping-visual-contracts.ts` e o respectivo teste validam:
- mapeamento dos 17 códigos de artista para os 17 nós de moldura;
- ausência de colisões entre slots;
- exclusão de códigos inválidos, duplicados, imagens vazias e membros fora do roster;
- ausência de retratos inventados para slots sem registo publicado.

O teste do contrato visual foi acrescentado ao conjunto Vitest existente. Não foi possível executar os testes do repositório num sandbox Vercel: a criação de sandbox devolveu `403 forbidden`. A ferramenta de workflows GitHub disponível não expõe os runs de push e o estado Vercel está limitado por `build-rate-limit`. Por isso, não é correcto afirmar que Vitest, lint, Playwright ou uma inspeção visual de browser passaram.

## Publicação e bloqueios

O deployment Vercel conhecido como `READY` continua associado ao commit anterior de runtime `2eede7f4157f603bc9c27202b60d496c3fd7f25b`. As correcções dos retratos, do letreiro, da bandeira e da entrada estão na `main`, mas ainda não foram comprovadas numa publicação Vercel que contenha todas estas alterações. O estado do Lovable também não foi confirmado para o commit mais recente do motor.

## Critérios para fechar a auditoria

1. Verificar o deployment que inclua o commit do motor, a UI e o manifesto actualizado.
2. Abrir `/camping` no browser, introduzir `808` e confirmar visualmente as 17 fotografias, o letreiro Xoyens, as pregas do pano e o selo em grande escala.
3. Inspeccionar os erros da rede para os 17 `photo_url` e para os assets `xoyens.png` e `sindicato-selo.png`; confirmar que todos respondem com sucesso.
4. Correr `npm test`, `npm run lint`, `npm run build` e `npm run test:e2e` no mesmo commit.
5. Repetir a experiência em desktop e móvel e comparar proporções, leitura das molduras, sombra, exposição e qualidade das texturas.

**Conclusão:** as faltas visuais identificadas foram corrigidas no código. A fidelidade métrica absoluta não pode ser garantida com uma única imagem de referência e a certificação visual final depende de inspeccionar o runtime actualizado no browser.
