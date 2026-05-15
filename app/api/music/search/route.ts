import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

type NormalizedTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  mood: string;
  duration: string;
  src: string;
  cover: string;
  artworkUrl?: string;
  externalUrl?: string;
  source: "itunes" | "jamendo" | "audius";
  tags: string[];
};

type ItunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  trackViewUrl?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
};

type JamendoResult = {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
  audio?: string;
  image?: string;
  shareurl?: string;
  musicinfo?: {
    tags?: { genres?: string[]; instruments?: string[]; vartags?: string[] };
  };
};

type AudiusResult = {
  id?: string;
  title?: string;
  duration?: number;
  permalink?: string;
  artwork?: { "150x150"?: string; "480x480"?: string; "1000x1000"?: string };
  user?: { name?: string; handle?: string };
  genre?: string;
  mood?: string;
};

function formatDuration(value?: number, unit: "ms" | "s" = "s") {
  if (!value || !Number.isFinite(value)) return "0:30";
  const total = Math.max(1, Math.round(unit === "ms" ? value / 1000 : value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function moodFromText(text: string) {
  const s = text.toLowerCase();
  if (/(calm|relax|sleep|piano|meditation|ambient|soft|chill|peace)/.test(s))
    return "calm";
  if (
    /(classical|orchestra|study|math|science|stem|bach|mozart|beethoven|instrumental)/.test(
      s,
    )
  )
    return "classical";
  if (/(lofi|focus|concentration|study|work|productivity)/.test(s))
    return "focus";
  if (/(read|reading|acoustic|book|literature)/.test(s)) return "reading";
  if (/(energy|pop|dance|workout|electro|edm|house)/.test(s)) return "energy";
  if (/(design|creative|project|art)/.test(s)) return "creative";
  return "focus";
}

function safeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

async function searchItunes(query: string): Promise<NormalizedTrack[]> {
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "30",
    country: "CL",
    lang: "es_es",
  });

  const res = await fetch(
    `https://itunes.apple.com/search?${params.toString()}`,
    {
      headers: { "User-Agent": "EduAI-Music/1.2" },
      next: { revalidate: 1800 },
    },
  );
  if (!res.ok) throw new Error(`iTunes Search API ${res.status}`);
  const data = await res.json();

  return ((data.results || []) as ItunesResult[])
    .filter((item) => item.previewUrl && item.trackName && item.artistName)
    .map((item) => {
      const title = item.trackName || "Canción";
      const artist = item.artistName || "Artista";
      const album = item.collectionName || "Resultado online";
      const artwork = item.artworkUrl600 || item.artworkUrl100;
      return {
        id: `itunes-${item.trackId || safeId(`${artist}-${title}`)}`,
        title,
        artist,
        album,
        mood: moodFromText(
          `${title} ${artist} ${album} ${item.primaryGenreName || ""}`,
        ),
        duration: formatDuration(item.trackTimeMillis, "ms"),
        src: item.previewUrl!.replace(/^http:/, "https:"),
        cover: artwork || "linear-gradient(135deg,#38bdf8,#2563eb)",
        artworkUrl: artwork,
        externalUrl: item.trackViewUrl,
        source: "itunes" as const,
        tags: ["online", "preview", item.primaryGenreName || "música"].filter(
          Boolean,
        ),
      };
    });
}

async function searchJamendo(query: string): Promise<NormalizedTrack[]> {
  const clientId =
    process.env.JAMENDO_CLIENT_ID || process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
  if (!clientId) return [];

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: "25",
    namesearch: query,
    include: "musicinfo",
    audioformat: "mp32",
    imagesize: "300",
    order: "popularity_total",
  });

  const res = await fetch(
    `https://api.jamendo.com/v3.0/tracks/?${params.toString()}`,
    {
      headers: { "User-Agent": "EduAI-Music/1.2" },
      next: { revalidate: 1800 },
    },
  );
  if (!res.ok) throw new Error(`Jamendo API ${res.status}`);
  const data = await res.json();

  return ((data.results || []) as JamendoResult[])
    .filter((item) => item.audio && item.name && item.artist_name)
    .map((item) => {
      const tags = [
        "jamendo",
        ...(item.musicinfo?.tags?.genres || []),
        ...(item.musicinfo?.tags?.instruments || []),
        ...(item.musicinfo?.tags?.vartags || []),
      ].slice(0, 5);
      return {
        id: `jamendo-${item.id || safeId(`${item.artist_name}-${item.name}`)}`,
        title: item.name || "Canción",
        artist: item.artist_name || "Artista independiente",
        album: item.album_name || "Jamendo",
        mood: moodFromText(
          `${item.name} ${item.artist_name} ${tags.join(" ")}`,
        ),
        duration: formatDuration(item.duration, "s"),
        src: item.audio!.replace(/^http:/, "https:"),
        cover: item.image || "linear-gradient(135deg,#6ee7b7,#10b981)",
        artworkUrl: item.image,
        externalUrl: item.shareurl,
        source: "jamendo" as const,
        tags,
      };
    });
}

