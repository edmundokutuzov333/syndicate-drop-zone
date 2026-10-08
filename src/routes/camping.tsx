import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BunkerMap, type Room } from "@/components/BunkerMap";
import { ArtistPresence } from "@/components/ArtistPresence";
import { CampingLive } from "@/components/CampingLive";
import { CampingSessions } from "@/components/CampingSessions";
import {
  getLiveCampingGallery,
  getLiveCampingSessions,
  getLiveFlags,
  subscribeCampingLive,
  campingDayRange,
  getRoomAlias,
} from "@/lib/camping-data";
import { getLiveRevelationMedia } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/camping")({
  validateSearch: (search: Record<string, unknown>) => ({
    media: typeof search.media === "string" ? search.media : undefined,
  }),
  loader: async () => {
    const [sessions, flags, gallery, revelation] = await Promise.all([
      getLiveCampingSessions(),
      getLiveFlags(),
      getLiveCampingGallery(),
      getLiveRevelationMedia(),
    ]);
    const galleryFallback = { ...gallery };
    if (!Object.keys(galleryFallback).length) {
      for (const item of revelation.filter((entry) => entry.src).slice(0, 30)) {
        const room = getRoomAlias(item.roll || item.tag || "estudio");
        galleryFallback[room.id] = galleryFallback[room.id] ?? [];
        if (galleryFallback[room.id].length < 3) {
          galleryFallback[room.id].push({
            id: item.id,
            src: item.src!,
            caption: item.caption || item.alt,
            tag: item.tag || item.roll || room.tag,
          });
        }
      }
    }
    return { sessions, live: flags.live, camp: flags.camp, gallery: galleryFallback };
  }),
  head: () => ({
    meta: [
      { title: "Camping — O Sindicato do Trap" },
      { name: "description", content: "A planta viva do bunker Studio XOYENS: sessões, presença e transmissão." },
      { property: "og:title", content: "Camping — O Sindicato do Trap" },
      { property: "og:description", content: "O bunker vivo do Sindicato do Trap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Camping,
});

function Camping() {
  const navigate = useNavigate({ from: "/camping" });
  const { sessions, camp, gallery, live: initialLive } = Route.useLoaderData();
  const [live, setLive] = useState(initialLive);
  const [selectedRoom, setSelectedRoom] = useState("estudio");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const day = campingDayRange(camp.start, camp.end, now);
  useEffect(() => subscribeCampingLive(setLive), []);

  const currentSession = useMemo(
    () => sessions.find((session) => new Date(session.startsAt).getTime() <= now && new Date(session.endsAt).getTime() > now) ?? null,
    [now, sessions],
  );
  const nextSession = useMemo(
    () => sessions.filter((session) => new Date(session.startsAt).getTime() > now).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null,
    [now, sessions],
  );

  useEffect(() => {
    if (currentSession?.roomId) setSelectedRoom(currentSession.roomId);
  }, [currentSession?.roomId]);

  const pickRoom = (room: Room) => setSelectedRoom(room.id);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8">
      <header className="relative border-y border-border py-6">
        <p className="text-xs tracking-[0.22em] text-blood">1ª EDIÇÃO · STUDIO XOYENS · BUNKER</p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-gothic text-6xl leading-[0.85] md:text-8xl">O Camping</h1>
            <p className="mt-3 max-w-2xl font-stamp text-sm text-muted-foreground">A planta viva: salas, escala, presença e sinal.</p>
          </div>
          {day && (
            <div className="border border-blood px-4 py-3 text-right font-mono">
              <p className="text-[8px] tracking-[0.2em] text-muted-foreground">CAMP</p>
              <p className="text-2xl text-blood">DIA {String(day.current).padStart(2, "0")}/{String(day.total).padStart(2, "0")}</p>
            </div>
          )}
        </div>
      </header>

      <section className="mt-8">
        <BunkerMap
          liveOn={live.on}
          selectedRoomId={selectedRoom}
          galleryByRoom={gallery}
          onPick={pickRoom}
          onOpenMedia={(id) => navigate({ to: "/revelacao", search: { media: id } })}
        />
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <CampingSessions sessions={sessions} selectedRoomId={selectedRoom} onPickRoom={pickRoom} />
        <div className="space-y-8">
          <CampingLive live={live} nextSession={nextSession} />
          {currentSession && (
            <div className="border border-blood bg-blood/5 p-4">
              <p className="font-mono text-[9px] tracking-[0.2em] text-blood">● AGORA</p>
              <p className="mt-1 font-gothic text-3xl">{currentSession.title}</p>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">{currentSession.roomName}</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <ArtistPresence />
      </section>
    </main>
  );
}
