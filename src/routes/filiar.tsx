import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, Download, Loader2, Pause, Play, Share2, Upload, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import selo from "@/assets/brand/sindicato-selo.png.asset.json";
import { downloadFanCard, downloadVideoBlob, drawFanCard, shareFanCard } from "@/lib/fan-card";
import { fanPublic, getStoredFanCode, registerFan, storeFanCode, type FanPublic } from "@/lib/fan-membership";
import { track } from "@/lib/track";

export const Route = createFileRoute("/filiar")({
  head: () => ({
    meta: [
      { title: "Cartão de Fã — O Sindicato do Trap" },
      { name: "description", content: "Aceita o Código do Fã, cria o teu cartão e partilha o Sindicato." },
      { property: "og:title", content: "Cartão de Fã — O Sindicato do Trap" },
      { property: "og:description", content: "Cria o teu cartão de fã, descarrega o PNG ou faz um vídeo com música." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Filiacao,
});

const CLAUSES = [
  { title: "RESPEITO", body: "Respeita toda a comunidade." },
  { title: "APOIO", body: "Apoia os artistas e a cultura." },
  { title: "CRÉDITO", body: "Dá crédito a quem cria." },
  { title: "UNIÃO", body: "Não divulgues conteúdos privados ou lançamentos sem autorização." },
] as const;

const TRACKS = [
  {
    id: "T1",
    title: "A NOVA WAVE",
    feat: "Bruno The Goat, Alemão Wav, Elton Penicela",
    src: "/audio/Phantom, Bruno The Goat, Alemão Wav & Elton Penicela - A Nova Wave.mp3",
  },
  {
    id: "T2",
    title: "PHANTOM MODE",
    feat: "INF8M8US, HEYYG, Kingston Siriro",
    src: "/audio/PHANTOM Mode 2 - The Final Movie W_ INF8M8US, HEYYG, KINGSTON SIRIRO.mp3",
  },
  {
    id: "T3",
    title: "FASHIION D'PHANTOM",
    feat: "Kingston Siriro, Kaká Machava, Elton Penicela",
    src: "/audio/(Unmastered) PHANTOM, Kingston Siriro, Elton Penicela - Fashion de Phantom.mp3",
  },
] as const;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-PT");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a fotografia."));
    image.src = src;
  });
}

