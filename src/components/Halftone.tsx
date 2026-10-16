import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  mode?: "normal" | "noturna" | "raiox";
  className?: string;
  width?: number;
  height?: number;
};

// Photo treated as heavy screenprint halftone + photocopy wear + grain.
export function Halftone({ src, alt, mode = "normal", className, width, height }: Props) {
  const filter =
    mode === "noturna"
      ? "grayscale(1) contrast(1.6) brightness(1.3) sepia(1) hue-rotate(60deg) saturate(3)"
      : mode === "raiox"
        ? "grayscale(1) invert(1) contrast(1.8) brightness(0.9)"
        : "grayscale(1) contrast(1.45) brightness(0.92)";
  return (
    <div className={cn("relative overflow-hidden bg-background", className)}>
      <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async"
        className="h-full w-full object-cover transition-[filter] duration-500" style={{ filter }} />
      <div className="halftone-overlay pointer-events-none absolute inset-0" />
      <div className="xerox-wear pointer-events-none absolute inset-0" />
      {mode === "raiox" && <div className="pointer-events-none absolute inset-0 bg-blood mix-blend-multiply" />}
      {mode === "noturna" && <div className="scan-sweep pointer-events-none absolute inset-x-0 h-1/4" />}
    </div>
  );
}
