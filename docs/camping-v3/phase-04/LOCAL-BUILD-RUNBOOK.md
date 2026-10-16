# Execução local alternativa da Fase 04

O runner do GitHub tem falhado antes do primeiro step. A causa exacta permanece UNKNOWN até ser recolhido o texto original de Annotations. Não se deve alterar Blender ou o código para resolver uma falha que ainda não chegou a executar os steps.

## Pré-voo

Na raiz do repositório, usar Node.js 22, Python 3, Git e acesso de rede a download.blender.org. O Git LFS é necessário para promover o binário após certificação, não para os testes unitários do verificador.

Executar o mesmo fluxo usado pelas rotas de build:

    node scripts/3d/doctor.mjs
    bash scripts/3d/install-blender.sh
    source scripts/3d/env.sh
    bash scripts/3d/local-build.sh

O script local instala as dependências do projecto, compila os scripts Python, valida a Scene Bible, corre npm run 3d:blend, reabre e valida a cena, corre npm run 3d:blend:validate, tenta gerar o relatório e o GLB, e empacota os logs e códigos de saída mesmo quando falha.

## Entrega

No fim, procura art/_delivery/phase04-delivery-*.zip ou a alternativa tar.gz, com o sidecar .sha256. Se o build falhar, anexa a entrega e os logs de art/_delivery/logs em vez de descartar a evidência.

Não declares a fase certificada só porque o script foi executado. O gate é node scripts/3d/verify-delivery.mjs sobre a entrega produzida, com o resultado Fase 04 certificável e código zero, incluindo os códigos validate=0, blend=0, blend-check=0 e verify=0.

Não commits um .blend criado à mão, ponteiro LFS, GLB sintético ou relatório fabricado. Só o binário produzido por uma execução real e confirmado por SHA-256 pode ser promovido através de Git LFS.
