import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const maxDuration = 25;

type RequestSong = { artist: string; title: string };
type YouTubeItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string; description?: string; thumbnails?: { high?: { url?: string }; medium?: { url?: string } } };
};
type VideoDetail = {
  id?: string;
  status?: { embeddable?: boolean; privacyStatus?: string };
  contentDetails?: { duration?: string };
  snippet?: { liveBroadcastContent?: string };
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function seconds(value = "") {
  const m = /^P(?:([0-9]+)D)?T?(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/.exec(value);
  if (!m) return 0;
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0);
}
function durationLabel(value: number) {
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
}
// Los canales oficiales, de fans, lyrics, covers, remixes y mixes son
// descubribles: el ranking ordena por relevancia, no censura variantes.
function rankVideo(title: string, channel: string, requested: RequestSong) {
  const t = normalized(title);
  const c = normalized(channel);
  const artist = normalized(requested.artist);
  const song = normalized(requested.title);
  const artistWords = artist.split(" ").filter((word) => word.length >= 3);
  const titleWords = song.split(" ").filter((word) => word.length >= 3 && !["feat", "remix", "radio", "edit", "with"].includes(word));
  const artistMatch = t.includes(artist) || c.includes(artist) ||
    artistWords.some((word) => t.includes(word) || c.includes(word));
  const titleOverlap = titleWords.length ? titleWords.filter((word) => t.includes(word)).length / titleWords.length : 0;
  if (!artistMatch && titleOverlap < 0.75) return -100;
  return titleOverlap * 22 + (artistMatch ? 18 : 0) +
    (t.includes(artist) ? 6 : 0) + (c.includes(artist) ? 5 : 0) +
    (/\bofficial\b/.test(t) ? 4 : 0) +
    (/\b(lyrics|lyric|letra)\b/.test(t) ? 3 : 0);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Falta configurar YOUTUBE_API_KEY en Vercel." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const list = Array.isArray(body.requests) ? body.requests : [];
  const requests: RequestSong[] = list.slice(0, 10).map((s: any) => ({
    artist: String(s?.artist || "").trim().slice(0, 100),
    title: String(s?.title || "").trim().slice(0, 140),
  })).filter((s: RequestSong) => s.artist && s.title);
  if (!requests.length) return NextResponse.json({ ok: false, error: "Faltan artistas o canciones." }, { status: 400 });
  const excluded = new Set(
    (Array.isArray(body.excludeIds) ? body.excludeIds : [])
      .slice(-500).filter((v: unknown): v is string => typeof v === "string"),
  );
  const adminUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cache = adminUrl && adminKey
    ? createAdminClient(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
  const songKey = (song: RequestSong) => normalized(song.artist) + "|" + normalized(song.title);
  type MixTrack = {
    id: string; title: string; artist: string; album: string; mood: string;
    duration: string; src: string; cover: string; artworkUrl: string;
    externalUrl: string; source: "youtube"; tags: string[];
    youtubeVideoId: string; videoEmbedUrl: string; videoThumbnail: string;
    playable: boolean; externalOnly: boolean;
  };
  type Candidate = { song: RequestSong; score: number; track: MixTrack };
  const isTrack = (value: unknown): value is MixTrack =>
    Boolean(value && typeof value === "object" && typeof (value as MixTrack).youtubeVideoId === "string");
  const cached: Candidate[] = [];
  const requestKeys = requests.map(songKey);

  if (cache) {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await cache.from("eduai_music_mix_video_cache")
      .select("song_key,track").in("song_key", requestKeys).gte("verified_at", cutoff);
    for (const row of data || []) {
      const song = requests.find((item) => songKey(item) === row.song_key);
      if (!song) continue;
      const tracks: unknown[] = Array.isArray(row.track) ? row.track : [row.track];
      for (const track of tracks.filter(isTrack)) {
        if (!excluded.has(track.youtubeVideoId)) cached.push({ song, score: 20, track });
      }
    }
  }

  const inCache = new Set(cached.map(({ song }) => songKey(song)));
  const unresolved = requests.filter((song) => !inCache.has(songKey(song)));
  const found: Array<{ song: RequestSong; item: YouTubeItem; score: number }> = [];
  let failures = 0;
  if (unresolved.length) {
    // Sin videoEmbeddable / videoSyndicated: mostrar incluso las canciones
    // que solo pueden escucharse en youtube.com (nunca evadir el bloqueo).
    const params = new URLSearchParams({
      key: apiKey, part: "snippet", type: "video",
      q: unresolved.map((song) => song.artist + " " + song.title).join("|").slice(0, 800),
      safeSearch: "moderate", maxResults: "50",
    });
    try {
      const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params, {
        next: { revalidate: 3600 },
      });
      if (!response.ok) failures++;
      else {
        const data = await response.json();
        for (const item of (data.items || []) as YouTubeItem[]) {
          if (!item.id?.videoId || !item.snippet?.title || excluded.has(item.id.videoId)) continue;
          const matches = unresolved.map((song) => ({
            song, score: rankVideo(item.snippet!.title!, item.snippet!.channelTitle || "", song),
          })).sort((a, b) => b.score - a.score);
          if (matches[0]?.score >= 0) found.push({ ...matches[0], item });
        }
      }
    } catch { failures++; }
  }

  const ids = [...new Set(found.map((entry) => entry.item.id!.videoId!))].slice(0, 50);
  const detailMap = new Map<string, VideoDetail>();
  if (ids.length) {
    const params = new URLSearchParams({ part: "status,contentDetails,snippet", id: ids.join(","), key: apiKey });
    try {
      const response = await fetch("https://www.googleapis.com/youtube/v3/videos?" + params, {
        next: { revalidate: 1800 },
      });
      if (response.ok) {
        const data = await response.json();
        for (const detail of (data.items || []) as VideoDetail[]) {
          if (detail.id) detailMap.set(detail.id, detail);
        }
      }
    } catch { failures++; }
  }

  const candidates: Candidate[] = [...cached];
  for (const { song, item, score } of found) {
    const id = item.id!.videoId!;
    const detail = detailMap.get(id);
    // Eliminados y privados no están disponibles en YouTube; nunca crear
    // una URL ficticia para ellos.
    if (!detail || detail.status?.privacyStatus !== "public") continue;
    const duration = seconds(detail.contentDetails?.duration);
    const embeddable = detail.status?.embeddable === true;
    const thumb = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || "";
    candidates.push({
      song, score: score + (embeddable ? 4 : 0),
      track: {
        id: "youtube-" + id,
        title: item.snippet?.title || song.title,
        artist: song.artist,
        album: embeddable ? "Mix Favorite · YouTube" : "Disponible en YouTube · no integrable",
        mood: "energy", duration: duration ? durationLabel(duration) : "Video",
        src: "", cover: thumb || "linear-gradient(135deg,#25f4ff,#43145f)",
        artworkUrl: thumb, externalUrl: "https://www.youtube.com/watch?v=" + id,
        source: "youtube",
        tags: ["youtube", "mix-favorite", ...(embeddable ? ["video-integrable"] : ["abrir-en-youtube"])],
        youtubeVideoId: id, videoEmbedUrl: "https://www.youtube.com/embed/" + id,
        videoThumbnail: thumb, playable: embeddable, externalOnly: !embeddable,
      },
    });
  }

  // Conservar varias versiones por artista (hasta 6): tema oficial, lyric,
  // remix, cover, compilación, etc. Orden intercalado para no repetir artista.
  candidates.sort((a, b) => b.score - a.score);
  const grouped = new Map<string, Candidate[]>();
  const usedIds = new Set<string>();
  for (const candidate of candidates) {
    const key = normalized(candidate.song.artist);
    if (!key || usedIds.has(candidate.track.youtubeVideoId)) continue;
    const group = grouped.get(key) || [];
    if (group.length >= 6) continue;
    group.push(candidate);
    grouped.set(key, group);
    usedIds.add(candidate.track.youtubeVideoId);
  }
  const tracks: MixTrack[] = [];
  while (tracks.length < 60 && [...grouped.values()].some((group) => group.length)) {
    for (const group of grouped.values()) {
      const next = group.shift();
      if (next) tracks.push(next.track);
      if (tracks.length >= 60) break;
    }
  }

  // Solo conservar resultados por canción en la caché si la búsqueda realmente
  // devolvió videos; no sobrescribirlos con un error temporal de API.
  if (cache && found.length) {
    const bySong = new Map<string, MixTrack[]>();
    for (const candidate of candidates.filter((v) => !cached.includes(v))) {
      const key = songKey(candidate.song);
      const group = bySong.get(key) || [];
      if (group.length < 6 && !group.some((v) => v.id === candidate.track.id)) group.push(candidate.track);
      bySong.set(key, group);
    }
    const rows = [...bySong.entries()].map(([key, value]) => {
      const song = requests.find((item) => songKey(item) === key)!;
      return { song_key: key, artist: song.artist, title: song.title,
        track: value, verified_at: new Date().toISOString() };
    });
    if (rows.length) {
      const { error } = await cache.from("eduai_music_mix_video_cache")
        .upsert(rows, { onConflict: "song_key" });
      if (error) console.warn("[EDUAI Music] Caché YouTube no disponible:", error.message);
    }
  }

  return NextResponse.json({
    ok: true, tracks, searched: unresolved.length, cached: cached.length,
    failures, verifiedCount: detailMap.size, candidates: candidates.length,
    embeddable: tracks.filter((track) => track.playable).length,
    external: tracks.filter((track) => track.externalOnly).length,
  });
}
