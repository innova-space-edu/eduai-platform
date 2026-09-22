import type { Metadata } from "next";
import ShareOpenClient from "./ShareOpenClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://eduaiplatformclon.vercel.app";

type SearchValue = string | string[] | undefined;
type SearchParams = Record<string, SearchValue>;

function first(value: SearchValue) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function clean(value: string, max = 140) {
  return value.replace(/[<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeVideoId(value: string) {
  const id = value.trim();
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const catalog = first(params.catalog) === "1";
  const title = clean(first(params.title), 120);
  const artist = clean(first(params.artist), 100);
  const videoId = safeVideoId(first(params.videoId));

  const pageTitle = catalog
    ? "Catálogo EDUAI Music"
    : title
      ? `${title} · EDUAI Music`
      : "EDUAI Music";

  const description = catalog
    ? "Explora el catálogo de EDUAI Music."
    : title
      ? `Escuchando "${title}"${artist ? ` — ${artist}` : ""} en EDUAI Music.`
      : "Escucha y comparte música desde EDUAI Music.";

  const card = new URL("/api/music/share-card", SITE_URL);
  if (catalog) card.searchParams.set("catalog", "1");
  if (title) card.searchParams.set("title", title);
  if (artist) card.searchParams.set("artist", artist);
  if (videoId) card.searchParams.set("videoId", videoId);

  const canonical = new URL("/music/share", SITE_URL);
  if (catalog) canonical.searchParams.set("catalog", "1");
  if (title) canonical.searchParams.set("title", title);
  if (artist) canonical.searchParams.set("artist", artist);
  if (videoId) canonical.searchParams.set("videoId", videoId);

  return {
    title: pageTitle,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical.toString(),
      siteName: "EDUAI Music",
      type: "website",
      images: [
        {
          url: card.toString(),
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [card.toString()],
    },
  };
}

export default async function MusicSharePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const catalog = first(params.catalog) === "1";
  const title = clean(first(params.title), 120);
  const artist = clean(first(params.artist), 100);
  const videoId = safeVideoId(first(params.videoId));
  const artwork = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#02050c] px-5 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-cyan-300/20 bg-[#06101d] p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-300">EDUAI Music</p>
        <div className="mt-5 flex items-center gap-4">
          {artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork} alt="" className="h-24 w-24 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#25f4ff,#9b6cff,#ff42cf)] text-3xl font-black text-slate-950">
              E
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black">{catalog ? "Catálogo EDUAI Music" : title || "EDUAI Music"}</h1>
            <p className="mt-1 truncate text-sm text-cyan-300">{catalog ? "Música para explorar" : artist}</p>
            <p className="mt-2 text-xs text-slate-400">Abriendo EDUAI Music…</p>
          </div>
        </div>
        <a
          href="/music"
          className="mt-6 inline-flex rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950"
        >
          Abrir EDUAI Music
        </a>
      </section>
      <ShareOpenClient />
    </main>
  );
}
