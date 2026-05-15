"use client";

import Link from "next/link";
import {
  MOOD_LABELS,
  type EduMusicTrack,
} from "@/lib/music/eduai-music-catalog";
import { useEduAIMusic } from "@/components/music/MusicProvider";

type PlayerMode = "panel" | "mini" | "page";

type Props = {
  mode?: PlayerMode;
  showMiniWhenStopped?: boolean;
  onOpenPanel?: () => void;
};

function PlaylistCover({
  cover,
  label,
  size = "md",
}: {
  cover: string;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const cls =
    size === "lg"
      ? "h-24 w-24 rounded-3xl text-3xl"
      : size === "sm"
        ? "h-10 w-10 rounded-xl text-base"
        : "h-14 w-14 rounded-2xl text-xl";
  return (
    <div
      className={`${cls} flex items-center justify-center text-white font-black shadow-inner`}
      style={{ background: cover }}
    >
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrackRows({
  tracks,
  currentId,
  playing,
  onPlay,
  onLike,
  liked,
  onAddToPlaylist,
}: {
  tracks: EduMusicTrack[];
  currentId?: string;
  playing: boolean;
  onPlay: (track: EduMusicTrack) => void;
  onLike: (id: string) => void;
  liked: Set<string>;
  onAddToPlaylist: (trackId: string) => void;
}) {
  if (tracks.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-emerald-100/70">
        No encontré canciones con ese filtro.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {tracks.map((track, index) => {
        const active = track.id === currentId;
        return (
          <div
            key={track.id}
            className={`group grid grid-cols-[28px,1fr,44px,32px,32px] items-center gap-2 rounded-2xl px-2 py-2 transition ${active ? "bg-emerald-500/16 text-white" : "text-emerald-50 hover:bg-white/8"}`}
          >
            <button
              onClick={() => onPlay(track)}
              className={`h-7 w-7 rounded-full text-xs font-black ${active ? "bg-emerald-400 text-black" : "bg-white/8 text-white group-hover:bg-white/15"}`}
              aria-label={`Reproducir ${track.title}`}
            >
              {active && playing ? "Ⅱ" : active ? "▶" : index + 1}
            </button>
            <button onClick={() => onPlay(track)} className="min-w-0 text-left">
              <p className="truncate text-sm font-bold">{track.title}</p>
              <p className="truncate text-[11px] text-emerald-100/60">
                {track.artist} · {track.album}
              </p>
            </button>
            <span className="text-right text-[11px] text-emerald-100/55">
              {track.duration}
            </span>
            <button
              onClick={() => onLike(track.id)}
              className={`h-8 w-8 rounded-full text-sm transition ${liked.has(track.id) ? "text-emerald-300" : "text-emerald-100/50 hover:text-emerald-200"}`}
              aria-label="Me gusta"
            >
              ♥
            </button>
            <button
              onClick={() => onAddToPlaylist(track.id)}
              className="h-8 w-8 rounded-full text-lg text-emerald-100/50 hover:bg-white/10 hover:text-white transition"
              aria-label="Agregar a playlist"
            >
              +
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function EduAIMusicPlayer({
  mode = "panel",
  showMiniWhenStopped = false,
  onOpenPanel,
}: Props) {
  const music = useEduAIMusic();
  const {
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
  } = music;

  if (mode === "mini") {
    if (!playing && !showMiniWhenStopped) return null;
    return (
      <div className="w-[320px] rounded-3xl border border-emerald-400/20 bg-[#07120d]/96 text-white shadow-2xl shadow-emerald-900/30 px-3 py-2.5 flex items-center gap-3 backdrop-blur-xl">
        <button
          onClick={onOpenPanel}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <PlaylistCover
            cover={currentTrack.cover}
            label={currentTrack.title}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-xs font-black truncate">{currentTrack.title}</p>
            <p className="text-[10px] text-emerald-200/75 truncate">
              {currentTrack.artist} · EduAI Music
            </p>
          </div>
        </button>
        <button
          onClick={prevTrack}
          className="h-8 w-8 rounded-full bg-white/8 hover:bg-white/15 text-sm"
        >
          ‹
        </button>
        <button
          onClick={() => setPlaying((v) => !v)}
          className="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black"
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button
          onClick={nextTrack}
          className="h-8 w-8 rounded-full bg-white/8 hover:bg-white/15 text-sm"
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${mode === "page" ? "min-h-[calc(100vh-32px)]" : "h-full"} overflow-hidden rounded-[28px] bg-[#07120d] text-white border border-emerald-500/15 shadow-2xl shadow-emerald-950/30`}
    >
      <div
        className={`${mode === "page" ? "grid min-h-[calc(100vh-32px)] lg:grid-cols-[260px,1fr]" : "flex h-full flex-col"}`}
      >
        <aside
          className={`${mode === "page" ? "border-r border-white/10" : "border-b border-white/10"} bg-black/20 p-3`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-black font-black">
                ♫
              </div>
              <div>
                <p className="text-sm font-black leading-tight">EduAI Music</p>
                <p className="text-[10px] text-emerald-100/55">
                  Playlists focus
                </p>
              </div>
            </div>
            {mode !== "page" && (
              <Link
                href="/music"
                className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-white/10"
              >
                Abrir
              </Link>
            )}
          </div>

          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="mt-3 w-full rounded-2xl bg-white/8 px-3 py-2 text-left text-xs font-bold text-emerald-50 hover:bg-white/12"
          >
            + Crear playlist
          </button>
          {createOpen && (
            <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-2">
              <input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createPlaylist();
                }}
                placeholder="Nombre de la playlist"
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white outline-none placeholder:text-emerald-100/40"
              />
              <button
                onClick={createPlaylist}
                className="mt-2 w-full rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-black hover:bg-emerald-400"
              >
                Guardar playlist
              </button>
            </div>
          )}

          <div
            className={`${mode === "page" ? "mt-5 space-y-2" : "mt-3 flex gap-2 overflow-x-auto pb-1"}`}
          >
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setSelectedPlaylistId(playlist.id)}
                className={`${mode === "page" ? "w-full" : "min-w-[150px]"} rounded-2xl border p-2 text-left transition ${selectedPlaylistId === playlist.id ? "border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <div className="flex items-center gap-2">
                  <PlaylistCover
                    cover={playlist.cover}
                    label={playlist.name}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">
                      {playlist.name}
                    </p>
                    <p className="truncate text-[10px] text-emerald-100/50">
                      {playlist.trackIds.length} canciones
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/10 bg-gradient-to-br from-emerald-500/18 via-green-500/8 to-transparent p-4">
            <div className="flex items-end gap-4">
              <PlaylistCover
                cover={selectedPlaylist.cover}
                label={selectedPlaylist.name}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200/70">
                  Playlist
                </p>
                <h2 className="truncate text-2xl font-black tracking-tight">
                  {selectedPlaylist.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs text-emerald-100/65">
                  {selectedPlaylist.description}
                </p>
                <p className="mt-1 text-[10px] font-bold text-emerald-300">
                  {selectedPlaylist.trackIds.length} canciones ·{" "}
                  {MOOD_LABELS[selectedPlaylist.mood]}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => visibleTracks[0] && playTrack(visibleTracks[0])}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-black text-black hover:bg-emerald-400"
              >
                ▶ Reproducir
              </button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar canción, asignatura o mood..."
                className="min-w-[180px] flex-1 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs text-white outline-none placeholder:text-emerald-100/35"
              />
            </div>

            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  "all",
                  "focus",
                  "calm",
                  "classical",
                  "nature",
                  "energy",
                  "deep",
                ] as const
              ).map((mood) => (
                <button
                  key={mood}
                  onClick={() => setSelectedMood(mood)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${selectedMood === mood ? "border-emerald-400 bg-emerald-500/20 text-emerald-100" : "border-white/10 bg-white/5 text-emerald-100/65 hover:bg-white/10"}`}
                >
                  {mood === "all" ? "Todo" : MOOD_LABELS[mood]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-28">
            <TrackRows
              tracks={visibleTracks}
              currentId={currentTrack?.id}
              playing={playing}
              onPlay={playTrack}
              onLike={toggleLike}
              liked={liked}
              onAddToPlaylist={requestAddToPlaylist}
            />

            {pendingTrackId && (
              <div className="sticky bottom-3 mt-3 rounded-3xl border border-emerald-400/25 bg-[#0b1510]/95 p-3 shadow-2xl backdrop-blur-xl">
                <p className="text-xs font-bold text-emerald-100">
                  Agregar a playlist
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => addToPlaylist("pl-liked", pendingTrackId)}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15"
                  >
                    ♥ Me gusta
                  </button>
                  {userPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => addToPlaylist(playlist.id, pendingTrackId)}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15"
                    >
                      {playlist.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-black text-black hover:bg-emerald-400"
                  >
                    + Nueva
                  </button>
                  <button
                    onClick={() => setPendingTrackId(null)}
                    className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-emerald-100/60 hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/35 p-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <PlaylistCover
                cover={currentTrack.cover}
                label={currentTrack.title}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">
                  {currentTrack.title}
                </p>
                <p className="truncate text-[11px] text-emerald-100/55">
                  {currentTrack.artist}
                </p>
              </div>
              <button
                onClick={prevTrack}
                className="h-9 w-9 rounded-full bg-white/8 hover:bg-white/15"
              >
                ‹
              </button>
              <button
                onClick={() => setPlaying((v) => !v)}
                className="h-11 w-11 rounded-full bg-emerald-500 text-black font-black hover:bg-emerald-400"
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
              <button
                onClick={nextTrack}
                className="h-9 w-9 rounded-full bg-white/8 hover:bg-white/15"
              >
                ›
              </button>
              <div className="hidden min-w-[90px] items-center gap-2 sm:flex">
                <span className="text-xs text-emerald-100/60">Vol</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
