// 16 artistas da 1ª edição. Fotos reais em src/assets/artists (ponteiros CDN).
import a01 from "@/assets/artists/a01.jpg.asset.json";
import a02 from "@/assets/artists/a02.jpg.asset.json";
import a03 from "@/assets/artists/a03.jpg.asset.json";
import a04 from "@/assets/artists/a04.jpg.asset.json";
import a05 from "@/assets/artists/a05.jpg.asset.json";
import a06 from "@/assets/artists/a06.jpg.asset.json";
import a07 from "@/assets/artists/a07.jpg.asset.json";
import a08 from "@/assets/artists/a08.jpg.asset.json";
import a09 from "@/assets/artists/a09.jpg.asset.json";
import a10 from "@/assets/artists/a10.jpg.asset.json";

export type Artist = { code: string; name: string; img?: string; status: string };

const STATUS = ["ATIVO", "VIGIADO", "ISOLADO", "CLASSIFICADO"];
const PHOTOS = [a01, a02, a03, a04, a05, a06, a07, a08, a09, a10].map((a) => a.url);

export const ARTISTS: Artist[] = Array.from({ length: 16 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const base = { code: `SDT-${n}`, name: `ARTISTA ${n}`, status: STATUS[i % STATUS.length]! };
  const img = PHOTOS[i];
  return img ? { ...base, img } : base;
});
