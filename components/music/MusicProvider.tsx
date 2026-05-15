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
  | "queue";
type RepeatMode = "off" | "one" | "all";

type OnlineProviderMode = "all" | "full" | "preview" | "youtube";

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
  selectedMood: EduMusicMood | "all";
  setSelectedMood: (value: EduMusicMood | "all") => void;
  volume: number;
  setVolume: (value: number) => void;
  playing: boolean;
  setPlaying: (value: boolean | ((prev: boolean) => boolean)) => void;
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
};

const STORAGE_KEY = "eduai_music_player_v52";
const MusicContext = createContext<MusicContextValue | null>(null);

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

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<MusicView>("home");
  const [query, setQuery] = useState("");
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [onlineProviderMode, setOnlineProviderMode] = useState<OnlineProviderMode>("full");
  const [selectedMood, setSelectedMood] = useState<EduMusicMood | "all">("all");
  const [volume, setVolume] = useState(0.62);
  const [playing, setPlaying] = useState(false);
  const [currentId, setCurrentId] = useState(EDU_MUSIC_TRACKS[0]?.id);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(
    SYSTEM_PLAYLISTS[0]?.id,
  );
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
    [...EDU_MUSIC_TRACKS, ...onlineTracks].forEach((track) =>
      byId.set(track.id, track),
    );
    return Array.from(byId.values());
  }, [onlineTracks]);

  const getTrack = useCallback(
    (id?: string) => allTracks.find((track) => track.id === id),
    [allTracks],
  );

  useEffect(() => {
    const stored = safeReadState();
    if (stored.volume !== undefined) setVolume(stored.volume);
    if (stored.onlineTracks) setOnlineTracks(stored.onlineTracks.slice(0, 60));
    if (stored.trackId && !stored.trackId.startsWith("youtube-")) setCurrentId(stored.trackId);
    if (stored.playlistId) setSelectedPlaylistId(stored.playlistId);
    if (stored.likedTrackIds) setLikedTrackIds(stored.likedTrackIds);
    if (stored.userPlaylists) setUserPlaylists(stored.userPlaylists);
    if (stored.queueIds) setQueueIds(stored.queueIds.filter((id) => !id.startsWith("youtube-")));
    // Always start searches in full-song mode. YouTube remains a fallback when no full audio is found.
    setOnlineProviderMode("full");
    if (stored.view) setView(stored.view);
    if (stored.shuffle !== undefined) setShuffle(stored.shuffle);
    if (stored.repeat) setRepeat(stored.repeat);
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
      description: "Previews encontrados en la web mediante iTunes Search API.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#e0f2fe,#ddd6fe)",
      trackIds: onlineTracks.map((track) => track.id),
      system: true,
    };
    return [
      ...SYSTEM_PLAYLISTS,
      onlinePlaylist,
      likedPlaylist,
      ...userPlaylists,
    ];
  }, [likedTrackIds, onlineTracks, userPlaylists]);

  const selectedPlaylist = useMemo(
    () =>
      playlists.find((playlist) => playlist.id === selectedPlaylistId) ??
      playlists[0],
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
    const source = view === "search" || q ? allTracks : baseTracks;
    return source.filter((track) => {
      const moodOk = selectedMood === "all" || track.mood === selectedMood;
      const queryOk =
        !q ||
        [
          track.title,
          track.artist,
          track.album,
          track.mood,
          track.source || "",
          ...track.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return moodOk && queryOk;
    });
  }, [allTracks, baseTracks, query, selectedMood, view]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const state: StoredState = {
      trackId: currentId,
      playlistId: selectedPlaylistId,
      volume,
      likedTrackIds,
      userPlaylists,
      onlineTracks: onlineTracks.slice(0, 60),
      onlineProviderMode: onlineProviderMode === "youtube" ? "full" : onlineProviderMode,
      queueIds,
      view,
      shuffle,
      repeat,
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
  ]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

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
    setCurrentTime(0);
    setDurationSeconds(0);
  }, [currentTrack?.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentTrack?.source === "youtube" || !currentTrack?.src) {
      audio.pause();
      if (playing) setPlaying(false);
      return;
    }
    if (playing) audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [playing, currentTrack?.src, currentTrack?.source]);

  const playTrack = useCallback(
    (track: EduMusicTrack, queueFrom?: EduMusicTrack[]) => {
      if (queueFrom?.length) setQueueIds(queueFrom.map((t) => t.id));
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
      const playlist =
        playlists.find((p) => p.id === (playlistId || selectedPlaylistId)) ??
        selectedPlaylist;
      const tracks = getTracksForPlaylist(playlist, allTracks);
      if (!tracks.length) return;
      setSelectedPlaylistId(playlist.id);
      setQueueIds(tracks.map((track) => track.id));
      setCurrentId(tracks[0].id);
      setPlaying(true);
    },
    [allTracks, playlists, selectedPlaylist, selectedPlaylistId],
  );

  const nextTrack = useCallback(() => {
    if (repeat === "one") {
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
      const random =
        others[Math.floor(Math.random() * others.length)] ?? list[0];
      setCurrentId(random.id);
      setPlaying(true);
      return;
    }

    const index = Math.max(
      0,
      list.findIndex((track) => track.id === currentId),
    );
    const next = list[index + 1] ?? (repeat === "all" ? list[0] : null);
    if (next) {
      setCurrentId(next.id);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  }, [allTracks, baseTracks, currentId, queue, repeat, shuffle, visibleTracks]);

  const prevTrack = useCallback(() => {
    const list = queue.length
      ? queue
      : visibleTracks.length
        ? visibleTracks
        : baseTracks.length
          ? baseTracks
          : allTracks;
    if (!list.length) return;
    const index = Math.max(
      0,
      list.findIndex((track) => track.id === currentId),
    );
    const prev = list[(index - 1 + list.length) % list.length];
    if (prev) {
      setCurrentId(prev.id);
      setPlaying(true);
    }
  }, [allTracks, baseTracks, currentId, queue, visibleTracks]);

  const toggleLike = useCallback((id: string) => {
    setLikedTrackIds((prev) =>
      prev.includes(id)
        ? prev.filter((trackId) => trackId !== id)
        : [...prev, id],
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
      trackIds: pendingTrackId
        ? [pendingTrackId]
        : currentTrack
          ? [currentTrack.id]
          : [],
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
      setLikedTrackIds((prev) =>
        prev.includes(trackId) ? prev : [...prev, trackId],
      );
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

  const removeFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      if (playlistId === "pl-liked") {
        setLikedTrackIds((prev) => prev.filter((id) => id !== trackId));
        return;
      }
      setUserPlaylists((prev) =>
        prev.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                trackIds: playlist.trackIds.filter((id) => id !== trackId),
              }
            : playlist,
        ),
      );
    },
    [],
  );

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      setUserPlaylists((prev) =>
        prev.filter((playlist) => playlist.id !== playlistId),
      );
      if (selectedPlaylistId === playlistId)
        setSelectedPlaylistId(SYSTEM_PLAYLISTS[0]?.id);
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

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safe = Math.max(
      0,
      Math.min(
        seconds,
        Number.isFinite(audio.duration) ? audio.duration : seconds,
      ),
    );
    audio.currentTime = safe;
    setCurrentTime(safe);
  }, []);

  const searchOnline = useCallback(
    async (term?: string, providerOverride?: OnlineProviderMode) => {
      const mode = providerOverride || onlineProviderMode;
      if (providerOverride) setOnlineProviderMode(providerOverride);
      const clean = (term || onlineQuery || query).trim();
      if (!clean) return;
      setOnlineLoading(true);
      setOnlineError("");
      try {
        const res = await fetch("/api/music/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: clean,
            // Full mode searches complete audio first and lets the API fall back to YouTube only if needed.
            provider: mode === "youtube" ? "youtube" : mode || "full",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok)
          throw new Error(data?.error || "No se pudo buscar música online.");
        const tracks = Array.isArray(data.tracks)
          ? (data.tracks as EduMusicTrack[])
          : [];
        if (!tracks.length) {
          setOnlineError(
            mode === "full"
              ? (data?.sources?.youtube
                  ? "No encontré canciones completas en Jamendo/Audius ni videos embebibles de YouTube. Prueba con otro término o cambia a DJ 30s."
                  : "No encontré canciones completas en Jamendo/Audius. Para buscar videos de YouTube debes agregar YOUTUBE_API_KEY en Vercel o cambiar a DJ 30s.")
              : mode === "youtube"
                ? (data?.sources?.youtube
                    ? "No encontré videos embebibles de YouTube para esa búsqueda."
                    : "Falta configurar YOUTUBE_API_KEY en Vercel para buscar videos de YouTube.")
                : "No encontré resultados reproducibles para esa búsqueda.",
          );
          return;
        }
        setOnlineTracks((prev) => {
          const map = new Map<string, EduMusicTrack>();
          [...tracks, ...prev].forEach((track) => map.set(track.id, track));
          return Array.from(map.values()).slice(0, 60);
        });
        setSelectedPlaylistId("pl-online");
        setView("search");
        if (tracks[0]) playTrack(tracks[0], tracks);
      } catch (error) {
        setOnlineError(
          error instanceof Error
            ? error.message
            : "Error buscando música online.",
        );
      } finally {
        setOnlineLoading(false);
      }
    },
    [onlineProviderMode, onlineQuery, playTrack, query],
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
    selectedMood,
    setSelectedMood,
    volume,
    setVolume,
    playing,
    setPlaying,
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
  };

  return (
    <MusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={currentTrack?.source === "youtube" ? undefined : currentTrack?.src}
        preload="none"
        onEnded={nextTrack}
      />
      {children}
    </MusicContext.Provider>
  );
}

export function useEduAIMusic() {
  const context = useContext(MusicContext);
  if (!context)
    throw new Error("useEduAIMusic must be used inside MusicProvider");
  return context;
}
