import { useEffect, useMemo, useState } from "react";
import { createPublicLiveNotification, normalizeLiveUrl, subscribeCampingLive, type LiveFlag, type CampingSessionRow } from "@/lib/camping-data";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function isLikelyWhatsApp(value: string) {
  return /^\+?[0-9][0-9 .()\-]{4,}$/.test(value.trim());
}

export function CampingLive({
  live,
  nextSession,
}: {
  live: LiveFlag;
  nextSession: CampingSessionRow | null;
}) {
  const [armed, setArmed] = useState(false);
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [currentLive, setCurrentLive] = useState(live);

  const onNotify = async () => {
    const value = contact.trim();
    const type = isLikelyEmail(value) ? "email" : isLikelyWhatsApp(value) ? "whatsapp" : null;
    if (!type) {
      setMessage("INTRODUZ UM EMAIL OU WHATSAPP VÁLIDO.");
      return;
    }
    try {
      await createPublicLiveNotification({ contactType: type, contactValue: value });
      track("live_notify", { kind: "live", contact_type: type });
      setMessage("REGISTADO. AVISAMOS QUANDO O SINAL ENTRAR.");
      setContact("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "NÃO FOI POSSÍVEL REGISTAR.");
    }
  };

  useEffect(() => subscribeCampingLive(setCurrentLive), []);

  useEffect(() => setCurrentLive(live), [live.on, live.url]);

  const embedUrl = useMemo(() => normalizeLiveUrl(currentLive.url), [currentLive.url]);

  if (currentLive.on && embedUrl) {
    return (
      <section className="border border-blood bg-black">
        <div className="flex items-center justify-between border-b border-blood/50 px-4 py-3">
          <span className="font-mono text-[9px] tracking-[0.2em] text-blood">● AO VIVO</span>
          <span className="font-mono text-[8px] text-muted-foreground">TRANSMISSÃO EXTERNA</span>
        </div>
        <div className="scanlines relative aspect-video overflow-hidden bg-black">
          {!armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-[0.18em] text-foreground"
            >
              <span className="border border-blood bg-background/90 px-5 py-4 hover:bg-blood hover:text-primary-foreground">
                CARREGAR EMISSÃO
              </span>
            </button>
          ) : (
            <iframe
              src={embedUrl}
              title="Emissão ao vivo do Sindicato"
              loading="eager"
              allow="autoplay; encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] text-blood">LIVE · EM ESPERA</p>
          <h2 className="mt-1 font-gothic text-4xl">FORA DO AR</h2>
          {nextSession ? (
            <p className="mt-2 font-stamp text-sm text-muted-foreground">
              PRÓXIMA: {nextSession.title} · {new Date(nextSession.startsAt).toLocaleString("pt-PT")}
            </p>
          ) : (
            <p className="mt-2 font-stamp text-sm text-muted-foreground">A PRÓXIMA SESSÃO AINDA NÃO FOI PUBLICADA.</p>
          )}
        </div>

        <div className="w-full max-w-md">
          <label htmlFor="camp-live-contact" className="font-mono text-[8px] tracking-[0.15em] text-muted-foreground">
            AVISA-ME QUANDO ENTRAR NO AR
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="camp-live-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="WHATSAPP OU EMAIL"
              className="min-w-0 flex-1 border border-border bg-background px-3 py-3 font-mono text-[9px] outline-none focus:border-blood"
              inputMode="email"
              autoComplete="email"
            />
            <button
              type="button"
              onClick={() => void onNotify()}
              className="border border-blood bg-blood px-4 py-3 font-mono text-[9px] text-primary-foreground hover:opacity-90"
            >
              AVISA-ME
            </button>
          </div>
          {message && <p className="mt-2 font-mono text-[8px] text-muted-foreground">{message}</p>}
        </div>
      </div>
    </section>
  );
}
