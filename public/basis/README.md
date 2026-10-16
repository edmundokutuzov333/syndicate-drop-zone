# Basis Universal runtime files

The files basis_transcoder.js and basis_transcoder.wasm are generated from the installed Three.js package by scripts/copy-basis-transcoder.mjs during predev/prebuild and CI.

Do not copy or update these binaries manually. Their source version must match the Three.js package installed from the lockfile. KTX2 loading is not activated in the production runtime until the relevant CAMPING phase has verified the asset-loader integration.
