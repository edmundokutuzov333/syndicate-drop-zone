// Métrica de fidelidade à referência por sector de azimute/elevação. Recebe RGBA 8 bits.
export type Rgba = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
export type SectorStat = { az0: number; az1: number; el0: number; el1: number; L: number; a: number; b: number; lumaStd: number };

const linear = (c: number) => {
  const value = c / 255;
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
};

export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = linear(r), G = linear(g), B = linear(b);
  const X = (R * 0.4124564 + G * 0.3575764 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (value: number) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export function sectorStats(
  image: Rgba,
  azimuthSectors = 24,
  elevationBands: readonly [number, number][] = [[-90, -15], [-15, 25], [25, 90]],
): SectorStat[] {
  if (!Number.isInteger(azimuthSectors) || azimuthSectors < 1) throw new Error("azimuthSectors deve ser positivo.");
  if (image.width <= 0 || image.height <= 0 || image.data.length < image.width * image.height * 4) {
    throw new Error("Imagem RGBA inválida.");
  }
  const output: SectorStat[] = [];
  for (const [el0, el1] of elevationBands) {
    for (let sector = 0; sector < azimuthSectors; sector += 1) {
      const x0 = Math.floor((sector / azimuthSectors) * image.width);
      const x1 = Math.floor(((sector + 1) / azimuthSectors) * image.width);
      const y0 = Math.floor(((90 - el1) / 180) * image.height);
      const y1 = Math.floor(((90 - el0) / 180) * image.height);
      let count = 0, sumL = 0, sumA = 0, sumB = 0, sumL2 = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * image.width + x) * 4;
          const [L, a, b] = srgbToLab(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0);
          sumL += L; sumA += a; sumB += b; sumL2 += L * L; count += 1;
        }
      }
      const L = count ? sumL / count : 0;
      output.push({
        az0: (sector / azimuthSectors) * 360,
        az1: ((sector + 1) / azimuthSectors) * 360,
        el0, el1, L, a: count ? sumA / count : 0, b: count ? sumB / count : 0,
        lumaStd: count ? Math.sqrt(Math.max(0, sumL2 / count - L * L)) : 0,
      });
    }
  }
  return output;
}

export function referenceMatchScore(
  reference: SectorStat[],
  rendered: SectorStat[],
): { score: number; worst: { az: number; el: number; dE: number }[] } {
  if (reference.length !== rendered.length || reference.length === 0) {
    return { score: 0, worst: [] };
  }
  let sum = 0;
  const rows: { az: number; el: number; dE: number }[] = [];
  for (let i = 0; i < reference.length; i += 1) {
    const ref = reference[i]!;
    const got = rendered[i]!;
    const deltaE = Math.hypot((ref.L - got.L) * 1.2, ref.a - got.a, ref.b - got.b)
      + Math.abs(ref.lumaStd - got.lumaStd) * 0.35;
    sum += deltaE;
    rows.push({ az: (ref.az0 + ref.az1) / 2, el: (ref.el0 + ref.el1) / 2, dE: deltaE });
  }
  const mean = sum / reference.length;
  return { score: Math.max(0, Math.round((100 - mean * 1.6) * 10) / 10), worst: rows.sort((a, b) => b.dE - a.dE).slice(0, 5) };
}
