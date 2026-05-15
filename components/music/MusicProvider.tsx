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
  getTrackById,
  getTracksForPlaylist,
  type EduMusicMood,
  type EduMusicPlaylist,
  type EduMusicTrack,
} from "@/lib/music/eduai-music-catalog";

type StoredState = {
  trackId?: string;
  playlistId?: string;
  volume?: number;
  likedTrackIds?: string[];
  userPlaylists?: EduMusicPlaylist[];
};

type MusicContextValue = {
  query: string;
  setQuery: (value: string) => void;
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
  visibleTracks: EduMusicTrack[];
  baseTracks: EduMusicTrack[];
  liked: Set<string>;
  createOpen: boolean;
  setCreateOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  newPlaylistName: string;
  setNewPlaylistName: (value: string) => void;
  pendingTrackId: string | null;
  setPendingTrackId: (id: string | null) => void;
  playTrack: (track: EduMusicTrack) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleLike: (id: string) => void;
  createPlaylist: () => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  requestAddToPlaylist: (trackId: string) => void;
};

const STORAGE_KEY = "eduai_music_player_v4";
const MusicContext = createContext<MusicContextValue | null>(null);

function safeReadState(): StoredState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState<EduMusicMood | "all">("all");
  const [volume, setVolume] = useState(0.64);
  const [playing, setPlaying] = useState(false);
  const [currentId, setCurrentId] = useState(EDU_MUSIC_TRACKS[0]?.id);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(
    SYSTEM_PLAYLISTS[0]?.id,
  );
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<EduMusicPlaylist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const stored = safeReadState();
    if (stored.volume !== undefined) setVolume(stored.volume);
    if (stored.trackId && getTrackById(stored.trackId))
      setCurrentId(stored.trackId);
    if (stored.playlistId) setSelectedPlaylistId(stored.playlistId);
    if (stored.likedTrackIds) setLikedTrackIds(stored.likedTrackIds);
    if (stored.userPlaylists) setUserPlaylists(stored.userPlaylists);
    setHydrated(true);
  }, []);

  const playlists = useMemo(() => {
    const likedPlaylist: EduMusicPlaylist = {
      id: "pl-liked",
      name: "Tus me gusta",
      description: "Canciones guardadas por ti.",
      mood: "mixed",
      cover: "linear-gradient(135deg,#1DB954,#ec4899)",
      trackIds: likedTrackIds,
      system: true,
    };
    return [...SYSTEM_PLAYLISTS, likedPlaylist, ...userPlaylists];
  }, [likedTrackIds, userPlaylists]);

  const selectedPlaylist = useMemo(
    () =>
      playlists.find((playlist) => playlist.id === selectedPlaylistId) ??
      playlists[0],
    [playlists, selectedPlaylistId],
  );

  const baseTracks = useMemo(
    () => getTracksForPlaylist(selectedPlaylist),
    [selectedPlaylist],
  );
  const currentTrack = useMemo(
    () => getTrackById(currentId || "") ?? EDU_MUSIC_TRACKS[0],
    [currentId],
  );
  const liked = useMemo(() => new Set(likedTrackIds), [likedTrackIds]);

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseTracks.filter((track) => {
      const moodOk = selectedMood === "all" || track.mood === selectedMood;
      const queryOk =
        !q ||
        [track.title, track.artist, track.album, track.mood, ...track.tags]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return moodOk && queryOk;
    });
  }, [baseTracks, query, selectedMood]);

  const nextTrack = useCallback(() => {
    const list = visibleTracks.length
      ? visibleTracks
      : baseTracks.length
        ? baseTracks
        : EDU_MUSIC_TRACKS;
    const index = Math.max(
      0,
      list.findIndex((track) => track.id === currentId),
    );
    const next = list[(index + 1) % list.length];
    if (next) {
      setCurrentId(next.id);
      setPlaying(true);
    }
  }, [baseTracks, currentId, visibleTracks]);

  const prevTrack = useCallback(() => {
    const list = visibleTracks.length
      ? visibleTracks
      : baseTracks.length
        ? baseTracks
        : EDU_MUSIC_TRACKS;
    const index = Math.max(
      0,
      list.findIndex((track) => track.id === currentId),
    );
    const prev = list[(index - 1 + list.length) % list.length];
    if (prev) {
      setCurrentId(prev.id);
      setPlaying(true);
    }
  }, [baseTracks, currentId, visibleTracks]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const state: StoredState = {
      trackId: currentId,
      playlistId: selectedPlaylistId,
      volume,
      likedTrackIds,
      userPlaylists,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    hydrated,
    currentId,
    selectedPlaylistId,
    volume,
    likedTrackIds,
    userPlaylists,
  ]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, currentId]);

  const playTrack = useCallback(
    (track: EduMusicTrack) => {
      if (track.id === currentId) {
        setPlaying((value) => !value);
        return;
      }
      setCurrentId(track.id);
      setPlaying(true);
    },
    [currentId],
  );

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
      cover: "linear-gradient(135deg,#1DB954,#0ea5e9)",
      trackIds: pendingTrackId
        ? [pendingTrackId]
        : currentTrack
          ? [currentTrack.id]
          : [],
    };
    setUserPlaylists((prev) => [...prev, playlist]);
    setSelectedPlaylistId(playlist.id);
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
          ? {
              ...playlist,
              trackIds: playlist.trackIds.includes(trackId)
                ? playlist.trackIds
                : [...playlist.trackIds, trackId],
            }
          : playlist,
      ),
    );
    setPendingTrackId(null);
  }, []);

  const requestAddToPlaylist = useCallback((trackId: string) => {
    setPendingTrackId((prev) => (prev === trackId ? null : trackId));
  }, []);

  const value: MusicContextValue = {
    query,
    setQuery,
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
    visibleTracks,
    baseTracks,
    liked,
    createOpen,
    setCreateOpen,
    newPlaylistName,
    setNewPlaylistName,
    pendingTrackId,
    setPendingTrackId,
    playTrack,
    nextTrack,
    prevTrack,
    toggleLike,
    createPlaylist,
    addToPlaylist,
    requestAddToPlaylist,
  };

  return (
    <MusicContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={currentTrack?.src}
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
