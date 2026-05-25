import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 25;

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
  source: "itunes" | "jamendo" | "audius" | "youtube";
  tags: string[];
  youtubeVideoId?: string;
  videoEmbedUrl?: string;
  videoThumbnail?: string;
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
  album_image?: string;
  shareurl?: string;
  shorturl?: string;
  audiodownload_allowed?: boolean;
  musicinfo?: {
    tags?: { genres?: string[]; instruments?: string[]; vartags?: string[] };
  };
  licenses?: Array<{ name?: string; url?: string }>;
};



type YouTubeSearchResult = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    description?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
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

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

function clampLimit(raw: string | number | null | undefined) {
  const value = Number(raw || DEFAULT_LIMIT);
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(value)));
}

function formatDuration(value?: number, unit: "ms" | "s" = "s") {
  if (!value || !Number.isFinite(value)) return "0:30";
  const total = Math.max(1, Math.round(unit === "ms" ? value / 1000 : value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function moodFromText(text: string) {
  const s = text.toLowerCase();
  if (/(calm|relax|sleep|piano|meditation|ambient|soft|chill|peace|tranquil|relajaci[oó]n|calma)/.test(s))
    return "calm";
  if (
    /(classical|orchestra|study|math|science|stem|bach|mozart|beethoven|instrumental|cl[aá]sica)/.test(
      s,
    )
  )
    return "classical";
  if (/(lofi|focus|concentration|study|work|productivity|concentraci[oó]n|estudio)/.test(s))
    return "focus";
  if (/(read|reading|acoustic|book|literature|lectura)/.test(s)) return "reading";
  if (/(energy|pop|dance|workout|electro|edm|house|energ[ií]a)/.test(s)) return "energy";
  if (/(design|creative|project|art|dise[nñ]o|creativ)/.test(s)) return "creative";
  return "focus";
}

function safeId(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function isStudyInstrumentalQuery(query: string) {
  return /(instrumental|sin letra|lofi|focus|study|estudio|concentraci[oó]n|calm|relax|relajaci[oó]n|piano|ambient|meditation|meditaci[oó]n)/i.test(
    query,
  );
}

function tagHints(query: string) {
  const s = query.toLowerCase();
  const hints: string[] = [];
  if (/(lofi|focus|study|estudio|concentraci[oó]n)/.test(s)) hints.push("chillout", "instrumental");
  if (/(relax|calm|relajaci[oó]n|calma|sleep|meditation|meditaci[oó]n)/.test(s)) hints.push("relaxation", "ambient");
  if (/(classical|cl[aá]sica|piano|orchestra|bach|mozart|beethoven)/.test(s)) hints.push("classical", "piano");
  if (/(electro|edm|house|dance|energy|energ[ií]a)/.test(s)) hints.push("electronic");
  if (/(jazz|blues|soul)/.test(s)) hints.push("jazz");
  if (/(rock|guitar|guitarra)/.test(s)) hints.push("rock", "guitar");
  return Array.from(new Set(hints)).slice(0, 4);
}

async function searchItunes(query: string, limit: number): Promise<NormalizedTrack[]> {
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: String(Math.min(limit, 30)),
    country: "CL",
    lang: "es_es",
  });

  const res = await fetch(
    `https://itunes.apple.com/search?${params.toString()}`,
    {
      headers: { "User-Agent": "EduAI-Music/1.5" },
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
      const artwork = (item.artworkUrl600 || item.artworkUrl100 || "").replace("100x100bb", "600x600bb");
      return {
        id: `itunes-${item.trackId || safeId(`${artist}-${title}`)}`,
        title,
        artist,
        album,
        mood: moodFromText(
          `${title} ${artist} ${album} ${item.primaryGenreName || ""}`,
        ),
        duration: "0:30",
        src: item.previewUrl!.replace(/^http:/, "https:"),
        cover: artwork || "linear-gradient(135deg,#38bdf8,#2563eb)",
        artworkUrl: artwork,
        externalUrl: item.trackViewUrl,
        source: "itunes" as const,
        tags: ["itunes", "preview", "dj-30s", item.primaryGenreName || "música"].filter(
          Boolean,
        ),
      };
    });
}

async function jamendoRequest(
  query: string,
  limit: number,
  mode: "search" | "tags",
): Promise<NormalizedTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];

  const params = new URLSearchParams({
    client_id: clientId,
    format: "json",
    limit: String(Math.min(limit, 50)),
    include: "musicinfo licenses",
    audioformat: "mp32",
    imagesize: "600",
    type: "single albumtrack",
    groupby: "artist_id",
    boost: "popularity_month",
  });

  if (mode === "tags") {
    const hints = tagHints(query);
    if (!hints.length) return [];
    params.set("fuzzytags", hints.join("+"));
    if (isStudyInstrumentalQuery(query)) params.set("vocalinstrumental", "instrumental");
  } else {
    params.set("search", query);
    // Search relevance is Jamendo's default order. Avoid order=popularity here because it can destroy relevance.
  }

  const res = await fetch(
    `https://api.jamendo.com/v3.0/tracks/?${params.toString()}`,
    {
      headers: { "User-Agent": "EduAI-Music/1.5" },
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
        ...(item.licenses?.map((license) => license.name || "").filter(Boolean) || []),
      ].slice(0, 7);
      const image = item.image || item.album_image;
      return {
        id: `jamendo-${item.id || safeId(`${item.artist_name}-${item.name}`)}`,
        title: item.name || "Canción",
        artist: item.artist_name || "Artista independiente",
        album: item.album_name || "Jamendo",
        mood: moodFromText(
          `${item.name} ${item.artist_name} ${item.album_name || ""} ${tags.join(" ")}`,
        ),
        duration: formatDuration(item.duration, "s"),
        src: item.audio!.replace(/^http:/, "https:"),
        cover: image || "linear-gradient(135deg,#6ee7b7,#10b981)",
        artworkUrl: image,
        externalUrl: item.shareurl || item.shorturl,
        source: "jamendo" as const,
        tags,
      };
    });
}

