"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EDU_MUSIC_TRACKS,
  getTracksForPlaylist,
  type EduMusicMood,
  type EduMusicPlaylist,
  type EduMusicTrack,
} from "@/lib/music/eduai-music-catalog";
import { nextPlaybackId } from "@/lib/music/playback-order.mjs";
import { isRadioTrack, nextRadioAttempt } from "@/lib/music/radio-session.mjs";
import { MIX_FAVORITE_SEED_ARTISTS } from "@/lib/music/mix-favorite-seed";
import { chooseMixRequests, inferredMixSong, learnedVideoTrack, mixSongKey, normalizeArtist, type MixSong } from "@/lib/music/mix-favorite";

type MusicView =
  | "home"
  | "search"
  | "library"
  | "playlists"
  | "liked"
  | "queue"
  | "radio"
  | "mix";
type RepeatMode = "off" | "one" | "all";
type OnlineProviderMode = "all" | "full" | "preview" | "youtube";

type ExtendedEduMusicTrack = EduMusicTrack & {
  playable?: boolean;
  externalOnly?: boolean;
  embedOnly?: boolean;
  embedUrl?: string;
  loaderUrl?: string;
  previewSeconds?: number;
  previewStartSeconds?: number;
  radioStreams?: string[];
};

type StoredState = {
  trackId?: string;
  playlistId?: string;
  volume?: number;
  likedTrackIds?: string[];
  likedTracks?: EduMusicTrack[];
  userPlaylists?: EduMusicPlaylist[];
  onlineTracks?: EduMusicTrack[];
  onlineQuery?: string;
  recentSearches?: string[];
  onlineProviderMode?: OnlineProviderMode;
  recentIds?: string[];
  queueIds?: string[];
  view?: MusicView;
  shuffle?: boolean;
  repeat?: RepeatMode;
  hasActiveSession?: boolean;
  favoriteSession?: boolean;
};

type MusicContextValue = {
  view: MusicView;
  setView: (value: MusicView) => void;
  query: string;
  setQuery: (value: string) => void;
  onlineQuery: string;
  setOnlineQuery: (value: string) => void;
  recentSearches: string[];
  onlineLoading: boolean;
  onlineError: string;
  onlineProviderMode: OnlineProviderMode;
  setOnlineProviderMode: (value: OnlineProviderMode) => void;
  radioQuery: string;
  setRadioQuery: (value: string) => void;
  radioLoading: boolean;
  radioError: string;
  radioTracks: EduMusicTrack[];
  radioFavoriteTracks: EduMusicTrack[];
  searchRadio: (term?: string, countryCode?: string) => Promise<void>;
  selectedMood: EduMusicMood | "all";
  setSelectedMood: (value: EduMusicMood | "all") => void;
  volume: number;
  setVolume: (value: number) => void;
  playing: boolean;
  setPlaying: (value: boolean | ((prev: boolean) => boolean)) => void;
  hasActiveSession: boolean;
  clearActiveSession: () => void;
  currentTrack: EduMusicTrack;
  selectedPlaylist: EduMusicPlaylist;
  selectedPlaylistId: string;
  setSelectedPlaylistId: (id: string) => void;
  playlists: EduMusicPlaylist[];
  userPlaylists: EduMusicPlaylist[];
  onlineTracks: EduMusicTrack[];
  uploadedTracks: EduMusicTrack[];
  recentTracks: EduMusicTrack[];
  audioUploadLoading: boolean;
  audioUploadError: string;
  uploadAudios: (files: File[]) => Promise<void>;
  refreshUploadedAudios: () => Promise<void>;
  visibleTracks: EduMusicTrack[];
  baseTracks: EduMusicTrack[];
  allTracks: EduMusicTrack[];
  liked: Set<string>;
  favoriteSyncStatus: "local" | "syncing" | "synced";
  favoriteTracks: EduMusicTrack[];
  favoriteSession: boolean;
  startFavorites: () => void;
  mixFavoriteActive: boolean;
  mixFavoriteLoading: boolean;
  mixFavoriteError: string;
  mixFavoriteArtists: string[];
  mixFavoriteLearnedCount: number;
  mixFavoriteTracks: EduMusicTrack[];
  startMixFavorite: () => void;
  stopMixFavorite: () => void;
  loadMoreMixFavorite: () => void;
  createOpen: boolean;
  setCreateOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  newPlaylistName: string;
  setNewPlaylistName: (value: string) => void;
  pendingTrackId: string | null;
  setPendingTrackId: (id: string | null) => void;
  queue: EduMusicTrack[];
  queueIds: string[];
  shuffle: boolean;
  setShuffle: (value: boolean | ((prev: boolean) => boolean)) => void;
  repeat: RepeatMode;
  setRepeat: (value: RepeatMode) => void;
  playTrack: (track: EduMusicTrack, queueFrom?: EduMusicTrack[]) => void;
  playPlaylist: (playlistId?: string) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLike: (id: string) => void;
  createPlaylist: () => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;
  requestAddToPlaylist: (trackId: string) => void;
  addToQueue: (trackId: string) => void;
  clearQueue: () => void;
  currentTime: number;
  durationSeconds: number;
  seekTo: (seconds: number) => void;
  searchOnline: (term?: string, providerOverride?: OnlineProviderMode) => Promise<void>;
  clearOnlineResults: () => void;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    Hls?: any;
  }
}

const STORAGE_KEY = "eduai_music_player_v60";
const FAVORITES_RECOVERY_VERSION = "eduai_music_favorites_recovered_v1";
const FAVORITES_BACKUP_KEY = "eduai_music_favorites_backup_v1";
const FAVORITES_CLOUD_TABLE = "eduai_music_favorites";
const FAVORITES_IMPORT_PREFIX = "eduai_music_favorites_imported_v1_";
const FAVORITES_LEGACY_OWNER_KEY = "eduai_music_favorites_legacy_owner_v1";
const FAVORITES_PENDING_PREFIX = "eduai_music_favorites_pending_v1_";
const MUSIC_STORAGE_BUCKET = "multimedia-projects";
const MUSIC_LIBRARY_FOLDER = "music-library";
const MIX_FAVORITE_TABLE = "eduai_music_mix_profiles";
const MIX_LOCAL_PREFIX = "eduai_music_mix_favorite_v1_";
const EMPTY_MUSIC_TRACK: EduMusicTrack = {
  id: "eduai-music-empty",
  title: "Elige una canción",
  artist: "YouTube · Spotify · Radio · Mis audios",
  album: "Busca música real para comenzar",
  mood: "creative",
  duration: "--:--",
  src: "",
  cover: "linear-gradient(135deg,#06121f,#102a43 48%,#43145f)",
  tags: ["música", "fuentes reales"],
  source: "external",
};
export const YOUTUBE_PLAYER_ID = "eduai-youtube-global-player";
const MusicContext = createContext<MusicContextValue | null>(null);

let youtubeApiPromise: Promise<void> | null = null;
let hlsScriptPromise: Promise<void> | null = null;

function parseStoredState(value: string | null): StoredState {
  if (!value) return {};
  try {
    const result = JSON.parse(value);
    return result && typeof result === "object" && !Array.isArray(result) ? result as StoredState : {};
  } catch {
    return {};
  }
}

function safeFavoriteTrack(track: unknown): EduMusicTrack | null {
  if (!track || typeof track !== "object") return null;
  const value = track as Partial<EduMusicTrack>;
  if (typeof value.id !== "string" || !value.id || typeof value.title !== "string") return null;
  return {
    ...value,
    id: value.id,
    title: value.title,
    artist: typeof value.artist === "string" ? value.artist : "Artista desconocido",
    album: typeof value.album === "string" ? value.album : "Canción guardada",
    mood: value.mood || "creative",
    duration: typeof value.duration === "string" ? value.duration : "--:--",
    src: typeof value.src === "string" ? value.src : "",
    cover: typeof value.cover === "string" ? value.cover : "",
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
  } as EduMusicTrack;
}

function fallbackFavoriteTrack(id: string): EduMusicTrack {
  // Canciones antiguas podían guardar solo el ID, sin título ni metadatos.
  // Reconstruimos el enlace y portada sin inventar el nombre del video.
  const match = /^youtube-([A-Za-z0-9_-]{11})$/.exec(id);
  const videoId = match?.[1];
  return {
    id, title: videoId ? "Vídeo guardado de YouTube" : "Canción guardada",
    artist: "Metadatos no disponibles", album: "Favorito recuperado",
    mood: "creative", duration: "--:--", src: "",
    cover: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "linear-gradient(135deg,#06121f,#43145f)",
    artworkUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
    videoThumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
    youtubeVideoId: videoId,
    externalUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
    source: videoId ? "youtube" : id.startsWith("radio-") ? "radio" : "external", tags: ["favorito", "recuperado"],
  };
}

function safeReadState(): StoredState {
  if (typeof window === "undefined") return {};
  const storage = window.localStorage;
  const current = parseStoredState(storage.getItem(STORAGE_KEY));
  if (storage.getItem(FAVORITES_RECOVERY_VERSION) === "1") return current;

  // El cambio de versiones no debe ocultar favoritos guardados previamente.
  const prior: StoredState[] = [parseStoredState(storage.getItem(FAVORITES_BACKUP_KEY)), current];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("eduai_music_player_v") && key !== STORAGE_KEY) {
      prior.push(parseStoredState(storage.getItem(key)));
    }
  }

  const ids = unique(prior.flatMap((state) => [
    ...(Array.isArray(state.likedTrackIds) ? state.likedTrackIds.filter((id): id is string => typeof id === "string") : []),
    ...(Array.isArray(state.likedTracks) ? state.likedTracks.map((track) => track?.id).filter((id): id is string => typeof id === "string") : []),
  ]));
  const tracks = new Map<string, EduMusicTrack>();
  for (const state of prior) {
    for (const track of [...(state.onlineTracks || []), ...(state.likedTracks || [])]) {
      const safe = safeFavoriteTrack(track);
      if (safe && ids.includes(safe.id)) tracks.set(safe.id, sanitizeStoredTrack(safe));
    }
  }
  const recovered = {
    ...current,
    likedTrackIds: ids,
    likedTracks: ids.map((id) => tracks.get(id) || fallbackFavoriteTrack(id)),
  };
  // Archivo de respaldo local: nunca borrar favoritos antiguos para migrarlos.
  try {
    storage.setItem(FAVORITES_BACKUP_KEY, JSON.stringify({
      likedTrackIds: recovered.likedTrackIds,
      likedTracks: recovered.likedTracks,
    }));
    storage.setItem(FAVORITES_RECOVERY_VERSION, "1");
  } catch {}
  return recovered;
}

type PendingFavoriteChange = { op: "add" | "remove"; trackId: string; track?: EduMusicTrack };

function pendingKey(userId: string) { return `${FAVORITES_PENDING_PREFIX}${userId}`; }
function readPending(userId: string): PendingFavoriteChange[] {
  try {
    const raw = JSON.parse(localStorage.getItem(pendingKey(userId)) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is PendingFavoriteChange =>
      x?.trackId && (x.op === "add" || x.op === "remove")) : [];
  } catch { return []; }
}