async function searchAudius(query: string): Promise<NormalizedTrack[]> {
  const host = (
    process.env.AUDIUS_API_HOST || "https://discoveryprovider.audius.co"
  ).replace(/\/$/, "");
  const params = new URLSearchParams({ query, app_name: "EduAI Music" });

  const res = await fetch(`${host}/v1/tracks/search?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Music/1.2" },
    next: { revalidate: 1200 },
  });
  if (!res.ok) return [];
  const data = await res.json();

  return ((data.data || []) as AudiusResult[])
    .filter((item) => item.id && item.title)
    .slice(0, 20)
    .map((item) => {
      const artwork =
        item.artwork?.["480x480"] ||
        item.artwork?.["150x150"] ||
        item.artwork?.["1000x1000"];
      return {
        id: `audius-${item.id}`,
        title: item.title || "Canción",
        artist: item.user?.name || item.user?.handle || "Audius Artist",
        album: item.genre || "Audius",
        mood: moodFromText(
          `${item.title} ${item.genre || ""} ${item.mood || ""}`,
        ),
        duration: formatDuration(item.duration, "s"),
        src: `${host}/v1/tracks/${item.id}/stream?app_name=${encodeURIComponent("EduAI Music")}`,
        cover: artwork || "linear-gradient(135deg,#c4b5fd,#7c3aed)",
        artworkUrl: artwork,
        externalUrl: item.permalink
          ? `https://audius.co${item.permalink.startsWith("/") ? item.permalink : `/${item.permalink}`}`
          : undefined,
        source: "audius" as const,
        tags: ["audius", item.genre, item.mood].filter(Boolean) as string[],
      };
    });
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const query = String(
    body.query ||
      url.searchParams.get("q") ||
      url.searchParams.get("query") ||
      "",
  ).trim();
  const provider = String(
    body.provider || url.searchParams.get("provider") || "all",
  );

  if (!query) {
    return NextResponse.json(
      { ok: false, error: "query requerida" },
      { status: 400 },
    );
  }

  const tasks: Array<Promise<NormalizedTrack[]>> = [];
  if (provider === "all" || provider === "itunes")
    tasks.push(searchItunes(query).catch(() => []));
  if (provider === "all" || provider === "jamendo")
    tasks.push(searchJamendo(query).catch(() => []));
  if (provider === "all" || provider === "audius")
    tasks.push(searchAudius(query).catch(() => []));

  const results = await Promise.all(tasks);
  const map = new Map<string, NormalizedTrack>();
  results.flat().forEach((track) => map.set(track.id, track));
  const tracks = Array.from(map.values()).slice(0, 60);

  return NextResponse.json({
    ok: true,
    provider,
    sources: {
      itunes: true,
      jamendo: Boolean(
        process.env.JAMENDO_CLIENT_ID ||
        process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID,
      ),
      audius: true,
    },
    tracks,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
