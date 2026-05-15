import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
};

function formatDuration(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return "0:30";
  const total = Math.max(1, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function moodFromText(text: string) {
  const s = text.toLowerCase();
  if (/(calm|relax|sleep|piano|meditation|ambient)/.test(s)) return "calm";
  if (/(classical|orchestra|study|math|science|stem)/.test(s)) return "classical";
  if (/(lofi|focus|concentration|study)/.test(s)) return "focus";
  if (/(read|reading|acoustic)/.test(s)) return "reading";
  if (/(energy|pop|dance|workout)/.test(s)) return "energy";
  return "focus";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "").trim();

  if (!query) {
    return NextResponse.json({ ok: false, error: "query requerida" }, { status: 400 });
  }

  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "18",
    country: "CL",
    lang: "es_es",
  });

  try {
    const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      headers: { "User-Agent": "EduAI-Music/1.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`iTunes Search API ${res.status}`);
    const data = await res.json();
    const tracks = ((data.results || []) as ItunesResult[])
      .filter((item) => item.previewUrl && item.trackName && item.artistName)
      .map((item) => {
        const title = item.trackName || "Canción";
        const artist = item.artistName || "Artista";
        const album = item.collectionName || "Resultado online";
        return {
          id: `itunes-${item.trackId || `${artist}-${title}`.replace(/\W+/g, "-").toLowerCase()}`,
          title,
          artist,
          album,
          mood: moodFromText(`${title} ${artist} ${album} ${item.primaryGenreName || ""}`),
          duration: formatDuration(item.trackTimeMillis),
          src: item.previewUrl!.replace(/^http:/, "https:"),
          cover: item.artworkUrl100 || "linear-gradient(135deg,#e0f2fe,#bfdbfe)",
          artworkUrl: item.artworkUrl100,
          externalUrl: item.trackViewUrl,
          source: "itunes",
          tags: ["online", item.primaryGenreName || "música"].filter(Boolean),
        };
      });

    return NextResponse.json({ ok: true, provider: "itunes", tracks });
  } catch (error) {
    return NextResponse.json(
      { ok: false, provider: "itunes", error: error instanceof Error ? error.message : "Error buscando música" },
      { status: 500 },
    );
  }
}