export function Filiacao() {
  const [alias, setAlias] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [card, setCard] = useState<FanPublic | null>(null);
  const [registering, setRegistering] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState("");
  const [shareState, setShareState] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState(TRACKS[0]?.id ?? "");
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [stampImage, setStampImage] = useState<HTMLImageElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const cardCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoObjectUrlRef = useRef<string | null>(null);
  const photoObjectUrlRef = useRef<string | null>(null);

  const selectedTrack = useMemo(
    () => TRACKS.find((item) => item.id === selectedTrackId) ?? TRACKS[0],
    [selectedTrackId],
  );

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("fan") || (params.get("ref") ? null : getStoredFanCode());
    if (!code) return;

    setLoadingExisting(true);
    fanPublic(code)
      .then((saved) => {
        if (!active) return;
        if (!saved) {
          if (params.get("fan")) setError("NÃO FOI POSSÍVEL ENCONTRAR ESTE CARTÃO.");
          return;
        }
        setCard(saved);
        setAlias(saved.alias);
        storeFanCode(saved.code);
      })
      .catch(() => {
        if (active) setError("NÃO FOI POSSÍVEL ABRIR O CARTÃO. TENTA NOVAMENTE.");
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadImage(selo.url)
      .then((image) => { if (active) setStampImage(image); })
      .catch(() => { if (active) setStampImage(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!card || !photo || !cardCanvasRef.current) return;
    drawFanCard(cardCanvasRef.current, card, photo, stampImage);
  }, [card, photo, stampImage]);

  useEffect(() => {
    return () => {
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
      if (videoObjectUrlRef.current) URL.revokeObjectURL(videoObjectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPreviewPlaying(false);
    setVideoError("");
    setPreviewError("");
    setVideoProgress(0);
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current);
      videoObjectUrlRef.current = null;
    }
    setVideoUrl(null);
  }, [selectedTrackId]);

  const selectPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("ESCOLHE UM FICHEIRO DE IMAGEM.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("A FOTOGRAFIA DEVE TER NO MÁXIMO 12 MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (photoObjectUrlRef.current) URL.revokeObjectURL(photoObjectUrlRef.current);
      photoObjectUrlRef.current = url;
      setPhoto(image);
      setError("");
    } catch {
      URL.revokeObjectURL(url);
      setError("NÃO FOI POSSÍVEL ABRIR A FOTOGRAFIA.");
    }
  };

  const createCard = async () => {
    setError("");
    setShareState("");
    const cleanAlias = alias.trim();
    if (!accepted) {
      setError("ACEITA O CÓDIGO DO FÃ PARA CONTINUAR.");
      return;
    }
    if (cleanAlias.length < 2 || cleanAlias.length > 20) {
      setError("O NOME OU APELIDO DEVE TER ENTRE 2 E 20 CARACTERES.");
      return;
    }
    if (!photo) {
      setError("A FOTOGRAFIA É OBRIGATÓRIA PARA CRIAR O CARTÃO.");
      return;
    }
    if (registering) return;

    const params = new URLSearchParams(window.location.search);
    const referredBy = params.get("ref");
    setRegistering(true);
    try {
      track("join_start", { referred: Boolean(referredBy) });
      const created = await registerFan({ alias: cleanAlias, rulesVersion: "v1", referredBy });
      storeFanCode(created.code);
      setCard(created);
      setAlias(created.alias);
      window.history.replaceState({}, "", window.location.pathname + "?fan=" + encodeURIComponent(created.code));
      track("join_done", { member: created.fanNumber, referred: Boolean(referredBy) });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      setError(message.includes("NOME_INVALIDO")
        ? "O NOME OU APELIDO DEVE TER ENTRE 2 E 20 CARACTERES."
        : "NÃO FOI POSSÍVEL CRIAR O CARTÃO. TENTA NOVAMENTE.");
    } finally {
      setRegistering(false);
    }
  };

  const downloadPng = async () => {
    if (!card || !photo || !cardCanvasRef.current) return;
    try {
      await downloadFanCard(cardCanvasRef.current, "sindicato-cartao-fa-" + card.code + ".png");
      track("card_share", { method: "download_png" });
      setShareState("IMAGEM PNG DESCARREGADA.");
    } catch {
      setShareState("NÃO FOI POSSÍVEL DESCARREGAR A IMAGEM.");
    }
  };

  const sharePng = async () => {
    if (!card || !photo || !cardCanvasRef.current) return;
    try {
      const result = await shareFanCard(cardCanvasRef.current, "sindicato-cartao-fa-" + card.code + ".png");
      if (result === "cancelled") {
        setShareState("PARTILHA CANCELADA.");
        return;
      }
      track("card_share", { method: result === "shared" ? "share_png" : "download_png_fallback" });
      setShareState(result === "shared" ? "PARTILHA ABERTA NO TELEMÓVEL." : "IMAGEM PNG DESCARREGADA.");
    } catch {
      setShareState("NÃO FOI POSSÍVEL PARTILHAR A IMAGEM.");
    }
  };

  const copyLink = async () => {
    if (!card) return;
    const link = window.location.origin + "/filiar?fan=" + encodeURIComponent(card.code);
    try {
      await navigator.clipboard.writeText(link);
      setShareState("LINK DO CARTÃO COPIADO.");
    } catch {
      setShareState("COPIA ESTE LINK: " + link);
    }
  };

  const createVideo = async () => {
    if (!card || !photo || !cardCanvasRef.current || !selectedTrack || videoBusy) return;
    setVideoBusy(true);
    setVideoError("");
    setVideoProgress(1);
    setShareState("");
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current);
      videoObjectUrlRef.current = null;
    }
    setVideoUrl(null);
    try {
      const { createFanVideo } = await import("@/lib/fan-video");
      const blob = await createFanVideo(cardCanvasRef.current, selectedTrack.id, setVideoProgress);
      if (blob.type !== "video/mp4" || blob.size === 0) throw new Error("O vídeo criado não está no formato esperado.");
      const url = URL.createObjectURL(blob);
      videoObjectUrlRef.current = url;
      setVideoUrl(url);
      setVideoProgress(100);
      track("card_share", { method: "video_created" });
    } catch (renderError) {
      let message = "";
      if (typeof renderError === "string") {
        message = renderError.trim();
      } else if (renderError && typeof renderError === "object") {
        const details = renderError as { message?: unknown; error?: unknown; code?: unknown };
        if (typeof details.message === "string") message = details.message.trim();
        else if (typeof details.error === "string") message = details.error.trim();
        else if (typeof details.code === "string") message = `O motor de vídeo falhou (${details.code}).`;
      }
      setVideoError(
        message
          || "O motor de vídeo falhou sem devolver diagnóstico. Recarrega a página e tenta novamente; o download PNG continua disponível.",
      );
    } finally {
      setVideoBusy(false);
    }
  };

  const downloadVideo = async () => {
    if (!videoUrl || !card) return;
    try {
      const blob = await (await fetch(videoUrl)).blob();
      downloadVideoBlob(blob, "sindicato-video-fa-" + card.code + ".mp4");
      track("card_share", { method: "download_mp4" });
    } catch {
      setVideoError("NÃO FOI POSSÍVEL DESCARREGAR O VÍDEO.");
    }
  };

  const shareVideo = async () => {
    if (!videoUrl || !card) return;
    try {
      const blob = await (await fetch(videoUrl)).blob();
      const file = new File([blob], "sindicato-video-fa-" + card.code + ".mp4", { type: "video/mp4" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (navigator.share && nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "O Sindicato do Trap", text: "O meu cartão de fã do Sindicato do Trap." });
        track("card_share", { method: "share_mp4" });
        setShareState("PARTILHA ABERTA NO TELEMÓVEL.");
        return;
      }
      downloadVideoBlob(blob, "sindicato-video-fa-" + card.code + ".mp4");
      setShareState("O TEU NAVEGADOR NÃO ABRIU A PARTILHA. O VÍDEO FOI DESCARREGADO.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") setShareState("PARTILHA CANCELADA.");
      else setVideoError("NÃO FOI POSSÍVEL PARTILHAR O VÍDEO.");
    }
  };

  const togglePreview = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setPreviewError("");
    try { await audio.play(); } catch {
      setPreviewError("NÃO FOI POSSÍVEL REPRODUZIR A PRÉVIA. VERIFICA A LIGAÇÃO E EXPERIMENTA OUTRA MÚSICA.");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-10 md:px-8">
      <header className="border-y border-border py-5">
        <p className="font-mono text-[10px] tracking-[0.24em] text-blood">SINDICATO DO TRAP // COMUNIDADE</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-gothic text-6xl leading-[0.85] md:text-8xl">Cartão de Fã.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Entra na comunidade, cria o teu cartão e partilha o Sindicato.</p>
          </div>
          <span className="border border-blood px-3 py-2 font-mono text-[9px] tracking-[0.18em] text-blood">
            {card ? "CARTÃO CRIADO" : loadingExisting ? "A ABRIR CARTÃO..." : "GRATUITO"}
          </span>
        </div>
      </header>

      {loadingExisting && !card && (
        <div className="mt-8 flex items-center gap-3 border border-border p-4 font-mono text-xs text-muted-foreground" role="status">
          <Loader2 className="animate-spin" size={16} /> A ABRIR O TEU CARTÃO...
        </div>
      )}

      {!card && !loadingExisting && (
        <section className="mx-auto mt-8 max-w-3xl border border-border bg-card">
          <div className="border-b-2 border-blood bg-[#111] p-5 md:p-7">
            <p className="font-mono text-[9px] tracking-[0.2em] text-blood">CÓDIGO DO FÃ // V1</p>
            <h2 className="mt-2 font-stamp text-3xl text-foreground md:text-4xl">SINDIIICALIZADO</h2>
            <p className="mt-2 text-sm text-muted-foreground">Quatro regras. Um cartão. A tua forma de representar.</p>
          </div>

          <div className="grid gap-0 sm:grid-cols-2">
            {CLAUSES.map((clause, index) => (
              <div key={clause.title} className="flex min-h-28 gap-3 border-b border-border p-4 sm:odd:border-r">
                <div className="font-mono text-xs text-blood">0{index + 1}</div>
                <div>
                  <h3 className="font-stamp text-lg text-foreground">{clause.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{clause.body}</p>
                </div>
              </div>
            ))}
          </div>

          <form className="space-y-5 p-5 md:p-7" onSubmit={(event) => { event.preventDefault(); void createCard(); }}>
            <label className="flex cursor-pointer items-start gap-3 border border-border p-4 hover:border-blood">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#bd252b]" />
              <span>
                <span className="block font-mono text-xs text-foreground">Aceito o Código do Fã.</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Respeito, apoio, crédito e união.</span>
              </span>
            </label>

            <div className="space-y-2">
              <label htmlFor="fan-alias" className="font-mono text-[10px] tracking-[0.16em] text-blood">NOME OU APELIDO</label>
              <input id="fan-alias" value={alias} onChange={(event) => setAlias(event.target.value.slice(0, 20))} minLength={2} maxLength={20} autoComplete="nickname" placeholder="Como queres aparecer no cartão?" className="min-h-12 w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-blood" required />
              <p className="text-xs text-muted-foreground">Máximo de 20 caracteres. Não precisas de indicar telefone ou email.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="fan-photo" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-dashed border-border px-4 py-3 font-mono text-[10px] tracking-[0.14em] hover:border-blood">
                <Upload size={15} /> {photo ? "FOTOGRAFIA SELECCIONADA" : "ADICIONAR FOTOGRAFIA OBRIGATÓRIA"}
              </label>
              <input id="fan-photo" type="file" accept="image/*" aria-required="true" className="sr-only" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
              <p className="text-xs text-muted-foreground">Obrigatória. A fotografia recebe o efeito de impressão e fotocópia dos artistas. Fica neste dispositivo e não é enviada para o servidor.</p>
            </div>

            {error && <p role="alert" aria-live="assertive" className="border border-blood/60 bg-blood/10 p-3 font-mono text-[10px] leading-5 text-blood">{error}</p>}

            <button type="submit" disabled={registering} className="flex min-h-12 w-full items-center justify-center gap-2 border border-blood bg-blood px-5 py-4 font-mono text-[10px] tracking-[0.18em] text-primary-foreground transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
              {registering ? <><Loader2 className="animate-spin" size={15} /> A CRIAR CARTÃO...</> : <><Check size={15} /> CRIAR O MEU CARTÃO</>}
            </button>
            <p className="text-center text-xs text-muted-foreground">Gratuito. Sem conta, sem assinatura e sem dados de contacto.</p>
          </form>
        </section>
      )}

      {card && (
        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="border border-border bg-card p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] tracking-[0.18em] text-blood">CARTÃO DE FÃ CRIADO</p>
                <p className="mt-1 font-stamp text-xl">Nº {String(card.fanNumber).padStart(4, "0")} · {card.code}</p>
              </div>
              <span className="stamp px-2 py-1 text-[8px] font-bold tracking-[0.12em]">FÃ SDT</span>
            </div>
            {!photo && (
              <div className="mb-4 space-y-2 border border-dashed border-blood p-4">
                <label htmlFor="fan-photo-existing" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 font-mono text-[10px] tracking-[0.12em]">
                  <Upload size={15} /> ADICIONAR FOTOGRAFIA OBRIGATÓRIA
                </label>
                <input id="fan-photo-existing" type="file" accept="image/*" aria-required="true" className="sr-only" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
                <p className="text-xs leading-5 text-muted-foreground">Este cartão foi aberto sem a fotografia local. Selecciona-a novamente para gerar o PNG ou vídeo. A imagem não é enviada para o servidor.</p>
              </div>
            )}
            <div className="overflow-hidden border border-border bg-black">
              {photo ? <canvas ref={cardCanvasRef} className="h-auto w-full" aria-label="Prévia do cartão de fã" /> : <div className="flex aspect-[9/16] items-center justify-center p-6 text-center font-mono text-xs leading-6 text-muted-foreground">A FOTOGRAFIA É OBRIGATÓRIA<br />PARA GERAR O CARTÃO.</div>}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">PNG em 1080 × 1920 píxeis.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => void downloadPng()} disabled={!photo} className="flex min-h-12 items-center justify-center gap-2 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.14em] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Download size={15} /> DESCARREGAR IMAGEM PNG</button>
              <button type="button" onClick={() => void sharePng()} disabled={!photo} className="flex min-h-12 items-center justify-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.14em] hover:border-blood disabled:cursor-not-allowed disabled:opacity-50"><Share2 size={15} /> PARTILHAR PNG</button>
              <button type="button" onClick={() => void copyLink()} className="flex min-h-12 items-center justify-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.14em] hover:border-blood"><Copy size={15} /> COPIAR LINK DO CARTÃO</button>
              {shareState && <p role="status" className="break-words text-center font-mono text-[9px] leading-5 text-blood">{shareState}</p>}
            </div>
          </div>

          <div className="space-y-5">
            <div className="border border-border bg-card p-5 md:p-7">
              <p className="font-mono text-[9px] tracking-[0.2em] text-blood">O PRÓXIMO PASSO</p>
              <h2 className="mt-2 font-gothic text-5xl leading-none md:text-6xl">Dá som ao teu cartão.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Escolhe uma prévia. O vídeo terá 30 segundos, música incluída e animação que acompanha o som.</p>

              <div className="mt-5 space-y-2">
                <label htmlFor="fan-track" className="font-mono text-[10px] tracking-[0.16em] text-blood">ESCOLHE A MÚSICA</label>
                <select id="fan-track" value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)} className="min-h-12 w-full border border-border bg-background px-3 py-3 text-sm">
                  {TRACKS.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.feat}</option>)}
                </select>
                {selectedTrack && (
                  <audio ref={audioRef} src={selectedTrack.src} preload="none" onPlay={() => setPreviewPlaying(true)} onPause={() => setPreviewPlaying(false)} onEnded={() => setPreviewPlaying(false)} className="hidden" />
                )}
                <button type="button" onClick={() => void togglePreview()} disabled={!selectedTrack} className="flex min-h-11 w-full items-center justify-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.14em] hover:border-blood disabled:opacity-50">
                  {previewPlaying ? <Pause size={15} /> : <Play size={15} />} {previewPlaying ? "PAUSAR PRÉVIA" : "OUVIR PRÉVIA"}
                </button>
                {previewError && <p role="alert" className="border border-blood/60 bg-blood/10 p-3 text-xs leading-5 text-blood">{previewError}</p>}
                <div className="flex h-16 items-center justify-center gap-1 overflow-hidden border border-border bg-[#101010] px-4" aria-label="Prévia visual do som">
                  {Array.from({ length: 36 }, (_, index) => (
                    <span key={index} className={previewPlaying ? "fan-eq-bar" : ""} style={{ height: (10 + ((index * 17) % 35)) + "px", width: "5px", background: "#bd252b", opacity: previewPlaying ? 1 : 0.65, animationDelay: (index * 18) + "ms" }} />
                  ))}
                </div>
              </div>

              <div className="mt-5 border border-border p-4">
                <div className="flex items-center gap-3">
                  <Video size={19} className="text-blood" />
                  <div className="flex-1">
                    <p className="font-mono text-[10px] tracking-[0.14em]">VÍDEO VERTICAL · 30 SEGUNDOS</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">1080 × 1920 píxeis · MP4 · música incluída.</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">O motor de vídeo gratuito só é carregado quando clicares em “CRIAR VÍDEO”. A primeira vez pode demorar e usa a memória do teu dispositivo.</p>
                <button type="button" onClick={() => void createVideo()} disabled={videoBusy || !selectedTrack || !photo} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 border border-blood bg-blood px-4 py-4 font-mono text-[10px] tracking-[0.16em] text-primary-foreground disabled:cursor-wait disabled:opacity-60">
                  {videoBusy ? <><Loader2 size={15} className="animate-spin" /> A RENDERIZAR NO SERVIDOR...</> : <><Video size={15} /> CRIAR VÍDEO</>}
                </button>
                {videoBusy && (
                  <div className="fan-rendering-track mt-3 h-2 overflow-hidden bg-border" role="status" aria-label="A renderizar o vídeo no servidor">
                    <div className="fan-rendering-bar h-full w-1/3 bg-blood" />
                  </div>
                )}
                {videoError && <p role="alert" className="mt-3 border border-blood/60 bg-blood/10 p-3 text-xs leading-5 text-blood">{videoError}</p>}
              </div>
            </div>

            {videoUrl && (
              <div className="border border-border bg-card p-5 md:p-7">
                <p className="font-mono text-[9px] tracking-[0.2em] text-blood">VÍDEO PRONTO</p>
                <h3 className="mt-2 font-stamp text-2xl">Pré-visualiza antes de partilhar.</h3>
                <video src={videoUrl} controls playsInline className="mt-4 max-h-[70vh] w-full border border-border bg-black" />
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void downloadVideo()} className="flex min-h-12 items-center justify-center gap-2 border border-blood bg-blood px-4 py-3 font-mono text-[10px] tracking-[0.12em] text-primary-foreground"><Download size={15} /> DESCARREGAR VÍDEO MP4</button>
                  <button type="button" onClick={() => void shareVideo()} className="flex min-h-12 items-center justify-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.12em] hover:border-blood"><Share2 size={15} /> PARTILHAR VÍDEO</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Link to="/" className="inline-flex min-h-11 items-center gap-2 border border-border px-4 py-3 font-mono text-[10px] tracking-[0.14em] hover:border-blood"><ArrowLeft size={14} /> VOLTAR AO SINDICATO</Link>
              <p className="self-center text-xs text-muted-foreground">Cartão criado em {formatDate(card.since)}.</p>
            </div>
          </div>
        </section>
      )}

      {!card && error && !loadingExisting && <p role="alert" aria-live="assertive" className="mt-5 border border-blood/60 bg-blood/10 p-3 font-mono text-[10px] leading-5 text-blood">{error}</p>}
      <style>{".fan-eq-bar{transform-origin:center;animation:fan-eq 420ms ease-in-out infinite alternate}@keyframes fan-eq{0%{transform:scaleY(.28)}100%{transform:scaleY(1)}}.fan-rendering-bar{animation:fan-rendering 1.15s ease-in-out infinite alternate}@keyframes fan-rendering{from{transform:translateX(0)}to{transform:translateX(200%)}}"}</style>
    </main>
  );
}
