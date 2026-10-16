import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { MIX_FAVORITE_SEED_SONGS } from "@/lib/music/mix-favorite-seed";

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
// Se permiten lyric videos de cualquier canal. Rechazamos recopilaciones,
// videos con múltiples canciones, reacciones, covers y versiones alteradas.
function badVideo(title: string, expectedTitle: string) {
  const t = normalized(title);
  const expected = normalized(expectedTitle);
  if (/(mega ?mix|playlist|compilacion|mix de canciones|mix de reggaeton|best songs|greatest hits|full album|1 hour|2 hours|30 minutes|dj set|continuous mix|nonstop|non stop|reaction|reacting|tutorial|karaoke|sped up|slowed|nightcore|instrumental cover|fanmade remix|bass boosted|tiktok compilation)/.test(t)) return true;
  if (/\bcover\b/.test(t) && !/\bcover\b/.test(expected)) return true;
  if (/\bremix\b/.test(t) && !/\bremix\b/.test(expected)) return true;
  return false;
}
function rankVideo(title: string, channel: string, requested: RequestSong) {
  const t = normalized(title);
  const a = normalized(requested.artist);
  const song = normalized(requested.title);
  const wanted = song.split(" ").filter((word) => word.length >= 3 && !["feat", "remix", "radio", "edit", "with"].includes(word));
  // No confundir un lyric de un tema con otro cantante/canción popular.
  const meaningful = wanted.filter((word) => t.includes(word)).length;
  if (wanted.length && meaningful / wanted.length < 0.6) return -100;
  if (!t.includes(a) && !normalized(channel).includes(a)) {
    // Artistas compuestos / colaboraciones pueden usar parte del crédito.
    const first = a.split(" ").slice(0, 2).join(" ");
    if (!first || !t.includes(first)) return -100;
  }
  const c = normalized(channel);
  return meaningful * 6 + (t.includes(a) ? 12 : 0) +
    (/\bofficial (music )?video\b/.test(t) ? 14 : 0) +
    (/\bofficial (audio|lyric|lyrics)\b/.test(t) ? 13 : 0) +
    (/\b(lyrics|lyric|letra|sub espanol)\b/.test(t) ? 9 : 0) +
    (c.includes(a) ? 10 : 0) + (/\btopic\b/.test(c) ? 3 : 0);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "Falta configurar YOUTUBE_API_KEY en Vercel." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const list = Array.isArray(body.requests) ? body.requests : [];
  const requests: RequestSong[] = list.slice(0, 3).map((s: any) => ({
    artist: String(s?.artist || "").trim().slice(0, 100),
    title: String(s?.title || "").trim().slice(0, 140),
  })).filter((s: RequestSong) => s.artist && s.title);
  if (!requests.length) return NextResponse.json({ ok: false, error: "Faltan artistas o canciones." }, { status: 400 });
  const excluded = new Set((Array.isArray(body.excludeIds) ? body.excludeIds : []).slice(-500).filter((s: unknown): s is string => typeof s === "string"));
  // Caché global de videos verificados: reutilizar un mismo video para distintas
  // cuentas no mezcla historiales personales y evita gastar cuota de búsqueda.
  const adminUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cache = adminUrl && adminKey
    ? createAdminClient(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
  const songKey = (song: RequestSong) => normalized(song.artist) + "|" + normalized(song.title);
  const requestedKeys = requests.map(songKey);
  const cachedTracks: Array<{ song_key: string; track: Record<string, unknown> }> = [];
  if (cache) {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await cache.from("eduai_music_mix_video_cache")
      .select("song_key,track").in("song_key", requestedKeys).gte("verified_at", cutoff);
    for (const row of data || []) {
      const id = (row.track as { youtubeVideoId?: string })?.youtubeVideoId;
      if (id && !excluded.has(id)) cachedTracks.push(row);
    }
  }
  const inCache = new Set(cachedTracks.map((v) => v.song_key));
  const unresolved = requests.filter((s) => !inCache.has(songKey(s)));
  const found: { song: RequestSong; item: YouTubeItem }[] = [];
  let failures = 0;
  if (unresolved.length) {
    // YouTube permite OR (|): hasta tres artistas con una sola búsqueda.
    const params = new URLSearchParams({
      key: apiKey, part: "snippet", type: "video",
      q: unresolved.map((song) => song.artist + " " + song.title).join("|"),
      videoEmbeddable: "true", videoSyndicated: "true",
      safeSearch: "moderate", maxResults: "50",
    });
    try {
      const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params, { next: { revalidate: 7200 } });
      if (!response.ok) failures++;
      else {
        const data = await response.json();
        for (const item of (data.items || []) as YouTubeItem[]) {
          if (!item.id?.videoId || excluded.has(item.id.videoId) || !item.snippet?.title) continue;
          for (const song of unresolved) {
            if (rankVideo(item.snippet.title, item.snippet.channelTitle || "", song) >= 0) {
              found.push({ song, item });
            }
          }
        }
      }
    } catch { failures++; }
  }
  if (!found.length) {
    return NextResponse.json({
      ok: true, tracks: cachedTracks.map((v) => v.track), searched: unresolved.length,
      cached: cachedTracks.length, failures,
    });
  }

  const ids = [...new Set(found.map((v) => v.item.id!.videoId!))].slice(0, 36);
  const params = new URLSearchParams({ part: "status,contentDetails,snippet", id: ids.join(","), key: apiKey });
  let details: VideoDetail[] = [];
  try {
    const response = await fetch("https://www.googleapis.com/youtube/v3/videos?" + params, { next: { revalidate: 1800 } });
    if (response.ok) details = (await response.json()).items || [];
  } catch {}
  // Si no se pudo confirmar embebibilidad/duración, nunca prometemos reproducción.
  const verified = new Map(details.map((d) => [d.id, d]));
  const scored = found.flatMap(({ song, item }) => {
    const id = item.id!.videoId!;
    const d = verified.get(id);
    const duration = seconds(d?.contentDetails?.duration);
    if (!d || d.status?.embeddable !== true || d.status?.privacyStatus !== "public" || duration < 80 || duration > 720 || d.snippet?.liveBroadcastContent === "live") return [];
    if (badVideo(item.snippet?.title || "", song.title)) return [];
    const score = rankVideo(item.snippet?.title || "", item.snippet?.channelTitle || "", song);
    if (score < 0) return [];
    const thumb = item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || "";
    return [{ score, artistKey: normalized(song.artist), song, track: {
      id: "youtube-" + id, title: song.title, artist: song.artist,
      album: "Mix Favorite · YouTube", mood: "energy", duration: durationLabel(duration),
      src: "", cover: thumb || "linear-gradient(135deg,#25f4ff,#43145f)",
      artworkUrl: thumb, externalUrl: "https://www.youtube.com/watch?v=" + id,
      source: "youtube", tags: ["youtube", "mix-favorite", "lyric-o-video"],
      youtubeVideoId: id, videoEmbedUrl: "https://www.youtube.com/embed/" + id, videoThumbnail: thumb,
    } }];
  });
  // Prioriza coincidencia de canción y artista; a igualdad da cabida a lyric UGC.
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const selected: typeof scored = [];
  for (const row of scored) {
    if (seen.has(row.artistKey) || excluded.has(row.track.youtubeVideoId)) continue;
    seen.add(row.artistKey);
    selected.push(row);
  }
  if (cache && selected.length) {
    void await cache.from("eduai_music_mix_video_cache").upsert(selected.map((v) => ({
      song_key: songKey(v.song), artist: v.song.artist, title: v.song.title,
      track: v.track, verified_at: new Date().toISOString(),
    })), { onConflict: "song_key" }).then(({ error }) => {
      if (error) console.warn("[EDUAI Music] No se pudo almacenar caché verificada:", error.message);
    });
  }
  const finalTracks = [...cachedTracks.map((v) => v.track), ...selected.map((v) => v.track)];
  const playedArtists = new Set<string>();
  const tracks = finalTracks.filter((track) => {
    const key = normalized(String(track.artist || ""));
    if (!key || playedArtists.has(key)) return false;
    playedArtists.add(key);
    return true;
  });
  return NextResponse.json({
    ok: true, tracks, searched: unresolved.length, cached: cachedTracks.length,
    failures, verifiedCount: details.length, candidates: scored.length,
  });
}