async function searchJamendo(query: string, limit: number): Promise<NormalizedTrack[]> {
  const primary = await jamendoRequest(query, limit, "search");
  if (primary.length >= Math.min(8, limit)) return primary;
  const fallback = await jamendoRequest(query, limit, "tags");
  const map = new Map<string, NormalizedTrack>();
  [...primary, ...fallback].forEach((track) => map.set(track.id, track));
  return Array.from(map.values());
}

async function searchAudius(query: string, limit: number): Promise<NormalizedTrack[]> {
  const host = (
    process.env.AUDIUS_API_HOST || "https://discoveryprovider.audius.co"
  ).replace(/\/$/, "");
  const params = new URLSearchParams({ query, app_name: "EduAI Music" });

  const res = await fetch(`${host}/v1/tracks/search?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Music/1.5" },
    next: { revalidate: 1200 },
  });
  if (!res.ok) return [];
  const data = await res.json();

  return ((data.data || []) as AudiusResult[])
    .filter((item) => item.id && item.title)
    .slice(0, Math.min(limit, 25))
    .map((item) => {
      const artwork =
        item.artwork?.["1000x1000"] ||
        item.artwork?.["480x480"] ||
        item.artwork?.["150x150"];
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

async function searchYouTube(query: string, limit: number): Promise<NormalizedTrack[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    part: "snippet",
    q: `${query} official audio official video`,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    maxResults: String(Math.min(limit, 10)),
    key,
    safeSearch: "moderate",
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Music/1.6" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`YouTube Data API ${res.status}`);
  const data = await res.json();

  return ((data.items || []) as YouTubeSearchResult[])
    .filter((item) => item.id?.videoId && item.snippet?.title)
    .map((item) => {
      const videoId = item.id!.videoId!;
      const title = item.snippet?.title || "Video musical";
      const artist = item.snippet?.channelTitle || "YouTube";
      const thumbnail =
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url;
      return {
        id: `youtube-${videoId}`,
        title,
        artist,
        album: "YouTube video",
        mood: moodFromText(`${title} ${artist} ${item.snippet?.description || ""}`),
        duration: "Video",
        src: "",
        cover: thumbnail || "linear-gradient(135deg,#ef4444,#111827)",
        artworkUrl: thumbnail,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        source: "youtube" as const,
        tags: ["youtube", "video", "fallback"],
        youtubeVideoId: videoId,
        videoEmbedUrl: `https://www.youtube.com/embed/${videoId}`,
        videoThumbnail: thumbnail,
      };
    });
}


