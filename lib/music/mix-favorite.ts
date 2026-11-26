import type { EduMusicTrack } from "@/lib/music/eduai-music-catalog";
import { MIX_FAVORITE_SEED_SONGS, MIX_FAVORITE_SEED_ARTISTS, type MixFavoriteSeedSong } from "@/lib/music/mix-favorite-seed";

// Metadata de canciones aprendidas, conservada en el perfil privado existente.
export type MixSong = MixFavoriteSeedSong & {
  youtubeVideoId?: string;
  videoTitle?: string;
  artworkUrl?: string;
  duration?: string;
  externalOnly?: boolean;
  origin?: "search" | "played" | "discovered";
  playCount?: number;
  lastPlayedAt?: number;
};

export function normalizeArtist(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function mixSongKey(song: MixSong) {
  return normalizeArtist(song.artist) + ":" + normalizeArtist(cleanTitle(song.title).replace(/\s*[\[(][^\])]*(?:remix|live|cover|version|edit|remaster|instrumental|sped up|slowed|dance practice|performance|m\/?v)[^\])]*[\])]/gi, "").replace(/\s+(?:[-–—|]\s*)?(?:official music video|official video|official audio|lyrics?|m\/?v|remastered|live|remix)\s*$/gi, ""));
}
const KNOWN_ARTISTS = [...MIX_FAVORITE_SEED_ARTISTS].sort((a, b) => b.length - a.length);

function cleanTitle(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'").replace(/&apos;/gi, "'")
    .replace(/\s*[\[(](?:official\s*)?(?:music\s*)?(?:video|audio|lyric(?:s)?|letra|visualizer|hd|4k)[^\])]*[\])]/gi, "")
    .replace(/\s*(?:\||•)\s*(?:official\s*)?(?:video|audio|lyrics|letra)\s*$/gi, "")
    .replace(/\s+/g, " ").trim();
}
function validArtist(value: string) {
  return value.length >= 2 && value.length <= 100 &&
    !/^(music|official|lyrics?|letra|video|audio|playlist|youtube|topic|various artists)$/i.test(value);
}
function validSong(value: string) {
  return value.length >= 2 && value.length <= 180 &&
    !/^(official|audio|lyrics?|video|music|full|mix)$/i.test(value);
}

// El canal de subida no es necesariamente el artista; usamos el título, la
// búsqueda concreta y las referencias existentes para identificarlo.
export function inferredMixSong(track: EduMusicTrack, searchQuery = ""): MixSong | null {
  if (track.source !== "youtube" || !/^[a-zA-Z0-9_-]{11}$/.test(track.youtubeVideoId || "")) return null;
  const raw = cleanTitle(track.title || "");
  const query = normalizeArtist(searchQuery);
  const normalizedTitle = normalizeArtist(raw);
  const channel = cleanTitle(track.artist || "").replace(/\s*[-–]\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  let artist = "";
  let title = "";

  if (track.tags?.includes("mix-favorite") && validArtist(track.artist)) {
    artist = track.artist;
    title = normalizedTitle.startsWith(normalizeArtist(artist) + " ")
      ? raw.slice(artist.length).replace(/^\s*[-–—:]\s*/, "").trim() : raw;
  } else {
    const parts = /^(.{2,100}?)\s+[-–—:]\s+(.{2,180})$/.exec(raw);
    const seed = MIX_FAVORITE_SEED_SONGS.find((song) =>
      normalizedTitle.includes(normalizeArtist(song.artist)) &&
      normalizedTitle.includes(normalizeArtist(song.title)));
    if (parts) {
      const left = cleanTitle(parts[1]), right = cleanTitle(parts[2]);
      const l = normalizeArtist(left), r = normalizeArtist(right);
      const leftKnown = KNOWN_ARTISTS.some((a) => l === normalizeArtist(a));
      const rightKnown = KNOWN_ARTISTS.some((a) => r === normalizeArtist(a));
      const rightQuery = !!query && (query === r || query.startsWith(r + " "));
      const leftQuery = !!query && (query === l || query.startsWith(l + " "));
      const reverse = (rightQuery && !leftQuery) ||
        (rightKnown && !leftKnown && !leftQuery) ||
        (!leftQuery && !leftKnown && normalizeArtist(channel) === r);
      artist = reverse ? right : left;
      title = reverse ? left : right;
      if (seed && !leftQuery && !rightQuery && !leftKnown && !rightKnown &&
          !normalizeArtist(channel).startsWith(l)) {
        artist = seed.artist;
        title = seed.title;
      }
    } else if (seed) {
      artist = seed.artist;
      title = seed.title;
    } else {
      const artistHint = KNOWN_ARTISTS.find((a) => normalizedTitle.startsWith(normalizeArtist(a) + " "));
      const topicChannel = /(?:-|\s)Topic$|VEVO$/i.test(track.artist || "");
      if (artistHint) {
        artist = artistHint;
        title = raw.slice(artistHint.length).replace(/^\s*[-–—:]\s*/, "").trim();
      } else if (query && normalizedTitle.startsWith(query + " ") && searchQuery.trim().length <= 85) {
        artist = searchQuery.trim();
        title = raw.slice(searchQuery.trim().length).replace(/^\s*[-–—:]\s*/, "").trim();
      } else if ((topicChannel || normalizedTitle.length > 1) && validArtist(channel)) {
        artist = channel;
        title = raw;
      }
    }
  }
  artist = cleanTitle(artist);
  title = cleanTitle(title);
  if (!validArtist(artist) || !validSong(title)) return null;
  const extended = track as EduMusicTrack & { externalOnly?: boolean };
  return {
    artist, title, youtubeVideoId: track.youtubeVideoId,
    videoTitle: (track.title || "").slice(0, 200),
    artworkUrl: String(track.artworkUrl || track.videoThumbnail || "").slice(0, 600),
    duration: track.duration, externalOnly: extended.externalOnly === true,
  };
}

export function learnedVideoTrack(song: MixSong): EduMusicTrack | null {
  const id = song.youtubeVideoId;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id) || !validArtist(song.artist) || !validSong(song.title)) return null;
  const thumb = song.artworkUrl || "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
  return {
    id: "youtube-" + id, title: song.videoTitle || song.title,
    artist: song.artist, album: "Mix Favorite · Aprendida de YouTube",
    mood: "energy", duration: song.duration || "Video", src: "",
    cover: thumb, artworkUrl: thumb,
    externalUrl: "https://www.youtube.com/watch?v=" + id,
    source: "youtube", tags: ["youtube", "mix-favorite", "aprendida"],
    youtubeVideoId: id, videoEmbedUrl: "https://www.youtube.com/embed/" + id,
    videoThumbnail: thumb, externalOnly: song.externalOnly === true,
    playable: song.externalOnly !== true,
  } as EduMusicTrack;
}

