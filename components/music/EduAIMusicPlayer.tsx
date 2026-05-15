"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Home,
  Library,
  ListMusic,
  Menu,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
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
  { id: "home", label: "Inicio", icon: Home },
  { id: "search", label: "Buscar", icon: Search },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "liked", label: "Me gusta", icon: Heart },
  { id: "queue", label: "Cola", icon: Menu },
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

function parseDuration(duration?: string) {
  if (!duration) return 0;
  const [m, s] = duration.split(":").map((part) => Number(part));
  return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : 0;
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
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
  size?: "xs" | "sm" | "md" | "lg" | "hero";
}) {
  const cls =
    size === "hero"
      ? "h-36 w-36 rounded-[26px] text-5xl"
      : size === "lg"
        ? "h-24 w-24 rounded-3xl text-3xl"
        : size === "md"
          ? "h-12 w-12 rounded-2xl text-base"
          : size === "sm"
            ? "h-10 w-10 rounded-xl text-sm"
            : "h-8 w-8 rounded-lg text-xs";
  const title = track?.title || label || "Música";
  const artwork =
    track?.artworkUrl ||
    (track?.cover?.startsWith("http") ? track.cover : undefined);

  if (artwork) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artwork}
        alt={title}
        className={`${cls} shrink-0 object-cover shadow-lg shadow-black/20`}
      />
    );
  }

  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center font-black text-white shadow-lg shadow-black/20 ring-1 ring-white/10`}
      style={{
        background:
          cover || track?.cover || "linear-gradient(135deg,#38bdf8,#2563eb)",
      }}
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  active,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition",
        active
          ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
          : "bg-white/10 text-slate-200 hover:bg-white/15 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

function PlayButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const music = useEduAIMusic();
  const cls =
    size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const iconCls = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <button
      type="button"
      onClick={() => music.setPlaying((value) => !value)}
      className={`${cls} inline-flex items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:scale-105 hover:bg-emerald-300`}
      aria-label={music.playing ? "Pausar" : "Reproducir"}
    >
      {music.playing ? (
        <Pause className={iconCls} fill="currentColor" />
      ) : (
        <Play className={`${iconCls} translate-x-0.5`} fill="currentColor" />
      )}
    </button>
  );
}

function TrackRow({
  track,
  index,
  tracks,
  compact = false,
}: {
  track: EduMusicTrack;
  index: number;
  tracks: EduMusicTrack[];
  compact?: boolean;
}) {
  const music = useEduAIMusic();
  const active = track.id === music.currentTrack.id;
  return (
    <div
      className={cn(
        "group grid min-h-[54px] items-center gap-3 rounded-xl px-3 text-sm transition",
        compact
          ? "grid-cols-[30px,40px,minmax(0,1fr),48px]"
          : "grid-cols-[36px,44px,minmax(0,1.8fr),minmax(0,1fr),70px,94px]",
        active
          ? "bg-white/15 text-white"
          : "text-slate-300 hover:bg-white/8 hover:text-white",
      )}
    >
      <button
        type="button"
        onClick={() => music.playTrack(track, tracks)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black transition",
          active
            ? "bg-emerald-400 text-slate-950"
            : "bg-white/8 text-slate-300 group-hover:bg-emerald-400 group-hover:text-slate-950",
        )}
        aria-label={`Reproducir ${track.title}`}
      >
        {active && music.playing ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" />
        ) : active ? (
          <Play className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          index + 1
        )}
      </button>
      <Cover track={track} size="sm" />
      <button
        type="button"
        onClick={() => music.playTrack(track, tracks)}
        className="min-w-0 text-left"
      >
        <p
          className={cn(
            "truncate font-bold",
            active ? "text-emerald-300" : "text-current",
          )}
        >
          {track.title}
        </p>
        <p className="truncate text-xs text-slate-400">{track.artist}</p>
      </button>
      {!compact && (
        <p className="truncate text-xs text-slate-400">{track.album}</p>
      )}
      {!compact && (
        <span className="text-xs text-slate-500">
          {track.source === "itunes"
            ? "Preview"
            : track.source === "jamendo"
              ? "Jamendo"
              : track.source === "audius"
                ? "Audius"
                : "EduAI"}
        </span>
      )}
      <div className="flex items-center justify-end gap-2">
        {!compact && (
          <button
            type="button"
            onClick={() => music.toggleLike(track.id)}
            className={cn(
              "text-slate-500 hover:text-rose-300",
              music.liked.has(track.id) && "text-rose-300",
            )}
            aria-label="Me gusta"
          >
            <Heart
              className="h-4 w-4"
              fill={music.liked.has(track.id) ? "currentColor" : "none"}
            />
          </button>
        )}
        <span className="w-10 text-right text-xs text-slate-500">
          {track.duration}
        </span>
      </div>
    </div>
  );
}

function TrackList({
  tracks,
  compact = false,
  limit,
}: {
  tracks: EduMusicTrack[];
  compact?: boolean;
  limit?: number;
}) {
  const shown = typeof limit === "number" ? tracks.slice(0, limit) : tracks;
  if (!shown.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
        No hay canciones en esta vista.
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {!compact && (
        <div className="grid grid-cols-[36px,44px,minmax(0,1.8fr),minmax(0,1fr),70px,94px] gap-3 px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
          <span>#</span>
          <span></span>
          <span>Título</span>
          <span>Álbum</span>
          <span>Fuente</span>
          <span className="text-right">Duración</span>
        </div>
      )}
      {shown.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          index={index}
          tracks={shown}
          compact={compact}
        />
      ))}
    </div>
  );
}

function TopBar() {
  const music = useEduAIMusic();
  return (
    <header className="grid h-16 grid-cols-[320px,minmax(0,1fr),320px] items-center gap-3 border-b border-white/10 bg-[#07080d] px-4 text-white max-lg:grid-cols-[1fr,auto]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black tracking-tight">EduAI Music</p>
          <p className="text-[11px] text-slate-400">Music Dashboard Pro</p>
        </div>
      </div>
      <div className="mx-auto flex h-11 w-full max-w-2xl items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 shadow-inner max-lg:hidden">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={music.query}
          onChange={(e) => music.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && music.query.trim())
              void music.searchOnline(music.query);
          }}
          placeholder="¿Qué quieres reproducir? Busca en biblioteca o presiona Enter para buscar online"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Link
          href="/agentes"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" /> Agentes
        </Link>
      </div>
    </header>
  );
}

function Sidebar({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();
  const [playlistFilter, setPlaylistFilter] = useState("");
  const filteredPlaylists = music.playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(playlistFilter.toLowerCase()),
  );

  return (
    <aside className="flex min-h-0 flex-col gap-3 border-r border-white/10 bg-[#0c0e14] p-3 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black">Tu biblioteca</p>
          <button
            onClick={() => music.setCreateOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/15"
          >
            <Plus className="h-3.5 w-3.5" /> Crear
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs font-bold text-slate-300">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => music.setView(item.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition",
                  music.view === item.id
                    ? "bg-white text-slate-950"
                    : "bg-white/10 hover:bg-white/15",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </div>
        {music.createOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-2">
            <input
              value={music.newPlaylistName}
              onChange={(e) => music.setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && music.createPlaylist()}
              placeholder="Nombre de playlist"
              className="h-9 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-xs outline-none placeholder:text-slate-500"
            />
            <button
              onClick={music.createPlaylist}
              className="mt-2 h-9 w-full rounded-xl bg-emerald-400 text-xs font-black text-slate-950 hover:bg-emerald-300"
            >
              Crear playlist
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-slate-500" />
          <input
            value={playlistFilter}
            onChange={(e) => setPlaylistFilter(e.target.value)}
            placeholder="Filtrar playlists"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
          {filteredPlaylists.map((playlist: EduMusicPlaylist) => (
            <button
              key={playlist.id}
              onClick={() => {
                music.setSelectedPlaylistId(playlist.id);
                music.setView(
                  playlist.id === "pl-liked"
                    ? "liked"
                    : playlist.id === "pl-online"
                      ? "search"
                      : "playlists",
                );
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                music.selectedPlaylistId === playlist.id
                  ? "bg-white/15"
                  : "hover:bg-white/10",
              )}
            >
              <Cover label={playlist.name} cover={playlist.cover} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">
                  {playlist.name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {playlist.trackIds.length} canciones
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Canciones
          </p>
          <span className="text-xs text-slate-500">{tracks.length}</span>
        </div>
        <div className="h-[calc(100%-28px)] overflow-y-auto pr-1">
          <TrackList tracks={tracks} compact limit={36} />
        </div>
      </div>
    </aside>
  );
}

function PlaylistHero({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();
  const playlist = music.selectedPlaylist;
  const totalSeconds = tracks.reduce(
    (sum, track) => sum + parseDuration(track.duration),
    0,
  );
  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(59,130,246,0.35),rgba(15,23,42,0.92)_55%,rgba(16,185,129,0.22))] p-6 text-white shadow-2xl shadow-black/20">
      <div className="flex items-end gap-6 max-md:flex-col max-md:items-start">
        <Cover label={playlist.name} cover={playlist.cover} size="hero" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
            Playlist educativa
          </p>
          <h1 className="mt-2 truncate text-5xl font-black tracking-tight max-xl:text-4xl max-md:text-3xl">
            {playlist.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            {playlist.description}
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-300">
            EduAI Music · {tracks.length} canciones ·{" "}
            {formatSeconds(totalSeconds)} aprox.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => music.playPlaylist(playlist.id)}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-400 px-6 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-300"
        >
          <Play className="h-5 w-5" fill="currentColor" /> Reproducir lista
        </button>
        <IconButton
          onClick={() => music.setShuffle((value) => !value)}
          active={music.shuffle}
          title="Aleatorio"
        >
          <Shuffle className="h-4 w-4" />
        </IconButton>
        <IconButton
          onClick={() => music.toggleLike(music.currentTrack.id)}
          active={music.liked.has(music.currentTrack.id)}
          title="Me gusta"
        >
          <Heart
            className="h-4 w-4"
            fill={
              music.liked.has(music.currentTrack.id) ? "currentColor" : "none"
            }
          />
        </IconButton>
        <IconButton
          onClick={() =>
            music.setRepeat(
              music.repeat === "off"
                ? "all"
                : music.repeat === "all"
                  ? "one"
                  : "off",
            )
          }
          active={music.repeat !== "off"}
          title="Repetir"
        >
          <Repeat className="h-4 w-4" />
        </IconButton>
      </div>
    </section>
  );
}

function MainPanel({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();
  return (
    <main className="min-h-0 overflow-y-auto bg-[#11131a] p-4 text-white">
      <PlaylistHero tracks={tracks} />
      <div className="mt-4 rounded-[28px] border border-white/10 bg-black/20 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => music.setSelectedMood(mood)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                music.selectedMood === mood
                  ? "border-emerald-300 bg-emerald-400 text-slate-950"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
              )}
            >
              {mood === "all" ? "Todo" : MOOD_LABELS[mood]}
            </button>
          ))}
        </div>
        <TrackList tracks={tracks} />
      </div>
    </main>
  );
}

function RightPanel() {
  const music = useEduAIMusic();
  const [youtubeQuery, setYoutubeQuery] = useState(
    "música para estudiar sin letra",
  );
  const related = music.allTracks
    .filter(
      (track) =>
        track.mood === music.currentTrack.mood &&
        track.id !== music.currentTrack.id,
    )
    .slice(0, 5);
  return (
    <aside className="flex min-h-0 flex-col gap-3 border-l border-white/10 bg-[#0c0e14] p-3 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <p className="text-sm font-black">Buscar online</p>
        <p className="mt-1 text-xs text-slate-400">
          Primero busca música completa en Jamendo/Audius y deja iTunes como preview.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-200">
            Jamendo
          </span>
          <span className="rounded-full bg-violet-400/15 px-2 py-1 text-violet-200">
            Audius
          </span>
          <span className="rounded-full bg-sky-400/15 px-2 py-1 text-sky-200">
            iTunes preview
          </span>
          <a
            href="/api/music/jamendo/connect"
            className="rounded-full bg-white/10 px-2 py-1 text-slate-200 hover:bg-white/15"
          >
            Conectar Jamendo
          </a>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={music.onlineQuery}
            onChange={(e) => music.setOnlineQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void music.searchOnline()}
            placeholder="Calvin Harris, lofi, piano..."
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => void music.searchOnline()}
            disabled={music.onlineLoading}
            className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
          >
            {music.onlineLoading ? "..." : "Buscar"}
          </button>
        </div>
        {music.onlineError && (
          <p className="mt-2 text-xs font-bold text-rose-300">
            {music.onlineError}
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <p className="text-sm font-black">Acerca de la canción</p>
        <Cover track={music.currentTrack} size="lg" />
        <p className="mt-3 text-lg font-black leading-tight">
          {music.currentTrack.title}
        </p>
        <p className="text-sm text-slate-400">{music.currentTrack.artist}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {music.currentTrack.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
        {music.currentTrack.externalUrl && (
          <a
            href={music.currentTrack.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-300 hover:underline"
          >
            Abrir fuente <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="min-h-0 flex-1 rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black">Cola / relacionados</p>
          <button
            onClick={music.clearQueue}
            className="text-xs font-bold text-emerald-300 hover:underline"
          >
            limpiar
          </button>
        </div>
        <div className="max-h-[180px] overflow-y-auto pr-1">
          <TrackList
            tracks={music.queue.length ? music.queue : related}
            compact
          />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-3">
        <p className="text-sm font-black">Fuentes externas</p>
        <div className="mt-2 flex gap-2">
          <input
            value={youtubeQuery}
            onChange={(e) => setYoutubeQuery(e.target.value)}
            placeholder="Buscar en YouTube"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none placeholder:text-slate-500"
          />
          <a
            href={youtubeSearchUrl(youtubeQuery)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/15"
          >
            Abrir
          </a>
        </div>
        <div className="mt-2 max-h-[150px] space-y-1 overflow-y-auto pr-1">
          {EXTERNAL_MUSIC_COLLECTIONS.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-xs hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-slate-200">
                  {item.name}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {item.provider}
                </span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}

function BottomPlayer() {
  const music = useEduAIMusic();
  const duration =
    music.durationSeconds || parseDuration(music.currentTrack.duration);
  const progress = duration
    ? Math.min(100, (music.currentTime / duration) * 100)
    : 0;
  return (
    <footer className="grid h-[88px] grid-cols-[320px,minmax(0,1fr),320px] items-center gap-4 border-t border-white/10 bg-[#07080d] px-4 text-white max-lg:grid-cols-[1fr,auto]">
      <div className="flex min-w-0 items-center gap-3">
        <Cover track={music.currentTrack} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black">
            {music.currentTrack.title}
          </p>
          <p className="truncate text-xs text-slate-400">
            {music.currentTrack.artist}
          </p>
        </div>
        <button
          onClick={() => music.toggleLike(music.currentTrack.id)}
          className={cn(
            "text-slate-500 hover:text-rose-300",
            music.liked.has(music.currentTrack.id) && "text-rose-300",
          )}
        >
          <Heart
            className="h-4 w-4"
            fill={
              music.liked.has(music.currentTrack.id) ? "currentColor" : "none"
            }
          />
        </button>
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-center gap-3">
          <IconButton
            onClick={() => music.setShuffle((value) => !value)}
            active={music.shuffle}
          >
            <Shuffle className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={music.prevTrack}>
            <SkipBack className="h-4 w-4" fill="currentColor" />
          </IconButton>
          <PlayButton />
          <IconButton onClick={music.nextTrack}>
            <SkipForward className="h-4 w-4" fill="currentColor" />
          </IconButton>
          <IconButton
            onClick={() =>
              music.setRepeat(
                music.repeat === "off"
                  ? "all"
                  : music.repeat === "all"
                    ? "one"
                    : "off",
              )
            }
            active={music.repeat !== "off"}
          >
            <Repeat className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="w-9 text-right">
            {formatSeconds(music.currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(1, duration)}
            step="1"
            value={Math.min(music.currentTime, Math.max(1, duration))}
            onChange={(e) => music.seekTo(Number(e.target.value))}
            className="h-1 min-w-0 flex-1 accent-emerald-400"
            style={{
              background: `linear-gradient(90deg,#34d399 ${progress}%,rgba(255,255,255,.16) ${progress}%)`,
            }}
          />
          <span className="w-9">{formatSeconds(duration)}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 max-lg:hidden">
        <ListMusic className="h-4 w-4 text-slate-500" />
        <Volume2 className="h-4 w-4 text-slate-500" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={music.volume}
          onChange={(e) => music.setVolume(Number(e.target.value))}
          className="w-28 accent-emerald-400"
        />
      </div>
    </footer>
  );
}

