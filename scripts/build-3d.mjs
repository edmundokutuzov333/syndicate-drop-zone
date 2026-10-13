#!/usr/bin/env node
// Pipeline glTF: deduplicação, weld, LOD, instancing, compressão KTX2 e Meshopt.
// A cena-fonte deve ser produzida em fases posteriores; este CLI não inventa geometria.
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(
    "CAMPING V3 GLB pipeline\n\n" +
    "Uso: node scripts/build-3d.mjs [art/out/xoyens-studio.raw.glb] [public/models/camping]\n\n" +
    "Gera xoyens-studio.high.glb, xoyens-studio.mid.glb e xoyens-studio.low.glb.\n" +
    "Requer @gltf-transform/*, meshoptimizer, sharp, KTX-Software (ktx + toktx) e uma cena-fonte GLB.\n" +
    "O pipeline falha se a fonte não existir, se a compressão KTX2 não estiver disponível ou se os budgets de saída forem excedidos."
  );
}

if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h" || arg === "help")) {
  usage();
  process.exit(0);
}

const [srcArg = "art/out/xoyens-studio.raw.glb", outArg = "public/models/camping"] = process.argv.slice(2);
const src = resolve(srcArg);
const outDir = resolve(outArg);

if (!existsSync(src)) {
  console.error("Cena-fonte em falta: " + src);
  console.error("A cena .blend e o GLB cru pertencem às fases de modelação/exportação. Não será criado um modelo fictício.");
  process.exit(2);
}

try {
  const [{ NodeIO }, { ALL_EXTENSIONS }, functions, meshoptimizer, sharpModule, cli] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
    import("meshoptimizer"),
    import("sharp"),
    import("@gltf-transform/cli")
  ]);
  const { dedup, weld, simplify, prune, textureCompress, meshopt, instance, reorder, quantize } = functions;
  const { MeshoptEncoder, MeshoptSimplifier } = meshoptimizer;
  const sharp = sharpModule.default;
  const { Mode, toktx } = cli;
  const { execFileSync } = await import("node:child_process");

  for (const command of ["ktx", "toktx"]) execFileSync(command, ["--version"], { stdio: "ignore" });
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

  mkdirSync(outDir, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const tiers = [
    { name: "high", maxTex: 2048, ratio: 1.0, error: 0.0005 },
    { name: "mid", maxTex: 1024, ratio: 0.5, error: 0.002 },
    { name: "low", maxTex: 512, ratio: 0.25, error: 0.006 }
  ];

  for (const tier of tiers) {
    const document = await io.read(src);
    await document.transform(dedup(), prune({ keepLeaves: false }), weld({ tolerance: 1e-4 }));

    // Não achatar nem juntar nós com extras.interactionId: são contratos do produto.
    if (tier.ratio < 1) {
      await document.transform(simplify({
        simplifier: MeshoptSimplifier,
        ratio: tier.ratio,
        error: tier.error,
        lockBorder: true
      }));
    }

    await document.transform(instance({ min: 3 }));
    await document.transform(textureCompress({ encoder: sharp, resize: [tier.maxTex, tier.maxTex] }));

    const slotsForColor = /^(?!.*(normal|occlusion|metallicRoughness|lightMap)).*$/;
    const slotsForData = /(normal|occlusion|metallicRoughness)/;
    await document.transform(
      toktx({ encoder: sharp, mode: Mode.ETC1S, slots: slotsForColor, quality: 192, compression: 4 }),
      toktx({ encoder: sharp, mode: Mode.UASTC, slots: slotsForData, level: 2, rdo: true, rdoLambda: 4, zstd: 18 })
    );

    await document.transform(
      reorder({ encoder: MeshoptEncoder }),
      quantize({ quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }),
      meshopt({ encoder: MeshoptEncoder, level: "high" })
    );

    const output = resolve(outDir, "xoyens-studio." + tier.name + ".glb");
    await io.write(output, document);
    console.log(tier.name + " -> " + output + " (" + (statSync(output).size / 1048576).toFixed(2) + " MB)");
    execFileSync(process.execPath, [
      resolve(dirname(fileURLToPath(import.meta.url)), "check-3d-budgets.mjs"), output, tier.name
    ], { stdio: "inherit" });
  }
} catch (error) {
  console.error("Build CAMPING 3D falhou:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
