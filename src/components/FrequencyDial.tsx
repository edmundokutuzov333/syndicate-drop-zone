import { useMemo } from "react";

export function FrequencyDial({ level, spectrum, playing }: { level: number; spectrum: number[]; playing: boolean }) {
  const ticks = useMemo(
    () => Array.from({ length: 21 }, (_, index) => {
      const value = 760 + index * 5;
      const angle = -140 + (index / 20) * 280;
      const major = value % 20 === 0 || value === 808;
      return { value, angle, major };
    }),
    [],
  );

  const needle = -140 + ((808 - 760) / (860 - 760)) * 280;
  const needleRad = (needle - 90) * (Math.PI / 180);
  const x = 180 + Math.cos(needleRad) * 118;
  const y = 180 + Math.sin(needleRad) * 118;

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="relative aspect-square rounded-full border-2 border-border bg-black/70 p-4 shadow-[0_0_80px_rgba(0,0,0,.65)]">
        <svg viewBox="0 0 360 360" role="img" aria-label="Dial analógico da Frequência 808" className="h-full w-full">
          <circle cx="180" cy="180" r="153" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="1" />
          <circle cx="180" cy="180" r="133" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="1" />
          <g aria-hidden>
            {(() => {
              const angle = -140 + ((808 - 760) / (860 - 760)) * 280;
              const rad = (angle - 90) * (Math.PI / 180);
              const x1 = 180 + Math.cos(rad) * 128;
              const y1 = 180 + Math.sin(rad) * 128;
              const x2 = 180 + Math.cos(rad) * 145;
              const y2 = 180 + Math.sin(rad) * 145;
              const tx = 180 + Math.cos(rad) * 116;
              const ty = 184 + Math.sin(rad) * 116;
              return (
                <>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--blood)" strokeWidth="3" />
                  <text x={tx} y={ty} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--blood)">808</text>
                </>
              );
            })()}
          </g>
          {ticks.map((tick) => {
            const rad = (tick.angle - 90) * (Math.PI / 180);
            const r1 = tick.major ? 132 : 137;
            const r2 = 143;
            const x1 = 180 + Math.cos(rad) * r1;
            const y1 = 180 + Math.sin(rad) * r1;
            const x2 = 180 + Math.cos(rad) * r2;
            const y2 = 180 + Math.sin(rad) * r2;
            return (
              <g key={tick.value}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tick.value === 808 ? "var(--blood)" : "currentColor"} strokeWidth={tick.major ? 2 : 1} />
                {tick.major && (
                  <text x={180 + Math.cos(rad) * 118} y={184 + Math.sin(rad) * 118} textAnchor="middle" fontSize="8" fill={tick.value === 808 ? "var(--blood)" : "currentColor"} opacity={tick.value === 808 ? 1 : .55}>
                    {tick.value}
                  </text>
                )}
              </g>
            );
          })}
          <circle cx="180" cy="180" r="5" fill="var(--blood)" />
          <line x1="180" y1="180" x2={x} y2={y} stroke="var(--blood)" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 5px var(--blood))" }} />
          <text x="180" y="212" textAnchor="middle" fontSize="8" letterSpacing="3" fill="currentColor" opacity=".6">FM / SDT</text>
          <text x="180" y="232" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">808</text>
        </svg>

        <div className="absolute inset-x-12 bottom-10">
          <div className="flex items-end justify-center gap-1">
            {Array.from({ length: 20 }).map((_, index) => {
              const value = spectrum[index % Math.max(1, spectrum.length)] ?? level;
              const h = 10 + value * 44;
              return <span key={index} className="w-1 rounded-t bg-blood/80" style={{ height: h }} />;
            })}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[8px] tracking-[0.18em] text-muted-foreground">
            <span>VU</span>
            <span className={playing ? "text-blood" : ""}>{playing ? "CARRIER LOCK" : "MUTE / PAUSA"}</span>
            <span>SPC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
