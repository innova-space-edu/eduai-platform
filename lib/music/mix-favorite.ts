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
};

export function normalizeArtist(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function mixSongKey(song: MixSong) {
  return normalizeArtist(song.artist) + ":" + normalizeArtist(song.title);
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
      } else if (topicChannel && validArtist(channel)) {
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

export function chooseMixRequests(learned: MixSong[], artists: string[], avoidArtists: string[], count = 3): MixSong[] {
  const seen = new Set<string>();
  const avoid = new Set(avoidArtists.map(normalizeArtist));
  const personalized = learned.filter((s) => validArtist(s.artist) && validSong(s.title));
  const artistSet = new Set(artists.map(normalizeArtist));
  const shuffle = <T,>(items: T[]) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  const pool = [
    ...shuffle(personalized.filter((s) => s.origin === "played")).slice(0, 8),
    ...shuffle(personalized.filter((s) => s.origin !== "played")).slice(0, 12),
    ...shuffle(MIX_FAVORITE_SEED_SONGS.filter((s) => artistSet.has(normalizeArtist(s.artist)))),
    ...shuffle([...personalized, ...MIX_FAVORITE_SEED_SONGS]),
  ];
  const chosen: MixSong[] = [];
  for (const song of pool) {
    const key = normalizeArtist(song.artist);
    if (!key || seen.has(key) || avoid.has(key)) continue;
    seen.add(key);
    chosen.push(song);
    if (chosen.length >= count) break;
  }
  return chosen;
}
