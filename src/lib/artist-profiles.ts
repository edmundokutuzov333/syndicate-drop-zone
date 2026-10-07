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

export type ArtistVideo = {
  id: string;
  youtubeId: string;
  label: string;
};

export type ArtistProfile = {
  slug: string;
  name: string;
  bio: string;
  frase: string;
  zona: string;
  faixas: string[];
  role: string;
  studio: string;
  edition: string;
  presence: string;
  spotifyArtistId: string;
  youtube: ArtistVideo[];
  img: string;
};

const PROFILES: Omit<ArtistProfile, "img">[] = [
  { slug: "khriys", name: "Khriys", frase: "Rima fria, coração quente.", zona: "Maputo · Malhangalene", faixas: ["ph4nt0mmm_intr0"], bio: "Primeiro a chegar, último a sair. Escreve no telemóvel entre takes.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "2zLSeGbduePeKdpiuRYSry", youtube: [{ id: "khriys-01", youtubeId: "XKzbL5wsFNw", label: "Lançamento 01" }, { id: "khriys-02", youtubeId: "yeqKHuM_NXM", label: "Lançamento 02" }, { id: "khriys-03", youtubeId: "RJNhU3afjT0", label: "Lançamento 03" }] },
  { slug: "kong-v12", name: "KongV12", frase: "Sem plano B.", zona: "Matola · Liberdade", faixas: ["PHANTOM MODE"], bio: "Flow de metralhadora e ad-libs que viram hino na sala.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "78YVPqfXcElqqfwbR1Egus", youtube: [{ id: "kong-v12-01", youtubeId: "KJKkbNXcqfE", label: "Lançamento 01" }, { id: "kong-v12-02", youtubeId: "9a5hsYvddSw", label: "Lançamento 02" }, { id: "kong-v12-03", youtubeId: "TpPc2dIKcKY", label: "Lançamento 03" }] },
  { slug: "bruno-the-goat", name: "Bruno The Goat", frase: "O cabrito não pede licença.", zona: "Maputo · Polana Caniço", faixas: ["A NOVA WAVE"], bio: "Abriu A Nova Wave numa só take. Voz grave, presença pesada.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "0ZOd9IlBNOIDPKIYUKkPHp", youtube: [{ id: "bruno-the-goat-01", youtubeId: "UNRJZB2sd7o", label: "Lançamento 01" }, { id: "bruno-the-goat-02", youtubeId: "RvPESv5C8I0", label: "Lançamento 02" }, { id: "bruno-the-goat-03", youtubeId: "QKFQmEvAzKA", label: "Lançamento 03" }] },
  { slug: "masepurp", name: "Masepurp", frase: "Roxo no copo, ouro na voz.", zona: "Maputo · Xipamanine", faixas: ["PHANTOM MODE"], bio: "Melodia arrastada, auto-tune no talo, vibe noturna.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "7uOMkYjLobQzJdO5LaNuwL", youtube: [{ id: "masepurp-01", youtubeId: "1tfLq0VraiQ", label: "Lançamento 01" }, { id: "masepurp-02", youtubeId: "vbb5RJTRv04", label: "Lançamento 02" }, { id: "masepurp-03", youtubeId: "wecXt8accQk", label: "Lançamento 03" }] },
  { slug: "kingston-siriro", name: "Kingston Siriro", frase: "Estilo não se compra.", zona: "Maputo · Sommerschield", faixas: ["FASHIION D'PHANTOM"], bio: "Moda e trap no mesmo verso. Comandou a FASHIION D'PHANTOM.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "0V8GXIuiejkGA6m0159YNl", youtube: [{ id: "kingston-siriro-01", youtubeId: "RgumO1E_7q4", label: "Lançamento 01" }, { id: "kingston-siriro-02", youtubeId: "3rFGkLU_byw", label: "Lançamento 02" }, { id: "kingston-siriro-03", youtubeId: "ATjMF69GV10", label: "Lançamento 03" }] },
  { slug: "kaka-machava", name: "Kaká Machava", frase: "Fala pouco, fere muito.", zona: "Matola · Fomento", faixas: ["FASHIION D'PHANTOM"], bio: "Chegou com o refrão pronto. Saiu com a sala toda a cantar.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "52sVhfDGmWOXmaiddgfWix", youtube: [{ id: "kaka-machava-01", youtubeId: "mhX0o3hGisg", label: "Lançamento 01" }, { id: "kaka-machava-02", youtubeId: "CzhomfU1AyA", label: "Lançamento 02" }, { id: "kaka-machava-03", youtubeId: "hXjLPOKhbJg", label: "Lançamento 03" }] },
  { slug: "twista", name: "Twista", frase: "Gira o mundo, volta pra rua.", zona: "Maputo · Hulene", faixas: ["A NOVA WAVE"], bio: "Double-time sem respirar. Escreve em cima do beat a correr.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "3c2TqwIinkQvVK0JYPYrLR", youtube: [{ id: "twista-01", youtubeId: "VUwGqPWlrxI", label: "Lançamento 01" }, { id: "twista-02", youtubeId: "p5PxNepr0Ww", label: "Lançamento 02" }, { id: "twista-03", youtubeId: "yDUQ3-5XnT4", label: "Lançamento 03" }] },
  { slug: "txopheer-wawa", name: "Txopheer Wawa", frase: "Wawa nunca dorme.", zona: "Maputo · Mafalala", faixas: ["PHANTOM MODE"], bio: "Energia de palco dentro da cabine. Grita os ad-libs sozinho.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "5GBgb1VlOXQN5jBu6Z3zMk", youtube: [{ id: "txopheer-wawa-01", youtubeId: "zs9pRhWzxi4", label: "Lançamento 01" }, { id: "txopheer-wawa-02", youtubeId: "rQ3v4CT1YZQ", label: "Lançamento 02" }, { id: "txopheer-wawa-03", youtubeId: "NkCbNUx7xUU", label: "Lançamento 03" }] },
  { slug: "cipher", name: "Cipher", frase: "Código fechado.", zona: "Maputo · Alto Maé", faixas: ["ph4nt0mmm_intr0"], bio: "Letra cifrada, punchlines escondidas. Ouve duas vezes.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "5xbGmD0sbNSmqXj3VzsSZY", youtube: [{ id: "cipher-01", youtubeId: "kj5rPWCf1Ro", label: "Lançamento 01" }, { id: "cipher-02", youtubeId: "ZLwqokBhqbQ", label: "Lançamento 02" }, { id: "cipher-03", youtubeId: "P-dnE_-1AVs", label: "Lançamento 03" }] },
  { slug: "5ir0w", name: "5ir0w", frase: "Zero sinal, só som.", zona: "Matola · Machava", faixas: ["A NOVA WAVE"], bio: "Produz e rima. Mexeu nos 808 da sessão inteira.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "3xn6GYqDbmzCbkJtvdlbRF", youtube: [{ id: "5ir0w-01", youtubeId: "iJfHBXcssns", label: "Lançamento 01" }, { id: "5ir0w-02", youtubeId: "4qkmugBjSbc", label: "Lançamento 02" }, { id: "5ir0w-03", youtubeId: "qc4fe0BjQQU", label: "Lançamento 03" }] },
  { slug: "pita-shana", name: "Pita Shana", frase: "Rainha da sombra.", zona: "Maputo · Central", faixas: ["FASHIION D'PHANTOM"], bio: "Voz cortante, presença de capa. Entrou e mudou o clima.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "0MYxw3F13ZkgVex2ztSfeb", youtube: [{ id: "pita-shana-01", youtubeId: "8nm7U2yhEoc", label: "Lançamento 01" }, { id: "pita-shana-02", youtubeId: "OlhZwxQQ3ZM", label: "Lançamento 02" }, { id: "pita-shana-03", youtubeId: "c8-WV3DG8ZM", label: "Lançamento 03" }] },
  { slug: "keew080", name: "Keew080", frase: "808 no sangue.", zona: "Maputo · Chamanculo", faixas: ["PHANTOM MODE"], bio: "Dono do bounce. Cada verso tem um gancho.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "63M4Lo07MGOC1eEaVAXIMo", youtube: [{ id: "keew080-01", youtubeId: "AqNsJCaa8kI", label: "Lançamento 01" }, { id: "keew080-02", youtubeId: "NwP4mUA-to0", label: "Lançamento 02" }, { id: "keew080-03", youtubeId: "A8ZhoDHcPRk", label: "Lançamento 03" }] },
  { slug: "reinaldo-king", name: "Reinaldo King", frase: "Coroa de rua.", zona: "Matola · T3", faixas: ["A NOVA WAVE"], bio: "Rei das madrugadas no estúdio. Grava quando todos já foram.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "3wnx882xKoP5KKfbgRCOIZ", youtube: [{ id: "reinaldo-king-01", youtubeId: "CrSRCHJU5c4", label: "Lançamento 01" }, { id: "reinaldo-king-02", youtubeId: "V9Ler_77JHE", label: "Lançamento 02" }, { id: "reinaldo-king-03", youtubeId: "7J5b0kE_c_w", label: "Lançamento 03" }] },
  { slug: "kametee", name: "Kametee", frase: "Calma antes do caos.", zona: "Maputo · Maxaquene", faixas: ["ph4nt0mmm_intr0"], bio: "Começa sussurrado, acaba a rasgar. Imprevisível.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "0MtXCW1LGdsVwyYpLsslZy", youtube: [{ id: "kametee-01", youtubeId: "N-AQkMGjpNI", label: "Lançamento 01" }, { id: "kametee-02", youtubeId: "eWogXs9IUDY", label: "Lançamento 02" }, { id: "kametee-03", youtubeId: "BbzZETffYPA", label: "Lançamento 03" }] },
  { slug: "herkey-hk", name: "Herkey HK", frase: "HK no beat, HK na rua.", zona: "Maputo · Laulane", faixas: ["PHANTOM MODE"], bio: "Herkey HK é um artista de Maputo ligado ao trap e à cultura urbana. No Sindicato, integra a sessão PHANTOM MODE e o arquivo do Studio XOYENS.", role: "MELÓDICO / TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "2g183yVpFQpPrLtBhOy8zF", youtube: [{ id: "herkey-hk-01", youtubeId: "7J5b0kE_c_w", label: "Lançamento 01" }, { id: "herkey-hk-02", youtubeId: "_T5Bv7BKTPQ", label: "Lançamento 02" }, { id: "herkey-hk-03", youtubeId: "6JUypUpQ7l4", label: "Lançamento 03" }] },
  { slug: "skyler", name: "Skyler", frase: "Céu é o limite? Nem.", zona: "Maputo · Zimpeto", faixas: ["FASHIION D'PHANTOM"], bio: "Voz aérea por cima de 808 pesado. Contraste puro.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "3BsJWmIWPWDtnNf2ppYa8c", youtube: [{ id: "skyler-01", youtubeId: "CLXEDmeQ7IU", label: "Lançamento 01" }, { id: "skyler-02", youtubeId: "xit5C-wY-GE", label: "Lançamento 02" }, { id: "skyler-03", youtubeId: "KJKkbNXcqfE", label: "Lançamento 03" }] },
  { slug: "3go", name: "3go", frase: "Três letras, mil barras.", zona: "Matola · Khongolote", faixas: ["A NOVA WAVE"], bio: "O mais novo da escalação. Chegou a provar — e provou.", role: "TRAP", studio: "STUDIO XOYENS", edition: "01", presence: "ACTIVA", spotifyArtistId: "7a0U3cgTT4uStYXnZJFXgs", youtube: [{ id: "3go-01", youtubeId: "N-AQkMGjpNI", label: "Lançamento 01" }, { id: "3go-02", youtubeId: "8e7uROy4UOs", label: "Lançamento 02" }, { id: "3go-03", youtubeId: "QEQnzob8wLk", label: "Lançamento 03" }] },
];

const PHOTOS = [a01, a02, a03, a04, a05, a06, a07, a08, a09, a10, a11, a12, a13, a14, a15, a16, a17];

export const ARTIST_PROFILES: ArtistProfile[] = PROFILES.map((profile, index) => ({
  ...profile,
  img: PHOTOS[index]!.url,
}));
