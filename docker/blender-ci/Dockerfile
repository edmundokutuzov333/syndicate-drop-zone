FROM ubuntu:22.04
ARG BLENDER_VERSION=4.5.14
ENV DEBIAN_FRONTEND=noninteractive BLENDER_VERSION=${BLENDER_VERSION}
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils git git-lfs zip unzip python3 build-essential libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libegl1 libxkbcommon0 libsm6 libice6 libx11-6 libxext6 libgomp1 fontconfig \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*
RUN set -eux; SERIES="${BLENDER_VERSION%.*}"; BASE="https://download.blender.org/release/Blender${SERIES}"; FILE="blender-${BLENDER_VERSION}-linux-x64.tar.xz"; \
    curl -fL --retry 5 -o "/tmp/${FILE}" "${BASE}/${FILE}"; curl -fsSL -o /tmp/blender.sha256 "${BASE}/blender-${BLENDER_VERSION}.sha256"; \
    EXPECTED="$(grep -F "${FILE}" /tmp/blender.sha256 | grep -Eo '[[:xdigit:]]{64}' | head -1)"; test -n "${EXPECTED}"; echo "${EXPECTED}  /tmp/${FILE}" | sha256sum -c -; \
    mkdir -p /opt && tar -xJf "/tmp/${FILE}" -C /opt && mv "/opt/blender-${BLENDER_VERSION}-linux-x64" /opt/blender && rm -f "/tmp/${FILE}"; /opt/blender/blender --version | head -1
ENV BLENDER_BIN=/opt/blender/blender PATH="/opt/blender:${PATH}"
WORKDIR /work