function unique(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function safeAudioStorageName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "audio";
}

function uploadedTrackTitle(name: string) {
  return name
    .replace(/^\d{10,}-/, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "Audio subido";
}

function isHlsUrl(src?: string) {
  return Boolean(src && /\.m3u8(\?|$)/i.test(src));
}

function isBlockedBrowserAudioSrc(src?: string) {
  const clean = String(src || "").trim();
  if (!clean) return false;
  // La app corre en HTTPS. Estos streams producen mixed content, certificados inválidos
  // o errores como NET::ERR_CERT_COMMON_NAME_INVALID en el navegador.
  return /^http:\/\//i.test(clean) || /sonando\.us\.digitalproserver\.com/i.test(clean);
}

function parseDurationSeconds(duration?: string) {
  if (!duration || /vivo|video/i.test(duration)) return 0;
  const parts = duration.split(":").map((part) => Number(part));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return 0;
  return Math.max(0, parts[0] * 60 + parts[1]);
}

function isFmdosTrack(track?: EduMusicTrack | null) {
  const text = `${track?.id || ""} ${track?.title || ""} ${track?.artist || ""}`.toLowerCase();
  return text.includes("fmdos") || text.includes("fm dos") || text.includes("fm2");
}

function radioSources(track: EduMusicTrack, catalog: EduMusicTrack[]) {
  if (!isRadioTrack(track)) return [];
  const related = isFmdosTrack(track) ? catalog.filter((item) => isRadioTrack(item) && isFmdosTrack(item)) : [];
  const direct = isFmdosTrack(track) ? [
    "https://playerservices.streamtheworld.com/api/livestream-redirect/FMDOSAAC_SC.aac",
    "https://playerservices.streamtheworld.com/api/livestream-redirect/FMDOSAAC_SC.m3u8",
  ] : [];
  return unique([track.src, ...(asExtendedTrack(track)?.radioStreams || []), ...related.flatMap((item) => [item.src, ...(asExtendedTrack(item)?.radioStreams || [])]), ...direct])
    .filter((src) => /^https:\/\//i.test(src) && !isBlockedBrowserAudioSrc(src));
}
function sanitizeStoredTrack(track: EduMusicTrack): EduMusicTrack {
  if (track.source !== "radio" || !isBlockedBrowserAudioSrc(track.src)) return track;

  return {
    ...track,
    src: "",
    album: "Señal externa no reproducible directamente",
    playable: false,
    externalOnly: true,
    externalUrl: track.externalUrl || "https://www.canal95.cl/",
  } as EduMusicTrack;
}

function asExtendedTrack(track?: EduMusicTrack | null): ExtendedEduMusicTrack | null {
  return (track || null) as ExtendedEduMusicTrack | null;
}

function isEmbedTrack(track?: EduMusicTrack | null) {
  return Boolean(asExtendedTrack(track)?.embedOnly);
}

function trackExternalUrl(track?: EduMusicTrack | null) {
  return asExtendedTrack(track)?.externalUrl || asExtendedTrack(track)?.embedUrl || "";
}

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const script = existing || document.createElement("script");
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("error", fail);
      script.remove();
      youtubeApiPromise = null;
      reject(new Error("No se pudo cargar el reproductor de YouTube"));
    };
    const timeout = window.setTimeout(fail, 12000);
    window.onYouTubeIframeAPIReady = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("error", fail);
      resolve();
    };
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function loadHlsScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Hls) return Promise.resolve();
  if (hlsScriptPromise) return hlsScriptPromise;

  hlsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.jsdelivr.net/npm/hls.js@latest"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar hls.js")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar hls.js"));
    document.head.appendChild(script);
  });

  return hlsScriptPromise;
}

function trackArtwork(track: EduMusicTrack) {
  return track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);
}

function canAutoPlay(track: EduMusicTrack, failed: ReadonlySet<string>) {
  if (asExtendedTrack(track)?.externalOnly || isEmbedTrack(track) || failed.has(track.id)) return false;
  if (track.source === "youtube") return Boolean(track.youtubeVideoId && !failed.has(track.youtubeVideoId));
  return Boolean(track.src && !isBlockedBrowserAudioSrc(track.src));
}

