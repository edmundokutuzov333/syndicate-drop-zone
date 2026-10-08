import { ExternalLink } from "lucide-react";

type Props = {
  artistName: string;
  spotifyArtistId: string;
};

export function SpotifyEmbed({ artistName, spotifyArtistId }: Props) {
  const embedUrl =
    "https://open.spotify.com/embed/artist/" +
    encodeURIComponent(spotifyArtistId) +
    "?utm_source=generator&theme=0";
  const spotifyUrl = "https://open.spotify.com/artist/" + encodeURIComponent(spotifyArtistId);
  const panelId = "spotify-profile-" + encodeURIComponent(spotifyArtistId);

  return (
    <section className="border border-border bg-card p-4 md:p-5" aria-labelledby="spotify-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.28em] text-blood">SINAL SPOTIFY</p>
          <h2 id="spotify-title" className="mt-1 font-gothic text-4xl md:text-5xl">OUÇA O ARTISTA</h2>
        </div>
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1 text-[10px] tracking-widest text-muted-foreground transition hover:text-blood md:flex"
        >
          ABRIR NO SPOTIFY <ExternalLink size={12} />
        </a>
      </div>

      <div id={panelId} className="relative overflow-hidden border border-border bg-black/30">
        <iframe
          title={"Spotify de " + artistName}
          src={embedUrl}
          loading="lazy"
          className="h-[352px] w-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-[10px] tracking-widest text-blood md:hidden"
      >
        ABRIR NO SPOTIFY <ExternalLink size={12} />
      </a>
    </section>
  );
}
