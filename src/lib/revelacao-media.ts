import g1 from "@/assets/gallery/g1.jpg";
import g2 from "@/assets/gallery/g2.jpg";
import g3 from "@/assets/gallery/g3.jpg";
import g4 from "@/assets/gallery/g4.jpg";
import v1 from "@/assets/gallery/v1.mp4.asset.json";

export type RevelationMediaType = "image" | "video";
export type RevelationMediaRatio = "4:3" | "3:4";

export type RevelationMedia = {
  id: string;
  type: RevelationMediaType;
  src: string | null;
  poster?: string;
  alt: string;
  caption?: string;
  tag?: string;
  roll?: string;
  day?: number;
  timecode?: string;
  ratio: RevelationMediaRatio;
  downloadable: boolean;
  downloadName?: string;
};

const ROLLS = ["CABINE", "ESTAMPA", "BEAT", "VISUALIZER", "LIVES"] as const;

const EMPTY_PHOTO_SLOTS: RevelationMedia[] = Array.from({ length: 17 }, (_, index) => {
  const roll = ROLLS[index % ROLLS.length];
  return {
    id: "revelacao-photo-slot-" + String(index + 1).padStart(2, "0"),
    type: "image",
    src: null,
    alt: "Slot reservado para fotografia da Sala de Revelação",
    caption: "SLOT RESERVADO · A AGUARDAR REVELAÇÃO",
    tag: roll,
    roll,
    day: Math.floor(index / 5) + 1,
    timecode: "00:00",
    ratio: index % 2 === 0 ? "4:3" : "3:4",
    downloadable: false,
  };
});

export const REVELACAO_MEDIA: RevelationMedia[] = [
  {
    id: "revelacao-001",
    type: "video",
    src: v1.url,
    alt: "Registo em vídeo do camping no Studio XOYENS",
    caption: "REGISTO EM BRUTO · SESSÃO",
    tag: "LIVES",
    roll: "LIVES",
    day: 1,
    timecode: "00:41",
    ratio: "4:3",
    downloadable: true,
    downloadName: "sindicato-revelacao-001.mp4",
  },
  {
    id: "revelacao-002",
    type: "image",
    src: g1,
    alt: "Registo fotográfico do camping no Studio XOYENS",
    caption: "CABINE · PRIMEIRO TAKE",
    tag: "CABINE",
    roll: "CABINE",
    day: 1,
    timecode: "00:18",
    ratio: "4:3",
    downloadable: true,
    downloadName: "sindicato-revelacao-002.jpg",
  },
  {
    id: "revelacao-003",
    type: "image",
    src: g2,
    alt: "Imagem dos bastidores do camping",
    caption: "ESTAMPA · TINTA FRESCA",
    tag: "ESTAMPA",
    roll: "ESTAMPA",
    day: 2,
    timecode: "03:12",
    ratio: "3:4",
    downloadable: true,
    downloadName: "sindicato-revelacao-003.jpg",
  },
  {
    id: "revelacao-004",
    type: "image",
    src: g3,
    alt: "Registo dos bastidores do camping",
    caption: "BEAT · BLOCO B",
    tag: "BEAT",
    roll: "BEAT",
    day: 3,
    timecode: "01:27",
    ratio: "4:3",
    downloadable: true,
    downloadName: "sindicato-revelacao-004.jpg",
  },
  {
    id: "revelacao-005",
    type: "image",
    src: g4,
    alt: "Registo visual do camping",
    caption: "VISUALIZER · TAKE FINAL",
    tag: "VISUALIZER",
    roll: "VISUALIZER",
    day: 4,
    timecode: "02:04",
    ratio: "3:4",
    downloadable: true,
    downloadName: "sindicato-revelacao-005.jpg",
  },
  ...EMPTY_PHOTO_SLOTS,
];

export const REVELACAO_READY_MEDIA = REVELACAO_MEDIA.filter(
  (item): item is RevelationMedia & { src: string } => item.src !== null,
);

export const REVELACAO_DOWNLOADS = Object.fromEntries(
  REVELACAO_READY_MEDIA
    .filter((item) => item.downloadable && item.downloadName)
    .map((item) => [
      item.id,
      {
        src: item.src,
        downloadName: item.downloadName!,
      },
    ]),
) as Record<string, { src: string; downloadName: string }>;
