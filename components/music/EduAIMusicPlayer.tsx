"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EXTERNAL_MUSIC_COLLECTIONS,
  MOOD_LABELS,
  type EduMusicMood,
  type EduMusicPlaylist,
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
  { id: "home", label: "Inicio", icon: "⌂" },
  { id: "search", label: "Buscar", icon: "⌕" },
  { id: "library", label: "Biblioteca", icon: "♪" },
  { id: "playlists", label: "Playlists", icon: "▦" },
  { id: "liked", label: "Me gusta", icon: "♡" },
  { id: "queue", label: "Cola", icon: "☰" },
] as const;

const MOODS: Array<EduMusicMood | "all"> = [
  "all",
  "focus",
  "calm",
  "classical",
  "reading",
  "creative",
  "deep",
  "nature",
  "energy",
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query || "study music playlist")}`;
}

function Cover({
  track,
  label,
  cover,
  size = "md",
}: {
  track?: EduMusicTrack;
  label?: string;
  cover?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const cls =
    size === "lg"
      ? "h-28 w-28 rounded-3xl text-4xl"
      : size === "md"
        ? "h-14 w-14 rounded-2xl text-lg"
        : size === "sm"
          ? "h-10 w-10 rounded-xl text-sm"
          : "h-8 w-8 rounded-lg text-xs";
  const title = track?.title || label || "Música";
  const artwork = track?.artworkUrl || (track?.cover?.startsWith("http") ? track.cover : undefined);

  if (artwork) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={artwork} alt={title} className={`${cls} shrink-0 object-cover shadow-sm`} />
    );
  }

  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center border border-slate-200 font-black text-slate-700 shadow-sm`}
      style={{ background: cover || track?.cover || "linear-gradient(135deg,#eff6ff,#dbeafe)" }}
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

function MiniIconButton({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition",
        active ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700",
      )}
    >
      {children}
    </button>
  );
}

function TrackRows({ tracks, compact = false, limit }: { tracks: EduMusicTrack[]; compact?: boolean; limit?: number }) {
  const music = useEduAIMusic();
  const shown = typeof limit === "number" ? tracks.slice(0, limit) : tracks;

  if (!shown.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-center text-sm text-slate-500">
        No hay canciones en esta vista. Busca online o selecciona otra playlist.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {shown.map((track, index) => {
        const active = track.id === music.currentTrack.id;
        return (
          <div
            key={track.id}
            className={cn(
              "group grid min-h-[54px] items-center gap-2 border-b border-slate-100 px-3 text-sm last:border-b-0 hover:bg-slate-50",
              compact ? "grid-cols-[30px,1fr,44px]" : "grid-cols-[36px,42px,minmax(0,1.7fr),minmax(0,1fr),58px,34px,34px,34px]",
              active && "bg-blue-50/80",
            )}
          >
            <button
              type="button"
              onClick={() => music.playTrack(track, tracks)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black transition",
                active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700",
              )}
              aria-label={`Reproducir ${track.title}`}
            >
              {active && music.playing ? "Ⅱ" : active ? "▶" : index + 1}
            </button>

            {!compact && <Cover track={track} size="xs" />}

            <button type="button" onClick={() => music.playTrack(track, tracks)} className="min-w-0 text-left">
              <p className={cn("truncate font-bold", active ? "text-blue-800" : "text-slate-900")}>{track.title}</p>
              <p className="truncate text-[11px] text-slate-500">
                {track.artist} · {track.source === "itunes" ? "Preview online" : track.album}
              </p>
            </button>

            {!compact && <p className="truncate text-xs text-slate-500">{track.album}</p>}
            {!compact && <span className="text-right text-xs text-slate-400">{track.duration}</span>}

            {!compact && (
              <MiniIconButton onClick={() => music.toggleLike(track.id)} active={music.liked.has(track.id)} title="Me gusta">
                ♥
              </MiniIconButton>
            )}
            {!compact && (
              <MiniIconButton onClick={() => music.addToQueue(track.id)} title="Agregar a cola">
                ≡
              </MiniIconButton>
            )}
            {!compact && (
              <MiniIconButton onClick={() => music.requestAddToPlaylist(track.id)} title="Agregar a playlist">
                +
              </MiniIconButton>
            )}

            {compact && <span className="text-right text-[11px] text-slate-400">{track.duration}</span>}
          </div>
        );
      })}
    </div>
  );
}

