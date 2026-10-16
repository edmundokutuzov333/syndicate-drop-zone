import { useState } from "react";
import { cn } from "@/lib/utils";
import { click } from "@/lib/sfx";
import type { CampingRoom, CampingGalleryItem } from "@/lib/camping-data";

export type Room = CampingRoom;

type Props = {
  liveOn: boolean;
  selectedRoomId?: string;
  galleryByRoom?: Record<string, CampingGalleryItem[]>;
  onPick?: (room: Room) => void;
  onOpenMedia?: (id: string) => void;
};

export const ROOMS: Room[] = [
  { id: "estudio", name: "ESTÚDIO", x: 40, y: 40, w: 360, h: 250, line: "Cabine, mesa, 808.", galleryTag: "CABINE" },
  { id: "estampa", name: "ESTAMPA", x: 420, y: 40, w: 250, h: 170, line: "Silk ao vivo.", galleryTag: "ESTAMPA" },
  { id: "visual", name: "VISUALIZER", x: 690, y: 40, w: 270, h: 170, line: "Câmara e luz.", galleryTag: "VISUALIZER" },
  { id: "foto", name: "FOTO", x: 420, y: 230, w: 250, h: 150, line: "Retratos de ficha.", galleryTag: "FOTO" },
  { id: "rede", name: "NETWORKING", x: 690, y: 230, w: 270, h: 150, line: "Quem passa, fica.", galleryTag: "NETWORKING" },
  { id: "live", name: "LIVE", x: 40, y: 310, w: 360, h: 210, line: "Sessão no ar.", live: true, galleryTag: "LIVES" },
];

export function BunkerMap({
  liveOn,
  selectedRoomId,
  galleryByRoom = {},
  onPick,
  onOpenMedia,
}: Props) {
  const [internalSel, setInternalSel] = useState("estudio");
  const sel = selectedRoomId ?? internalSel;
  const cur = ROOMS.find((room) => room.id === sel) ?? ROOMS[0];

  const pick = (room: Room) => {
    setInternalSel(room.id);
    click();
    onPick?.(room);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <svg
        viewBox="0 0 1000 560"
        role="group"
        aria-label="Planta do bunker"
        className="w-full border border-border bg-card"
      >
        <defs>
          <pattern id="bunker-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".08" />
          </pattern>
        </defs>
        <rect width="1000" height="560" fill="url(#bunker-grid)" className="text-foreground" />
        {ROOMS.map((room) => {
          const selected = room.id === cur.id;
          const live = room.live && liveOn;
          return (
            <g
              key={room.id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={room.name}
              className="cursor-pointer outline-none"
              onClick={() => pick(room)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  pick(room);
                }
              }}
            >
              <rect
                x={room.x}
                y={room.y}
                width={room.w}
                height={room.h}
                className={cn(
                  "fill-background transition-colors",
                  selected || live
                    ? "stroke-[var(--blood)]"
                    : "stroke-[var(--border)] hover:stroke-[var(--muted-foreground)]",
                )}
                strokeWidth="2"
              />
              {selected && (
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.w}
                  height={room.h}
                  className="fill-[var(--blood)] opacity-15"
                />
              )}
              <text x={room.x + 16} y={room.y + 30} className="fill-[var(--foreground)] font-mono text-[18px] tracking-widest">
                {room.name}
              </text>
              {live && (
                <circle
                  cx={room.x + room.w - 24}
                  cy={room.y + 24}
                  r="7"
                  className="fill-[var(--blood)]"
                  style={{ animation: "blink 1s steps(1) infinite" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      <aside className="border border-blood bg-card p-5" aria-live="polite">
        <p className="text-xs tracking-widest text-blood">SALA</p>
        <h2 className="mt-1 font-gothic text-5xl leading-none">{cur.name}</h2>
        <p className="mt-3 font-stamp text-muted-foreground">{cur.line}</p>

        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-[9px] tracking-[0.18em] text-blood">REGISTOS</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(galleryByRoom[cur.id] ?? []).slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenMedia?.(item.id)}
                className="group aspect-square overflow-hidden border border-border bg-background text-left"
                aria-label={"Abrir " + item.caption}
              >
                <img
                  src={item.src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover grayscale contrast-125 transition duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
          {!galleryByRoom[cur.id]?.length && (
            <p className="mt-3 font-mono text-[8px] text-muted-foreground">
              SEM REGISTOS PUBLICADOS NESTA SALA.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
