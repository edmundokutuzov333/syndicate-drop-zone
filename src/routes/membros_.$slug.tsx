import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArtistDossier } from "@/components/artists/ArtistDossier";
import { getArtistBySlug } from "@/lib/artist-content";
import { getLiveArtistBySlug, getLiveArtistChannels } from "@/lib/public-content";

export const Route = createFileRoute("/membros_/$slug")({
  head: ({ params }) => {
    const artist = getArtistBySlug(params.slug);
    return {
      meta: [
        {
          title: artist
            ? artist.name + " · Arquivo de Convocados — O Sindicato do Trap"
            : "Artista não encontrado — O Sindicato do Trap",
        },
        {
          name: "description",
          content: artist
            ? "Arquivo oficial de " + artist.name + " dentro do Sindicato do Trap."
            : "O convocado solicitado não existe no arquivo.",
        },
        ...(artist
          ? [
              { property: "og:title", content: artist.name + " · O Sindicato do Trap" },
              { property: "og:description", content: "Arquivo de convocados · " + artist.slug.toUpperCase() },
              { property: "og:image", content: artist.img },
              { property: "og:type", content: "profile" },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: async ({ params }) => {
    const fallback = getArtistBySlug(params.slug);
    if (!fallback) throw notFound();
    const [artist, channels] = await Promise.all([
      getLiveArtistBySlug(params.slug),
      getLiveArtistChannels(params.slug),
    ]);
    if (!artist) throw notFound();
    return { artist, channels };
  },
  component: ArtistProfile,
});

function ArtistProfile() {
  const data = Route.useLoaderData();
  if (!data) return null;
  return <ArtistDossier artist={data.artist} channels={data.channels} />;
}
