import type { FilterDefinition } from "@/lib/camera/types";

type FilterControlPanelProps = {
  filter: FilterDefinition;
  values: Readonly<Record<string, number>>;
  onChange: (uniform: string, value: number) => void;
  onReset: () => void;
  waveAmount: number;
  onWaveAmountChange: (value: number) => void;
  locked?: boolean;
};

function formatParameter(value: number, step: number): string {
  const decimalPlaces = step < 1
    ? Math.min(3, step.toString().split(".")[1]?.length ?? 0)
    : 0;
  return value.toFixed(decimalPlaces);
}

export function FilterControlPanel({ filter, values, onChange, onReset, waveAmount, onWaveAmountChange, locked = false }: FilterControlPanelProps) {
  const controls = filter.controls ?? [];
  if (controls.length === 0) return null;

  return (
    <section className="camera-filter-tuning" aria-label={`Controlos do filtro ${filter.label}`} aria-describedby="camera-filter-tuning-status">
      <header className="camera-filter-tuning-head">
        <div className="camera-filter-tuning-heading">
          <span className="camera-filter-tuning-kicker">FILTER TUNING // {filter.index}</span>
          <strong>{filter.label}</strong>
        </div>
        <div className="camera-filter-tuning-actions">
          <span id="camera-filter-tuning-status" className="camera-filter-tuning-live"><i aria-hidden="true" />LIVE</span>
          <button type="button" className="camera-filter-tuning-reset" onClick={onReset} disabled={locked}>RESET</button>
        </div>
      </header>
      <div className="camera-filter-tuning-grid">
        {controls.map((control) => (
          <label className="camera-filter-tuning-control" key={control.uniform}>
            <span className="camera-filter-tuning-value">
              <span>{control.label}</span>
              <output>{formatParameter(values[control.uniform] ?? control.defaultValue, control.step)}</output>
            </span>
            <input type="range" min={control.min} max={control.max} step={control.step}
              value={values[control.uniform] ?? control.defaultValue}
              aria-label={`${filter.label} — ${control.label}`}
              onChange={(event) => onChange(control.uniform, Number(event.currentTarget.value))}
              disabled={locked}
            />
          </label>
        ))}
      </div>
      <div className="camera-wave-control">
        <label className="camera-wave-toggle">
          <input
            type="checkbox"
            checked={waveAmount > 0}
            onChange={(event) => onWaveAmountChange(event.currentTarget.checked ? 0.28 : 0)}
            disabled={locked}
          />
          <span className="camera-wave-switch" aria-hidden="true" />
          <span className="camera-wave-copy">
            <strong>SIGNAL WAVE</strong>
            <small>{waveAmount > 0 ? "OPTIONAL FX // ON" : "OPTIONAL FX // OFF"}</small>
          </span>
        </label>
        {waveAmount > 0 && (
          <label className="camera-wave-level">
            <span>WAVE AMOUNT</span>
            <output>{Math.round(waveAmount * 100)}%</output>
            <input
              type="range"
              min={0.05}
              max={0.45}
              step={0.01}
              value={waveAmount}
              onChange={(event) => onWaveAmountChange(Number(event.currentTarget.value))}
              disabled={locked}
              aria-label="Intensidade da onda de sinal"
            />
          </label>
        )}
      </div>
    </section>
  );
}
