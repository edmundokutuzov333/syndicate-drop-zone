// 17 artistas da 1ª edição. Fotos reais em src/assets/artists (ponteiros CDN).
import a01 from "@/assets/artists/a01.jpg.asset.json";
import a02 from "@/assets/artists/a02.jpg.asset.json";
import a03 from "@/assets/artists/a03.jpg.asset.json";
import a04 from "@/assets/artists/a04.jpg.asset.json";
import a05 from "@/assets/artists/a05b.jpg.asset.json";
import a06 from "@/assets/artists/a06.jpg.asset.json";
import a07 from "@/assets/artists/a07.jpg.asset.json";
import a08 from "@/assets/artists/a08.jpg.asset.json";
import a09 from "@/assets/artists/a09.jpg.asset.json";
import a10 from "@/assets/artists/a10.jpg.asset.json";
import a11 from "@/assets/artists/a11.jpg.asset.json";
import a12 from "@/assets/artists/a12.jpg.asset.json";
import a13 from "@/assets/artists/a13.jpg.asset.json";
import a14 from "@/assets/artists/a14.jpg.asset.json";
import a15 from "@/assets/artists/a15.jpg.asset.json";
import a16 from "@/assets/artists/a16.jpg.asset.json";
import a17 from "@/assets/artists/a17.jpg.asset.json";

export type Artist = { code: string; name: string; img: string; bio: string };

const NAMES = [
  "Khriys", "KongV12", "Bruno The Goat", "Masepurp", "Kingston Siriro", "Kaká Machava",
  "Twista", "Txopheer Wawa", "Cipher", "5ir0w", "Pita Shana", "Keew080",
  "Reinaldo King", "Kametee", "Herkey Hk", "Skyler", "3go",
];
// Bios: preencher aqui (mesma ordem). Vazio = "BIO EM BREVE".
const BIOS: string[] = Array(17).fill("");
const PHOTOS = [a01, a02, a03, a04, a05, a06, a07, a08, a09, a10, a11, a12, a13, a14, a15, a16, a17].map((a) => a.url);

export const ARTISTS: Artist[] = PHOTOS.map((img, i) => ({
  code: `SDT-${String(i + 1).padStart(2, "0")}`,
  name: NAMES[i]!,
  bio: BIOS[i] ?? "",
  img,
}));
