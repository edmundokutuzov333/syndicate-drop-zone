import { useMemo } from "react";
import type { CampingRoom, CampingSessionRow } from "@/lib/camping-data";
import { cn } from "@/lib/utils";
import { click } from "@/lib/sfx";

export function CampingSessions({
  sessions,
  selectedRoomId,
  onPickRoom,
}: {
  sessions: CampingSessionRow[];
  selectedRoomId: string;
  onPickRoom: (room: CampingRoom) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, CampingSessionRow[]>();
    for (const session of sessions) {
      const day = Number(session.day ?? 0) || 0;
      const rows = map.get(day) ?? [];
      rows.push(session);
      map.set(day, rows);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [sessions]);

  const roomId = (session: CampingSessionRow) => session.roomId || "estudio";

  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border p-4">
        <p className="font-mono text-[9px] tracking-[0.2em] text-blood">ESCALA</p>
        <h2 className="mt-1 font-gothic text-4xl">SESSÕES</h2>
      </div>
      <div className="divide-y divide-border">
        {!grouped.length && (
          <div className="p-5 font-mono text-[9px] text-muted-foreground">SEM SESSÕES PUBLICADAS.</div>
        )}
        {grouped.map(([day, rows]) => (
          <div key={day} className="p-4">
            <p className="font-mono text-[8px] tracking-[0.2em] text-blood">DIA {String(day).padStart(2, "0")}</p>
            <div className="mt-3 space-y-2">
              {rows.map((session) => {
                const active = session.id === sessions.find((item) => {
                  const now = Date.now();
                  return new Date(item.startsAt).getTime() <= now && new Date(item.endsAt).getTime() > now;
                })?.id;
                const selected = roomId(session) === selectedRoomId;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      onPickRoom({
                        id: roomId(session),
                        name: session.roomName,
                        x: 0,
                        y: 0,
                        w: 0,
                        h: 0,
                        line: session.title,
                        galleryTag: session.galleryTag,
                      });
                      click();
                    }}
                    className={cn(
                      "w-full border p-3 text-left transition",
                      selected ? "border-blood bg-blood/5" : "border-border hover:border-blood/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-stamp text-base">{session.title}</span>
                      {active && <span className="font-mono text-[8px] text-blood"><span style={{ animation: "blink 1s steps(1) infinite" }}>●</span> AGORA</span>}
                    </div>
                    <p className="mt-1 font-mono text-[8px] text-muted-foreground">
                      {session.startsAt && new Date(session.startsAt).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}
                      {" → "}
                      {session.endsAt && new Date(session.endsAt).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}
                      {" · "} {session.roomName}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
