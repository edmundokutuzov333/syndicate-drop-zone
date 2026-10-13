import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 82 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const stopDrag = useCallback(() => { drag.current = null; document.body.classList.remove("camera-panel-dragging"); }, []);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      const d = drag.current;
      const rect = panelRef.current?.getBoundingClientRect();
      const width = rect?.width ?? 300;
      const height = rect?.height ?? 80;
      setPosition({ x: Math.max(8, Math.min(window.innerWidth - width - 8, d.x + event.clientX - d.px)), y: Math.max(8, Math.min(window.innerHeight - height - 8, d.y + event.clientY - d.py)) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stopDrag); window.removeEventListener("pointercancel", stopDrag); document.body.classList.remove("camera-panel-dragging"); };
  }, [stopDrag]);
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    drag.current = { px: event.clientX, py: event.clientY, x: position.x, y: position.y };
    document.body.classList.add("camera-panel-dragging");
  };
  if (controls.length === 0) return null;
  const floatingStyle = { left: position.x, top: position.y };
  if (minimized) return <button type="button" className="camera-filter-panel-restore" style={floatingStyle} aria-label={"Reabrir painel de ajustes do filtro " + filter.label} title="Reabrir ajustes do filtro" onClick={() => setMinimized(false)}><span aria-hidden="true">ƒx</span><small>FILTERS</small></button>;
  return (
    <section ref={panelRef} className="camera-filter-tuning is-floating" style={floatingStyle} aria-label={`Controlos do filtro ${filter.label}`} aria-describedby="camera-filter-tuning-status">
      <header className="camera-filter-tuning-head">
        <div className="camera-filter-tuning-drag-handle" onPointerDown={beginDrag} title="Arrastar para mover o painel">
          <span className="camera-filter-drag-grip" aria-hidden="true">⠿</span>
          <div className="camera-filter-tuning-heading">
          <span className="camera-filter-tuning-kicker">FILTER TUNING // {filter.index}</span>
          <strong>{filter.label}</strong>
        </div>
        <div className="camera-filter-tuning-actions">
          <span id="camera-filter-tuning-status" className="camera-filter-tuning-live"><i aria-hidden="true" />LIVE</span>
          <button type="button" className="camera-filter-tuning-reset" onClick={onReset} disabled={locked}>RESET</button>
          <button type="button" className="camera-filter-tuning-window-action" aria-label="Minimizar painel de ajustes" title="Minimizar painel" onClick={() => setMinimized(true)}>−</button>
        </div>
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