function AddToPlaylistBar() {
  const music = useEduAIMusic();
  if (!music.pendingTrackId) return null;
  const track = music.allTracks.find(
    (item) => item.id === music.pendingTrackId,
  );
  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-[#11131a] p-3 text-white shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">
          Agregar {track?.title ?? "canción"} a playlist:
        </p>
        <button
          onClick={() => music.setPendingTrackId(null)}
          className="rounded-full px-2 text-slate-400 hover:bg-white/10"
        >
          ×
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => music.addToPlaylist("pl-liked", music.pendingTrackId!)}
          className="rounded-full bg-rose-400 px-3 py-1.5 text-xs font-bold text-slate-950"
        >
          ♥ Me gusta
        </button>
        {music.userPlaylists.map((playlist) => (
          <button
            key={playlist.id}
            onClick={() =>
              music.addToPlaylist(playlist.id, music.pendingTrackId!)
            }
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15"
          >
            {playlist.name}
          </button>
        ))}
        <button
          onClick={() => music.setCreateOpen(true)}
          className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950"
        >
          + Nueva
        </button>
      </div>
    </div>
  );
}

function MiniBar({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,540px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#07080d]/95 p-2 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPanel}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Cover track={music.currentTrack} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-black">
              {music.currentTrack.title}
            </span>
            <span className="block truncate text-[10px] text-slate-400">
              {music.currentTrack.artist}
            </span>
          </span>
        </button>
        <IconButton onClick={music.prevTrack}>
          <SkipBack className="h-3.5 w-3.5" />
        </IconButton>
        <PlayButton size="sm" />
        <IconButton onClick={music.nextTrack}>
          <SkipForward className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function CompactPanel({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  const tracks =
    music.view === "liked"
      ? music.allTracks.filter((track) => music.liked.has(track.id))
      : music.view === "queue"
        ? music.queue
        : music.visibleTracks;
  return (
    <div className="h-full overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0e14] text-white shadow-xl">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <button onClick={onOpenPanel} className="min-w-0 text-left">
              <p className="text-sm font-black">EduAI Music</p>
              <p className="truncate text-[10px] text-slate-400">
                {music.currentTrack.title}
              </p>
            </button>
            <Link
              href="/music"
              className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-white/15"
            >
              Abrir
            </Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <TrackList tracks={tracks} compact limit={12} />
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2">
            <Cover track={music.currentTrack} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">
                {music.currentTrack.title}
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {music.currentTrack.artist}
              </p>
            </div>
            <PlayButton size="sm" />
          </div>
        </div>
      </div>
      <AddToPlaylistBar />
    </div>
  );
}

export default function EduAIMusicPlayer({
  mode = "page",
  showMiniWhenStopped = false,
  onOpenPanel,
}: Props) {
  const music = useEduAIMusic();
  const tracksForMain = useMemo(() => {
    if (music.view === "liked")
      return music.allTracks.filter((track) => music.liked.has(track.id));
    if (music.view === "queue") return music.queue;
    return music.visibleTracks;
  }, [
    music.allTracks,
    music.liked,
    music.queue,
    music.view,
    music.visibleTracks,
  ]);

  if (mode === "mini") {
    if (!showMiniWhenStopped && !music.playing) return null;
    return <MiniBar onOpenPanel={onOpenPanel} />;
  }
  if (mode === "panel") return <CompactPanel onOpenPanel={onOpenPanel} />;

  return (
    <div className="h-screen min-h-[720px] overflow-hidden bg-[#07080d] text-white">
      <div className="grid h-full grid-rows-[64px,minmax(0,1fr),88px]">
        <TopBar />
        <div className="grid min-h-0 grid-cols-[320px,minmax(0,1fr),320px] max-xl:grid-cols-[300px,minmax(0,1fr)] max-lg:grid-cols-1">
          <div className="max-lg:hidden">
            <Sidebar tracks={tracksForMain} />
          </div>
          <MainPanel tracks={tracksForMain} />
          <div className="max-xl:hidden">
            <RightPanel />
          </div>
        </div>
        <BottomPlayer />
      </div>
      <AddToPlaylistBar />
    </div>
  );
}
