import g1 from "@/assets/gallery/g1.jpg";
import g2 from "@/assets/gallery/g2.jpg";
import g3 from "@/assets/gallery/g3.jpg";
import g4 from "@/assets/gallery/g4.jpg";
import v1 from "@/assets/gallery/v1.mp4.asset.json";

export type RevelationMediaType = "image" | "video";

export type RevelationMedia = {
  id: string;
  type: RevelationMediaType;
  src: string;
  alt: string;
  layoutVariant: "hero" | "tall" | "wide" | "standard" | "compact";
  downloadable: boolean;
  downloadName: string;
};

export const REVELACAO_MEDIA: RevelationMedia[] = [
  {
    id: "revelacao-001",
    type: "video",
    src: v1.url,
    alt: "Registo em vídeo do camping no Studio XOYENS",
    layoutVariant: "hero",
    downloadable: true,
    downloadName: "sindicato-revelacao-001.mp4",
  },
  {
    id: "revelacao-002",
    type: "image",
    src: g1,
    alt: "Registo fotográfico do camping no Studio XOYENS",
    layoutVariant: "tall",
    downloadable: true,
    downloadName: "sindicato-revelacao-002.jpg",
  },
  {
    id: "revelacao-003",
    type: "image",
    src: g2,
    alt: "Imagem dos bastidores do camping",
    layoutVariant: "standard",
    downloadable: true,
    downloadName: "sindicato-revelacao-003.jpg",
  },
  {
    id: "revelacao-004",
    type: "image",
    src: g3,
    alt: "Registo dos bastidores do camping",
    layoutVariant: "wide",
    downloadable: true,
    downloadName: "sindicato-revelacao-004.jpg",
  },
  {
    id: "revelacao-005",
    type: "image",
    src: g4,
    alt: "Registo visual do camping",
    layoutVariant: "tall",
    downloadable: true,
    downloadName: "sindicato-revelacao-005.jpg",
  },
];

export const REVELACAO_DOWNLOADS = Object.fromEntries(
  REVELACAO_MEDIA
    .filter((item) => item.downloadable)
    .map((item) => [
      item.id,
      {
        src: item.src,
        downloadName: item.downloadName,
      },
    ]),
) as Record<string, { src: string; downloadName: string }>;
