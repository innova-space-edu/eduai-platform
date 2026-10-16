import assert from "node:assert/strict";
import type { EduMusicTrack } from "../lib/music/eduai-music-catalog";
import {
  inferredMixSong, learnedVideoTrack, mixSongKey, chooseMixRequests,
} from "../lib/music/mix-favorite";

const video = (title: string, channel = "Canal de fans", videoId = "AbCdEfGh123", externalOnly = false): EduMusicTrack => ({
  id: "youtube-" + videoId, title, artist: channel,
  album: "YouTube", mood: "energy", duration: "3:22",
  src: "", cover: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
  artworkUrl: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
  youtubeVideoId: videoId, source: "youtube", tags: ["youtube"],
  externalOnly,
} as EduMusicTrack);

// Un lyric subido por cualquier persona no debe atribuirse al uploader.
const fromFan = inferredMixSong(video("Daddy Yankee - Gasolina (Lyrics)", "Mi canal de letras"), "Daddy Yankee");
assert.equal(fromFan?.artist, "Daddy Yankee");
assert.equal(fromFan?.title, "Gasolina");
assert.equal(fromFan?.youtubeVideoId, "AbCdEfGh123");

// Título invertido: reconocer que el cantante figura después de la canción.
const inverted = inferredMixSong(video("Ojitos Lindos - Bad Bunny", "Videoclips UGC"), "Bad Bunny");
assert.equal(inverted?.artist, "Bad Bunny");
assert.equal(inverted?.title, "Ojitos Lindos");

// Búsqueda de artista con título corrido sin el separador "Artista - Canción".
const inferredSearch = inferredMixSong(video("Cantante de Prueba Canción Nueva (Official Audio)"), "Cantante de Prueba");
assert.equal(inferredSearch?.artist, "Cantante de Prueba");
assert.equal(inferredSearch?.title, "Canción Nueva");

// Canal oficial Topic: si el título no lo especifica, el canal sí acredita al artista.
const topic = inferredMixSong(video("Canción para recordar", "Artista Prueba - Topic"));
assert.equal(topic?.artist, "Artista Prueba");
assert.equal(topic?.title, "Canción para recordar");

// Sin una pista de artista fiable, no ensuciar el repertorio.
assert.equal(inferredMixSong(video("Descubre el canal aquí", "Uploader cualquiera")), null);
assert.equal(inferredMixSong({ ...video("Cantante - Canción"), source: "radio" }), null);

const blocked = inferredMixSong(video("Nueva Banda - Tema alternativo", "Fan", "ZyXwVuTs987", true));
assert.equal(blocked?.externalOnly, true);
const direct = learnedVideoTrack({ ...blocked!, origin: "played" });
assert.equal(direct?.id, "youtube-ZyXwVuTs987");
assert.equal(direct?.externalUrl, "https://www.youtube.com/watch?v=ZyXwVuTs987");
assert.equal((direct as EduMusicTrack & { externalOnly?: boolean })?.externalOnly, true);
assert.equal(direct?.tags.includes("aprendida"), true);

assert.equal(mixSongKey({ artist: "Beyoncé", title: "Canción" }), mixSongKey({ artist: "Beyonce", title: "Cancion" }));
const preferences = chooseMixRequests([{ artist: "Artista nuevo personal", title: "Una canción exclusiva", origin: "played" }], [], [], 1);
assert.equal(preferences[0]?.artist, "Artista nuevo personal");

console.log("EDUAI Music · YouTube learning validation: OK");
