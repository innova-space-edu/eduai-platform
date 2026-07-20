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
import {
  EDU_MUSIC_TRACKS,
  SYSTEM_PLAYLISTS,
  getTracksForPlaylist,
  type EduMusicMood,
  type EduMusicPlaylist,
  type EduMusicTrack,
} from "@/lib/music/eduai-music-catalog";

type MusicView =
  | "home"
  | "search"
  | "library"
  | "playlists"
  | "liked"
  | "queue"
  | "radio";
type RepeatMode = "off" | "one" | "all";
type OnlineProviderMode = "all" | "full" | "preview" | "youtube";

type ExtendedEduMusicTrack = EduMusicTrack & {
  playable?: boolean;
  externalOnly?: boolean;
  embedOnly?: boolean;
  embedUrl?: string;
  loaderUrl?: string;
};

type StoredState = {
  trackId?: string;
  playlistId?: string;
  volume?: number;
  likedTrackIds?: string[];
  userPlaylists?: EduMusicPlaylist[];
  onlineTracks?: EduMusicTrack[];
  onlineProviderMode?: OnlineProviderMode;
  queueIds?: string[];
  view?: MusicView;
  shuffle?: boolean;
  repeat?: RepeatMode;
  hasActiveSession?: boolean;
};

type MusicContextValue = {
  view: MusicView;
  setView: (value: MusicView) => void;
  query: string;
  setQuery: (value: string) => void;
  onlineQuery: string;
  setOnlineQuery: (value: string) => void;
  onlineLoading: boolean;
  onlineError: string;
  onlineProviderMode: OnlineProviderMode;
  setOnlineProviderMode: (value: OnlineProviderMode) => void;
  radioQuery: string;
  setRadioQuery: (value: string) => void;
  radioLoading: boolean;
  radioError: string;
  radioTracks: EduMusicTrack[];
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
  visibleTracks: EduMusicTrack[];
  baseTracks: EduMusicTrack[];
  allTracks: EduMusicTrack[];
  liked: Set<string>;
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
export const YOUTUBE_PLAYER_ID = "eduai-youtube-global-player";
const MusicContext = createContext<MusicContextValue | null>(null);

let youtubeApiPromise: Promise<void> | null = null;
let hlsScriptPromise: Promise<void> | null = null;

function safeReadState(): StoredState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function unique(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
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

  youtubeApiPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    window.onYouTubeIframeAPIReady = () => resolve();
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
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

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeReadyRef = useRef(false);
  const youtubeVideoIdRef = useRef<string>("");
  const youtubeRetryRef = useRef(0);
  const playingRef = useRef(false);
  const hlsRef = useRef<any>(null);
  const nextTrackRef = useRef<() => void>(() => {});
  const onlineSearchAbortRef = useRef<AbortController | null>(null);
  const onlineSearchRequestRef = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<MusicView>("home");
  const [query, setQuery] = useState("");
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineProviderMode, setOnlineProviderMode] = useState<OnlineProviderMode>("full");
  const [radioQuery, setRadioQuery] = useState("Chile");
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioError, setRadioError] = useState("");
  const [selectedMood, setSelectedMood] = useState<EduMusicMood | "all">("all");
  const [volume, setVolume] = useState(0.62);
  const [playing, setPlaying] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [currentId, setCurrentId] = useState(EDU_MUSIC_TRACKS[0]?.id);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(SYSTEM_PLAYLISTS[0]?.id);
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<EduMusicPlaylist[]>([]);
  const [onlineTracks, setOnlineTracks] = useState<EduMusicTrack[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("all");
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const allTracks = useMemo(() => {
    const byId = new Map<string, EduMusicTrack>();
    [...EDU_MUSIC_TRACKS, ...onlineTracks].forEach((track) => byId.set(track.id, track));
    return Array.from(byId.values());
  }, [onlineTracks]);

  const radioTracks = useMemo(
    () => allTracks.filter((track) => track.source === "radio"),
    [allTracks],
  );

  const getTrack = useCallback(
    (id?: string) => allTracks.find((track) => track.id === id),
    [allTracks],
  );

  useEffect(() => {
    const stored = safeReadState();
    if (stored.volume !== undefined) setVolume(stored.volume);
    if (stored.onlineTracks) {
      setOnlineTracks(stored.onlineTracks.slice(0, 80).map(sanitizeStoredTrack));
    }
    if (stored.trackId) setCurrentId(stored.trackId);
    if (stored.playlistId) setSelectedPlaylistId(stored.playlistId);
    if (stored.likedTrackIds) setLikedTrackIds(stored.likedTrackIds);
    if (stored.userPlaylists) setUserPlaylists(stored.userPlaylists);
    if (stored.queueIds) setQueueIds(stored.queueIds);
    setOnlineProviderMode("full");
    if (stored.view) setView(stored.view === "radio" ? "radio" : stored.view);
    if (stored.shuffle !== undefined) setShuffle(stored.shuffle);
    if (stored.repeat) setRepeat(stored.repeat);
    if (stored.hasActiveSession) setHasActiveSession(true);
    setHydrated(true);
  }, []);

  const playlists = useMemo(() => {
    const likedPlaylist: EduMusicPlaylist = {
      id: "pl-liked",
      name: "Tus me gusta",
      description: "Canciones guardadas por ti.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#fee2e2,#bfdbfe)",
      trackIds: likedTrackIds,
      system: true,
    };
    const onlinePlaylist: EduMusicPlaylist = {
      id: "pl-online",
      name: "Resultados online",
      description: "Canciones, videos y radios encontrados desde fuentes externas.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#e0f2fe,#ddd6fe)",
      trackIds: onlineTracks.map((track) => track.id),
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
    return [...SYSTEM_PLAYLISTS, radioPlaylist, onlinePlaylist, likedPlaylist, ...userPlaylists];
  }, [likedTrackIds, onlineTracks, radioTracks, userPlaylists]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0],
    [playlists, selectedPlaylistId],
  );

  const baseTracks = useMemo(
    () => getTracksForPlaylist(selectedPlaylist, allTracks),
    [allTracks, selectedPlaylist],
  );

  const currentTrack = useMemo(
    () => getTrack(currentId) ?? allTracks[0] ?? EDU_MUSIC_TRACKS[0],
    [allTracks, currentId, getTrack],
  );

  const liked = useMemo(() => new Set(likedTrackIds), [likedTrackIds]);
  const queue = useMemo(
    () => queueIds.map((id) => getTrack(id)).filter(Boolean) as EduMusicTrack[],
    [getTrack, queueIds],
  );

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = view === "radio"
      ? radioTracks
      : view === "search" || q
        ? allTracks
        : baseTracks;
    return source.filter((track) => {
      const moodOk = view === "radio" || selectedMood === "all" || track.mood === selectedMood;
      const queryOk =
        !q ||
        [track.title, track.artist, track.album, track.mood, track.source || "", ...track.tags]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return moodOk && queryOk;
    });
  }, [allTracks, baseTracks, query, radioTracks, selectedMood, view]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const state: StoredState = {
      trackId: currentId,
      playlistId: selectedPlaylistId,
      volume,
      likedTrackIds,
      userPlaylists,
      onlineTracks: onlineTracks.slice(0, 80),
      onlineProviderMode: onlineProviderMode === "youtube" ? "full" : onlineProviderMode,
      queueIds,
      view,
      shuffle,
      repeat,
      hasActiveSession,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    hydrated,
    currentId,
    selectedPlaylistId,
    volume,
    likedTrackIds,
    userPlaylists,
    onlineTracks,
    onlineProviderMode,
    queueIds,
    view,
    shuffle,
    repeat,
    hasActiveSession,
  ]);

  useEffect(() => {
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

    const handleMediaError = () => {
      if (currentTrack?.source !== "radio") return;

      if (isFmdosTrack(currentTrack)) {
        const fallback = queue.find(
          (track) =>
            track.id !== currentTrack.id &&
            isFmdosTrack(track) &&
            Boolean(track.src) &&
            !isBlockedBrowserAudioSrc(track.src),
        );
        if (fallback) {
          setRadioError(`${currentTrack.title} falló. Probando señal alternativa de FM Dos...`);
          setCurrentId(fallback.id);
          setPlaying(true);
          return;
        }
      }

      setPlaying(false);
      setRadioError(
        `No se pudo reproducir ${currentTrack.title}. La emisora puede estar usando HTTP, un certificado inválido o una señal que el navegador bloquea. Usa “Abrir fuente” o prueba otra radio.`,
      );
    };

    const handlePlaying = () => {
      if (currentTrack?.source === "radio") setRadioError("");
    };

    audio.addEventListener("error", handleMediaError);
    audio.addEventListener("playing", handlePlaying);
    return () => {
      audio.removeEventListener("error", handleMediaError);
      audio.removeEventListener("playing", handlePlaying);
    };
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.title, queue]);

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

    if (currentTrack?.source === "youtube" || isEmbedTrack(currentTrack) || !currentTrack?.src) return;

    if (currentTrack.source === "radio" && isBlockedBrowserAudioSrc(currentTrack.src)) {
      setPlaying(false);
      setRadioError(
        `${currentTrack.title} usa una señal bloqueada por el navegador por HTTP o certificado inválido. Busca otra radio o abre la fuente oficial.`,
      );
      return;
    }

    if (isHlsUrl(currentTrack.src)) {
      if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = currentTrack.src;
        audio.load();
        return;
      }
      void loadHlsScript()
        .then(() => {
          if (!window.Hls?.isSupported?.()) {
            audio.src = currentTrack.src;
            audio.load();
            return;
          }
          const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(currentTrack.src);
          hls.attachMedia(audio);
        })
        .catch(() => {
          audio.src = currentTrack.src;
          audio.load();
        });
      return;
    }

    audio.src = currentTrack.src;
    audio.load();
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack?.source === "youtube") {
      audio.pause();
      if (youtubeReadyRef.current && youtubePlayerRef.current) {
        try {
          if (playing) {
            youtubeRetryRef.current = 0;
            youtubePlayerRef.current.playVideo();
          } else {
            youtubePlayerRef.current.pauseVideo();
          }
        } catch {}
      }
      return;
    }

    if (isEmbedTrack(currentTrack) || !currentTrack?.src) {
      audio.pause();
      if (playing) setPlaying(false);
      return;
    }

    if (playing) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, currentTrack?.src, currentTrack?.source]);


  useEffect(() => {
    if (!playing || currentTrack?.source !== "itunes") return;
    const previewSeconds = 30;
    setDurationSeconds(previewSeconds);
    const remainingMs = Math.max(1200, (previewSeconds - Math.min(currentTime || 0, previewSeconds) + 0.25) * 1000);
    const timer = window.setTimeout(() => {
      const audio = audioRef.current;
      const nearEnd = !audio || audio.ended || audio.currentTime >= previewSeconds - 0.8;
      if (nearEnd || !Number.isFinite(audio?.duration || Number.NaN)) nextTrackRef.current();
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [playing, currentTrack?.id, currentTrack?.source, currentTime]);

  const playTrack = useCallback(
    (track: EduMusicTrack, queueFrom?: EduMusicTrack[]) => {
      setHasActiveSession(true);
      if (queueFrom?.length) setQueueIds(queueFrom.map((t) => t.id));

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
          `${track.title} usa una señal bloqueada por el navegador por HTTP o certificado inválido. Se abrirá la fuente oficial si está disponible.`,
        );
        if (externalUrl && typeof window !== "undefined") {
          window.open(externalUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }

      if (!track.src && externalUrl && (track.source === "radio" || track.source === "external")) {
        setCurrentId(track.id);
        setPlaying(false);
        setRadioError(
          `${track.title} no tiene una señal HTTPS reproducible directamente en el navegador. Se abrirá la fuente oficial.`,
        );
        if (typeof window !== "undefined") {
          window.open(externalUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }

      if (track.id === currentId) {
        setPlaying((value) => !value);
        return;
      }
      setCurrentId(track.id);
      setPlaying(true);
    },
    [currentId],
  );

  const playPlaylist = useCallback(
    (playlistId?: string) => {
      const playlist = playlists.find((p) => p.id === (playlistId || selectedPlaylistId)) ?? selectedPlaylist;
      const tracks = getTracksForPlaylist(playlist, allTracks);
      if (!tracks.length) return;
      setHasActiveSession(true);
      setSelectedPlaylistId(playlist.id);
      setQueueIds(tracks.map((track) => track.id));
      setCurrentId(tracks[0].id);
      setPlaying(!isEmbedTrack(tracks[0]));
    },
    [allTracks, playlists, selectedPlaylist, selectedPlaylistId],
  );

  const nextTrack = useCallback(() => {
    setHasActiveSession(true);
    if (repeat === "one") {
      if (isEmbedTrack(currentTrack)) {
        setPlaying(false);
        return;
      }
      if (currentTrack?.source === "youtube" && youtubePlayerRef.current?.seekTo) {
        try {
          youtubePlayerRef.current.seekTo(0, true);
          youtubePlayerRef.current.playVideo();
        } catch {}
        setPlaying(true);
        return;
      }
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => setPlaying(false));
      }
      setPlaying(true);
      return;
    }

    const list = queue.length
      ? queue
      : visibleTracks.length
        ? visibleTracks
        : baseTracks.length
          ? baseTracks
          : allTracks;
    if (!list.length) return;

    if (shuffle && list.length > 1) {
      const others = list.filter((track) => track.id !== currentId);
      const random = others[Math.floor(Math.random() * others.length)] ?? list[0];
      setCurrentId(random.id);
      setPlaying(true);
      return;
    }

    const index = Math.max(0, list.findIndex((track) => track.id === currentId));
    const next = list[index + 1] ?? (repeat === "all" ? list[0] : null);
    if (next) {
      setCurrentId(next.id);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  }, [allTracks, baseTracks, currentId, currentTrack?.source, queue, repeat, shuffle, visibleTracks]);

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  const prevTrack = useCallback(() => {
    setHasActiveSession(true);
    const list = queue.length
      ? queue
      : visibleTracks.length
        ? visibleTracks
        : baseTracks.length
          ? baseTracks
          : allTracks;
    if (!list.length) return;
    const index = Math.max(0, list.findIndex((track) => track.id === currentId));
    const prev = list[(index - 1 + list.length) % list.length];
    if (prev) {
      setCurrentId(prev.id);
      setPlaying(true);
    }
  }, [allTracks, baseTracks, currentId, queue, visibleTracks]);

  useEffect(() => {
    if (typeof window === "undefined" || currentTrack?.source !== "youtube") return;

    const videoId = currentTrack.youtubeVideoId;
    if (!videoId) return;

    let cancelled = false;
    let mountRetry: number | null = null;

    const mountPlayer = async () => {
      await loadYouTubeApi();
      if (cancelled || !window.YT?.Player) return;

      const target = document.getElementById(YOUTUBE_PLAYER_ID);
      if (!target) {
        mountRetry = window.setTimeout(mountPlayer, 120);
        return;
      }

      const playerVars = {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      };

      const startVideo = (player: any, forceLoad = false) => {
        try {
          player.setVolume?.(Math.round(volume * 100));
          player.unMute?.();
          const loadedId = youtubeVideoIdRef.current;
          if (forceLoad || loadedId !== videoId) {
            youtubeVideoIdRef.current = videoId;
            player.loadVideoById?.(videoId);
          }
          if (playingRef.current) player.playVideo?.();
        } catch {}
      };

      if (!youtubePlayerRef.current) {
        youtubeReadyRef.current = false;
        youtubePlayerRef.current = new window.YT.Player(YOUTUBE_PLAYER_ID, {
          height: "100%",
          width: "100%",
          videoId,
          playerVars,
          events: {
            onReady: (event: any) => {
              youtubeReadyRef.current = true;
              youtubeRetryRef.current = 0;
              startVideo(event.target, true);
            },
            onStateChange: (event: any) => {
              const state = event.data;
              if (state === window.YT?.PlayerState?.PLAYING) {
                setPlaying(true);
                youtubeRetryRef.current = 0;
                return;
              }
              if (state === window.YT?.PlayerState?.PAUSED) {
                setPlaying(false);
                return;
              }
              if (state === window.YT?.PlayerState?.ENDED) {
                nextTrackRef.current();
              }
            },
            onError: () => {
              nextTrackRef.current();
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
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.youtubeVideoId, volume]);

  useEffect(() => {
    if (currentTrack?.source !== "youtube") return;
    const timer = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player || !youtubeReadyRef.current) return;
      try {
        const time = Number(player.getCurrentTime?.() || 0);
        const duration = Number(player.getDuration?.() || 0);
        const state = Number(player.getPlayerState?.());
        const safeTime = Number.isFinite(time) ? time : 0;
        const safeDuration = Number.isFinite(duration) ? duration : 0;
        setCurrentTime(safeTime);
        setDurationSeconds(safeDuration);

        if (playingRef.current) {
          const PlayerState = window.YT?.PlayerState || {};
          const isStuck = state === PlayerState.UNSTARTED || state === PlayerState.CUED;
          if (isStuck && youtubeRetryRef.current < 6) {
            youtubeRetryRef.current += 1;
            player.playVideo?.();
          }
        }

        if (safeDuration > 0 && safeTime >= safeDuration - 0.8) {
          nextTrackRef.current();
        }
      } catch {}
    }, 700);
    return () => window.clearInterval(timer);
  }, [currentTrack?.source, currentTrack?.youtubeVideoId]);

  const toggleLike = useCallback((id: string) => {
    setLikedTrackIds((prev) =>
      prev.includes(id) ? prev.filter((trackId) => trackId !== id) : [...prev, id],
    );
  }, []);

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
      setLikedTrackIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
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
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    if (playlistId === "pl-liked") {
      setLikedTrackIds((prev) => prev.filter((id) => id !== trackId));
      return;
    }
    setUserPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
          : playlist,
      ),
    );
  }, []);

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      setUserPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId(SYSTEM_PLAYLISTS[0]?.id);
    },
    [selectedPlaylistId],
  );

  const requestAddToPlaylist = useCallback((trackId: string) => {
    setPendingTrackId((prev) => (prev === trackId ? null : trackId));
  }, []);

  const addToQueue = useCallback((trackId: string) => {
    setQueueIds((prev) => unique([...prev, trackId]));
  }, []);

  const clearQueue = useCallback(() => setQueueIds([]), []);

  const seekTo = useCallback(
    (seconds: number) => {
      if (currentTrack?.source === "youtube" && youtubePlayerRef.current?.seekTo) {
        try {
          youtubePlayerRef.current.seekTo(seconds, true);
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
      onlineSearchRequestRef.current += 1;
      const requestId = onlineSearchRequestRef.current;
      onlineSearchAbortRef.current?.abort();
      const controller = new AbortController();
      onlineSearchAbortRef.current = controller;
      setOnlineLoading(true);
      setOnlineError("");
      // Una búsqueda representa una nueva sesión: no mezclamos resultados ni
      // conservamos la lista anterior mientras se consulta el nuevo término.
      setOnlineTracks([]);
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
            limit: mode === "youtube" ? 24 : 24,
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
        setOnlineTracks(tracks.map(sanitizeStoredTrack).slice(0, 60));
        if (tracks[0]) playTrack(tracks[0], tracks);
      } catch (error) {
        if (controller.signal.aborted || requestId !== onlineSearchRequestRef.current) return;
        setOnlineError(error instanceof Error ? error.message : "Error buscando música online.");
      } finally {
        if (requestId === onlineSearchRequestRef.current) setOnlineLoading(false);
      }
    },
    [onlineProviderMode, onlineQuery, playTrack, query],
  );

  const searchRadio = useCallback(
    async (term?: string, countryCode = "CL") => {
      const clean = (term || radioQuery || "Chile").trim();
      if (!clean) return;
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
        setOnlineTracks((prev) => {
          const map = new Map<string, EduMusicTrack>();
          [...tracks.map(sanitizeStoredTrack), ...prev.map(sanitizeStoredTrack)].forEach((track) => map.set(track.id, track));
          return Array.from(map.values()).slice(0, 80);
        });
        setSelectedPlaylistId("pl-radio");
        setView("radio");
        playTrack(tracks[0], tracks);
      } catch (error) {
        setRadioError(error instanceof Error ? error.message : "Error buscando radios online.");
      } finally {
        setRadioLoading(false);
      }
    },
    [playTrack, radioQuery],
  );

  const value: MusicContextValue = {
    view,
    setView,
    query,
    setQuery,
    onlineQuery,
    setOnlineQuery,
    onlineLoading,
    onlineError,
    onlineProviderMode,
    setOnlineProviderMode,
    radioQuery,
    setRadioQuery,
    radioLoading,
    radioError,
    radioTracks,
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
    visibleTracks,
    baseTracks,
    allTracks,
    liked,
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
      <audio ref={audioRef} preload="none" onEnded={nextTrack} />
      {children}
    </MusicContext.Provider>
  );
}

export function useEduAIMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useEduAIMusic must be used inside MusicProvider");
  return context;
}
