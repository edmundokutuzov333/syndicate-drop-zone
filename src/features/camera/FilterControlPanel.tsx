import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type DragState = {
  pointerX: number;
  pointerY: number;
  originX: number;
  originY: number;
  latestX: number;
  latestY: number;
};

function formatParameter(value: number, step: number): string {
  const decimalPlaces =
    step < 1 ? Math.min(3, step.toString().split(".")[1]?.length ?? 0) : 0;
  return value.toFixed(decimalPlaces);
}

export function FilterControlPanel({
  filter,
  values,
  onChange,
  onReset,
  waveAmount,
  onWaveAmountChange,
  locked = false,
}: FilterControlPanelProps) {
  const controls = filter.controls ?? [];
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 82 });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const moveFrame = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Render identically during SSR, then move the floating window to the document
  // layer so camera-stage overflow cannot clip it at the edges of the viewport.
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const applyPointerPosition = useCallback((state: DragState) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 300;
    const height = rect?.height ?? 80;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    const nextX = state.originX + state.latestX - state.pointerX;
    const nextY = state.originY + state.latestY - state.pointerY;

    setPosition({
      x: Math.min(maxX, Math.max(8, nextX)),
      y: Math.min(maxY, Math.max(8, nextY)),
    });
  }, []);

  const stopDrag = useCallback(() => {
    const state = drag.current;
    if (moveFrame.current !== null) {
      window.cancelAnimationFrame(moveFrame.current);
      moveFrame.current = null;
    }
    if (state) applyPointerPosition(state);
    drag.current = null;
    document.body.classList.remove("camera-panel-dragging");
  }, [applyPointerPosition]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      state.latestX = event.clientX;
      state.latestY = event.clientY;

      // Coalesce pointer events to one React update per animation frame.
      if (moveFrame.current !== null) return;
      moveFrame.current = window.requestAnimationFrame(() => {
        moveFrame.current = null;
        const latest = drag.current;
        if (latest) applyPointerPosition(latest);
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      if (moveFrame.current !== null) {
        window.cancelAnimationFrame(moveFrame.current);
        moveFrame.current = null;
      }
      document.body.classList.remove("camera-panel-dragging");
    };
  }, [applyPointerPosition, stopDrag]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("button, input, select, a")
    ) {
      return;
    }

    event.preventDefault();
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: position.x,
      originY: position.y,
      latestX: event.clientX,
      latestY: event.clientY,
    };
    document.body.classList.add("camera-panel-dragging");
    // Global window listeners continue receiving pointer movement while the pointer
    // is outside the floating panel, without relying on element pointer capture.
  };

  const floatingStyle = { left: position.x, top: position.y };
  const panelContent = controls.length === 0 ? null : minimized ? (
    <button
      type="button"
      className="camera-filter-panel-restore"
      style={floatingStyle}
      aria-label={"Reabrir painel de ajustes do filtro " + filter.label}
      title="Reabrir ajustes do filtro"
      onClick={() => setMinimized(false)}
    >
      <span aria-hidden="true">ƒx</span>
      <small>FILTERS</small>
    </button>
  ) : (
    <section
      ref={panelRef}
      className="camera-filter-tuning is-floating"
      style={floatingStyle}
      aria-label={`Controlos do filtro ${filter.label}`}
      aria-describedby="camera-filter-tuning-status"
    >
      <header className="camera-filter-tuning-head">
        <div
          className="camera-filter-tuning-drag-handle"
          onPointerDown={beginDrag}
          title="Arrastar para qualquer canto do ecrã"
          aria-label="Mover painel de filtros"
        >
          <span className="camera-filter-drag-grip" aria-hidden="true">
            ⠿
          </span>
          <div className="camera-filter-tuning-heading">
            <span className="camera-filter-tuning-kicker">
              FILTER TUNING // {filter.index}
            </span>
            <strong>{filter.label}</strong>
          </div>
          <div className="camera-filter-tuning-actions">
            <span
              id="camera-filter-tuning-status"
              className="camera-filter-tuning-live"
            >
              <i aria-hidden="true" />
              LIVE
            </span>
            <button
              type="button"
              className="camera-filter-tuning-reset"
              onClick={onReset}
              disabled={locked}
            >
              RESET
            </button>
            <button
              type="button"
              className="camera-filter-tuning-window-action"
              aria-label="Minimizar painel de ajustes"
              title="Minimizar painel"
              onClick={() => setMinimized(true)}
            >
              −
            </button>
          </div>
        </div>
      </header>

      <div className="camera-filter-tuning-grid">
        {controls.map((control) => (
          <label className="camera-filter-tuning-control" key={control.uniform}>
            <span className="camera-filter-tuning-value">
              <span>{control.label}</span>
              <output>
                {formatParameter(
                  values[control.uniform] ?? control.defaultValue,
                  control.step,
                )}
              </output>
            </span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={values[control.uniform] ?? control.defaultValue}
              aria-label={`${filter.label} — ${control.label}`}
              onChange={(event) =>
                onChange(control.uniform, Number(event.currentTarget.value))
              }
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
            onChange={(event) =>
              onWaveAmountChange(event.currentTarget.checked ? 0.28 : 0)
            }
            disabled={locked}
          />
          <span className="camera-wave-switch" aria-hidden="true" />
          <span className="camera-wave-copy">
            <strong>SIGNAL WAVE</strong>
            <small>
              {waveAmount > 0 ? "OPTIONAL FX // ON" : "OPTIONAL FX // OFF"}
            </small>
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
              onChange={(event) =>
                onWaveAmountChange(Number(event.currentTarget.value))
              }
              disabled={locked}
              aria-label="Intensidade da onda de sinal"
            />
          </label>
        )}
      </div>
    </section>
  );

  if (!panelContent) return null;
  return portalTarget ? createPortal(panelContent, portalTarget) : panelContent;
}
