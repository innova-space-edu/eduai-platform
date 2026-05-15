"use client";

import Link from "next/link";
import {
  EDU_MUSIC_TRACKS,
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

const NAV_ITEMS = [
  { id: "home", label: "Inicio", icon: "🏠" },
  { id: "search", label: "Buscar", icon: "🔎" },
  { id: "library", label: "Biblioteca", icon: "📚" },
  { id: "playlists", label: "Playlists", icon: "▦" },
  { id: "liked", label: "Me gusta", icon: "♥" },
  { id: "queue", label: "Cola", icon: "☰" },
] as const;

function Cover({ cover, label, size = "md" }: { cover: string; label: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const cls =
    size === "xl"
      ? "h-36 w-36 rounded-[30px] text-5xl"
      : size === "lg"
        ? "h-24 w-24 rounded-3xl text-3xl"
        : size === "sm"
          ? "h-11 w-11 rounded-xl text-base"
          : "h-16 w-16 rounded-2xl text-xl";
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center font-black text-white shadow-inner`} style={{ background: cover }}>
      {label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrackRows({ tracks, compact = false }: { tracks: EduMusicTrack[]; compact?: boolean }) {
  const music = useEduAIMusic();
  if (tracks.length === 0) {
    return <p className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-emerald-100/70">No hay canciones en esta vista todavía.</p>;
  }
  return (
    <div className="space-y-1.5">
      {tracks.map((track, index) => {
        const active = track.id === music.currentTrack.id;
        return (
          <div
            key={track.id}
            className={`group grid items-center gap-2 rounded-2xl px-2 py-2 transition ${compact ? "grid-cols-[28px,1fr,32px]" : "grid-cols-[34px,48px,1fr,54px,36px,36px,36px]"} ${active ? "bg-emerald-500/18 text-white" : "text-emerald-50 hover:bg-white/8"}`}
          >
            <button
              onClick={() => music.playTrack(track, tracks)}
              className={`h-8 w-8 rounded-full text-xs font-black ${active ? "bg-emerald-400 text-black" : "bg-white/8 text-white group-hover:bg-white/15"}`}
              aria-label={`Reproducir ${track.title}`}
            >
              {active && music.playing ? "Ⅱ" : active ? "▶" : index + 1}
            </button>
            {!compact && <Cover cover={track.cover} label={track.title} size="sm" />}
            <button onClick={() => music.playTrack(track, tracks)} className="min-w-0 text-left">
              <p className="truncate text-sm font-bold">{track.title}</p>
              <p className="truncate text-[11px] text-emerald-100/55">
                {track.artist} · {track.album} · {MOOD_LABELS[track.mood]}
              </p>
            </button>
            {!compact && <span className="text-right text-[11px] text-emerald-100/55">{track.duration}</span>}
            {!compact && (
              <button
                onClick={() => music.toggleLike(track.id)}
                className={`h-8 w-8 rounded-full text-sm transition ${music.liked.has(track.id) ? "text-emerald-300" : "text-emerald-100/45 hover:text-emerald-200"}`}
                aria-label="Me gusta"
              >
                ♥
              </button>
            )}
            {!compact && (
              <button
                onClick={() => music.addToQueue(track.id)}
                className="h-8 w-8 rounded-full text-sm text-emerald-100/45 transition hover:bg-white/10 hover:text-white"
                aria-label="Agregar a cola"
              >
                ≡
              </button>
            )}
            <button
              onClick={() => music.requestAddToPlaylist(track.id)}
              className="h-8 w-8 rounded-full text-lg text-emerald-100/45 transition hover:bg-white/10 hover:text-white"
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

function CreatePlaylistBox() {
  const music = useEduAIMusic();
  if (!music.createOpen) return null;
  return (
    <div className="rounded-3xl border border-white/10 bg-black/25 p-3">
      <p className="text-xs font-black text-emerald-100">Nueva playlist</p>
      <input
        value={music.newPlaylistName}
        onChange={(e) => music.setNewPlaylistName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") music.createPlaylist();
        }}
        placeholder="Ej: 4° medio matemáticas"
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white outline-none placeholder:text-emerald-100/35"
      />
      <button onClick={music.createPlaylist} className="mt-2 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-black text-black hover:bg-emerald-400">
        Crear y agregar canción actual
      </button>
    </div>
  );
}

function AddToPlaylistBar() {
  const music = useEduAIMusic();
  if (!music.pendingTrackId) return null;
  const track = EDU_MUSIC_TRACKS.find((item) => item.id === music.pendingTrackId);
  return (
    <div className="sticky bottom-24 z-20 rounded-3xl border border-emerald-400/25 bg-[#07120d]/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-emerald-100">Agregar {track?.title ?? "canción"} a:</p>
        <button onClick={() => music.setPendingTrackId(null)} className="rounded-full px-2 text-emerald-100/55 hover:bg-white/10">×</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => music.addToPlaylist("pl-liked", music.pendingTrackId!)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15">♥ Me gusta</button>
        {music.userPlaylists.map((playlist) => (
          <button key={playlist.id} onClick={() => music.addToPlaylist(playlist.id, music.pendingTrackId!)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15">
            {playlist.name}
          </button>
        ))}
        <button onClick={() => music.setCreateOpen(true)} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-black text-black hover:bg-emerald-400">+ Nueva</button>
      </div>
    </div>
  );
}

function NowPlayingBar({ compact = false }: { compact?: boolean }) {
  const music = useEduAIMusic();
  return (
    <div className="border-t border-white/10 bg-black/45 p-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Cover cover={music.currentTrack.cover} label={music.currentTrack.title} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{music.currentTrack.title}</p>
          <p className="truncate text-[11px] text-emerald-100/55">{music.currentTrack.artist}</p>
        </div>
        {!compact && (
          <button onClick={() => music.setShuffle((value) => !value)} className={`hidden rounded-full px-3 py-2 text-xs font-bold sm:block ${music.shuffle ? "bg-emerald-500 text-black" : "bg-white/8 text-emerald-100"}`}>Shuffle</button>
        )}
        <button onClick={music.prevTrack} className="h-9 w-9 rounded-full bg-white/8 hover:bg-white/15">‹</button>
        <button onClick={() => music.setPlaying((v) => !v)} className="h-11 w-11 rounded-full bg-emerald-500 text-sm font-black text-black hover:bg-emerald-400">{music.playing ? "Ⅱ" : "▶"}</button>
        <button onClick={music.nextTrack} className="h-9 w-9 rounded-full bg-white/8 hover:bg-white/15">›</button>
        {!compact && (
          <button
            onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")}
            className="hidden rounded-full bg-white/8 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-white/15 sm:block"
          >
            Repeat {music.repeat}
          </button>
        )}
        <div className="hidden min-w-[110px] items-center gap-2 md:flex">
          <span className="text-xs text-emerald-100/60">Vol</span>
          <input type="range" min={0} max={1} step={0.01} value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="w-24 accent-emerald-500" />
        </div>
      </div>
    </div>
  );
}

export default function EduAIMusicPlayer({ mode = "panel", showMiniWhenStopped = false, onOpenPanel }: Props) {
  const music = useEduAIMusic();

  if (mode === "mini") {
    if (!music.playing && !showMiniWhenStopped) return null;
    return (
      <div className="w-[340px] rounded-3xl border border-emerald-400/20 bg-[#07120d]/96 px-3 py-2.5 text-white shadow-2xl shadow-emerald-900/30 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onOpenPanel} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Cover cover={music.currentTrack.cover} label={music.currentTrack.title} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-black">{music.currentTrack.title}</p>
              <p className="truncate text-[10px] text-emerald-200/75">{music.currentTrack.artist} · EduAI Music</p>
            </div>
          </button>
          <button onClick={music.prevTrack} className="h-8 w-8 rounded-full bg-white/8 hover:bg-white/15">‹</button>
          <button onClick={() => music.setPlaying((v) => !v)} className="h-9 w-9 rounded-full bg-emerald-500 text-xs font-black text-black hover:bg-emerald-400">{music.playing ? "Ⅱ" : "▶"}</button>
          <button onClick={music.nextTrack} className="h-8 w-8 rounded-full bg-white/8 hover:bg-white/15">›</button>
        </div>
      </div>
    );
  }

  const tracksForMain = music.view === "liked" ? EDU_MUSIC_TRACKS.filter((track) => music.liked.has(track.id)) : music.view === "queue" ? music.queue : music.visibleTracks;

  return (
    <div className={`${mode === "page" ? "min-h-[calc(100vh-32px)]" : "h-full"} overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[#07120d] text-white shadow-2xl shadow-emerald-950/30`}>
      <div className={`${mode === "page" ? "grid min-h-[calc(100vh-32px)] lg:grid-cols-[280px,1fr]" : "flex h-full flex-col"}`}>
        <aside className={`${mode === "page" ? "border-r border-white/10" : "border-b border-white/10"} bg-black/25 p-4`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 font-black text-black">♫</div>
              <div>
                <p className="text-sm font-black leading-tight">EduAI Music</p>
                <p className="text-[10px] text-emerald-100/55">Focus, playlists y biblioteca</p>
              </div>
            </div>
            {mode !== "page" && <Link href="/music" className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-emerald-200 hover:bg-white/10">Abrir</Link>}
          </div>

          <div className={`${mode === "page" ? "mt-5 space-y-1" : "mt-3 flex gap-2 overflow-x-auto pb-1"}`}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => music.setView(item.id)}
                className={`${mode === "page" ? "w-full" : "min-w-[118px]"} rounded-2xl px-3 py-2 text-left text-xs font-bold transition ${music.view === item.id ? "bg-white text-black" : "bg-white/5 text-emerald-100/75 hover:bg-white/10"}`}
              >
                <span className="mr-2">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>

          <button onClick={() => music.setCreateOpen((v) => !v)} className="mt-4 w-full rounded-2xl bg-emerald-500 px-3 py-2 text-left text-xs font-black text-black hover:bg-emerald-400">+ Crear playlist</button>
          <div className="mt-3"><CreatePlaylistBox /></div>

          <div className={`${mode === "page" ? "mt-5 space-y-2" : "mt-3 flex gap-2 overflow-x-auto pb-1"}`}>
            {music.playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => {
                  music.setSelectedPlaylistId(playlist.id);
                  music.setView(playlist.id === "pl-liked" ? "liked" : "playlists");
                }}
                className={`${mode === "page" ? "w-full" : "min-w-[170px]"} rounded-2xl border p-2 text-left transition ${music.selectedPlaylistId === playlist.id ? "border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <div className="flex items-center gap-2">
                  <Cover cover={playlist.cover} label={playlist.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{playlist.name}</p>
                    <p className="truncate text-[10px] text-emerald-100/50">{playlist.trackIds.length} canciones</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/10 bg-gradient-to-br from-emerald-500/20 via-green-500/8 to-transparent p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <Cover cover={music.selectedPlaylist.cover} label={music.selectedPlaylist.name} size={mode === "page" ? "xl" : "lg"} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/70">{music.view === "search" ? "Búsqueda global" : music.view === "queue" ? "Cola de reproducción" : "Playlist"}</p>
                <h2 className="truncate text-3xl font-black tracking-tight md:text-5xl">{music.view === "search" ? "Buscar música" : music.view === "liked" ? "Tus me gusta" : music.view === "queue" ? "Siguiente en reproducir" : music.selectedPlaylist.name}</h2>
                <p className="mt-2 max-w-2xl text-sm text-emerald-100/65">{music.view === "search" ? "Busca por asignatura, actividad, mood o palabra clave." : music.view === "queue" ? "Orden de canciones preparado para esta sesión." : music.selectedPlaylist.description}</p>
                <p className="mt-2 text-xs font-bold text-emerald-300">{tracksForMain.length} canciones · {MOOD_LABELS[music.selectedPlaylist.mood]}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => music.playPlaylist()} className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-black text-black hover:bg-emerald-400">▶ Reproducir playlist</button>
              {music.view === "queue" && <button onClick={music.clearQueue} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-emerald-100 hover:bg-white/10">Limpiar cola</button>}
              {!music.selectedPlaylist.system && music.selectedPlaylist.id.startsWith("user-") && (
                <button onClick={() => music.deletePlaylist(music.selectedPlaylist.id)} className="rounded-full border border-red-400/25 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-200 hover:bg-red-500/20">Eliminar playlist</button>
              )}
              <input value={music.query} onChange={(e) => music.setQuery(e.target.value)} placeholder="Buscar canción, asignatura o mood..." className="min-w-[200px] flex-1 rounded-full border border-white/10 bg-black/25 px-4 py-3 text-xs text-white outline-none placeholder:text-emerald-100/35" />
            </div>

            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {(["all", "focus", "calm", "classical", "nature", "energy", "deep"] as const).map((mood) => (
                <button key={mood} onClick={() => music.setSelectedMood(mood)} className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${music.selectedMood === mood ? "border-emerald-400 bg-emerald-500/20 text-emerald-100" : "border-white/10 bg-white/5 text-emerald-100/65 hover:bg-white/10"}`}>
                  {mood === "all" ? "Todo" : MOOD_LABELS[mood]}
                </button>
              ))}
            </div>
          </div>

          <div className={`${mode === "page" ? "grid lg:grid-cols-[1fr_310px]" : "block"} min-h-0 flex-1 overflow-hidden`}>
            <div className="min-h-0 overflow-y-auto p-4 pb-28">
              {music.view === "home" && mode === "page" && (
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  {music.playlists.slice(0, 3).map((playlist) => (
                    <button key={playlist.id} onClick={() => music.setSelectedPlaylistId(playlist.id)} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
                      <Cover cover={playlist.cover} label={playlist.name} size="md" />
                      <p className="mt-3 font-black">{playlist.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-emerald-100/55">{playlist.description}</p>
                    </button>
                  ))}
                </div>
              )}
              <TrackRows tracks={tracksForMain} />
              <AddToPlaylistBar />
            </div>

            {mode === "page" && (
              <aside className="hidden border-l border-white/10 bg-black/20 p-4 lg:block">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">Ahora suena</p>
                  <Cover cover={music.currentTrack.cover} label={music.currentTrack.title} size="lg" />
                  <h3 className="mt-4 text-xl font-black">{music.currentTrack.title}</h3>
                  <p className="text-sm text-emerald-100/60">{music.currentTrack.artist}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {music.currentTrack.tags.map((tag) => <span key={tag} className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-emerald-100/70">#{tag}</span>)}
                  </div>
                </div>
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">Cola</p>
                    <button onClick={music.clearQueue} className="text-xs text-emerald-200/70 hover:text-white">limpiar</button>
                  </div>
                  <div className="mt-3">
                    <TrackRows tracks={music.queue.slice(0, 6)} compact />
                  </div>
                </div>
              </aside>
            )}
          </div>

          <NowPlayingBar compact={mode !== "page"} />
        </section>
      </div>
    </div>
  );
}