export type MixRequest = { artist: string; title: string; mode?: "artist" | "song" };

export function trackMixKey(track: EduMusicTrack): string {
  const song = inferredMixSong(track);
  return song ? mixSongKey(song) : mixSongKey({ artist: track.artist || "", title: track.title || "" });
}

export function chooseMixRequests(learned: MixSong[], artists: string[], avoidArtists: string[], count = 3, favorites: EduMusicTrack[] = [], recentlyRequested: string[] = []): MixRequest[] {
  const affinity = new Map<string, { artist: string; weight: number }>();
  const add = (artist: string, weight: number) => {
    if (!validArtist(artist)) return;
    const key = normalizeArtist(artist);
    if (!key) return;
    const old = affinity.get(key);
    affinity.set(key, { artist: old?.artist || artist, weight: (old?.weight || 0) + weight });
  };
  for (const artist of MIX_FAVORITE_SEED_ARTISTS) add(artist, 1);
  for (const artist of artists) add(artist, 0.4);
  for (const song of learned) {
    const played = song.origin === "played";
    const recency = played && song.lastPlayedAt && Date.now() - song.lastPlayedAt < 30 * 86400000 ? 2 : 0;
    add(song.artist, played ? 4 + Math.min(12, Math.max(0, song.playCount || 0)) + recency : song.origin === "search" ? 0.7 : 0.12);
  }
  for (const track of favorites) {
    const song = inferredMixSong(track);
    if (song) add(song.artist, 12);
    else if (track.source === "youtube" && track.artist) add(track.artist, 8);
  }
  const avoid = new Set(avoidArtists.map(normalizeArtist));
  const recent = new Set(recentlyRequested.map(normalizeArtist));
  const ranked = [...affinity.values()].map(item => ({
    ...item, rank: -Math.log(Math.max(0.000001, Math.random())) / Math.max(.1, Math.sqrt(item.weight) * (avoid.has(normalizeArtist(item.artist)) ? .12 : 1) * (recent.has(normalizeArtist(item.artist)) ? .15 : 1))
  })).sort((a,b) => a.rank-b.rank);
  const chosen: MixRequest[] = [];
  const limit = Math.max(1, Math.min(10, count));
  for (const item of ranked) {
    if (chosen.length >= limit) break;
    chosen.push({ artist: item.artist, title: "canciones", mode: "artist" });
  }
  return chosen;
}
