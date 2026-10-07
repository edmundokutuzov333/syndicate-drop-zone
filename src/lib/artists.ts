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

export type Artist = {
  code: string;
  slug: string;
  name: string;
  img: string;
  bio: string;
  frase: string;
  zona: string;
  faixas: string[];
};

const NAMES = [
  "Khriys", "KongV12", "Bruno The Goat", "Masepurp", "Kingston Siriro", "Kaká Machava",
  "Twista", "Txopheer Wawa", "Cipher", "5ir0w", "Pita Shana", "Keew080",
  "Reinaldo King", "Kametee", "Herkey Hk", "Skyler", "3go",
];
// Fichas (provisórias, fictícias) — mesma ordem dos NAMES.
const FICHAS: { frase: string; zona: string; faixas: string[]; bio: string }[] = [
  { frase: "Rima fria, coração quente.", zona: "Maputo · Malhangalene", faixas: ["ph4nt0mmm_intr0"], bio: "Primeiro a chegar, último a sair. Escreve no telemóvel entre takes." },
  { frase: "Sem plano B.", zona: "Matola · Liberdade", faixas: ["PHANTOM MODE"], bio: "Flow de metralhadora e ad-libs que viram hino na sala." },
  { frase: "O cabrito não pede licença.", zona: "Maputo · Polana Caniço", faixas: ["A NOVA WAVE"], bio: "Abriu A Nova Wave numa só take. Voz grave, presença pesada." },
  { frase: "Roxo no copo, ouro na voz.", zona: "Maputo · Xipamanine", faixas: ["PHANTOM MODE"], bio: "Melodia arrastada, auto-tune no talo, vibe noturna." },
  { frase: "Estilo não se compra.", zona: "Maputo · Sommerschield", faixas: ["FASHIION D'PHANTOM"], bio: "Moda e trap no mesmo verso. Comandou a FASHIION D'PHANTOM." },
  { frase: "Fala pouco, fere muito.", zona: "Matola · Fomento", faixas: ["FASHIION D'PHANTOM"], bio: "Chegou com o refrão pronto. Saiu com a sala toda a cantar." },
  { frase: "Gira o mundo, volta pra rua.", zona: "Maputo · Hulene", faixas: ["A NOVA WAVE"], bio: "Double-time sem respirar. Escreve em cima do beat a correr." },
  { frase: "Wawa nunca dorme.", zona: "Maputo · Mafalala", faixas: ["PHANTOM MODE"], bio: "Energia de palco dentro da cabine. Grita os ad-libs sozinho." },
  { frase: "Código fechado.", zona: "Maputo · Alto Maé", faixas: ["ph4nt0mmm_intr0"], bio: "Letra cifrada, punchlines escondidas. Ouve duas vezes." },
  { frase: "Zero sinal, só som.", zona: "Matola · Machava", faixas: ["A NOVA WAVE"], bio: "Produz e rima. Mexeu nos 808 da sessão inteira." },
  { frase: "Rainha da sombra.", zona: "Maputo · Central", faixas: ["FASHIION D'PHANTOM"], bio: "Voz cortante, presença de capa. Entrou e mudou o clima." },
  { frase: "808 no sangue.", zona: "Maputo · Chamanculo", faixas: ["PHANTOM MODE"], bio: "Dono do bounce. Cada verso tem um gancho." },
  { frase: "Coroa de rua.", zona: "Matola · T3", faixas: ["A NOVA WAVE"], bio: "Rei das madrugadas no estúdio. Grava quando todos já foram." },
  { frase: "Calma antes do caos.", zona: "Maputo · Maxaquene", faixas: ["ph4nt0mmm_intr0"], bio: "Começa sussurrado, acaba a rasgar. Imprevisível." },
  { frase: "HK no beat, HK na rua.", zona: "Maputo · Laulane", faixas: ["PHANTOM MODE"], bio: "Melódico e sujo ao mesmo tempo. Fez o hook em 10 minutos." },
  { frase: "Céu é o limite? Nem.", zona: "Maputo · Zimpeto", faixas: ["FASHIION D'PHANTOM"], bio: "Voz aérea por cima de 808 pesado. Contraste puro." },
  { frase: "Três letras, mil barras.", zona: "Matola · Khongolote", faixas: ["A NOVA WAVE"], bio: "O mais novo da escalação. Chegou a provar — e provou." },
];
const PHOTOS = [a01, a02, a03, a04, a05, a06, a07, a08, a09, a10, a11, a12, a13, a14, a15, a16, a17].map((a) => a.url);

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const ARTISTS: Artist[] = PHOTOS.map((img, i) => ({
  code: `SDT-${String(i + 1).padStart(2, "0")}`,
  slug: slugify(NAMES[i]!),
  name: NAMES[i]!,
  ...FICHAS[i]!,
  img,
}));