function isYouTubeQueueTrack(track?: EduMusicTrack | null) {
  return track?.source === "youtube";
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeReadyRef = useRef(false);
  const youtubeVideoIdRef = useRef<string>("");
  const currentYouTubeTrackRef = useRef<EduMusicTrack>(EMPTY_MUSIC_TRACK);
  const volumeRef = useRef(0.62);
  // YouTube emite ENDED, PAUSED y a veces ERROR durante un mismo cambio de
  // clip. Este candado evita que esos eventos atrasados avancen dos o más
  // canciones de la cola DJ.
  const youtubeTransitionUntilRef = useRef(0);
  const playingRef = useRef(false);
  const hlsRef = useRef<any>(null);
  const radioReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radioRecoveryRef = useRef<() => void>(() => {});
  const [radioAttempt, setRadioAttempt] = useState({ trackId: "", step: 0, generation: 0 });
  const radioExhaustedRef = useRef<string | null>(null);
  const [radioResults, setRadioResults] = useState<EduMusicTrack[] | null>(null);
  const nextTrackRef = useRef<(reason?: "ended" | "error") => void>(() => {});
  const failedPlaybackRef = useRef(new Set<string>());
  const shuffledPlayedRef = useRef(new Set<string>());
  const playbackHistoryRef = useRef<string[]>([]);
  const autoAdvanceRef = useRef<string | undefined>(undefined);
  const radioInitialRequestRef = useRef(false);
  const radioRequestPendingRef = useRef(false);
  const onlineSearchAbortRef = useRef<AbortController | null>(null);
  const onlineSearchRequestRef = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [view, setViewState] = useState<MusicView>("home");
  const viewRef = useRef<MusicView>("home");
  const [query, setQuery] = useState("");
  const [onlineQuery, setOnlineQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineProviderMode, setOnlineProviderMode] = useState<OnlineProviderMode>("youtube");
  const [radioQuery, setRadioQuery] = useState("Chile");
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState("");
  const [selectedMood, setSelectedMood] = useState<EduMusicMood | "all">("all");
  const [volume, setVolume] = useState(0.62);
  const [playing, setPlaying] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [currentId, setCurrentId] = useState<string | undefined>(undefined);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("pl-radio");
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([]);
  const [likedTrackSnapshots, setLikedTrackSnapshots] = useState<EduMusicTrack[]>([]);
  const [failedYouTubeIds, setFailedYouTubeIds] = useState<string[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<EduMusicPlaylist[]>([]);
  const [onlineTracks, setOnlineTracks] = useState<EduMusicTrack[]>([]);
  const [uploadedTracks, setUploadedTracks] = useState<EduMusicTrack[]>([]);
  const [audioUploadLoading, setAudioUploadLoading] = useState(false);
  const [audioUploadError, setAudioUploadError] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [favoriteSession, setFavoriteSession] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const setView = useCallback((value: MusicView) => {
    if (value === "liked" && viewRef.current !== "liked") {
      setShuffle(true);
      setRepeat("all");
    }
    viewRef.current = value;
    setViewState(value);
  }, []);
  useEffect(() => { shuffledPlayedRef.current.clear(); }, [shuffle]);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const favoriteCloudUserRef = useRef<string | null>(null);
  const favoriteCloudFlushingRef = useRef(false);
  const favoriteLocalRevisionRef = useRef(0);
  const [favoriteSyncStatus, setFavoriteSyncStatus] = useState<"local" | "syncing" | "synced">("local");
  const [mixFavoriteActive, setMixFavoriteActive] = useState(false);
  const [mixFavoriteLoading, setMixFavoriteLoading] = useState(false);
  const [mixFavoriteError, setMixFavoriteError] = useState("");
  const [mixLearnedSongs, setMixLearnedSongs] = useState<MixSong[]>([]);
  const [mixArtists, setMixArtists] = useState<string[]>([]);
  const [mixQueueTracks, setMixQueueTracks] = useState<EduMusicTrack[]>([]);
  const [mixProfileReady, setMixProfileReady] = useState(false);
  const mixProfileUserRef = useRef<string | null>(null);
  const mixLoadSequenceRef = useRef(0);
  const mixSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mixRefillPendingRef = useRef(false);
  const mixAdvancePendingRef = useRef(false);
  const mixActiveRef = useRef(false);
  const mixCurrentQueueRef = useRef<EduMusicTrack[]>([]);
  const mixSeenRef = useRef(new Set<string>());
  const mixRefillTriggerRef = useRef("");
  const mixInitialPrefetchRef = useRef(0);
  useEffect(() => { mixActiveRef.current = mixFavoriteActive; }, [mixFavoriteActive]);
  useEffect(() => { mixCurrentQueueRef.current = mixQueueTracks; }, [mixQueueTracks]);

  const flushFavoriteChanges = useCallback(async (userId: string) => {
    if (favoriteCloudFlushingRef.current) return false;
    favoriteCloudFlushingRef.current = true;
    try {
      while (true) {
        const pending = readPending(userId);
        if (!pending.length) break;
        const change = pending[0];
        const request = change.op === "add"
          ? supabase.from(FAVORITES_CLOUD_TABLE).upsert({
              user_id: userId, track_id: change.trackId,
              track: change.track || fallbackFavoriteTrack(change.trackId),
            }, { onConflict: "user_id,track_id" })
          : supabase.from(FAVORITES_CLOUD_TABLE).delete()
              .eq("user_id", userId).eq("track_id", change.trackId);
        const { error } = await request;
        if (error) return false;
        // No perder un nuevo clic que se haya encolado durante la petición.
        const latest = readPending(userId);
        if (latest[0]?.trackId === change.trackId && latest[0]?.op === change.op) {
          latest.shift();
          localStorage.setItem(pendingKey(userId), JSON.stringify(latest));
        }
      }
      return true;
    } catch { return false; }
    finally { favoriteCloudFlushingRef.current = false; }
  }, [supabase]);

  const queueFavoriteChange = useCallback((change: PendingFavoriteChange) => {
    favoriteLocalRevisionRef.current += 1;
    if (typeof window === "undefined") return;
    const persistChange = (userId: string) => {
      try {
        const pending = readPending(userId);
        pending.push(change);
        localStorage.setItem(pendingKey(userId), JSON.stringify(pending));
        setFavoriteSyncStatus("syncing");
        void flushFavoriteChanges(userId).then((success) => {
          setFavoriteSyncStatus(success ? "synced" : "local");
        });
      } catch {
        setFavoriteSyncStatus("local");
      }
    };

    const knownUser = favoriteCloudUserRef.current;
    if (knownUser) {
      persistChange(knownUser);
    } else {
      // Guardar cambios durante la primera autenticación sin perder el clic.
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          favoriteCloudUserRef.current = data.user.id;
          persistChange(data.user.id);
        } else {
          setFavoriteSyncStatus("local");
        }
      }).catch(() => setFavoriteSyncStatus("local"));
    }
  }, [flushFavoriteChanges, supabase]);

  const refreshUploadedAudios = useCallback(async () => {
    setAudioUploadLoading(true);
    setAudioUploadError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setUploadedTracks([]);
        if (authError) setAudioUploadError("Inicia sesión para usar Mis audios en la nube.");
        return;
      }

      const prefix = `${authData.user.id}/${MUSIC_LIBRARY_FOLDER}`;
      const { data, error } = await supabase.storage
        .from(MUSIC_STORAGE_BUCKET)
        .list(prefix, { limit: 500, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;

      const tracks = await Promise.all(
        (data || [])
          .filter((item) => item.name && item.id)
          .map(async (item): Promise<EduMusicTrack | null> => {
            const path = `${prefix}/${item.name}`;
            const { data: signed, error: signedError } = await supabase.storage
              .from(MUSIC_STORAGE_BUCKET)
              .createSignedUrl(path, 60 * 60 * 6);
            if (signedError || !signed?.signedUrl) return null;
            return {
              id: `uploaded-${item.id || item.name}`,
              title: uploadedTrackTitle(item.name),
              artist: "Mis audios",
              album: "Biblioteca personal",
              mood: "creative" as const,
              duration: "--:--",
              src: signed.signedUrl,
              cover: "linear-gradient(135deg,#25f4ff,#9b6cff,#ff42cf)",
              tags: ["mis audios", "subido", "personal"],
              source: "external" as const,
              externalUrl: signed.signedUrl,
            } satisfies EduMusicTrack;
          }),
      );
      setUploadedTracks(tracks.filter((track): track is EduMusicTrack => track !== null));
    } catch (error) {
      setAudioUploadError(error instanceof Error ? error.message : "No se pudieron cargar tus audios.");
    } finally {
      setAudioUploadLoading(false);
    }
  }, [supabase]);

  const uploadAudios = useCallback(async (files: File[]) => {
    const accepted = files.filter((file) =>
      file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name),
    );
    if (!accepted.length) {
      setAudioUploadError("Selecciona archivos de audio MP3, WAV, M4A, AAC, OGG o FLAC.");
      return;
    }

    setAudioUploadLoading(true);
    setAudioUploadError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Inicia sesión para subir audio a tu biblioteca.");
      const prefix = `${authData.user.id}/${MUSIC_LIBRARY_FOLDER}`;
      for (const file of accepted) {
        const path = `${prefix}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeAudioStorageName(file.name)}`;
        const { error } = await supabase.storage.from(MUSIC_STORAGE_BUCKET).upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
          cacheControl: "3600",
        });
        if (error) throw error;
      }
      await refreshUploadedAudios();
    } catch (error) {
      setAudioUploadError(error instanceof Error ? error.message : "No se pudieron subir los audios.");
    } finally {
      setAudioUploadLoading(false);
    }
  }, [refreshUploadedAudios, supabase]);

  useEffect(() => {
    void refreshUploadedAudios();
  }, [refreshUploadedAudios]);

  const allTracks = useMemo(() => {
    const byId = new Map<string, EduMusicTrack>();
    [
      ...EDU_MUSIC_TRACKS.filter((track) => track.source !== "eduai"),
      ...likedTrackSnapshots,
      ...onlineTracks,
      ...uploadedTracks,
      ...mixQueueTracks,
      ...(radioResults || []),
    ].forEach((track) => {
      byId.set(track.id, track);
    });
    for (const id of likedTrackIds) {
      if (!byId.has(id)) byId.set(id, fallbackFavoriteTrack(id));
    }
    return Array.from(byId.values());
  }, [likedTrackIds, likedTrackSnapshots, onlineTracks, uploadedTracks, mixQueueTracks, radioResults]);

  const radioTracks = useMemo(
    () => radioResults ?? allTracks.filter(isRadioTrack),
    [allTracks, radioResults],
  );

  const getTrack = useCallback(
    (id?: string) => allTracks.find((track) => track.id === id),
    [allTracks],
  );

  useEffect(() => {
    const stored = safeReadState();
    if (stored.volume !== undefined) setVolume(stored.volume);
    if (stored.trackId) setCurrentId(stored.trackId);
    if (stored.playlistId) setSelectedPlaylistId(stored.playlistId);
    if (stored.likedTrackIds) setLikedTrackIds(stored.likedTrackIds);
    if (stored.likedTracks?.length) {
      setLikedTrackSnapshots(stored.likedTracks.map(sanitizeStoredTrack).slice(0, 2000));
    } else if (stored.likedTrackIds?.length && stored.onlineTracks?.length) {
      const likedIds = new Set(stored.likedTrackIds);
      setLikedTrackSnapshots(
        stored.onlineTracks
          .map(sanitizeStoredTrack)
          .filter((track) => likedIds.has(track.id))
          .slice(0, 2000),
      );
    }
    if (stored.userPlaylists) setUserPlaylists(stored.userPlaylists);
    if (stored.onlineTracks?.length) {
      setOnlineTracks(stored.onlineTracks.map(sanitizeStoredTrack).slice(0, 120));
    }
    if (stored.onlineQuery) setOnlineQuery(stored.onlineQuery);
    if (stored.recentSearches?.length) {
      setRecentSearches(
        unique(
          stored.recentSearches
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ).slice(0, 8),
      );
    }
    if (stored.queueIds) setQueueIds(stored.queueIds);
    if (stored.recentIds) setRecentIds(stored.recentIds.filter((id) => !id.startsWith("edu-")).slice(0, 18));
    setOnlineProviderMode("youtube");
    if (stored.view) {
      viewRef.current = stored.view;
      setViewState(stored.view);
    }
    if (stored.shuffle !== undefined) setShuffle(stored.shuffle);
    else if (stored.view === "liked") setShuffle(true);
    setFavoriteSession(!stored.trackId?.startsWith("radio-") && (stored.favoriteSession ?? Boolean(stored.view === "liked" && stored.likedTrackIds?.includes(stored.trackId || ""))));
    if (stored.repeat) setRepeat(stored.repeat);
    if (stored.hasActiveSession) setHasActiveSession(true);
    setHydrated(true);
  }, []);

  // Migra una sola vez la biblioteca local anterior y, después, utiliza la
  // copia privada por usuario en Supabase. Si la tabla aún no existe,
  // conservamos intacta la copia local (sin sobrescribirla con una lista vacía).
  const syncCloudFavorites = useCallback(async () => {
    if (!hydrated || typeof window === "undefined") return;
    setFavoriteSyncStatus("syncing");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) { setFavoriteSyncStatus("local"); return; }
      favoriteCloudUserRef.current = userId;
      const revisionAtStart = favoriteLocalRevisionRef.current;

      const { data: remote, error } = await supabase
        .from(FAVORITES_CLOUD_TABLE).select("track_id,track").eq("user_id", userId).order("created_at", { ascending: true }).order("track_id").limit(2000);
      if (error) { setFavoriteSyncStatus("local"); return; }

      const importKey = `${FAVORITES_IMPORT_PREFIX}${userId}`;
      const local = safeReadState();
      const imported = localStorage.getItem(importKey) === "1";
      const existingLegacyOwner = localStorage.getItem(FAVORITES_LEGACY_OWNER_KEY);
      // La biblioteca local anterior no identificaba al propietario:
      // solo puede importarse a la primera cuenta asociada a este navegador.
      if (!imported && (!existingLegacyOwner || existingLegacyOwner === userId)) {
        const storedIds = local.likedTrackIds || [];
        const storedTracks = new Map((local.likedTracks || []).map((track) => [track.id, track]));
        const rows = storedIds
          .filter((id) => typeof id === "string" && id)
          .filter((id) => !remote?.some((row) => row.track_id === id))
          .map((id) => ({ user_id: userId, track_id: id, track: storedTracks.get(id) || fallbackFavoriteTrack(id) }));
        if (rows.length) {
          const { error: importError } = await supabase.from(FAVORITES_CLOUD_TABLE)
            .upsert(rows, { onConflict: "user_id,track_id" });
          if (importError) { setFavoriteSyncStatus("local"); return; }
        }
        localStorage.setItem(importKey, "1");
        if (!existingLegacyOwner) localStorage.setItem(FAVORITES_LEGACY_OWNER_KEY, userId);
      } else if (!imported && existingLegacyOwner !== userId) {
        // No transferir canciones privadas de una cuenta a otra.
        localStorage.setItem(importKey, "1");
      }

      if (!(await flushFavoriteChanges(userId))) {
        setFavoriteSyncStatus("local");
        return;
      }
      const { data: saved, error: refreshError } = await supabase
        .from(FAVORITES_CLOUD_TABLE).select("track_id,track").eq("user_id", userId).order("created_at", { ascending: true }).order("track_id").limit(2000);
      if (refreshError) { setFavoriteSyncStatus("local"); return; }

      // Si hubo clics durante la carga, no sustituir el estado más reciente.
      const remoteRows = saved || [];
      if (favoriteLocalRevisionRef.current !== revisionAtStart) {
        // Un clic mientras se cargaba la biblioteca tiene prioridad
        // sobre los resultados anteriores de la nube.
        setFavoriteSyncStatus(readPending(userId).length ? "syncing" : "synced");
        return;
      }
      const ids = unique(remoteRows.map((row) => row.track_id).filter(Boolean));
      const tracks = remoteRows.map((row) =>
        sanitizeStoredTrack(safeFavoriteTrack(row.track) || fallbackFavoriteTrack(row.track_id)));
      setLikedTrackIds(ids);
      setLikedTrackSnapshots(tracks);
      setFavoriteSyncStatus("synced");
    } catch {
      setFavoriteSyncStatus("local");
    }
  }, [flushFavoriteChanges, hydrated, supabase]);

  useEffect(() => {
    if (!hydrated) return;
    void syncCloudFavorites();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncCloudFavorites();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrated, syncCloudFavorites]);


  // Perfil privado por usuario. El historial del invitado nunca se importa a
  // una cuenta distinta. Los favoritos existentes se mantienen intactos.
  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;
    const load = async (userId: string | null) => {
      const sequence = ++mixLoadSequenceRef.current;
      if (userId === mixProfileUserRef.current && mixProfileReady) return;
      if (userId !== mixProfileUserRef.current) {
        mixActiveRef.current = false;
        mixAdvancePendingRef.current = false;
        setMixFavoriteActive(false);
        setMixQueueTracks([]);
        mixCurrentQueueRef.current = [];
        setCurrentId(undefined);
        setPlaying(false);
      }
      setMixProfileReady(false);
      mixProfileUserRef.current = userId;
      let saved: { artists?: string[]; tracks?: MixSong[] } = {};
      try { saved = JSON.parse(localStorage.getItem(MIX_LOCAL_PREFIX + (userId || "guest")) || "{}"); } catch {}
      let artists = Array.isArray(saved.artists) ? saved.artists : [];
      let tracks = Array.isArray(saved.tracks) ? saved.tracks : [];
      if (userId) {
        const { data, error } = await supabase.from(MIX_FAVORITE_TABLE)
          .select("artists,tracks").eq("user_id", userId).maybeSingle();
        if (!error && data) {
          artists = [...artists, ...(Array.isArray(data.artists) ? data.artists : [])];
          tracks = [...tracks, ...(Array.isArray(data.tracks) ? data.tracks : [])];
        }
      }
      if (!mounted || sequence !== mixLoadSequenceRef.current) return;
      setMixArtists(Array.from(new Map(artists.filter((a): a is string =>
        typeof a === "string" && a.length > 1).map((a): [string, string] => [normalizeArtist(a), a])).values()).slice(-1000));
      setMixLearnedSongs(Array.from(new Map(tracks.filter((v): v is MixSong =>
        typeof v?.artist === "string" && typeof v?.title === "string" && !!v.artist && !!v.title)
        .map((v): [string, MixSong] => [mixSongKey(v), v])).values()).slice(-1500));
      setMixProfileReady(true);
    };
    void supabase.auth.getUser().then(({ data }) => load(data.user?.id || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user?.id || null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, supabase]);

  useEffect(() => {
    if (!hydrated || !mixProfileReady) return;
    const userId = mixProfileUserRef.current;
    const profile = { artists: mixArtists.slice(-1000), tracks: mixLearnedSongs.slice(-1500) };
    try { localStorage.setItem(MIX_LOCAL_PREFIX + (userId || "guest"), JSON.stringify(profile)); } catch {}
    if (mixSyncTimerRef.current) clearTimeout(mixSyncTimerRef.current);
    if (!userId) return;
    mixSyncTimerRef.current = setTimeout(() => {
      void supabase.from(MIX_FAVORITE_TABLE).upsert({
        user_id: userId, ...profile, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" }).then(({ error }) => {
        if (error) console.warn("[EDUAI Music] El mix se conserva local hasta sincronizar:", error.message);
      });
    }, 1200);
    return () => { if (mixSyncTimerRef.current) clearTimeout(mixSyncTimerRef.current); };
  }, [hydrated, mixProfileReady, mixArtists, mixLearnedSongs, supabase]);

  // Aprende resultados de búsqueda y, con prioridad, canciones realmente
  // reproducidas, incluyendo el avance automático entre videos de YouTube.
  const learnMixTracks = useCallback((tracks: EduMusicTrack[], options?: {
    origin?: "search" | "played" | "discovered"; query?: string;
  }) => {
    if (!mixProfileReady) return;
    const origin = options?.origin || "discovered";
    const songs = tracks.map((track) => inferredMixSong(track, options?.query))
      .filter((song): song is MixSong => Boolean(song))
      .map((song) => ({ ...song, origin }));
    if (!songs.length) return;
    setMixArtists((prev) => {
      const byArtist = new Map(prev.map((artist): [string, string] => [normalizeArtist(artist), artist]));
      let added = false;
      for (const song of songs) {
        const key = normalizeArtist(song.artist);
        if (!byArtist.has(key)) { byArtist.set(key, song.artist); added = true; }
      }
      return added ? [...byArtist.values()].slice(-1000) : prev;
    });
    setMixLearnedSongs((prev) => {
      const bySong = new Map(prev.map((song): [string, MixSong] => [mixSongKey(song), song]));
      let changed = false;
      for (const song of songs) {
        const key = mixSongKey(song);
        const existing = bySong.get(key);
        // Una búsqueda posterior nunca degrada una pista reproducida.
        const merged = existing && existing.origin === "played" && origin !== "played"
          ? { ...song, ...existing, origin: "played" as const }
          : { ...existing, ...song };
        if (existing && existing.youtubeVideoId === merged.youtubeVideoId &&
            existing.origin === merged.origin && existing.artworkUrl === merged.artworkUrl) continue;
        bySong.delete(key);
        bySong.set(key, merged);
        changed = true;
      }
      return changed ? [...bySong.values()].slice(-1500) : prev;
    });
  }, [mixProfileReady]);
  const learnMixTracksRef = useRef(learnMixTracks);
  useEffect(() => { learnMixTracksRef.current = learnMixTracks; }, [learnMixTracks]);

  const savedTracks = useMemo(() => likedTrackIds.map((id) => getTrack(id) || fallbackFavoriteTrack(id)), [getTrack, likedTrackIds]);
  const favoriteTracks = useMemo(() => savedTracks.filter((track) => !isRadioTrack(track)), [savedTracks]);
  const radioFavoriteTracks = useMemo(() => savedTracks.filter(isRadioTrack), [savedTracks]);
  const musicFavoriteIds = useMemo(() => favoriteTracks.map((track) => track.id), [favoriteTracks]);

  const playlists = useMemo(() => {
    const likedPlaylist: EduMusicPlaylist = {
      id: "pl-liked",
      name: "Tus me gusta",
      description: "Canciones guardadas por ti.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#fee2e2,#bfdbfe)",
      trackIds: musicFavoriteIds,
      system: true,
    };
    const onlinePlaylist: EduMusicPlaylist = {
      id: "pl-online",
      name: "Resultados online",
      description: "Canciones y videos encontrados desde fuentes externas.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#e0f2fe,#ddd6fe)",
      trackIds: onlineTracks.filter((track) => !isRadioTrack(track)).map((track) => track.id),
      system: true,
    };
    const libraryPlaylist: EduMusicPlaylist = {
      id: "pl-library",
      name: "Mis audios",
      description: "Archivos de audio subidos por ti.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#25f4ff,#9b6cff,#ff42cf)",
      trackIds: uploadedTracks.map((track) => track.id),
      system: true,
    };
    const radioPlaylist: EduMusicPlaylist = {
      id: "pl-radio",
      name: "Radios online",
      description: "Emisoras online reproducibles dentro de EduAI Music.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#bbf7d0,#14b8a6)",
      trackIds: radioTracks.map((track) => track.id),
      system: true,
    };
    return [libraryPlaylist, radioPlaylist, onlinePlaylist, likedPlaylist, ...userPlaylists];
  }, [musicFavoriteIds, onlineTracks, radioTracks, uploadedTracks, userPlaylists]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0],
    [playlists, selectedPlaylistId],
  );

  const baseTracks = useMemo(
    () => getTracksForPlaylist(selectedPlaylist, allTracks),
    [allTracks, selectedPlaylist],
  );

  const currentTrack = useMemo(
    () => getTrack(currentId) ?? EMPTY_MUSIC_TRACK,
    [currentId, getTrack],
  );

  const streamSourceKey = JSON.stringify(radioSources(currentTrack, allTracks));
  const streamSources = useMemo(() => JSON.parse(streamSourceKey) as string[], [streamSourceKey]);
  const streamStep = radioAttempt.trackId === currentTrack.id ? radioAttempt.step : 0;
  const streamGeneration = radioAttempt.trackId === currentTrack.id ? radioAttempt.generation : 0;
  const effectiveSrc = currentTrack.source === "radio" ? streamSources[Math.floor(streamStep / 2)] || currentTrack.src : currentTrack.src;
  useEffect(() => {
    currentYouTubeTrackRef.current = currentTrack;
  }, [currentTrack]);
  useEffect(() => { autoAdvanceRef.current = undefined; }, [currentId]);


  const recentTracks = useMemo(
    () => recentIds.map((id) => getTrack(id)).filter(Boolean) as EduMusicTrack[],
    [getTrack, recentIds],
  );

  const liked = useMemo(() => new Set(likedTrackIds), [likedTrackIds]);

  const queue = useMemo(
    () => favoriteSession ? favoriteTracks : queueIds.map((id) => getTrack(id)).filter(Boolean) as EduMusicTrack[],
    [favoriteSession, favoriteTracks, getTrack, queueIds],
  );
  useEffect(() => {
    if (favoriteSession) setQueueIds((prev) => prev.length === musicFavoriteIds.length && prev.every((id, i) => id === musicFavoriteIds[i]) ? prev : [...musicFavoriteIds]);
  }, [favoriteSession, musicFavoriteIds]);

  const visibleTracks = useMemo(() => {
    const q = view === "mix" ? "" : query.trim().toLowerCase();
    const source = view === "liked"
      ? favoriteTracks
      : view === "mix"
      ? mixQueueTracks
      : view === "radio"
      ? radioTracks
      : view === "library"
        ? uploadedTracks
        : view === "search" || q
          ? allTracks
          : baseTracks;
    return source.filter((track) => {
      const moodOk = view === "radio" || view === "mix" || selectedMood === "all" || track.mood === selectedMood;
      const queryOk =
        !q ||
        [track.title, track.artist, track.album, track.mood, track.source || "", ...track.tags]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return moodOk && queryOk;
    });
  }, [allTracks, baseTracks, favoriteTracks, query, radioTracks, selectedMood, uploadedTracks, mixQueueTracks, view]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const state: StoredState = {
      trackId: currentId,
      playlistId: selectedPlaylistId,
      volume,
      likedTrackIds,
      likedTracks: likedTrackSnapshots.slice(0, 2000),
      userPlaylists,
      onlineTracks: [...onlineTracks.filter((track) => !isRadioTrack(track)).slice(0, 60), ...onlineTracks.filter(isRadioTrack).slice(-60)],
      onlineQuery,
      recentSearches,
      onlineProviderMode: onlineProviderMode === "youtube" ? "full" : onlineProviderMode,
      recentIds,
      queueIds,
      view,
      shuffle,
      repeat,
      hasActiveSession,
      favoriteSession,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(FAVORITES_BACKUP_KEY, JSON.stringify({
        likedTrackIds, likedTracks: likedTrackSnapshots.slice(0, 2000),
      }));
    } catch (error) {
      console.warn("[EDUAI Music] No se pudo guardar favoritos en navegador", error);
    }
  }, [
    hydrated,
    currentId,
    selectedPlaylistId,
    volume,
    likedTrackIds,
    likedTrackSnapshots,
    userPlaylists,
    onlineTracks,
    onlineQuery,
    recentSearches,
    onlineProviderMode,
    recentIds,
    queueIds,
    view,
    shuffle,
    repeat,
    hasActiveSession,
    favoriteSession,
  ]);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
    if (youtubePlayerRef.current?.setVolume) {
      try {
        youtubePlayerRef.current.setVolume(Math.round(volume * 100));
      } catch {}
    }
  }, [volume]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    if (!playing && radioReconnectTimerRef.current) { clearTimeout(radioReconnectTimerRef.current); radioReconnectTimerRef.current = null; }
  }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime || 0);
    const updateDuration = () =>
      setDurationSeconds(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let disposed = false;
    let lastPosition = audio.currentTime;
    let lastProgress = Date.now();
    const recover = () => {
      if (disposed || currentTrack.source !== "radio" || !playingRef.current || radioReconnectTimerRef.current) return;
      const nextStep = nextRadioAttempt(streamStep, streamSources.length);
      if (nextStep === null) {
        radioExhaustedRef.current = currentTrack.id;
        setPlaying(false);
        setRadioError("No se pudo estabilizar la señal. Selecciona la emisora para volver a intentar o abre su sitio oficial.");
        return;
      }
      setRadioError(nextStep % 2 ? "Señal interrumpida. Reconectando…" : "Probando una señal alternativa de la misma emisora…");
      radioReconnectTimerRef.current = setTimeout(() => {
        radioReconnectTimerRef.current = null;
        if (disposed || !playingRef.current || currentYouTubeTrackRef.current.id !== currentTrack.id) return;
        setRadioAttempt((prev) => ({ trackId: currentTrack.id, step: nextStep, generation: prev.generation + 1 }));
      }, 1800);
    };
    radioRecoveryRef.current = recover;
    const handleMediaError = () => {
      if (currentTrack.source === "radio") { recover(); return; }
      if (currentTrack.id && currentTrack.source !== "youtube" && playingRef.current) {
        failedPlaybackRef.current.add(currentTrack.id);
        setOnlineError(`No se pudo reproducir ${currentTrack.title}. Se omitió de esta sesión.`);
        nextTrackRef.current("error");
      }
    };
    const handlePlaying = () => {
      if (currentTrack.source === "radio") {
        lastProgress = Date.now();
        if (radioReconnectTimerRef.current) { clearTimeout(radioReconnectTimerRef.current); radioReconnectTimerRef.current = null; }
        setRadioError("");
      }
    };
    const handleEnded = () => { if (currentTrack.source === "radio") recover(); };
    audio.addEventListener("error", handleMediaError);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("ended", handleEnded);
    const timer = currentTrack.source === "radio" && effectiveSrc && !isEmbedTrack(currentTrack) ? window.setInterval(() => {
      if (!playingRef.current) { lastProgress = Date.now(); return; }
      if (Math.abs(audio.currentTime - lastPosition) > 0.15) {
        lastPosition = audio.currentTime;
        lastProgress = Date.now();
      } else if (Date.now() - lastProgress > 25000) recover();
    }, 1000) : null;
    return () => {
      disposed = true;
      if (radioReconnectTimerRef.current) clearTimeout(radioReconnectTimerRef.current);
      radioReconnectTimerRef.current = null;
      radioRecoveryRef.current = () => {};
      if (timer !== null) window.clearInterval(timer);
      audio.removeEventListener("error", handleMediaError);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentTrack.id, currentTrack.source, currentTrack.title, effectiveSrc, streamStep, streamGeneration, streamSources]);

  useEffect(() => {
    setCurrentTime(0);
    setDurationSeconds(currentTrack?.source === "itunes" ? 30 : 0);
  }, [currentTrack?.id, currentTrack?.src, currentTrack?.source]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    if (currentTrack?.source === "youtube" || isEmbedTrack(currentTrack) || !effectiveSrc) return;

    if (currentTrack.source === "radio" && isBlockedBrowserAudioSrc(effectiveSrc)) {
      setPlaying(false);
      setRadioError(
        `${currentTrack.title} usa una señal bloqueada por el navegador por HTTP o certificado inválido. Busca otra radio o abre la fuente oficial.`,
      );
      return;
    }

    if (isHlsUrl(effectiveSrc)) {
      if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = effectiveSrc;
        audio.load();
        return;
      }
      let cancelled = false;
      void loadHlsScript()
        .then(() => {
          if (cancelled) return;
          if (!window.Hls?.isSupported?.()) {
            audio.src = effectiveSrc;
            audio.load();
            if (playingRef.current) void audio.play().catch((error) => { if (error?.name === "AbortError" || cancelled) return; if (error?.name === "NotAllowedError") { setPlaying(false); setRadioError("Pulsa Reproducir para iniciar la señal."); } else if (currentTrack.source === "radio") radioRecoveryRef.current(); else setPlaying(false); });
            return;
          }
          const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false, liveSyncDurationCount: 4, liveMaxLatencyDurationCount: 12, maxBufferLength: 45, maxMaxBufferLength: 90, backBufferLength: 30 });
          hlsRef.current = hls;
          hls.on(window.Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean }) => {
            if (!cancelled && data.fatal && currentTrack.source === "radio") radioRecoveryRef.current();
          });
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled && playingRef.current) void audio.play().catch((error) => { if (error?.name === "AbortError" || cancelled) return; if (error?.name === "NotAllowedError") { setPlaying(false); setRadioError("Pulsa Reproducir para iniciar la señal."); } else if (currentTrack.source === "radio") radioRecoveryRef.current(); else setPlaying(false); });
          });
          hls.loadSource(effectiveSrc);
          hls.attachMedia(audio);
        })
        .catch(() => {
          if (cancelled) return;
          audio.src = effectiveSrc;
          audio.load();
          if (playingRef.current) void audio.play().catch((error) => { if (error?.name === "AbortError" || cancelled) return; if (error?.name === "NotAllowedError") { setPlaying(false); setRadioError("Pulsa Reproducir para iniciar la señal."); } else if (currentTrack.source === "radio") radioRecoveryRef.current(); else setPlaying(false); });
        });
      return () => { cancelled = true; };
    }

    audio.src = effectiveSrc;
    audio.load();
  }, [currentTrack?.id, currentTrack?.source, effectiveSrc, streamStep, streamGeneration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack?.source === "youtube") {
      audio.pause();
      if (youtubeReadyRef.current && youtubePlayerRef.current) {
        try {
          if (playing) {
            youtubePlayerRef.current.playVideo();
          } else {
            youtubePlayerRef.current.pauseVideo();
          }
        } catch {}
      }
      return;
    }

    // Nunca dejes el iframe de YouTube sonando al cambiar a una pista de audio.
    // Además se destruye la instancia: su contenedor visual pudo desmontarse
    // al cambiar de búsqueda y reutilizarla provoca excepciones del cliente.
    if (youtubeReadyRef.current && youtubePlayerRef.current?.pauseVideo) {
      try {
        youtubePlayerRef.current.pauseVideo();
      } catch {}
    }
    if (youtubePlayerRef.current?.destroy) {
      try {
        youtubePlayerRef.current.destroy();
      } catch {}
    }
    youtubePlayerRef.current = null;
    youtubeReadyRef.current = false;
    youtubeVideoIdRef.current = "";

    if (isEmbedTrack(currentTrack) || !effectiveSrc) {
      audio.pause();
      if (playing) setPlaying(false);
      return;
    }

    if (playing) {
      if (currentTrack.source === "radio" && radioExhaustedRef.current === currentTrack.id) {
        radioExhaustedRef.current = null;
        setRadioAttempt((prev) => ({ trackId: currentTrack.id, step: 0, generation: prev.generation + 1 }));
        setRadioError("");
        return;
      }
      if (isHlsUrl(effectiveSrc) && !audio.canPlayType("application/vnd.apple.mpegurl") && !audio.src) return;
      audio.play().catch((error) => {
        if (error?.name === "AbortError" || currentYouTubeTrackRef.current.id !== currentTrack.id) return;
        if (error?.name === "NotAllowedError") {
          setOnlineError("El navegador bloqueó el inicio automático. Pulsa Reproducir para continuar.");
          setPlaying(false);
        } else if (currentTrack.source === "radio" && playingRef.current) {
          radioRecoveryRef.current();
        } else if (currentTrack.source !== "radio" && playingRef.current) {
          failedPlaybackRef.current.add(currentTrack.id);
          setOnlineError(`No se pudo reproducir ${currentTrack.title}. Se omitió de esta sesión.`);
          nextTrackRef.current("error");
        } else setPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [playing, currentTrack?.id, effectiveSrc, currentTrack?.source, streamStep, streamGeneration]);


  useEffect(() => {
    if (!playing || currentTrack?.source !== "itunes") return;
    const previewSeconds = 30;
    setDurationSeconds(previewSeconds);
    const remainingMs = Math.max(1200, (previewSeconds - Math.min(currentTime || 0, previewSeconds) + 0.25) * 1000);
    const timer = window.setTimeout(() => {
      const audio = audioRef.current;
      const nearEnd = !audio || audio.ended || audio.currentTime >= previewSeconds - 0.8;
      if (nearEnd) nextTrackRef.current("ended");
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [playing, currentTrack?.id, currentTrack?.source, currentTime]);

  const playTrack = useCallback(
    (track: EduMusicTrack, queueFrom?: EduMusicTrack[]) => {
      setHasActiveSession(true);
      const fromFavorites = (viewRef.current === "liked" || (favoriteSession && viewRef.current === "queue")) && liked.has(track.id) && !isRadioTrack(track);
      if (fromFavorites) {
        if (!favoriteSession) {
          shuffledPlayedRef.current.clear();
          playbackHistoryRef.current = [];
        }
        setFavoriteSession(true);
        setSelectedPlaylistId("pl-liked");
        setQueueIds(favoriteTracks.map((item) => item.id));
      } else if (!mixActiveRef.current || !mixCurrentQueueRef.current.some((row) => row.id === track.id)) {
        setFavoriteSession(false);
        if (queueFrom?.some((item) => item.id === track.id) && (viewRef.current !== "queue" || !favoriteSession)) {
          setQueueIds(unique(queueFrom.map((item) => item.id)));
          shuffledPlayedRef.current.clear();
          playbackHistoryRef.current = [];
        }
      }
      autoAdvanceRef.current = undefined;
      failedPlaybackRef.current.delete(track.id);
      if (track.youtubeVideoId) {
        failedPlaybackRef.current.delete(track.youtubeVideoId);
        setFailedYouTubeIds((prev) => prev.filter((id) => id !== track.youtubeVideoId));
      }
      setOnlineError("");
      if (!mixActiveRef.current || !mixCurrentQueueRef.current.some((row) => row.id === track.id)) {
        mixActiveRef.current = false;
        setMixFavoriteActive(false);
      }
      if (track.id !== EMPTY_MUSIC_TRACK.id) {
        if (!isRadioTrack(track)) learnMixTracks([track], { origin: "search" });
        setRecentIds((prev) => [track.id, ...prev.filter((id) => id !== track.id)].slice(0, 18));
      }

      // La cola pertenece a la fuente seleccionada; navegar no interrumpe la pista.
      if (isYouTubeQueueTrack(track)) {
        // Si veníamos de otro video, ignoramos el evento de cierre atrasado.
        youtubeTransitionUntilRef.current = Date.now() + 1400;
      }

      if (isEmbedTrack(track)) {
        setCurrentId(track.id);
        setPlaying(false);
        setRadioError("");
        return;
      }

      const externalUrl = trackExternalUrl(track);

      if (track.source === "radio" && isBlockedBrowserAudioSrc(track.src)) {
        setCurrentId(track.id);
        setPlaying(false);
        setRadioError(
          `${track.title} usa una señal que el navegador no puede reproducir de forma segura. EDUAI Music sigue operativo; usa “Abrir fuente” si quieres visitar la emisora oficial.`,
        );
        return;
      }

      if (!track.src && externalUrl && (track.source === "radio" || track.source === "external")) {
        setCurrentId(track.id);
        setPlaying(false);
        setRadioError(
          `${track.title} no tiene una señal HTTPS reproducible directamente. EDUAI Music seguirá en esta página; puedes usar “Abrir fuente” manualmente.`,
        );
        return;
      }

      if (track.source === "youtube" && asExtendedTrack(track)?.externalOnly) {
        setCurrentId(track.id);
        setPlaying(false);
        setOnlineError("Este video está disponible en YouTube, pero el propietario no permite insertarlo en EDUAI. Usa Abrir en YouTube.");
        return;
      }
      if (isRadioTrack(track) && (track.id !== currentId || !playingRef.current)) {
        radioExhaustedRef.current = null;
        setRadioAttempt((prev) => ({ trackId: track.id, step: 0, generation: prev.generation + 1 }));
        setRadioError("");
      }
      if (track.id === currentId) {
        setPlaying((value) => !value);
        return;
      }
      setCurrentId(track.id);
      setPlaying(true);
    },
    [currentId, favoriteSession, favoriteTracks, liked, learnMixTracks],
  );

  const startFavorites = useCallback(() => {
    const tracks = favoriteTracks.filter((track) => canAutoPlay(track, failedPlaybackRef.current));
    if (!tracks.length) {
      setOnlineError("No hay favoritos reproducibles en esta sesión. Puedes intentar una canción directamente.");
      return;
    }
    mixActiveRef.current = false;
    setMixFavoriteActive(false);
    setFavoriteSession(true);
    setSelectedPlaylistId("pl-liked");
    setQueueIds(favoriteTracks.map((track) => track.id));
    shuffledPlayedRef.current.clear();
    playbackHistoryRef.current = [];
    const first = shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0];
    autoAdvanceRef.current = undefined;
    setHasActiveSession(true);
    setCurrentId(first.id);
    setRecentIds((prev) => [first.id, ...prev.filter((id) => id !== first.id)].slice(0, 18));
    setOnlineError("");
    setPlaying(true);
  }, [favoriteTracks, shuffle]);

  const playPlaylist = useCallback(
    (playlistId?: string) => {
      mixActiveRef.current = false;
      setMixFavoriteActive(false);
      const playlist = playlists.find((p) => p.id === (playlistId || selectedPlaylistId)) ?? selectedPlaylist;
      if (playlist.id === "pl-liked") { startFavorites(); return; }
      setFavoriteSession(false);
      shuffledPlayedRef.current.clear();
      playbackHistoryRef.current = [];
      const tracks = getTracksForPlaylist(playlist, allTracks).filter((track) => canAutoPlay(track, failedPlaybackRef.current));
      if (!tracks.length) return;
      setHasActiveSession(true);
      setSelectedPlaylistId(playlist.id);
      setQueueIds(tracks.map((track) => track.id));
      const first = shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0];
      setCurrentId(first.id);
      setRecentIds((prev) => [first.id, ...prev.filter((id) => id !== first.id)].slice(0, 18));
      setPlaying(true);
    },
    [allTracks, playlists, selectedPlaylist, selectedPlaylistId, shuffle, startFavorites],
  );


  const refillMixFavorite = useCallback(async () => {
    if (!mixActiveRef.current || mixRefillPendingRef.current) return;
    mixRefillPendingRef.current = true;
    setMixFavoriteLoading(true);
    setMixFavoriteError("");
    const prior = mixCurrentQueueRef.current;
    const requests = chooseMixRequests(
      mixLearnedSongs, mixArtists, prior.slice(-4).map((track) => track.artist), 10,
    );
    try {
      const response = await fetch("/api/music/mix", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests, excludeIds: [...mixSeenRef.current, ...failedYouTubeIds] }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "No se pudo ampliar el mix.");
      if (!mixActiveRef.current) return;
      const tracks = ((Array.isArray(data.tracks) ? data.tracks : []) as EduMusicTrack[]).filter((track) => {
        if (!track.youtubeVideoId || mixSeenRef.current.has(track.youtubeVideoId)) return false;
        mixSeenRef.current.add(track.youtubeVideoId);
        return true;
      });
      if (!tracks.length) {
        setMixFavoriteError("No aparecieron canciones nuevas en esta búsqueda. Tu lista y reproducción se mantienen; puedes volver a intentar.");
        return;
      }
      // Reintentar y Encontrar más son operaciones acumulativas. Nunca
      // sustituir pistas anteriores ni alterar su orden o la reproducción.
      const combined = [...prior, ...tracks];
      mixCurrentQueueRef.current = combined;
      setMixQueueTracks(combined);
      setQueueIds((existingIds) => {
        const seen = new Set(existingIds);
        const newIds = tracks.map((track) => track.id).filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        return newIds.length ? [...existingIds, ...newIds] : existingIds;
      });
      learnMixTracks(tracks.slice(0, 12), { origin: "discovered" });
      // Avanzar solo si el reproductor realmente esperaba otra pista.
      // Una actualización manual no interrumpe la canción actual.
      if (mixAdvancePendingRef.current && !playingRef.current) {
        const firstPlayable = tracks.find((track) => !asExtendedTrack(track)?.externalOnly && !failedYouTubeIds.includes(track.youtubeVideoId || ""));
        if (firstPlayable) {
          mixAdvancePendingRef.current = false;
          youtubeTransitionUntilRef.current = Date.now() + 1300;
          setCurrentId(firstPlayable.id);
          setRecentIds((prev) => [firstPlayable.id, ...prev.filter((id) => id !== firstPlayable.id)].slice(0, 18));
          setPlaying(true);
        } else {
          setMixFavoriteError("Hay videos disponibles en YouTube, pero no pueden reproducirse aquí. Puedes abrirlos desde la lista.");
        }
      }
    } catch (error) {
      setMixFavoriteError(error instanceof Error ? error.message : "Error cargando canciones del mix.");
    } finally {
      mixRefillPendingRef.current = false;
      setMixFavoriteLoading(false);
    }
  }, [failedYouTubeIds, learnMixTracks, mixArtists, mixLearnedSongs]);

  const startMixFavorite = useCallback(() => {
    setFavoriteSession(false);
    shuffledPlayedRef.current.clear();
    playbackHistoryRef.current = [];
    mixActiveRef.current = true;
    mixRefillTriggerRef.current = "";
    mixInitialPrefetchRef.current = 0;
    // Reutilizar las canciones aprendidas de YouTube sin llamar primero a la
    // API. Favorece las realmente escuchadas y añade más artistas después.
    const shuffled = (songs: MixSong[]) => [...songs].sort(() => Math.random() - 0.5);
    const personal = [
      ...shuffled(mixLearnedSongs.filter((s) => s.origin === "played")),
      ...shuffled(mixLearnedSongs.filter((s) => s.origin !== "played")),
    ];
    const seenArtists = new Set<string>();
    const seenVideos = new Set<string>();
    const initial: EduMusicTrack[] = [];
    for (const song of personal) {
      const track = learnedVideoTrack(song);
      if (!track || !track.youtubeVideoId || seenVideos.has(track.youtubeVideoId) ||
          failedYouTubeIds.includes(track.youtubeVideoId)) continue;
      const artist = normalizeArtist(track.artist);
      if (seenArtists.has(artist)) continue;
      seenArtists.add(artist);
      seenVideos.add(track.youtubeVideoId);
      initial.push(track);
      if (initial.length >= 12) break;
    }
    const first = initial.find((track) => !asExtendedTrack(track)?.externalOnly);
    mixSeenRef.current = seenVideos;
    mixAdvancePendingRef.current = !first;
    mixCurrentQueueRef.current = initial;
    setMixQueueTracks(initial);
    setQueueIds(initial.map((track) => track.id));
    setMixFavoriteActive(true);
    setView("mix");
    setCurrentId(first?.id);
    setPlaying(Boolean(first));
    if (first) setRecentIds((prev) => [first.id, ...prev.filter((id) => id !== first.id)].slice(0, 18));
    setHasActiveSession(true);
    void refillMixFavorite();
  }, [failedYouTubeIds, mixLearnedSongs, refillMixFavorite]);

  const loadMoreMixFavorite = useCallback(() => {
    // Ni la cola, ni el video actual, ni la posición se reinician al buscar.
    if (mixActiveRef.current && !mixRefillPendingRef.current) {
      void refillMixFavorite();
    }
  }, [refillMixFavorite]);

  const stopMixFavorite = useCallback(() => {
    mixActiveRef.current = false;
    mixAdvancePendingRef.current = false;
    setMixFavoriteActive(false);
    setPlaying(false);
    setQueueIds([]);
  }, []);

  const advanceTrack = useCallback((reason: "manual" | "ended" | "error" = "manual") => {
    const auto = reason !== "manual";
    if (auto && (!playingRef.current || autoAdvanceRef.current === currentId)) return;
    if (reason === "ended" && isYouTubeQueueTrack(currentTrack) && Date.now() < youtubeTransitionUntilRef.current) return;
    autoAdvanceRef.current = currentId;
    if (isYouTubeQueueTrack(currentTrack)) youtubeTransitionUntilRef.current = Date.now() + 1400;
    setHasActiveSession(true);
    const restart = () => {
      if (currentTrack.source === "youtube") {
        const player = youtubePlayerRef.current;
        try {
          player?.seekTo?.(Math.max(0, Number(asExtendedTrack(currentTrack)?.previewStartSeconds || 0)), true);
          player?.playVideo?.();
        } catch { setPlaying(false); return; }
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play().catch(() => setPlaying(false));
      }
      autoAdvanceRef.current = undefined;
      setPlaying(true);
    };
    const switchTo = (track: EduMusicTrack, resume = playingRef.current) => {
      if (track.id === currentId) { if (resume) restart(); return; }
      if (currentId) playbackHistoryRef.current.push(currentId);
      playbackHistoryRef.current = playbackHistoryRef.current.slice(-200);
      setCurrentId(track.id);
      setRecentIds((prev) => [track.id, ...prev.filter((id) => id !== track.id)].slice(0, 18));
      setPlaying(resume);
    };
    if (mixActiveRef.current) {
      const list = mixCurrentQueueRef.current.filter((track) => canAutoPlay(track, failedPlaybackRef.current));
      const index = list.findIndex((t) => t.id === currentId);
      const artist = normalizeArtist(currentTrack.artist);
      const remaining = list.slice(Math.max(0, index + 1)).filter((t) => t.id !== currentId);
      const next = remaining.find((track) => normalizeArtist(track.artist) !== artist) || remaining[0];
      if (next) {
        switchTo(next);
        if (list.length - list.indexOf(next) <= 4) void refillMixFavorite();
      } else {
        mixAdvancePendingRef.current = true;
        setPlaying(false);
        void refillMixFavorite();
      }
      return;
    }
    if (reason === "ended" && repeat === "one") {
      restart();
      return;
    }
    const list = favoriteSession ? favoriteTracks :
      queue.some((track) => track.id === currentId) ? queue :
      currentTrack.source === "youtube" && onlineTracks.some((track) => track.id === currentId) ? onlineTracks :
      baseTracks.some((track) => track.id === currentId) ? baseTracks :
      queue.length ? queue : onlineTracks;
    const playable = list.filter((track) => canAutoPlay(track, failedPlaybackRef.current) &&
      (reason !== "error" || track.id !== currentId));
    if (!playable.length) { setPlaying(false); return; }
    const nextId = nextPlaybackId(list.map((track) => track.id), new Set(playable.map((track) => track.id)),
      currentId, shuffle, repeat === "all", shuffledPlayedRef.current);
    const next = playable.find((track) => track.id === nextId);
    if (next) switchTo(next);
    else setPlaying(false);
  }, [baseTracks, currentId, currentTrack, favoriteSession, favoriteTracks, onlineTracks, queue, repeat, shuffle, refillMixFavorite]);

  const nextTrack = useCallback(() => advanceTrack("manual"), [advanceTrack]);
  useEffect(() => {
    nextTrackRef.current = advanceTrack;
  }, [advanceTrack]);
  useEffect(() => {
    if (!mixFavoriteActive || mixFavoriteLoading || mixRefillPendingRef.current) return;
    // Mantener un catálogo inicial generoso en vez de apenas tres canciones.
    // Límite de precargas para proteger la cuota de YouTube.
    if (mixQueueTracks.length < 18 && mixInitialPrefetchRef.current < 3) {
      mixInitialPrefetchRef.current += 1;
      void refillMixFavorite();
      return;
    }
    if (!mixQueueTracks.length) return;
    const playable = mixQueueTracks.filter((track) =>
      !asExtendedTrack(track)?.externalOnly && !failedYouTubeIds.includes(track.youtubeVideoId || ""));
    const index = playable.findIndex((track) => track.id === currentId);
    if (index >= 0 && playable.length - index <= 6) {
      const token = currentId + ":" + mixQueueTracks.length;
      if (mixRefillTriggerRef.current !== token) {
        mixRefillTriggerRef.current = token;
        void refillMixFavorite();
      }
    }
  }, [mixFavoriteActive, mixFavoriteLoading, mixQueueTracks, currentId, failedYouTubeIds, refillMixFavorite]);

  const prevTrack = useCallback(() => {
    if (isYouTubeQueueTrack(currentTrack)) {
      youtubeTransitionUntilRef.current = Date.now() + 1400;
    }
    setHasActiveSession(true);
    const list = favoriteSession ? favoriteTracks : mixActiveRef.current ? mixCurrentQueueRef.current :
      queue.some((track) => track.id === currentId)
        ? queue
        : currentTrack?.source === "youtube" && onlineTracks.some((track) => track.id === currentId)
          ? onlineTracks
          : baseTracks.some((track) => track.id === currentId)
            ? baseTracks
            : queue.length
              ? queue
              : onlineTracks;
    const playable = list.filter((track) => canAutoPlay(track, failedPlaybackRef.current));
    if (!playable.length) return;
    const index = playable.findIndex((track) => track.id === currentId);
    let prev: EduMusicTrack | undefined;
    if (shuffle) {
      while (playbackHistoryRef.current.length && !prev) {
        const id = playbackHistoryRef.current.pop();
        prev = playable.find((track) => track.id === id && id !== currentId);
      }
    }
    prev ??= playable[(index - 1 + playable.length) % playable.length];
    if (prev) {
      const shouldContinue = playingRef.current;
      setCurrentId(prev.id);
      setPlaying(shouldContinue);
    }
  }, [baseTracks, currentId, currentTrack, favoriteSession, favoriteTracks, onlineTracks, queue, shuffle]);

  useEffect(() => {
    if (typeof window === "undefined" || currentTrack?.source !== "youtube" || asExtendedTrack(currentTrack)?.externalOnly) return;

    const videoId = currentTrack.youtubeVideoId;
    if (!videoId) return;
    let cancelled = false;
    let mountRetry: number | null = null;
    let loadFailures = 0;

    const mountPlayer = async () => {
      try { await loadYouTubeApi(); }
      catch {
        if (cancelled) return;
        if (loadFailures++ < 1) mountRetry = window.setTimeout(mountPlayer, 1000);
        else {
          setOnlineError("No se pudo conectar con YouTube. Intenta seleccionar la canción nuevamente.");
          setPlaying(false);
        }
        return;
      }
      if (cancelled || !window.YT?.Player) return;

      const target = document.getElementById(YOUTUBE_PLAYER_ID);
      if (!target) {
        mountRetry = window.setTimeout(mountPlayer, 120);
        return;
      }

      const playerVars = {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      };

      const startVideo = (player: any, forceLoad = false) => {
        const activeTrack = currentYouTubeTrackRef.current;
        const videoId = activeTrack.youtubeVideoId;
        if (!videoId || activeTrack.source !== "youtube") return;
        const previewSeconds = Math.max(0, Number(asExtendedTrack(activeTrack)?.previewSeconds || 0));
        const previewStartSeconds = Math.max(0, Number(asExtendedTrack(activeTrack)?.previewStartSeconds || 0));
        try {
          player.setVolume?.(Math.round(volumeRef.current * 100));
          player.unMute?.();
          const loadedId = youtubeVideoIdRef.current;
          if (forceLoad || loadedId !== videoId) {
            youtubeVideoIdRef.current = videoId;
            const load = playingRef.current ? player.loadVideoById : player.cueVideoById;
            load?.call(player, {
              videoId,
              startSeconds: previewStartSeconds,
              ...(previewSeconds ? { endSeconds: previewStartSeconds + previewSeconds } : {}),
            });
          }
          if (playingRef.current) player.playVideo?.();
        } catch {}
      };

      if (youtubePlayerRef.current && target.tagName !== "IFRAME") {
        try { youtubePlayerRef.current.destroy?.(); } catch {}
        youtubePlayerRef.current = null;
        youtubeReadyRef.current = false;
        youtubeVideoIdRef.current = "";
      }
      if (!youtubePlayerRef.current) {
        youtubeReadyRef.current = false;
        youtubePlayerRef.current = new window.YT.Player(YOUTUBE_PLAYER_ID, {
          height: "100%",
          width: "100%",
          videoId,
          playerVars,
          events: {
            onReady: (event: any) => {
              if (event.target !== youtubePlayerRef.current) return;
              youtubeReadyRef.current = true;
              startVideo(event.target, true);
            },
            onStateChange: (event: any) => {
              const state = event.data;
              if (event.target !== youtubePlayerRef.current) return;
              if (state === window.YT?.PlayerState?.PLAYING) {
                if (!playingRef.current) { event.target?.pauseVideo?.(); return; }
                // Solo aprender como "reproducido" cuando YouTube confirma
                // que el video se está escuchando, no por un clic o búsqueda.
                const reportedId = event.target?.getVideoData?.()?.video_id || youtubeVideoIdRef.current;
                const playingTrack = currentYouTubeTrackRef.current;
                if (reportedId && playingTrack.youtubeVideoId === reportedId) {
                  learnMixTracksRef.current([playingTrack], { origin: "played" });
                }
                return;
              }
              // Los controles de YouTube están ocultos: pausar desde EduAI ya
              // actualiza el estado. Ignoramos la pausa transitoria que emite
              // YouTube al cargar el siguiente video de la cola.
              if (state === window.YT?.PlayerState?.ENDED) {
                const reportedId = event.target?.getVideoData?.()?.video_id;
                if (reportedId && reportedId !== currentYouTubeTrackRef.current.youtubeVideoId) return;
                nextTrackRef.current("ended");
              }
            },
            onAutoplayBlocked: (event: any) => {
              if (event.target !== youtubePlayerRef.current) return;
              setPlaying(false);
              setOnlineError("El navegador bloqueó el inicio automático. Pulsa Reproducir para continuar.");
            },
            onError: (event: any) => {
              if (event.target !== youtubePlayerRef.current) return;
              const reportedId = event.target?.getVideoData?.()?.video_id || youtubeVideoIdRef.current;
              if (reportedId && reportedId !== currentYouTubeTrackRef.current.youtubeVideoId) return;
              if (reportedId) {
                failedPlaybackRef.current.add(reportedId);
                setFailedYouTubeIds((prev) => unique([...prev, reportedId]).slice(-80));
              }
              setOnlineError("Ese video no permite reproducción embebida en EDUAI Music. Saltando automáticamente a otra versión disponible.");
              youtubeTransitionUntilRef.current = 0;
              nextTrackRef.current("error");
            },
          },
        });
        return;
      }

      if (youtubeReadyRef.current) startVideo(youtubePlayerRef.current, true);
    };

    void mountPlayer();

    return () => {
      cancelled = true;
      if (mountRetry !== null) window.clearTimeout(mountRetry);
    };
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.youtubeVideoId]);

  useEffect(() => {
    if (currentTrack?.source !== "youtube") return;
    let lastTime = -1;
    let lastProgress = Date.now();
    let recoveryAttempted = false;
    const timer = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!playingRef.current) { lastProgress = Date.now(); recoveryAttempted = false; }
      if (!player || !youtubeReadyRef.current) {
        if (playingRef.current && Date.now() - lastProgress > 20000) {
          setOnlineError("YouTube no respondió. Pulsa Reproducir o abre la canción en YouTube.");
          setPlaying(false);
        }
        return;
      }
      try {
        const reportedId = player.getVideoData?.()?.video_id;
        if (reportedId && reportedId !== currentTrack.youtubeVideoId) return;
        const time = Number(player.getCurrentTime?.() || 0);
        const duration = Number(player.getDuration?.() || 0);
        const state = Number(player.getPlayerState?.());
        const safeTime = Number.isFinite(time) ? time : 0;
        const safeDuration = Number.isFinite(duration) ? duration : 0;
        const clipStart = Math.max(0, Number(asExtendedTrack(currentTrack)?.previewStartSeconds || 0));
        setCurrentTime(Math.max(0, safeTime - clipStart));
        const clipDuration = Math.max(0, Number(asExtendedTrack(currentTrack)?.previewSeconds || 0));
        const effectiveDuration = clipDuration || safeDuration;
        setDurationSeconds(effectiveDuration);

        if (Math.abs(safeTime - lastTime) > 0.15) {
          lastTime = safeTime;
          lastProgress = Date.now();
          recoveryAttempted = false;
        }
        if (!playingRef.current) return;
        const PlayerState = window.YT?.PlayerState || {};
        if (state === PlayerState.ENDED || (effectiveDuration > 0 && safeTime >= clipStart + effectiveDuration - 0.35)) {
          nextTrackRef.current("ended");
          return;
        }
        const stalledFor = Date.now() - lastProgress;
        if (stalledFor >= 15000 && !recoveryAttempted) {
          recoveryAttempted = true;
          player.playVideo?.();
        }
        if (stalledFor >= 28000) {
          const failedId = currentTrack.youtubeVideoId;
          if (failedId) {
            failedPlaybackRef.current.add(failedId);
            setFailedYouTubeIds((prev) => unique([...prev, failedId]).slice(-80));
          }
          setOnlineError("La canción no respondió después de un intento de recuperación. Se omitió temporalmente.");
          nextTrackRef.current("error");
        }
      } catch {}
    }, 700);
    return () => window.clearInterval(timer);
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.youtubeVideoId]);

  const toggleLike = useCallback((id: string) => {
    const alreadyLiked = likedTrackIds.includes(id);
    const track = getTrack(id) || fallbackFavoriteTrack(id);
    setLikedTrackIds((prev) =>
      alreadyLiked ? prev.filter((trackId) => trackId !== id) : unique([...prev, id]),
    );
    setLikedTrackSnapshots((prev) =>
      alreadyLiked ? prev.filter((item) => item.id !== id)
        : [track, ...prev.filter((item) => item.id !== id)].slice(0, 2000),
    );
    queueFavoriteChange({
      op: alreadyLiked ? "remove" : "add", trackId: id,
      ...(!alreadyLiked ? { track } : {}),
    });
  }, [getTrack, likedTrackIds, queueFavoriteChange]);

  const createPlaylist = useCallback(() => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const playlist: EduMusicPlaylist = {
      id: `user-${Date.now()}`,
      name,
      description: "Playlist creada en EduAI Music.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#dbeafe,#bbf7d0)",
      trackIds: pendingTrackId ? [pendingTrackId] : currentTrack ? [currentTrack.id] : [],
    };
    setUserPlaylists((prev) => [...prev, playlist]);
    setSelectedPlaylistId(playlist.id);
    setView("playlists");
    setNewPlaylistName("");
    setPendingTrackId(null);
    setCreateOpen(false);
  }, [currentTrack, newPlaylistName, pendingTrackId]);

  const addToPlaylist = useCallback((playlistId: string, trackId: string) => {
    if (playlistId === "pl-liked") {
      const track = getTrack(trackId) || fallbackFavoriteTrack(trackId);
      setLikedTrackIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
      setLikedTrackSnapshots((prev) => [track, ...prev.filter((item) => item.id !== trackId)].slice(0, 2000));
      queueFavoriteChange({ op: "add", trackId, track });
      setPendingTrackId(null);
      return;
    }
    setUserPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, trackIds: unique([...playlist.trackIds, trackId]) }
          : playlist,
      ),
    );
    setPendingTrackId(null);
  }, [getTrack, queueFavoriteChange]);

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    if (playlistId === "pl-liked") {
      setLikedTrackIds((prev) => prev.filter((id) => id !== trackId));
      setLikedTrackSnapshots((prev) => prev.filter((item) => item.id !== trackId));
      queueFavoriteChange({ op: "remove", trackId });
      return;
    }
    setUserPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
          : playlist,
      ),
    );
  }, [queueFavoriteChange]);

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      setUserPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId("pl-radio");
    },
    [selectedPlaylistId],
  );

  const requestAddToPlaylist = useCallback((trackId: string) => {
    setPendingTrackId((prev) => (prev === trackId ? null : trackId));
  }, []);

  const addToQueue = useCallback((trackId: string) => {
    setFavoriteSession(false);
    setQueueIds((prev) => unique([...prev, trackId]));
  }, []);

  const clearQueue = useCallback(() => { setFavoriteSession(false); setQueueIds([]); }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      if (currentTrack.source === "radio") return;
      if (currentTrack?.source === "youtube" && youtubePlayerRef.current?.seekTo) {
        try {
          const clipStart = Math.max(0, Number(asExtendedTrack(currentTrack)?.previewStartSeconds || 0));
          youtubePlayerRef.current.seekTo(clipStart + seconds, true);
          setCurrentTime(seconds);
        } catch {}
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      const safe = Math.max(
        0,
        Math.min(seconds, Number.isFinite(audio.duration) ? audio.duration : seconds),
      );
      audio.currentTime = safe;
      setCurrentTime(safe);
    },
    [currentTrack?.source],
  );

  const clearActiveSession = useCallback(() => {
    setPlaying(false);
    setHasActiveSession(false);
  }, []);

  const clearOnlineResults = useCallback(() => {
    onlineSearchRequestRef.current += 1;
    onlineSearchAbortRef.current?.abort();
    onlineSearchAbortRef.current = null;
    setOnlineLoading(false);
    setOnlineError("");
    setOnlineTracks([]);
  }, []);

  useEffect(() => {
    return () => onlineSearchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const artwork = trackArtwork(currentTrack);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: artwork ? [{ src: artwork, sizes: "512x512", type: "image/png" }] : undefined,
      });
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      navigator.mediaSession.setActionHandler("play", () => setPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => setPlaying(false));
      navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
      navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (typeof details.seekTime === "number") seekTo(details.seekTime);
      });
    } catch {}
  }, [currentTrack, nextTrack, playing, prevTrack, seekTo]);

  const searchOnline = useCallback(
    async (term?: string, providerOverride?: OnlineProviderMode) => {
      const mode = providerOverride || onlineProviderMode;
      if (providerOverride) setOnlineProviderMode(providerOverride);
      const clean = (term || onlineQuery || query).trim();
      if (!clean) return;
      setOnlineQuery(clean);
      setRecentSearches((prev) =>
        [clean, ...prev.filter((item) => item.toLocaleLowerCase() !== clean.toLocaleLowerCase())].slice(0, 8),
      );
      onlineSearchRequestRef.current += 1;
      const requestId = onlineSearchRequestRef.current;
      onlineSearchAbortRef.current?.abort();
      const controller = new AbortController();
      onlineSearchAbortRef.current = controller;
      setOnlineLoading(true);
      setOnlineError("");
      // Conservamos la lista actual durante la consulta y la reemplazamos de
      // forma atómica al recibir la respuesta. Así el host de YouTube no se
      // desmonta mientras su iframe sigue activo.
      setSelectedPlaylistId("pl-online");
      setView("search");
      try {
        const res = await fetch("/api/music/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            query: clean,
            provider: mode === "youtube" ? "youtube" : mode || "full",
            // Una cola amplia evita repetir videos tras solo unas pocas pistas.
            limit: 48,
          }),
        });
        const data = await res.json();
        if (requestId !== onlineSearchRequestRef.current) return;
        if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo buscar música online.");
        const tracks = Array.isArray(data.tracks) ? (data.tracks as EduMusicTrack[]) : [];
        if (!tracks.length) {
          setOnlineError(
            mode === "full"
              ? data?.sources?.youtube
                ? "No encontré canciones completas en Jamendo/Audius ni videos embebibles de YouTube. Prueba con otro término o cambia a DJ 30s."
                : "No encontré canciones completas en Jamendo/Audius. Para buscar videos de YouTube debes agregar YOUTUBE_API_KEY en Vercel o cambiar a DJ 30s."
              : mode === "youtube"
                ? data?.sources?.youtube
                  ? "No encontré videos embebibles de YouTube para esa búsqueda."
                  : "Falta configurar YOUTUBE_API_KEY en Vercel para buscar videos de YouTube."
                : "No encontré resultados reproducibles para esa búsqueda.",
          );
          return;
        }
        const sanitizedTracks = tracks.map(sanitizeStoredTrack).slice(0, 60);
        // Aprender de la búsqueda sin asumir que el canal del usuario es el cantante.
        // Las pistas efectivamente escuchadas tienen prioridad al reproducirse.
        learnMixTracks(sanitizedTracks.slice(0, 30), { origin: "search", query: clean });
        setOnlineTracks(sanitizedTracks);
        // Una búsqueda nueva define un orden de reproducción claro. Así los
        // botones anterior/siguiente recorren el catálogo en el mismo orden
        // mostrado cuando el modo aleatorio está apagado.
        setQueueIds(sanitizedTracks.map((track) => track.id));
        const initialPlayable = sanitizedTracks.find((track) => !asExtendedTrack(track)?.externalOnly);
        if (initialPlayable) playTrack(initialPlayable, sanitizedTracks);
        else setOnlineError("Se encontraron videos disponibles en YouTube, pero ninguno permite la reproducción integrada. Puedes abrirlos desde la lista.");
      } catch (error) {
        if (controller.signal.aborted || requestId !== onlineSearchRequestRef.current) return;
        setOnlineError(error instanceof Error ? error.message : "Error buscando música online.");
      } finally {
        if (requestId === onlineSearchRequestRef.current) setOnlineLoading(false);
      }
    },
    [onlineProviderMode, onlineQuery, playTrack, query, learnMixTracks, setView],
  );

  const searchRadio = useCallback(
    async (term?: string, countryCode = "CL") => {
      if (radioRequestPendingRef.current) return;
      radioInitialRequestRef.current = true;
      radioRequestPendingRef.current = true;
      const clean = term !== undefined ? term.trim() : (radioQuery || "").trim();
      setRadioLoading(true);
      setRadioError("");
      try {
        const res = await fetch("/api/music/radio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: clean, countryCode, limit: 24 }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudieron buscar radios.");
        const tracks = Array.isArray(data.tracks) ? (data.tracks as EduMusicTrack[]) : [];
        if (!tracks.length) {
          setRadioError("No encontré radios activas para esa búsqueda. Prueba con otra ciudad, país o nombre de radio.");
          return;
        }
        const normalized = tracks.map(sanitizeStoredTrack);
        setRadioResults(normalized);
        setOnlineTracks((prev) => {
          const map = new Map<string, EduMusicTrack>();
          [...prev, ...normalized].forEach((track) => map.set(track.id, track));
          return [...map.values()].slice(-120);
        });
      } catch (error) {
        setRadioError(error instanceof Error ? error.message : "Error buscando radios online.");
      } finally {
        radioRequestPendingRef.current = false;
        setRadioLoading(false);
      }
    },
    [radioQuery],
  );

  useEffect(() => {
    if (!hydrated || view !== "radio" || radioLoading || radioInitialRequestRef.current) return;
    radioInitialRequestRef.current = true;
    void searchRadio("", "CL");
  }, [hydrated, radioLoading, radioTracks.length, searchRadio, view]);

  const value: MusicContextValue = {
    view,
    setView,
    query,
    setQuery,
    onlineQuery,
    setOnlineQuery,
    recentSearches,
    onlineLoading,
    onlineError,
    onlineProviderMode,
    setOnlineProviderMode,
    radioQuery,
    setRadioQuery,
    radioLoading,
    radioError,
    radioTracks,
    radioFavoriteTracks,
    searchRadio,
    selectedMood,
    setSelectedMood,
    volume,
    setVolume,
    playing,
    setPlaying,
    hasActiveSession,
    clearActiveSession,
    currentTrack,
    selectedPlaylist,
    selectedPlaylistId,
    setSelectedPlaylistId,
    playlists,
    userPlaylists,
    onlineTracks,
    uploadedTracks,
    recentTracks,
    audioUploadLoading,
    audioUploadError,
    uploadAudios,
    refreshUploadedAudios,
    visibleTracks,
    baseTracks,
    allTracks,
    liked,
    favoriteSyncStatus,
    favoriteTracks,
    favoriteSession,
    startFavorites,
    mixFavoriteActive,
    mixFavoriteLoading,
    mixFavoriteError,
    mixFavoriteArtists: [...new Set([...MIX_FAVORITE_SEED_ARTISTS, ...mixArtists])],
    mixFavoriteLearnedCount: mixLearnedSongs.length,
    mixFavoriteTracks: mixQueueTracks,
    startMixFavorite,
    stopMixFavorite,
    loadMoreMixFavorite,
    createOpen,
    setCreateOpen,
    newPlaylistName,
    setNewPlaylistName,
    pendingTrackId,
    setPendingTrackId,
    queue,
    queueIds,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    playTrack,
    playPlaylist,
    nextTrack,
    prevTrack,
    toggleLike,
    createPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    deletePlaylist,
    requestAddToPlaylist,
    addToQueue,
    clearQueue,
    currentTime,
    durationSeconds,
    seekTo,
    searchOnline,
    clearOnlineResults,
  };

  return (
    <MusicContext.Provider value={value}>
      <audio ref={audioRef} preload="none" onEnded={() => { if (currentYouTubeTrackRef.current.source !== "radio") nextTrackRef.current("ended"); }} />
      {children}
    </MusicContext.Provider>
  );
}

export function useEduAIMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useEduAIMusic must be used inside MusicProvider");
  return context;
}
