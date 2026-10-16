export type HotspotAction = "radio" | "shop" | "camera" | "artists" | "production" | "membership";
export type Hotspot = { id: string; action: HotspotAction; label: string; position: [number, number, number] };

export const CAMPING_HOTSPOTS: readonly Hotspot[] = [
  { id: "studio.radio", action: "radio", label: "Abrir frequência", position: [-2.4, 1.3, -1.7] },
  { id: "studio.merch-rack", action: "shop", label: "Ver loja", position: [2.3, 1.2, -0.9] },
  { id: "studio.photo-backdrop", action: "camera", label: "Abrir câmara", position: [2.8, 1.4, 1.5] },
  { id: "studio.artists-wall", action: "artists", label: "Ver artistas", position: [-3.1, 1.4, 0.2] },
  { id: "studio.production-desk", action: "production", label: "Ver produção", position: [-0.6, 1.2, -2.1] },
  { id: "studio.membership", action: "membership", label: "Filiar", position: [0.4, 1.2, 2.2] },
];
