# Fase 03: Scene Bible e plano métrico

## Inventário validado

O Scene Bible contém 54 elementos, 7 fontes de luz planeadas, materiais identificados, fontes por elemento e orçamento individual. O orçamento agregado é 221 710 triângulos, abaixo do limite high de 260 000. As 24 fatias azimutais de 15 graus e as três bandas de elevação mantêm a comparação com a panorâmica de 1774 × 887.

Os detalhes adicionados nesta fase cobrem tomadas, interruptores, cabos de alimentação e áudio, parafusos/anilhas visíveis, etiquetas técnicas, ferragens das gaiolas de candeeiro, vincos do papel de fundo, palas do painel LED, rodízios e cablagem da fita LED da estante. As gaiolas continuam a pertencer aos quatro candeeiros já existentes; o número de fontes de luz não aumenta.

## Planta útil e envolvente

- Dimensões interiores livres: 7,60 × 5,60 m, com limites X = −3,80…+3,80 m e Z = −2,80…+2,80 m.
- Chão acabado: y=0; paredes: 2,85 m; chave da abóbada: 3,45 m; flecha da abóbada: 0,60 m.
- Espessura de parede prevista: 0,14 m; envelope exterior: 7,88 × 5,88 m.
- Quatro paredes estruturais, com vãos explícitos para a porta principal e a porta da extremidade visual da panorâmica. Ambos os vãos são fechados por folhas de porta.
- Rodapé nos quatro lados com comprimento total de 26,4 m.
- Câmara de calibração inicial em (0, 1,45, 0), a olhar para −Z.

## Escala humana

As dimensões que o validador compara com os elementos são: porta 2,04 m; secretária 0,75 m de altura; monitor de 27 polegadas com 0,62 × 0,37 m; cadeira 1,15 m; cabideiro 1,70 m; tripé 2,00 m.

O metricPlan guarda 40 âncoras com coordenadas X/Y/Z e rotações, mais regras de montagem para elementos agregados e detalhes repetidos. As coordenadas são alvos iniciais de desenho, a calibrar com o harness A/B; a panorâmica é composição e não um levantamento fotogramétrico. O selo, logótipo Xoyens, estampas e retratos oficiais não são redesenhados.

## Compatibilidade com o runtime publicado

O plano-alvo de 7,60 × 5,60 m não deve ser confundido com a cena actualmente publicada. O GLB continua descrito como 14,2 × 9,2 m, paredes de 3,2 m e coroa de 4,35 m; os limites de colisão também pertencem a esse envelope maior. Não alterei o runtime nem as colisões nesta fase. A convergência deve ser executada nas fases de fonte Blender, casca e runtime, seguida de testes de colisão e navegação.

## Validação executada sobre o candidato da Fase 03

Resultado medido pelo verificador Node no candidato preparado:

- 54 elementos e 221 710 triângulos orçamentados de 260 000.
- 7 fontes de luz.
- 24/24 sectores azimutais cobertos e 72/72 células sector/elev cobertas.
- 40 âncoras métricas e 15 regras de montagem.
- Resultado: scene-bible OK.
- Aviso intencional: o GLB publicado continua com envelope legacy de 14,2 × 9,2 m; o alvo é 7,6 × 5,6 m.

Este resultado valida o conteúdo candidato preparado com a seed do kit. A conclusão da fase permanece condicionada a uma execução CI válida contra a branch, validação do preview Lovable e confirmação do deploy. A issue não deve ser fechada enquanto o runner continuar a falhar antes dos passos.