function SearchAndSourcesPanel() {
  const music = useEduAIMusic();
  const [youtubeQuery, setYoutubeQuery] = useState("música para estudiar sin letra");

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">Buscar y escuchar</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Búsqueda interna con previews reproducibles. Para YouTube se abre el reproductor oficial.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={music.onlineQuery}
            onChange={(e) => music.setOnlineQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void music.searchOnline();
            }}
            placeholder="Artista, canción, lofi, piano..."
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white"
          />
          <button
            type="button"
            onClick={() => void music.searchOnline()}
            disabled={music.onlineLoading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {music.onlineLoading ? "..." : "Buscar"}
          </button>
        </div>
        {music.onlineError && <p className="mt-2 text-xs font-semibold text-red-600">{music.onlineError}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">YouTube / playlists externas</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Se usa como fuente externa. No se convierte a MP3 dentro de EduAI.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={youtubeQuery}
            onChange={(e) => setYoutubeQuery(e.target.value)}
            placeholder="Buscar playlist en YouTube"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white"
          />
          <a
            href={youtubeSearchUrl(youtubeQuery)}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            Abrir
          </a>
        </div>
        <div className="mt-3 space-y-2">
          {EXTERNAL_MUSIC_COLLECTIONS.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-900">{item.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{item.provider} · {item.description}</span>
              </span>
              <span className="text-xs text-slate-400">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaylistSidebar() {
  const music = useEduAIMusic();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tu biblioteca</p>
        <button
          type="button"
          onClick={() => music.setCreateOpen((v) => !v)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50"
        >
          + Crear
        </button>
      </div>

      {music.createOpen && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
          <input
            value={music.newPlaylistName}
            onChange={(e) => music.setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") music.createPlaylist();
            }}
            placeholder="Nombre de playlist"
            className="w-full rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs outline-none focus:border-blue-300"
          />
          <button type="button" onClick={music.createPlaylist} className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">
            Crear playlist
          </button>
        </div>
      )}

      <div className="max-h-[230px] space-y-1 overflow-y-auto pr-1">
        {music.playlists.map((playlist: EduMusicPlaylist) => (
          <button
            key={playlist.id}
            type="button"
            onClick={() => {
              music.setSelectedPlaylistId(playlist.id);
              music.setView(playlist.id === "pl-liked" ? "liked" : playlist.id === "pl-online" ? "search" : "playlists");
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition",
              music.selectedPlaylistId === playlist.id ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50",
            )}
          >
            <Cover label={playlist.name} cover={playlist.cover} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black text-slate-900">{playlist.name}</span>
              <span className="block truncate text-[10px] text-slate-500">{playlist.trackIds.length} canciones</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CurrentTrackCard() {
  const music = useEduAIMusic();
  const track = music.currentTrack;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <Cover track={track} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
            {track.source === "itunes" ? "Preview online" : MOOD_LABELS[track.mood]}
          </p>
          <h2 className="mt-1 truncate text-3xl font-black tracking-tight text-slate-950">{track.title}</h2>
          <p className="mt-1 truncate text-sm text-slate-500">{track.artist} · {track.album}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {track.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2">
          <MiniIconButton onClick={() => music.setShuffle((value) => !value)} active={music.shuffle} title="Shuffle">
            ↭
          </MiniIconButton>
          <MiniIconButton onClick={music.prevTrack} title="Anterior">
            ‹
          </MiniIconButton>
          <button
            type="button"
            onClick={() => music.setPlaying((value) => !value)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
          >
            {music.playing ? "Ⅱ" : "▶"}
          </button>
          <MiniIconButton onClick={music.nextTrack} title="Siguiente">
            ›
          </MiniIconButton>
          <MiniIconButton onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} active={music.repeat !== "off"} title="Repetir">
            {music.repeat === "one" ? "1" : "↻"}
          </MiniIconButton>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr,220px] lg:items-center">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
          <span className="text-xs font-bold text-slate-500">Volumen</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={music.volume}
            onChange={(e) => music.setVolume(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => music.toggleLike(track.id)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-rose-50 hover:text-rose-600">
            {music.liked.has(track.id) ? "♥ Guardada" : "♡ Me gusta"}
          </button>
          <button type="button" onClick={() => music.addToQueue(track.id)} className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700">
            + Cola
          </button>
        </div>
      </div>

      {track.externalUrl && (
        <a href={track.externalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-blue-700 hover:underline">
          Abrir fuente original ↗
        </a>
      )}
    </div>
  );
}

function AddToPlaylistBar() {
  const music = useEduAIMusic();
  if (!music.pendingTrackId) return null;
  const track = music.allTracks.find((item) => item.id === music.pendingTrackId);

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 rounded-3xl border border-blue-200 bg-white p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">Agregar {track?.title ?? "canción"} a playlist:</p>
        <button onClick={() => music.setPendingTrackId(null)} className="rounded-full px-2 text-slate-400 hover:bg-slate-100">×</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => music.addToPlaylist("pl-liked", music.pendingTrackId!)} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">♥ Me gusta</button>
        {music.userPlaylists.map((playlist) => (
          <button key={playlist.id} onClick={() => music.addToPlaylist(playlist.id, music.pendingTrackId!)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">{playlist.name}</button>
        ))}
        <button onClick={() => music.setCreateOpen(true)} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700">+ Nueva</button>
      </div>
    </div>
  );
}

function MiniBar({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,540px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-2 text-slate-900 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button onClick={onOpenPanel} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Cover track={music.currentTrack} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-black">{music.currentTrack.title}</p>
            <p className="truncate text-[10px] text-slate-500">{music.currentTrack.artist}</p>
          </div>
        </button>
        <MiniIconButton onClick={music.prevTrack}>‹</MiniIconButton>
        <button onClick={() => music.setPlaying((value) => !value)} className="h-9 w-9 rounded-full bg-blue-600 text-xs font-black text-white hover:bg-blue-700">{music.playing ? "Ⅱ" : "▶"}</button>
        <MiniIconButton onClick={music.nextTrack}>›</MiniIconButton>
      </div>
    </div>
  );
}

function CompactPanel({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  const tracksForMain = music.view === "liked"
    ? music.allTracks.filter((track) => music.liked.has(track.id))
    : music.view === "queue"
      ? music.queue
      : music.visibleTracks;

  return (
    <div className="h-full overflow-hidden rounded-[26px] border border-slate-200 bg-white text-slate-950 shadow-xl">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <button onClick={onOpenPanel} className="min-w-0 text-left">
              <p className="text-sm font-black">EduAI Music</p>
              <p className="truncate text-[10px] text-slate-500">{music.currentTrack.title}</p>
            </button>
            <Link href="/music" className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100">Abrir</Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <TrackRows tracks={tracksForMain} compact limit={12} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Cover track={music.currentTrack} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{music.currentTrack.title}</p>
              <p className="truncate text-[10px] text-slate-500">{music.currentTrack.artist}</p>
            </div>
            <MiniIconButton onClick={music.prevTrack}>‹</MiniIconButton>
            <button onClick={() => music.setPlaying((value) => !value)} className="h-9 w-9 rounded-full bg-blue-600 text-xs font-black text-white">{music.playing ? "Ⅱ" : "▶"}</button>
            <MiniIconButton onClick={music.nextTrack}>›</MiniIconButton>
          </div>
        </div>
      </div>
      <AddToPlaylistBar />
    </div>
  );
}

export default function EduAIMusicPlayer({ mode = "page", showMiniWhenStopped = false, onOpenPanel }: Props) {
  const music = useEduAIMusic();

  const tracksForMain = useMemo(() => {
    if (music.view === "liked") return music.allTracks.filter((track) => music.liked.has(track.id));
    if (music.view === "queue") return music.queue;
    return music.visibleTracks;
  }, [music.allTracks, music.liked, music.queue, music.view, music.visibleTracks]);

  if (mode === "mini") {
    if (!showMiniWhenStopped && !music.playing) return null;
    return <MiniBar onOpenPanel={onOpenPanel} />;
  }

  if (mode === "panel") return <CompactPanel onOpenPanel={onOpenPanel} />;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fafc] text-slate-950 shadow-sm">
      <div className="grid min-h-[calc(100vh-170px)] max-h-[calc(100vh-115px)] grid-rows-[1fr] overflow-hidden lg:grid-cols-[310px,minmax(0,1fr),340px]">
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 font-black text-white">♫</div>
            <div>
              <p className="text-sm font-black">EduAI Music</p>
              <p className="text-xs text-slate-500">Biblioteca + listas</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => music.setView(item.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-2 py-2 text-left text-xs font-black transition",
                  music.view === item.id ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
              >
                <span className="w-4 text-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <PlaylistSidebar />
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Canciones</p>
              <span className="text-[10px] font-bold text-slate-400">{tracksForMain.length}</span>
            </div>
            <div className="h-full overflow-y-auto pr-1">
              <TrackRows tracks={tracksForMain} compact />
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto p-4">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Reproductor central</p>
              <h1 className="truncate text-xl font-black tracking-tight">{music.view === "search" ? "Buscar y reproducir" : music.selectedPlaylist.name}</h1>
            </div>
            <input
              value={music.query}
              onChange={(e) => music.setQuery(e.target.value)}
              placeholder="Filtrar biblioteca..."
              className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white"
            />
          </div>

          <CurrentTrackCard />

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => music.setSelectedMood(mood)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    music.selectedMood === mood ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {mood === "all" ? "Todo" : MOOD_LABELS[mood]}
                </button>
              ))}
            </div>
            <TrackRows tracks={tracksForMain} />
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
          <SearchAndSourcesPanel />
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900">Cola</p>
              <button onClick={music.clearQueue} className="text-xs font-bold text-blue-700 hover:underline">limpiar</button>
            </div>
            <div className="mt-3 max-h-[220px] overflow-y-auto pr-1">
              <TrackRows tracks={music.queue.slice(0, 8)} compact />
            </div>
          </div>
        </aside>
      </div>
      <AddToPlaylistBar />
    </div>
  );
}