function withDjVisuals(previews: NormalizedTrack[], videos: NormalizedTrack[]): NormalizedTrack[] {
  if (!previews.length || !videos.length) return previews;

  return previews.map((track, index) => {
    const video = videos[index % videos.length];
    if (!video?.youtubeVideoId) return track;
    return {
      ...track,
      album: `${track.album || "Preview"} · DJ Reel visual`,
      tags: Array.from(new Set([...(track.tags || []), "dj-reel", "video-visual", "youtube-visual"])),
      youtubeVideoId: video.youtubeVideoId,
      videoEmbedUrl: video.videoEmbedUrl,
      videoThumbnail: video.videoThumbnail || video.artworkUrl,
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
  ).toLowerCase();
  const normalizedProvider =
    provider === "full" || provider === "completas"
      ? "full"
      : provider === "preview" || provider === "dj" || provider === "itunes"
        ? "preview"
        : provider;
  const limit = clampLimit(body.limit || url.searchParams.get("limit"));

  if (!query) {
    return NextResponse.json(
      { ok: false, error: "query requerida" },
      { status: 400 },
    );
  }

  const fullTasks: Array<Promise<NormalizedTrack[]>> = [];
  const previewTasks: Array<Promise<NormalizedTrack[]>> = [];

  // Prefer legal playable full streams first. YouTube is a video fallback, not MP3 extraction.
  if (normalizedProvider === "all" || normalizedProvider === "full" || normalizedProvider === "jamendo") {
    fullTasks.push(searchJamendo(query, limit).catch(() => []));
  }
  if (normalizedProvider === "all" || normalizedProvider === "full" || normalizedProvider === "audius") {
    fullTasks.push(searchAudius(query, limit).catch(() => []));
  }
  if (normalizedProvider === "all" || normalizedProvider === "preview" || normalizedProvider === "itunes") {
    previewTasks.push(searchItunes(query, limit).catch(() => []));
  }

  let fullResults = (await Promise.all(fullTasks)).flat();
  let previewResults = (await Promise.all(previewTasks)).flat();
  let youtubeFallback: NormalizedTrack[] = [];
  let djVisuals: NormalizedTrack[] = [];

  const shouldUseYouTubeFallback =
    normalizedProvider === "youtube" ||
    normalizedProvider === "preview" ||
    normalizedProvider === "itunes" ||
    ((normalizedProvider === "full" || normalizedProvider === "all") && fullResults.length === 0);

  if (shouldUseYouTubeFallback) {
    youtubeFallback = await searchYouTube(query, Math.min(8, limit)).catch(() => []);
    if (normalizedProvider === "youtube") fullResults = [];
  }

  if ((normalizedProvider === "preview" || normalizedProvider === "itunes" || normalizedProvider === "all") && previewResults.length) {
    djVisuals = youtubeFallback;
    previewResults = withDjVisuals(previewResults, djVisuals);
    if (normalizedProvider === "preview" || normalizedProvider === "itunes") youtubeFallback = [];
  }

  const map = new Map<string, NormalizedTrack>();
  [...fullResults, ...youtubeFallback, ...previewResults].forEach((track) => map.set(track.id, track));
  const tracks = Array.from(map.values()).slice(0, limit);

  return NextResponse.json({
    ok: true,
    provider: normalizedProvider,
    requestedProvider: provider,
    query,
    limit,
    fallbackUsed: Boolean(youtubeFallback.length || djVisuals.length),
    fallbackReason: youtubeFallback.length
      ? "No se encontró audio completo en Jamendo/Audius para esa búsqueda; se muestran videos embebibles de YouTube."
      : djVisuals.length
        ? "Modo DJ: se agregaron videos visuales tipo reel a los previews de 30 segundos."
        : null,
    djVisuals: djVisuals.length,
    youtubeKeyMissing: !process.env.YOUTUBE_API_KEY && (normalizedProvider === "full" || normalizedProvider === "youtube" || normalizedProvider === "preview"),
    youtubeSearchUrl: !process.env.YOUTUBE_API_KEY && (normalizedProvider === "full" || normalizedProvider === "youtube" || normalizedProvider === "preview") ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : null,
    sources: {
      jamendo: Boolean(process.env.JAMENDO_CLIENT_ID),
      jamendoOAuth: Boolean(process.env.JAMENDO_CLIENT_SECRET),
      audius: true,
      itunes: true,
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
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
