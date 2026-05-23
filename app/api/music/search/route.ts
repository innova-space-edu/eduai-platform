import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 25;

type DjReelVisual = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: string;
  embedUrl: string;
  externalUrl: string;
  durationSeconds?: number;
  score: number;
  matchReason: string;
};

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
  youtubePlaylistId?: string;
  videoEmbedUrl?: string;
  videoThumbnail?: string;
  djReels?: DjReelVisual[];
  djReelMatchScore?: number;
  djReelMatchReason?: string;
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

type YouTubeVideoDetails = {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    description?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
      standard?: { url?: string };
      maxres?: { url?: string };
    };
  };
  contentDetails?: {
    duration?: string;
    regionRestriction?: {
      allowed?: string[];
      blocked?: string[];
    };
  };
  status?: {
    embeddable?: boolean;
    privacyStatus?: string;
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


function parseYouTubeInput(raw: string) {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const isYouTube = host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtu.be";
    if (!isYouTube) return null;

    const videoId =
      host === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") ||
          (url.pathname.startsWith("/embed/") ? url.pathname.split("/").filter(Boolean)[1] : "") ||
          (url.pathname.startsWith("/shorts/") ? url.pathname.split("/").filter(Boolean)[1] : "");
    const playlistId = url.searchParams.get("list") || undefined;
    if (!videoId && !playlistId) return null;
    return { videoId: videoId || undefined, playlistId };
  } catch {
    return null;
  }
}

function youtubeWatchUrl(videoId?: string, playlistId?: string) {
  const params = new URLSearchParams();
  if (videoId) params.set("v", videoId);
  if (playlistId) params.set("list", playlistId);
  if (playlistId?.startsWith("RD")) params.set("start_radio", "1");
  return `https://www.youtube.com/watch?${params.toString()}`;
}

