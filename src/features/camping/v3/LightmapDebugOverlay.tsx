import { useEffect, useState } from "react";
import "./lightmap-debug.css";

type LightmapGroupPlan = {
  atlasPx: number;
  atlases: number;
  effectiveTexelsPerM: number;
  memoryMB: number;
  surfaceM2: number;
  meshCount: number;
  targetDensityScale?: number;
  fits?: boolean;
};
type LightmapTierPlan = {
  maxPx: number;
  budgetMB: number;
  totalMemoryMB: number;
  groups: Record<string, LightmapGroupPlan>;
};
type ModelManifest = {
  phase?: number;
  productionPhase?: number;
  status?: string;
  geometry?: {
    bytes?: number;
    sha256?: string;
    lightmapUV?: {
      sourceStatus?: string;
      meshCount?: number;
      primitives?: number;
      uv2Primitives?: number;
      uv2Independent?: boolean;
      maxIslandStretch?: number;
      tiers?: Record<string, LightmapTierPlan>;
    } | null;
  };
};
type GlbDocument = {
  meshes?: Array<{ primitives?: Array<{ attributes?: Record<string, number> }> }>;
};
type Audit = {
  manifest: ModelManifest;
  servedSha256: string;
  primitiveCount: number;
  uv2PrimitiveCount: number;
  hashMatches: boolean;
  error?: string;
};

function readGlbJson(buffer: ArrayBuffer): GlbDocument {
  if (buffer.byteLength < 20) throw new Error("GLB demasiado pequeno.");
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("O ficheiro servido não tem assinatura GLB.");
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.byteLength) {
    throw new Error("Chunk JSON do GLB inválido.");
  }
  const jsonText = new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)).trim();
  return JSON.parse(jsonText) as GlbDocument;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function LightmapDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("debug3d") === "lightmap-uv");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setAudit(null);
    void Promise.all([
      fetch("/models/camping/xoyens-studio.model.json", { cache: "no-store" }),
      fetch("/models/camping/xoyens-studio.glb", { cache: "no-store" }),
    ]).then(async ([manifestResponse, glbResponse]) => {
      if (!manifestResponse.ok) throw new Error("Manifesto HTTP " + manifestResponse.status);
      if (!glbResponse.ok) throw new Error("GLB HTTP " + glbResponse.status);
      const [manifest, buffer] = await Promise.all([
        manifestResponse.json() as Promise<ModelManifest>,
        glbResponse.arrayBuffer(),
      ]);
      const servedSha256 = await sha256(buffer);
      const gltf = readGlbJson(buffer);
      const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
      const uv2PrimitiveCount = primitives.filter((primitive) => primitive.attributes?.TEXCOORD_1 !== undefined).length;
      const expectedSha = manifest.geometry?.sha256?.toLowerCase() ?? "";
      if (!cancelled) {
        setAudit({
          manifest,
          servedSha256,
          primitiveCount: primitives.length,
          uv2PrimitiveCount,
          hashMatches: Boolean(expectedSha) && expectedSha === servedSha256,
        });
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setAudit({
          manifest: {},
          servedSha256: "",
          primitiveCount: 0,
          uv2PrimitiveCount: 0,
          hashMatches: false,
          error: error instanceof Error ? error.message : "Falha na auditoria do modelo servido.",
        });
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [enabled, refreshKey]);

  if (!enabled) return null;
  const manifest = audit?.manifest;
  const lightmap = manifest?.geometry?.lightmapUV;
  const tiers = lightmap?.tiers;

  return (
    <aside className="camping-lightmap-debug" aria-label="Auditoria UV2 e atlas do modelo servido">
      <header className="camping-lightmap-debug__header">
        <div>
          <p>CAMPING / QA INTERNO</p>
          <h2>UV2 / ATLAS AUDIT</h2>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          {loading ? "A VERIFICAR..." : "VERIFICAR"}
        </button>
      </header>
      {audit?.error ? <p className="camping-lightmap-debug__error">{audit.error}</p> : null}
      <div className="camping-lightmap-debug__summary">
        <p>MANIFESTO: {manifest ? `FASE ${manifest.phase ?? "?"} / ${manifest.status ?? "sem estado"}` : "a ler..."}</p>
        <p>FASE DE PRODUÇÃO: {manifest?.productionPhase ?? "N/D"}</p>
        <p>UV2 NO GLB SERVIDO: {audit ? `${audit.uv2PrimitiveCount}/${audit.primitiveCount} primitivas` : "N/D"}</p>
        <p>STRETCH MÁXIMO: {lightmap?.maxIslandStretch ?? "sem evidência publicada"}</p>
        <p>RELATÓRIO UV2: {lightmap?.sourceStatus ?? "Fase 12 não publicada"}</p>
        <p>SHA-256: <strong className={audit?.hashMatches ? "is-match" : "is-mismatch"}>{audit?.hashMatches ? "MATCH" : audit ? "DIVERGENTE" : "A VERIFICAR"}</strong></p>
        <code>{audit?.servedSha256 || "hash indisponível"}</code>
        {manifest?.geometry?.sha256 ? <code>Esperado: {manifest.geometry.sha256}</code> : null}
      </div>
      {(["high", "mid", "low"] as const).map((tierName) => {
        const tier = tiers?.[tierName];
        return (
          <section className="camping-lightmap-debug__tier" key={tierName}>
            <h3>{tierName.toUpperCase()} · {tier ? `${tier.totalMemoryMB.toFixed(3)} / ${tier.budgetMB} MiB` : "sem plano certificado"}</h3>
            {tier ? Object.entries(tier.groups).map(([groupName, group]) => (
              <div className="camping-lightmap-debug__group" key={groupName}>
                <strong>{groupName.toUpperCase()}</strong>
                <span>{group.atlasPx}px</span>
                <span>{group.effectiveTexelsPerM} tex/m</span>
                <span>{group.memoryMB.toFixed(3)} MiB</span>
              </div>
            )) : <p className="camping-lightmap-debug__empty">Sem dados de atlas neste manifesto.</p>}
          </section>
        );
      })}
      <p className="camping-lightmap-debug__footnote">O hash é calculado a partir do GLB descarregado do mesmo host. MATCH confirma que o manifesto descreve o ficheiro servido.</p>
    </aside>
  );
}
