import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export function SignaturePad({
  onChange,
}: {
  onChange: (canvas: HTMLCanvasElement | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ddd6c7";
  }, []);

  const position = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top] as const;
  };

  const end = () => {
    drawing.current = false;
    onChange(dirty.current ? ref.current : null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        aria-label="Área de assinatura"
        className="h-40 w-full touch-none border border-dashed border-border bg-card"
        onPointerDown={(event) => {
          drawing.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          const [x, y] = position(event);
          const ctx = event.currentTarget.getContext("2d");
          ctx?.beginPath();
          ctx?.moveTo(x, y);
          // A short tap still creates a visible signature mark, especially on touchscreens.
          ctx?.lineTo(x + 0.5, y + 0.5);
          ctx?.stroke();
          dirty.current = true;
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const [x, y] = position(event);
          const ctx = event.currentTarget.getContext("2d");
          ctx?.lineTo(x, y);
          ctx?.stroke();
          dirty.current = true;
        }}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <button
        type="button"
        className="mt-2 border border-border px-3 py-1 text-xs hover:border-blood"
        onClick={() => {
          const canvas = ref.current;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          dirty.current = false;
          onChange(null);
        }}
      >
        LIMPAR
      </button>
    </div>
  );
}