function youtubeEmbedUrl(videoId?: string, playlistId?: string) {
  if (!videoId && playlistId) {
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`;
  }
  if (!videoId) return "";
  const params = new URLSearchParams({
    controls: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (playlistId) params.set("list", playlistId);
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function youtubeThumbUrl(videoId?: string) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;
}

function youtubeTrackFromDetails(video: YouTubeVideoDetails, playlistId?: string): NormalizedTrack | null {
  const videoId = video.id;
  if (!videoId) return null;
  const title = video.snippet?.title || "Video musical de YouTube";
  const artist = video.snippet?.channelTitle || "YouTube";
  const thumbnail = youtubeThumbnail(video) || youtubeThumbUrl(videoId);
  const durationSeconds = parseIsoDurationSeconds(video.contentDetails?.duration);
  return {
    id: `youtube-${videoId}${playlistId ? `-${safeId(playlistId)}` : ""}`,
    title,
    artist,
    album: playlistId?.startsWith("RD") ? "YouTube radio / mix" : playlistId ? "YouTube playlist" : "YouTube video",
    mood: moodFromText(`${title} ${artist} ${video.snippet?.description || ""}`),
    duration: durationSeconds ? formatDuration(durationSeconds, "s") : "Video",
    src: "",
    cover: thumbnail || "linear-gradient(135deg,#ef4444,#111827)",
    artworkUrl: thumbnail,
    externalUrl: youtubeWatchUrl(videoId, playlistId),
    source: "youtube" as const,
    tags: ["youtube", playlistId ? "playlist" : "video", playlistId?.startsWith("RD") ? "radio-mix" : "embed"].filter(Boolean) as string[],
    youtubeVideoId: videoId,
    youtubePlaylistId: playlistId,
    videoEmbedUrl: youtubeEmbedUrl(videoId, playlistId),
    videoThumbnail: thumbnail,
  };
}

async function youtubeDirectFromInput(query: string, key?: string): Promise<NormalizedTrack[]> {
  const parsed = parseYouTubeInput(query);
  if (!parsed?.videoId && !parsed?.playlistId) return [];

  if (key && parsed.videoId) {
    const details = await fetchYoutubeVideoDetails([parsed.videoId], key).catch(() => []);
    const track = details[0] ? youtubeTrackFromDetails(details[0], parsed.playlistId) : null;
    if (track) return [track];
  }

  const videoId = parsed.videoId;
  const thumbnail = youtubeThumbUrl(videoId);
  return [
    {
      id: `youtube-${videoId || safeId(parsed.playlistId || "playlist")}${parsed.playlistId ? `-${safeId(parsed.playlistId)}` : ""}`,
      title: parsed.playlistId?.startsWith("RD") ? "YouTube Radio / Mix" : "Video o playlist de YouTube",
      artist: "YouTube",
      album: parsed.playlistId?.startsWith("RD") ? "Radio automática de YouTube" : "YouTube",
      mood: "energy",
      duration: "Video",
      src: "",
      cover: thumbnail || "linear-gradient(135deg,#ef4444,#111827)",
      artworkUrl: thumbnail,
      externalUrl: youtubeWatchUrl(videoId, parsed.playlistId),
      source: "youtube" as const,
      tags: ["youtube", "link", parsed.playlistId ? "playlist" : "video"],
      youtubeVideoId: videoId,
      youtubePlaylistId: parsed.playlistId,
      videoEmbedUrl: youtubeEmbedUrl(videoId, parsed.playlistId),
      videoThumbnail: thumbnail,
    },
  ];
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
        duration: formatDuration(item.trackTimeMillis, "ms"),
        src: item.previewUrl!.replace(/^http:/, "https:"),
        cover: artwork || "linear-gradient(135deg,#38bdf8,#2563eb)",
        artworkUrl: artwork,
        externalUrl: item.trackViewUrl,
        source: "itunes" as const,
        tags: ["itunes", "preview", item.primaryGenreName || "música"].filter(
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

const DJ_REEL_REGION = "CL";
const DJ_REEL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const djReelCache = new Map<string, { expiresAt: number; reels: DjReelVisual[] }>();

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/\b(feat|ft|featuring|con|with|official|video|audio|hd|hq|lyrics?|letra|visualizer|remastered)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSongTitle(value: string) {
  return value
    .replace(/\((?:official|audio|video|lyrics?|letra|visualizer|remastered|hd|hq)[^)]*\)/gi, " ")
    .replace(/\[(?:official|audio|video|lyrics?|letra|visualizer|remastered|hd|hq)[^\]]*\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(
    normalizeForMatch(value)
      .split(" ")
      .filter((token) => token.length > 1),
  );
}

function tokenOverlapRatio(needle: string, haystack: string) {
  const needleTokens = tokenSet(needle);
  const haystackTokens = tokenSet(haystack);
  if (!needleTokens.size || !haystackTokens.size) return 0;
  let hits = 0;
  needleTokens.forEach((token) => {
    if (haystackTokens.has(token)) hits += 1;
  });
  return hits / needleTokens.size;
}

function parseIsoDurationSeconds(value?: string) {
  if (!value) return 0;
  const match = value.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function isVideoPlayableInRegion(video: YouTubeVideoDetails, region = DJ_REEL_REGION) {
  if (video.status?.embeddable === false) return false;
  if (video.status?.privacyStatus && video.status.privacyStatus !== "public") return false;
  const allowed = video.contentDetails?.regionRestriction?.allowed;
  const blocked = video.contentDetails?.regionRestriction?.blocked;
  if (Array.isArray(allowed) && (!allowed.length || !allowed.includes(region))) return false;
  if (Array.isArray(blocked) && blocked.includes(region)) return false;
  return true;
}

function youtubeThumbnail(video: YouTubeVideoDetails | YouTubeSearchResult) {
  const thumbnails = video.snippet?.thumbnails as
    | {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
        standard?: { url?: string };
        maxres?: { url?: string };
      }
    | undefined;

  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url
  );
}

function scoreDjReelCandidate(track: NormalizedTrack, video: YouTubeVideoDetails) {
  const videoTitle = video.snippet?.title || "";
  const channelTitle = video.snippet?.channelTitle || "";
  const titleCore = compactSongTitle(track.title);
  const artistCore = track.artist;
  const videoTitleNorm = normalizeForMatch(videoTitle);
  const channelNorm = normalizeForMatch(channelTitle);
  const titleNorm = normalizeForMatch(titleCore);
  const artistNorm = normalizeForMatch(artistCore);
  const titleOverlap = tokenOverlapRatio(titleCore, videoTitle);
  const artistOverlap = Math.max(
    tokenOverlapRatio(artistCore, videoTitle),
    tokenOverlapRatio(artistCore, channelTitle),
  );
  const durationSeconds = parseIsoDurationSeconds(video.contentDetails?.duration);
  let score = 0;

  if (titleNorm && videoTitleNorm.includes(titleNorm)) score += 48;
  else score += Math.round(titleOverlap * 38);

  if (artistNorm && (videoTitleNorm.includes(artistNorm) || channelNorm.includes(artistNorm))) score += 30;
  else score += Math.round(artistOverlap * 25);

  if (/\b(official|video oficial|audio oficial|vevo|topic)\b/i.test(`${videoTitle} ${channelTitle}`)) score += 14;
  if (/(vevo|official|topic)/i.test(channelTitle)) score += 8;
  if (durationSeconds >= 90 && durationSeconds <= 600) score += 8;
  else if (durationSeconds >= 30 && durationSeconds <= 900) score += 3;
  else if (durationSeconds > 0) score -= 16;

  const trackAllowsAltVersion = /\b(live|remix|cover|karaoke|instrumental|slowed|sped up|acoustic|reprise)\b/i.test(track.title);
  if (!trackAllowsAltVersion && /\b(cover|reaction|karaoke|tutorial|instrumental|piano|8d|nightcore|slowed|sped up|remix|live|letra|lyrics)\b/i.test(videoTitle)) {
    score -= 22;
  }

  if (titleOverlap < 0.34) score -= 30;
  if (artistOverlap < 0.18 && !/(vevo|topic)/i.test(channelTitle)) score -= 18;

  const reasons: string[] = [];
  if (titleOverlap >= 0.7 || videoTitleNorm.includes(titleNorm)) reasons.push("título exacto");
  if (artistOverlap >= 0.5 || channelNorm.includes(artistNorm)) reasons.push("artista/canal coincide");
  if (/\b(official|vevo|topic)\b/i.test(`${videoTitle} ${channelTitle}`)) reasons.push("fuente oficial");
  if (durationSeconds >= 90 && durationSeconds <= 600) reasons.push("duración musical");

  return {
    score,
    durationSeconds,
    matchReason: reasons.length ? reasons.join(" · ") : "coincidencia aproximada verificada",
  };
}

async function fetchYoutubeSearchResults(q: string, key: string, maxResults = 8) {
  const params = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    videoCategoryId: "10",
    regionCode: DJ_REEL_REGION,
    maxResults: String(maxResults),
    key,
    safeSearch: "moderate",
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Music/1.7" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return [] as YouTubeSearchResult[];
  const data = await res.json();
  return ((data.items || []) as YouTubeSearchResult[]).filter((item) => item.id?.videoId);
}

async function fetchYoutubeVideoDetails(videoIds: string[], key: string) {
  const ids = Array.from(new Set(videoIds.filter(Boolean))).slice(0, 15);
  if (!ids.length) return [] as YouTubeVideoDetails[];
  const params = new URLSearchParams({
    part: "snippet,contentDetails,status",
    id: ids.join(","),
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Music/1.7" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return [] as YouTubeVideoDetails[];
  const data = await res.json();
  return (data.items || []) as YouTubeVideoDetails[];
}

async function searchExactDjReels(track: NormalizedTrack): Promise<DjReelVisual[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  const cacheKey = safeId(`${track.artist}-${track.title}`);
  const cached = djReelCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.reels;

  const title = compactSongTitle(track.title);
  const queries = [
    `"${title}" "${track.artist}" official video`,
    `"${title}" "${track.artist}" official audio`,
    `${track.artist} ${title}`,
  ];

  const collected = new Map<string, YouTubeSearchResult>();
  for (const q of queries) {
    const results = await fetchYoutubeSearchResults(q, key, 12);
    results.forEach((item) => {
      if (item.id?.videoId && !collected.has(item.id.videoId)) collected.set(item.id.videoId, item);
    });
    if (collected.size >= 12) break;
  }

  const details = await fetchYoutubeVideoDetails(Array.from(collected.keys()), key);
  const reels = details
    .filter((video) => video.id && isVideoPlayableInRegion(video))
    .map((video) => {
      const scored = scoreDjReelCandidate(track, video);
      const videoId = video.id!;
      return {
        videoId,
        title: video.snippet?.title || track.title,
        channelTitle: video.snippet?.channelTitle || "YouTube",
        thumbnail: youtubeThumbnail(video),
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        durationSeconds: scored.durationSeconds,
        score: scored.score,
        matchReason: scored.matchReason,
      } satisfies DjReelVisual;
    })
    .filter((reel) => reel.score >= 42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  djReelCache.set(cacheKey, { expiresAt: Date.now() + DJ_REEL_CACHE_TTL_MS, reels });
  return reels;
}

async function withExactDjVisuals(previews: NormalizedTrack[]): Promise<NormalizedTrack[]> {
  if (!previews.length || !process.env.YOUTUBE_API_KEY) return previews;
  const visualLimit = Math.min(previews.length, 12);
  const firstBatch = await Promise.all(
    previews.slice(0, visualLimit).map(async (track) => {
      const reels = await searchExactDjReels(track).catch(() => []);
      const primary = reels[0];
      if (!primary) {
        return {
          ...track,
          tags: Array.from(new Set([...(track.tags || []), "dj-reel", "sin-video-exacto"])),
        };
      }
      return {
        ...track,
        album: `${track.album || "Preview"} · DJ Reel exacto`,
        tags: Array.from(new Set([...(track.tags || []), "dj-reel", "video-exacto", "youtube-visual"])),
        youtubeVideoId: primary.videoId,
        videoEmbedUrl: primary.embedUrl,
        videoThumbnail: primary.thumbnail || track.videoThumbnail || track.artworkUrl,
        djReels: reels,
        djReelMatchScore: primary.score,
        djReelMatchReason: primary.matchReason,
      } satisfies NormalizedTrack;
    }),
  );

  return [...firstBatch, ...previews.slice(visualLimit)];
}

async function searchYouTube(query: string, limit: number): Promise<NormalizedTrack[]> {
  const key = process.env.YOUTUBE_API_KEY;
  const direct = await youtubeDirectFromInput(query, key).catch(() => []);
  if (!key) return direct;

  const params = new URLSearchParams({
    part: "snippet",
    q: `${query} official audio official video`,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    videoCategoryId: "10",
    regionCode: DJ_REEL_REGION,
    maxResults: String(Math.min(limit, 10)),
    key,
    safeSearch: "moderate",
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Music/1.8" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) return direct;
  const data = await res.json();

  const ids = ((data.items || []) as YouTubeSearchResult[])
    .map((item) => item.id?.videoId)
    .filter(Boolean) as string[];
  const details = await fetchYoutubeVideoDetails(ids, key).catch(() => []);

  const tracks = details
    .filter((video) => video.id && isVideoPlayableInRegion(video))
    .map((video) => youtubeTrackFromDetails(video))
    .filter(Boolean) as NormalizedTrack[];

  const map = new Map<string, NormalizedTrack>();
  [...direct, ...tracks].forEach((track) => map.set(track.id, track));
  return Array.from(map.values()).slice(0, limit);
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
  let djVisuals = 0;

  const isDirectYouTubeInput = Boolean(parseYouTubeInput(query));
  const shouldUseYouTubeFallback =
    normalizedProvider === "youtube" ||
    isDirectYouTubeInput ||
    ((normalizedProvider === "full" || normalizedProvider === "all") && fullResults.length === 0);

  if (shouldUseYouTubeFallback) {
    youtubeFallback = await searchYouTube(query, Math.min(8, limit)).catch(() => []);
    if (normalizedProvider === "youtube") fullResults = [];
  }

  if ((normalizedProvider === "preview" || normalizedProvider === "itunes" || normalizedProvider === "all") && previewResults.length) {
    previewResults = await withExactDjVisuals(previewResults);
    djVisuals = previewResults.filter((track) => (track.djReels || []).length > 0).length;
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
    fallbackUsed: Boolean(youtubeFallback.length || djVisuals > 0),
    fallbackReason: youtubeFallback.length
      ? "No se encontró audio completo en Jamendo/Audius para esa búsqueda; se muestran videos embebibles de YouTube."
      : djVisuals > 0
        ? "Modo DJ: se agregaron reels exactos de YouTube a los previews legales de 30 segundos."
        : previewResults.length && !process.env.YOUTUBE_API_KEY
          ? "Modo DJ: se muestran previews de iTunes; falta YOUTUBE_API_KEY para buscar reels exactos por canción."
          : null,
    djVisuals,
    youtubeKeyMissing: !process.env.YOUTUBE_API_KEY && (normalizedProvider === "all" || normalizedProvider === "full" || normalizedProvider === "youtube" || normalizedProvider === "preview" || normalizedProvider === "itunes"),
    youtubeSearchUrl: !process.env.YOUTUBE_API_KEY && (normalizedProvider === "all" || normalizedProvider === "full" || normalizedProvider === "youtube" || normalizedProvider === "preview" || normalizedProvider === "itunes") ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : null,
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
