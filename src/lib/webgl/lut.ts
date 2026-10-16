export const ASTRO_LUT_SIZE = 16;
export const ASTRO_LUT_WIDTH = ASTRO_LUT_SIZE * ASTRO_LUT_SIZE;
export const ASTRO_LUT_HEIGHT = ASTRO_LUT_SIZE;

export function createAstroHazeLut(): Uint8Array {
  const size = ASTRO_LUT_SIZE;
  const data = new Uint8Array(ASTRO_LUT_WIDTH * ASTRO_LUT_HEIGHT * 4);

  for (let blue = 0; blue < size; blue += 1) {
    for (let green = 0; green < size; green += 1) {
      for (let red = 0; red < size; red += 1) {
        let r = red / (size - 1);
        let g = green / (size - 1);
        let b = blue / (size - 1);

        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const shadow = Math.max(0, 1 - luminance * 2.0);
        const highlight = Math.max(0, (luminance - 0.52) * 2.0);

        r = Math.min(
          1,
          r * 0.92 + shadow * 0.018 + highlight * 0.055,
        );
        g = Math.min(
          1,
          g * 0.97 + shadow * 0.03 + highlight * 0.015,
        );
        b = Math.min(
          1,
          b * 0.93 + shadow * 0.035 - highlight * 0.018,
        );

        const x = blue * size + red;
        const y = green;
        const offset = (y * ASTRO_LUT_WIDTH + x) * 4;

        data[offset] = Math.round(r * 255);
        data[offset + 1] = Math.round(g * 255);
        data[offset + 2] = Math.round(b * 255);
        data[offset + 3] = 255;
      }
    }
  }

  return data;
}
