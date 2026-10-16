import type { EduMusicTrack } from "@/lib/music/eduai-music-catalog";
import { MIX_FAVORITE_SEED_SONGS, type MixFavoriteSeedSong } from "@/lib/music/mix-favorite-seed";

export type MixSong = MixFavoriteSeedSong;
export function normalizeArtist(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function inferredMixSong(track: EduMusicTrack): MixSong | null {
  if (track.source !== "youtube" || !track.youtubeVideoId) return null;
  const clean = (text: string) => text.replace(/\s*\((official|lyrics?|video|audio|visualizer)[^)]*\)/gi, "").trim();
  if (track.tags?.includes("mix-favorite")) return { artist: track.artist, title: clean(track.title) };
  const title = track.title.replace(/&amp;/g, "&");
  // Prioridad al crédito que aparece en el título del video; en un lyric UGC
  // channelTitle identifica al usuario que subió el video, no al cantante.
  const match = /^(.{2,90}?)\s+[-–—]\s+(.{2,140})/.exec(title);
  if (match) {
    const artist = clean(match[1]).replace(/\s+(ft\.?|feat\.?|con)\s+.*$/i, "").trim();
    const song = clean(match[2]).replace(/\s+\[(official|lyric)[^\]]*\]/gi, "").trim();
    if (artist.length >= 2 && artist.length <= 90 && !/(playlist|mix 20|dj set|radio)/i.test(artist)) return { artist, title: song };
  }
  // Título sin formato estándar: nunca confundir al uploader con el artista.
  const matchSeed = MIX_FAVORITE_SEED_SONGS.find((s) =>
    normalizeArtist(title).includes(normalizeArtist(s.title)) && normalizeArtist(title).includes(normalizeArtist(s.artist)));
  return matchSeed || null;
}
export function chooseMixRequests(
  learned: MixSong[],
  artists: string[],
  avoidArtists: string[],
  count = 3,
): MixSong[] {
  const seen = new Set<string>();
  const avoid = new Set(avoidArtists.map(normalizeArtist));
  const personalized = learned.filter((s) => s.artist && s.title);
  const seed = MIX_FAVORITE_SEED_SONGS;
  const artistSet = new Set(artists.map(normalizeArtist));
  const pool = [
    ...personalized,
    ...seed.filter((s) => artistSet.has(normalizeArtist(s.artist)) || Math.random() < 0.85),
    ...seed,
  ];
  // Fisher-Yates, con una ligera prioridad a artistas descubiertos por el usuario.
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const chosen: MixSong[] = [];
  for (const s of [...personalized.sort(() => Math.random() - 0.5).slice(0, 15), ...shuffled]) {
    const key = normalizeArtist(s.artist);
    if (!key || seen.has(key) || avoid.has(key)) continue;
    seen.add(key);
    chosen.push(s);
    if (chosen.length >= count) break;
  }
  return chosen;
}
