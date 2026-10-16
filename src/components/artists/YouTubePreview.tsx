import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ArtistVideo } from "@/lib/artist-content";

type Props = {
  artistName: string;
  video: ArtistVideo;
};

export function YouTubePreview({ artistName, video }: Props) {
  const [loaded, setLoaded] = useState(false);
  const thumbnail = "https://i.ytimg.com/vi/" + encodeURIComponent(video.youtubeId) + "/hqdefault.jpg";
  const youtubeUrl = "https://youtu.be/" + encodeURIComponent(video.youtubeId);

  return (
    <article className="group overflow-hidden border border-border bg-card">
      <div className="relative aspect-video overflow-hidden bg-background">
        {loaded ? (
          <iframe
            title={artistName + " · " + video.label}
            src={
              "https://www.youtube.com/embed/" +
              encodeURIComponent(video.youtubeId) +
              "?rel=0&modestbranding=1"
            }
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLoaded(true)}
            aria-label={"Reproduzir " + video.label}
            className="relative h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blood"
          >
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover grayscale contrast-[1.35] brightness-[0.72] transition duration-500 group-hover:scale-[1.025] group-hover:brightness-[0.85]"
            />
            <div className="halftone-overlay pointer-events-none absolute inset-0" />
            <div className="xerox-wear pointer-events-none absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center border border-foreground/70 bg-background/80 text-foreground transition group-hover:border-blood group-hover:text-blood">
                <Play size={24} fill="currentColor" />
              </span>
            </div>
            <span className="absolute left-3 top-3 bg-blood px-2 py-1 font-stamp text-[10px] text-primary-foreground">
              YOUTUBE
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border p-3">
        <div className="min-w-0">
          <p className="text-[10px] tracking-widest text-blood">{video.label}</p>
          <p className="truncate font-stamp text-sm">{artistName}</p>
        </div>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex shrink-0 items-center gap-1 text-[9px] tracking-widest text-muted-foreground",
            "transition hover:text-blood",
          )}
        >
          VER NO YOUTUBE <ExternalLink size={11} />
        </a>
      </div>
    </article>
  );
}
