import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room } from "@/components/BunkerMap";
import { CampingStudioExperience } from "@/features/camping/scene/CampingStudioExperience";
import "@/features/camping/scene/camping-route.css";
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

export const Route = createFileRoute("/camping")({
  validateSearch: (search: Record<string, unknown>) => ({
    media: typeof search.media === "string" ? search.media : undefined,
  }),
  loader: async () => {
    // The immersive studio is the primary experience. Optional backend content
    // must never prevent /camping from rendering when a catalogue or media table
    // is temporarily unavailable.
    const [sessions, flags, gallery, revelation] = await Promise.all([
      getLiveCampingSessions().catch(() => []),
      getLiveFlags().catch(() => ({
        live: { on: false, url: "" },
        camp: { start: null, end: null },
      })),
      getLiveCampingGallery().catch(() => ({})),
      getLiveRevelationMedia().catch(() => []),
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
  },
  head: () => ({
    meta: [
      { title: "Camping — O Sindicato do Trap" },
      { name: "description", content: "A planta viva do bunker Studio XOYENS: sessões, presença e transmissão." },
      { property: "og:title", content: "Camping — O Sindicato do Trap" },
      { property: "og:description", content: "O estúdio imersivo do Sindicato do Trap." },
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
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => subscribeCampingLive(setLive), []);

  const day = campingDayRange(camp.start, camp.end, now);
  const currentSession = useMemo(
    () => sessions.find((session) => new Date(session.startsAt).getTime() <= now && new Date(session.endsAt).getTime() > now) ?? null,
    [now, sessions],
  );
  const nextSession = useMemo(
    () => sessions
      .filter((session) => new Date(session.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null,
    [now, sessions],
  );

  useEffect(() => {
    if (currentSession?.roomId) setSelectedRoom(currentSession.roomId);
  }, [currentSession?.roomId]);

  const pickRoom = useCallback((room: Room) => setSelectedRoom(room.id), []);
  const toggleRecords = useCallback(() => setRecordsOpen((open) => !open), []);
  const closeRecords = useCallback(() => setRecordsOpen(false), []);
  const leaveCamping = useCallback(() => navigate({ to: "/" }), [navigate]);
  const selectedGallery = gallery[selectedRoom] ?? [];

  return (
    <main className="camping-studio-route">
      <CampingStudioExperience
        day={day ? { current: day.current, total: day.total } : null}
        recordsOpen={recordsOpen}
        onToggleRecords={toggleRecords}
        onClosePanels={closeRecords}
        onLeave={leaveCamping}
      />

      <aside className="camping-records-drawer" hidden={!recordsOpen} aria-label="Registos operacionais do Camping">
        <header className="camping-records-drawer__header">
          <div>
            <p className="camping-records-drawer__eyebrow">CAMPING / CONTROL LOG</p>
            <h2>REGISTOS DO ESTÚDIO</h2>
            <p>Dados publicados a partir dos serviços existentes.</p>
          </div>
          <button type="button" onClick={closeRecords} aria-label="Fechar registos">×</button>
        </header>

        <div className="camping-records-drawer__body">
          <section className="camping-records-drawer__section">
            <p className="camping-records-drawer__section-label">01 / SESSÕES</p>
            <CampingSessions sessions={sessions} selectedRoomId={selectedRoom} onPickRoom={pickRoom} />
          </section>

          <section className="camping-records-drawer__section">
            <p className="camping-records-drawer__section-label">02 / TRANSMISSÃO</p>
            <CampingLive live={live} nextSession={nextSession} />
            {currentSession && (
              <div className="camping-records-drawer__current">
                <p>● AGORA / SESSÃO ACTIVA</p>
                <h3>{currentSession.title}</h3>
                <span>{currentSession.roomName}</span>
              </div>
            )}
          </section>

          <section className="camping-records-drawer__section">
            <p className="camping-records-drawer__section-label">03 / ARQUIVO VISUAL</p>
            <h3>{selectedRoom.toUpperCase()} / GALERIA</h3>
            {selectedGallery.length ? (
              <div className="camping-records-drawer__gallery">
                {selectedGallery.slice(0, 12).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => navigate({ to: "/revelacao", search: { media: item.id } })}
                    aria-label={"Abrir registo " + item.caption}
                  >
                    <img src={item.src} alt={item.caption} loading="lazy" decoding="async" />
                    <span>{item.caption || item.tag}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="camping-records-drawer__empty">SEM REGISTOS PUBLICADOS NESTA SALA.</p>
            )}
          </section>

          <section className="camping-records-drawer__section">
            <p className="camping-records-drawer__section-label">04 / PRESENÇA</p>
            <ArtistPresence />
          </section>
        </div>
      </aside>
    </main>
  );
}
