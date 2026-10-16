// Controlador de resolução dinâmica com histerese. Ajusta apenas a escala de renderização
// em resposta à cadência medida dos frames, sem seleccionar perfis por dispositivo.
export type DrsOptions = {
  targetMs: number;
  min: number;
  max: number;
  step: number;
  downAfter: number;
  upAfter: number;
  headroom: number;
};

export const DRS_DEFAULTS: DrsOptions = {
  targetMs: 1000 / 58,
  min: 0.5,
  max: 1,
  step: 0.1,
  downAfter: 20,
  upAfter: 150,
  headroom: 0.78,
};

export class DynamicResolution {
  scale: number;
  private slow = 0;
  private fast = 0;
  private readonly options: DrsOptions;

  constructor(start = 1, options: Partial<DrsOptions> = {}) {
    this.options = { ...DRS_DEFAULTS, ...options };
    this.options.min = Math.min(this.options.min, this.options.max);
    this.options.max = Math.max(this.options.min, this.options.max);
    this.options.step = Math.max(0.001, Math.abs(this.options.step));
    this.options.downAfter = Math.max(1, Math.floor(this.options.downAfter));
    this.options.upAfter = Math.max(1, Math.floor(this.options.upAfter));
    this.scale = Math.min(this.options.max, Math.max(this.options.min, Number.isFinite(start) ? start : 1));
  }

  /** Devolve true quando scale muda; o chamador deve actualizar o drawing buffer. */
  update(frameMs: number): boolean {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return false;

    if (frameMs > this.options.targetMs * 1.12) {
      this.slow += 1;
      this.fast = 0;
    } else if (frameMs < this.options.targetMs * this.options.headroom) {
      this.fast += 1;
      this.slow = 0;
    } else {
      this.slow = 0;
      this.fast = 0;
    }

    const before = this.scale;
    if (this.slow >= this.options.downAfter) {
      this.scale = Math.max(this.options.min, Number((this.scale - this.options.step).toFixed(3)));
      this.slow = 0;
    } else if (this.fast >= this.options.upAfter) {
      this.scale = Math.min(this.options.max, Number((this.scale + this.options.step).toFixed(3)));
      this.fast = 0;
    }

    return this.scale !== before;
  }
}
