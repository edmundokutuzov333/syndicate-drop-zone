// Conversões aproximadas para valores de luz do Three.js; validar visualmente contra o set real.
export const lumensToCandelaPoint = (lumens: number): number => Math.max(0, lumens) / (4 * Math.PI);
export const lumensToCandelaSpot = (lumens: number, halfAngleRad: number): number => {
  const solidAngle = 2 * Math.PI * (1 - Math.cos(Math.max(0, halfAngleRad)));
  return solidAngle > 1e-6 ? Math.max(0, lumens) / solidAngle : 0;
};
export const lumensToRectNits = (lumens: number, areaM2: number): number =>
  Math.max(0, lumens) / (Math.PI * Math.PI * Math.max(areaM2, 1e-6));

export function kelvinToSrgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const channel = (value: number) => Math.min(255, Math.max(0, value)) / 255;
  return [channel(r), channel(g), channel(b)];
}

export const ev100ToExposure = (ev100: number): number =>
  1 / (1.2 * Math.pow(2, Number.isFinite(ev100) ? ev100 : 0));
