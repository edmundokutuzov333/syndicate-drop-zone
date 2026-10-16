export type HalftoneOpts = {
  cell?: number;
  angle?: number;
  ink?: string;
  paper?: string;
  contrast?: number;
  gamma?: number;
  invert?: boolean;
};

const DEFAULTS: Required<HalftoneOpts> = {
  cell: 5,
  angle: 45,
  ink: "#ddd6c7",
  paper: "#0f0f0f",
  contrast: 1.45,
  gamma: 0.9,
  invert: false,
};

export function renderHalftone(
  img: HTMLImageElement,
  out: HTMLCanvasElement,
  w: number,
  h: number,
  opts: HalftoneOpts = {},
): void {
  const p = { ...DEFAULTS, ...opts };
  out.width = w;
  out.height = h;

  const ctx = out.getContext("2d");
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx || !sctx || !img.naturalWidth || !img.naturalHeight) return;

  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  sctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  const data = sctx.getImageData(0, 0, w, h).data;
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.ink;

  const angle = (p.angle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const diagonal = Math.hypot(w, h);
  const cells = Math.ceil(diagonal / p.cell);
  const cx = w / 2;
  const cy = h / 2;

  for (let i = -cells; i <= cells; i += 1) {
    for (let j = -cells; j <= cells; j += 1) {
      const x = cx + (i * cos - j * sin) * p.cell;
      const y = cy + (i * sin + j * cos) * p.cell;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;

      const index = ((y | 0) * w + (x | 0)) * 4;
      let luminance =
        ((data[index] ?? 0) * 0.299 +
          (data[index + 1] ?? 0) * 0.587 +
          (data[index + 2] ?? 0) * 0.114) /
        255;

      if (p.invert) luminance = 1 - luminance;
      luminance =
        Math.min(1, Math.max(0, (luminance - 0.5) * p.contrast + 0.5)) **
        p.gamma;

      const radius = p.cell * 0.72 * Math.sqrt(luminance);
      if (radius < 0.35) continue;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
