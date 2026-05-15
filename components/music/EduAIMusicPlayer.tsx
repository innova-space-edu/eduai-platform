"use client";

import Link from "next/link";
import {
  EXTERNAL_MUSIC_COLLECTIONS,
  MOOD_LABELS,
  type EduMusicMood,
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
  { id: "search", label: "Buscar online", icon: "⌕" },
  { id: "library", label: "Biblioteca", icon: "♪" },
  { id: "playlists", label: "Playlists", icon: "▦" },
  { id: "liked", label: "Me gusta", icon: "♡" },
  { id: "queue", label: "Cola", icon: "☰" },
] as const;

const MOODS: Array<EduMusicMood | "all"> = ["all", "focus", "calm", "classical", "reading", "creative", "deep", "nature", "energy"];

function Cover({ track, label, cover, size = "md" }: { track?: EduMusicTrack; label?: string; cover?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const cls =
    size === "lg"
      ? "h-40 w-40 rounded-[34px] text-5xl"
      : size === "md"
        ? "h-16 w-16 rounded-2xl text-xl"
        : size === "sm"
          ? "h-11 w-11 rounded-xl text-sm"
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
    <div className={`${cls} flex shrink-0 items-center justify-center border border-slate-200 font-black text-slate-700 shadow-sm`} style={{ background: cover || track?.cover || "linear-gradient(135deg,#dbeafe,#bfdbfe)" }}>
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrackList({ tracks, dense = false }: { tracks: EduMusicTrack[]; dense?: boolean }) {
  const music = useEduAIMusic();
  if (!tracks.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No hay canciones en esta vista. Prueba con otra playlist o busca online.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {tracks.map((track, index) => {
        const active = track.id === music.currentTrack.id;
        return (
          <div key={track.id} className={`grid items-center gap-2 px-3 py-2 transition ${dense ? "grid-cols-[28px,1fr]" : "grid-cols-[34px,44px,1fr,56px,34px,34px,34px]"} ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <button
              onClick={() => music.playTrack(track, tracks)}
              className={`h-7 w-7 rounded-full text-[11px] font-black transition ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700"}`}
              aria-label={`Reproducir ${track.title}`}
            >
              {active && music.playing ? "Ⅱ" : active ? "▶" : index + 1}
            </button>
            {!dense && <Cover track={track} size="sm" />}
            <button onClick={() => music.playTrack(track, tracks)} className="min-w-0 text-left">
              <p className={`truncate font-semibold ${active ? "text-blue-800" : "text-slate-900"} ${dense ? "text-xs" : "text-sm"}`}>{track.title}</p>
              <p className="truncate text-[11px] text-slate-500">
                {track.artist} · {track.source === "itunes" ? "Online preview" : track.album}
              </p>
            </button>
            {!dense && <span className="text-right text-xs text-slate-400">{track.duration}</span>}
            {!dense && (
              <button onClick={() => music.toggleLike(track.id)} className={`h-8 w-8 rounded-full text-sm transition ${music.liked.has(track.id) ? "text-rose-500" : "text-slate-300 hover:bg-rose-50 hover:text-rose-500"}`} aria-label="Me gusta">
                ♥
              </button>
            )}
            {!dense && (
              <button onClick={() => music.addToQueue(track.id)} className="h-8 w-8 rounded-full text-sm text-slate-300 transition hover:bg-blue-50 hover:text-blue-700" aria-label="Agregar a cola">
                ≡
              </button>
            )}
            {!dense && (
              <button onClick={() => music.requestAddToPlaylist(track.id)} className="h-8 w-8 rounded-full text-lg text-slate-300 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Agregar a playlist">
                +
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OnlineSearchBox() {
  const music = useEduAIMusic();
  return (
    <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
      <p className="text-sm font-black text-slate-900">Buscar canciones online</p>
      <p className="mt-1 text-xs text-slate-600">Busca previews reproducibles. Los resultados se agregan a “Resultados online”.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={music.onlineQuery}
          onChange={(e) => music.setOnlineQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void music.searchOnline();
          }}
          placeholder="Ej: lofi study, piano calm, música clásica"
          className="min-w-0 flex-1 rounded-2xl border border-blue-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300"
        />
        <button onClick={() => void music.searchOnline()} disabled={music.onlineLoading} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
          {music.onlineLoading ? "..." : "Buscar"}
        </button>
      </div>
      {music.onlineError && <p className="mt-2 text-xs font-semibold text-red-600">{music.onlineError}</p>}
    </div>
  );
}

function PlaylistPanel() {
  const music = useEduAIMusic();
  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-slate-900">Playlists</p>
            <p className="text-xs text-slate-500">Selecciona o crea una lista.</p>
          </div>
          <button onClick={() => music.setCreateOpen((v) => !v)} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700">+ Crear</button>
        </div>
        {music.createOpen && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <input
              value={music.newPlaylistName}
              onChange={(e) => music.setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") music.createPlaylist();
              }}
              placeholder="Ej: Música para 4° medio"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
            />
            <button onClick={music.createPlaylist} className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">Crear playlist</button>
          </div>
        )}
        <div className="mt-3 max-h-[265px] space-y-2 overflow-y-auto pr-1">
          {music.playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => {
                music.setSelectedPlaylistId(playlist.id);
                music.setView(playlist.id === "pl-liked" ? "liked" : playlist.id === "pl-online" ? "search" : "playlists");
              }}
              className={`w-full rounded-2xl border p-2 text-left transition ${music.selectedPlaylistId === playlist.id ? "border-blue-200 bg-blue-50" : "border-slate-100 bg-white hover:bg-slate-50"}`}
            >
              <div className="flex items-center gap-2">
                <Cover label={playlist.name} cover={playlist.cover} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900">{playlist.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{playlist.trackIds.length} canciones</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">Playlists externas</p>
        <p className="mt-1 text-xs text-slate-500">Se abren fuera de EduAI. Para reproducción interna usa el buscador online.</p>
        <div className="mt-3 space-y-2">
          {EXTERNAL_MUSIC_COLLECTIONS.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-100 bg-slate-50 p-3 hover:border-blue-200 hover:bg-blue-50">
              <p className="text-xs font-black text-slate-900">{item.name}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{item.provider} · {item.description}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function NowPlayingCenter() {
  const music = useEduAIMusic();
  const track = music.currentTrack;
  return (
    <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <Cover track={track} size="lg" />
        <p className="mt-5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">{track.source === "itunes" ? "Resultado online" : MOOD_LABELS[track.mood]}</p>
        <h2 className="mt-3 line-clamp-2 text-2xl font-black tracking-tight text-slate-950">{track.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{track.artist} · {track.album}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {track.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">#{tag}</span>)}
        </div>
      </div>

      <div className="mt-7 flex items-center justify-center gap-3">
        <button onClick={() => music.setShuffle((value) => !value)} className={`rounded-full px-3 py-2 text-xs font-bold ${music.shuffle ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>Shuffle</button>
        <button onClick={music.prevTrack} className="h-11 w-11 rounded-full bg-slate-100 text-xl font-black text-slate-700 hover:bg-slate-200">‹</button>
        <button onClick={() => music.setPlaying((v) => !v)} className="h-16 w-16 rounded-full bg-blue-600 text-xl font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700">{music.playing ? "Ⅱ" : "▶"}</button>
        <button onClick={music.nextTrack} className="h-11 w-11 rounded-full bg-slate-100 text-xl font-black text-slate-700 hover:bg-slate-200">›</button>
        <button onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">Repeat {music.repeat}</button>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <span className="text-xs font-bold text-slate-500">Volumen</span>
        <input type="range" min={0} max={1} step={0.01} value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="w-full accent-blue-600" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold">
        <button onClick={() => music.toggleLike(track.id)} className={`rounded-2xl border px-3 py-2 ${music.liked.has(track.id) ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>♥ Me gusta</button>
        <button onClick={() => music.addToQueue(track.id)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50">+ Cola</button>
        <button onClick={() => music.requestAddToPlaylist(track.id)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50">+ Playlist</button>
      </div>

      {track.externalUrl && <a href={track.externalUrl} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs font-bold text-blue-700 hover:underline">Abrir fuente original ↗</a>}
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
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-3xl border border-slate-200 bg-white/95 p-2 text-slate-900 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button onClick={onOpenPanel} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Cover track={music.currentTrack} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-black">{music.currentTrack.title}</p>
            <p className="truncate text-[10px] text-slate-500">{music.currentTrack.artist}</p>
          </div>
        </button>
        <button onClick={music.prevTrack} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200">‹</button>
        <button onClick={() => music.setPlaying((v) => !v)} className="h-9 w-9 rounded-full bg-blue-600 text-xs font-black text-white hover:bg-blue-700">{music.playing ? "Ⅱ" : "▶"}</button>
        <button onClick={music.nextTrack} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200">›</button>
      </div>
    </div>
  );
}

export default function EduAIMusicPlayer({ mode = "page", showMiniWhenStopped = false, onOpenPanel }: Props) {
  const music = useEduAIMusic();

  if (mode === "mini") {
    if (!showMiniWhenStopped && !music.playing) return null;
    return <MiniBar onOpenPanel={onOpenPanel} />;
  }

  const tracksForMain = music.view === "liked"
    ? music.allTracks.filter((track) => music.liked.has(track.id))
    : music.view === "queue"
      ? music.queue
      : music.visibleTracks;

  if (mode === "panel") {
    return (
      <div className="h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-950 shadow-xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black">EduAI Music</p>
                <p className="text-[10px] text-slate-500">Música persistente</p>
              </div>
              <Link href="/music" className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100">Abrir</Link>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <TrackList tracks={tracksForMain.slice(0, 10)} dense />
          </div>
          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <Cover track={music.currentTrack} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black">{music.currentTrack.title}</p>
                <p className="truncate text-[10px] text-slate-500">{music.currentTrack.artist}</p>
              </div>
              <button onClick={music.prevTrack} className="h-8 w-8 rounded-full bg-slate-100">‹</button>
              <button onClick={() => music.setPlaying((v) => !v)} className="h-9 w-9 rounded-full bg-blue-600 text-xs font-black text-white">{music.playing ? "Ⅱ" : "▶"}</button>
              <button onClick={music.nextTrack} className="h-8 w-8 rounded-full bg-slate-100">›</button>
            </div>
          </div>
        </div>
        <AddToPlaylistBar />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-slate-50 text-slate-950 shadow-sm">
      <div className="grid min-h-[calc(100vh-148px)] gap-0 lg:grid-cols-[290px,1fr,330px]">
        <aside className="border-r border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 font-black text-white">♫</div>
            <div>
              <p className="text-sm font-black">EduAI Music</p>
              <p className="text-xs text-slate-500">Panel lateral + listas</p>
            </div>
          </div>

          <div className="mt-5 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => music.setView(item.id)} className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold transition ${music.view === item.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                <span className="w-5 text-center">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lista actual</p>
            <p className="mt-1 text-lg font-black text-slate-950">{music.selectedPlaylist.name}</p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{music.selectedPlaylist.description}</p>
            <button onClick={() => music.playPlaylist()} className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-700">▶ Reproducir lista</button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Canciones</p>
            <div className="max-h-[42vh] overflow-y-auto pr-1">
              <TrackList tracks={tracksForMain} dense />
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-[#f8fafc] p-5">
          <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Reproductor central</p>
              <h1 className="truncate text-2xl font-black tracking-tight">{music.view === "search" ? "Buscar y reproducir" : music.selectedPlaylist.name}</h1>
              <p className="text-sm text-slate-500">{tracksForMain.length} canciones · diseño claro · modo estudio</p>
            </div>
            <input value={music.query} onChange={(e) => music.setQuery(e.target.value)} placeholder="Filtrar canciones de la biblioteca..." className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-300" />
          </div>

          <NowPlayingCenter />

          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {MOODS.map((mood) => (
                <button key={mood} onClick={() => music.setSelectedMood(mood)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${music.selectedMood === mood ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                  {mood === "all" ? "Todo" : MOOD_LABELS[mood]}
                </button>
              ))}
            </div>
            <TrackList tracks={tracksForMain.slice(0, 8)} />
          </div>
        </main>

        <aside className="border-l border-slate-200 bg-white p-4">
          <div className="space-y-4">
            <OnlineSearchBox />
            <PlaylistPanel />
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-900">Cola</p>
                <button onClick={music.clearQueue} className="text-xs font-bold text-blue-700 hover:underline">limpiar</button>
              </div>
              <div className="mt-3 max-h-[180px] overflow-y-auto">
                <TrackList tracks={music.queue.slice(0, 8)} dense />
              </div>
            </div>
          </div>
        </aside>
      </div>
      <AddToPlaylistBar />
    </div>
  );
}
