export type RuntimeResilience = { lost: boolean; fallbackPano: boolean; onLost: () => void; onRestored: () => void };

export function installRuntimeResilience(canvas: HTMLCanvasElement, fallback: () => void, restore: () => void): RuntimeResilience {
  const state: RuntimeResilience = { lost: false, fallbackPano: false, onLost: () => undefined, onRestored: () => undefined };
  state.onLost = () => { state.lost = true; state.fallbackPano = true; fallback(); };
  state.onRestored = () => { state.lost = false; state.fallbackPano = false; restore(); };
  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); state.onLost(); });
  canvas.addEventListener("webglcontextrestored", () => state.onRestored());
  return state;
}
