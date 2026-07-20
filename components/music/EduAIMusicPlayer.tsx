"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  Radio,
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
import { YOUTUBE_PLAYER_ID, useEduAIMusic } from "@/components/music/MusicProvider";

type PlayerMode = "panel" | "mini" | "page";

type Props = {
  mode?: PlayerMode;
  showMiniWhenStopped?: boolean;
  onOpenPanel?: () => void;
};

type ExtendedMusicTrack = EduMusicTrack & {
  playable?: boolean;
  externalOnly?: boolean;
  embedOnly?: boolean;
  embedUrl?: string;
  loaderUrl?: string;
  previewSeconds?: number;
};

type SpotifyEmbedItem = {
  id: string;
  title: string;
  subtitle: string;
  src: string;
  accent: string;
};

function asExtendedTrack(track?: EduMusicTrack | null): ExtendedMusicTrack | null {
  return (track || null) as ExtendedMusicTrack | null;
}

function isEmbedTrack(track?: EduMusicTrack | null) {
  return Boolean(asExtendedTrack(track)?.embedOnly);
}

function getEmbedUrl(track?: EduMusicTrack | null) {
  return asExtendedTrack(track)?.embedUrl || track?.externalUrl || track?.src || "";
}

const NAV_ITEMS = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "search", label: "Buscar", icon: Search },
  { id: "radio", label: "Radio", icon: Radio },
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

const SPOTIFY_EMBEDS: SpotifyEmbedItem[] = [
  {
    id: "spotify-calvin-mix",
    title: "Calvin Harris Mix",
    subtitle: "Electrónica y energía para modo DJ visual",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1EIZna6YqhjeY0?utm_source=generator&theme=0",
    accent: "from-emerald-400 to-cyan-400",
  },
  {
    id: "spotify-top-global",
    title: "Top Global",
    subtitle: "Tendencias globales desde Spotify",
    src: "https://open.spotify.com/embed/playlist/37i9dQZEVXddk5AflVss6A?utm_source=generator&theme=0",
    accent: "from-violet-400 to-fuchsia-400",
  },
  {
    id: "spotify-electro-mix",
    title: "Mix electrónico",
    subtitle: "Visual tipo club, ideal para reels de fondo",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1E8KVBYF00LoMc?utm_source=generator&theme=0",
    accent: "from-lime-300 to-emerald-400",
  },
  {
    id: "spotify-personal-1",
    title: "Lista personal 1",
    subtitle: "Playlist guardada para pruebas en EduAI Music",
    src: "https://open.spotify.com/embed/playlist/3z0zQdiFbPdiZ1I7xRpqPx?utm_source=generator&theme=0",
    accent: "from-sky-400 to-blue-500",
  },
  {
    id: "spotify-personal-2",
    title: "Lista personal 2",
    subtitle: "Otra lista visual para abrir en el centro",
    src: "https://open.spotify.com/embed/playlist/6VjXyFH9Z5HlGPAjRBKR32?utm_source=generator&theme=0",
    accent: "from-amber-300 to-orange-400",
  },
  {
    id: "spotify-focus",
    title: "Focus profundo",
    subtitle: "Música para estudiar y trabajar",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1DX6aTaZa0K6VA?utm_source=generator&theme=0",
    accent: "from-teal-300 to-emerald-500",
  },
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query || "study music playlist",
  )}`;
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

function durationForPlayer(track: EduMusicTrack, reportedDuration = 0) {
  if (track.source === "itunes") return 30;
  return reportedDuration || parseDuration(track.duration);
}

function spotifyOpenUrl(embedSrc: string) {
  return embedSrc
    .replace("https://open.spotify.com/embed/", "https://open.spotify.com/")
    .replace(/\?.*$/, "");
}

function sourceLabel(source?: EduMusicTrack["source"]) {
  if (source === "jamendo") return "Jamendo";
  if (source === "audius") return "Audius";
  if (source === "itunes") return "Preview iTunes";
  if (source === "youtube") return "YouTube video";
  if (source === "radio") return "Radio online";
  if (source === "external") return "Externo";
  return "EduAI";
}

function playbackKind(track?: EduMusicTrack) {
  if (isEmbedTrack(track)) return "Reproductor oficial ConectaAPP";
  if (asExtendedTrack(track)?.previewSeconds) return "YouTube DJ · video y audio sincronizados · 30 segundos";
  if (track?.source === "itunes") return "Preview 30 segundos · modo DJ";
  if (track?.source === "youtube") return "YouTube · cola automática";
  if (track?.source === "radio") return "Radio online en vivo";
  if (track?.source === "jamendo" || track?.source === "audius")
    return "Canción completa reproducible";
  return "Pista completa EduAI";
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
      ? "h-20 w-20 rounded-2xl text-2xl"
      : size === "lg"
        ? "h-14 w-14 rounded-xl text-xl"
        : size === "md"
          ? "h-10 w-10 rounded-xl text-base"
          : size === "sm"
            ? "h-8 w-8 rounded-lg text-xs"
            : "h-7 w-7 rounded-lg text-[10px]";
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
        className={`${cls} shrink-0 object-cover shadow-sm shadow-black/40`}
      />
    );
  }

  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center font-black text-slate-950 shadow-sm shadow-black/40 ring-1 ring-white/10`}
      style={{
        background:
          cover || track?.cover || "linear-gradient(135deg,#34d399,#10b981)",
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
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition",
        active
          ? "bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/25"
          : "bg-white/8 text-slate-300 hover:bg-emerald-400/15 hover:text-emerald-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

function PlayButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const music = useEduAIMusic();
  const embedTrack = isEmbedTrack(music.currentTrack);
  const cls =
    size === "lg" ? "h-11 w-11" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconCls = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={() => {
        if (!embedTrack) music.setPlaying((value) => !value);
      }}
      className={cn(
        `${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition`,
        embedTrack ? "cursor-default opacity-75" : "hover:scale-105 hover:bg-emerald-300",
      )}
      aria-label={embedTrack ? "Usa el reproductor oficial" : music.playing ? "Pausar" : "Reproducir"}
      title={embedTrack ? "Usa el reproductor oficial de la radio" : music.playing ? "Pausar" : "Reproducir"}
    >
      {embedTrack ? (
        <ExternalLink className={iconCls} />
      ) : music.playing ? (
        <Pause className={iconCls} fill="currentColor" />
      ) : (
        <Play className={`${iconCls} translate-x-0.5`} fill="currentColor" />
      )}
    </button>
  );
}

function SidebarTrackRow({
  track,
  index,
  tracks,
}: {
  track: EduMusicTrack;
  index: number;
  tracks: EduMusicTrack[];
}) {
  const music = useEduAIMusic();
  const active = track.id === music.currentTrack.id;
  return (
    <button
      type="button"
      onClick={() => music.playTrack(track, tracks)}
      className={cn(
        "flex h-12 w-full items-center gap-2 rounded-xl px-2 text-left transition",
        active
          ? "bg-emerald-400/14 text-white ring-1 ring-emerald-400/35"
          : "text-slate-300 hover:bg-white/7 hover:text-white",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
          active ? "bg-emerald-400 text-slate-950" : "bg-white/8 text-slate-400",
        )}
      >
        {active && music.playing ? (
          <Pause className="h-3 w-3" fill="currentColor" />
        ) : active ? (
          <Play className="h-3 w-3" fill="currentColor" />
        ) : (
          index + 1
        )}
      </span>
      <Cover track={track} size="xs" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs font-black",
            active ? "text-emerald-300" : "text-current",
          )}
        >
          {track.title}
        </span>
        <span className="block truncate text-[10px] text-slate-500">
          {track.artist} · {sourceLabel(track.source)}
        </span>
      </span>
    </button>
  );
}

function TableTrackRow({
  track,
  index,
  tracks,
}: {
  track: EduMusicTrack;
  index: number;
  tracks: EduMusicTrack[];
}) {
  const music = useEduAIMusic();
  const active = track.id === music.currentTrack.id;
  return (
    <div
      className={cn(
        "group flex h-12 items-center gap-3 rounded-xl px-3 transition",
        active
          ? "bg-emerald-400/12 text-white ring-1 ring-emerald-400/25"
          : "text-slate-300 hover:bg-white/7 hover:text-white",
      )}
    >
      <button
        type="button"
        onClick={() => music.playTrack(track, tracks)}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition",
          active
            ? "bg-emerald-400 text-slate-950"
            : "bg-white/8 text-slate-400 group-hover:bg-emerald-400 group-hover:text-slate-950",
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
        className="min-w-0 flex-[1.6] text-left"
      >
        <span
          className={cn(
            "block truncate text-sm font-black",
            active ? "text-emerald-300" : "text-current",
          )}
        >
          {track.title}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {track.artist}
        </span>
      </button>
      <span className="hidden min-w-0 flex-1 truncate text-xs text-slate-400 md:block">
        {track.album}
      </span>
      <span className="hidden w-20 shrink-0 rounded-full bg-white/7 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:block">
        {sourceLabel(track.source)}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => music.toggleLike(track.id)}
          className={cn(
            "text-slate-500 hover:text-emerald-300",
            music.liked.has(track.id) && "text-emerald-300",
          )}
          aria-label="Me gusta"
        >
          <Heart
            className="h-3.5 w-3.5"
            fill={music.liked.has(track.id) ? "currentColor" : "none"}
          />
        </button>
        <button
          type="button"
          onClick={() => music.requestAddToPlaylist(track.id)}
          className="text-slate-500 hover:text-emerald-300"
          aria-label="Agregar a playlist"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="w-9 text-right text-xs text-slate-500">
          {track.duration}
        </span>
      </div>
    </div>
  );
}

function SidebarTrackList({ tracks, limit = 40 }: { tracks: EduMusicTrack[]; limit?: number }) {
  const shown = tracks.slice(0, limit);
  if (!shown.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-slate-400">
        No hay canciones en esta vista.
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {shown.map((track, index) => (
        <SidebarTrackRow key={track.id} track={track} index={index} tracks={shown} />
      ))}
    </div>
  );
}

function TableTrackList({ tracks }: { tracks: EduMusicTrack[] }) {
  if (!tracks.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
        No hay canciones seleccionadas.
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-3 pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <span className="w-7">#</span>
        <span className="w-8"></span>
        <span className="min-w-0 flex-[1.6]">Título</span>
        <span className="hidden min-w-0 flex-1 md:block">Álbum</span>
        <span className="hidden w-20 text-center lg:block">Fuente</span>
        <span className="ml-auto w-24 text-right">Acciones</span>
      </div>
      {tracks.map((track, index) => (
        <TableTrackRow key={track.id} track={track} index={index} tracks={tracks} />
      ))}
    </div>
  );
}

function TopBar() {
  const music = useEduAIMusic();
  return (
    <header className="flex h-[58px] shrink-0 items-center gap-4 border-b border-white/10 bg-[#05070a] px-4 text-white">
      <div className="flex w-[300px] shrink-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black tracking-tight text-white">
            EduAI Music
          </h1>
          <p className="truncate text-[11px] font-semibold text-emerald-300">
            Música, playlists y foco educativo
          </p>
        </div>
      </div>

      <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/8 px-4 shadow-inner shadow-black/30 max-md:hidden">
        <Search className="h-4 w-4 text-emerald-300" />
        <input
          value={music.query}
          onChange={(e) => music.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && music.query.trim())
              void music.searchOnline(music.query);
          }}
          placeholder="Buscar en biblioteca o presiona Enter para buscar online"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
      </div>

      <Link
        href="/agentes"
        className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/12 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
    </header>
  );
}


function RadioPanel() {
  const music = useEduAIMusic();
  const presets = [
    { label: "FM Dos", term: "fm dos", countryCode: "CL" },
    { label: "Canal 95", term: "canal 95", countryCode: "CL" },
    { label: "Carolina", term: "carolina", countryCode: "CL" },
    { label: "Chile", term: "", countryCode: "CL" },
    { label: "Noticias", term: "noticias", countryCode: "CL" },
    { label: "Música", term: "music", countryCode: "CL" },
    { label: "Mundo", term: "", countryCode: "" },
  ];
  const shown = music.radioTracks.slice(0, 8);

  return (
    <section className="shrink-0 rounded-2xl border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,.16),rgba(20,23,31,.96))] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-black text-white">
            <Radio className="h-4 w-4 text-emerald-300" /> Radio online
          </p>
          <p className="text-[10px] text-slate-400">Sintoniza emisoras en vivo.</p>
        </div>
        <button
          type="button"
          onClick={() => void music.searchRadio("", "CL")}
          disabled={music.radioLoading}
          className="rounded-full bg-emerald-400 px-3 py-1.5 text-[10px] font-black text-slate-950 disabled:opacity-50"
        >
          {music.radioLoading ? "..." : "Buscar"}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={music.radioQuery}
          onChange={(e) => music.setRadioQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void music.searchRadio()}
          placeholder="FM Dos, Carolina, Canal 95, Bío-Bío..."
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((item) => (
          <button
            key={`${item.label}-${item.countryCode}`}
            type="button"
            onClick={() => void music.searchRadio(item.term, item.countryCode)}
            className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-black text-slate-300 transition hover:bg-emerald-400/15 hover:text-emerald-200"
          >
            {item.label}
          </button>
        ))}
      </div>

      {music.radioError && <p className="mt-2 text-[10px] font-bold text-rose-300">{music.radioError}</p>}

      {shown.length > 0 && (
        <div className="mt-2 max-h-[180px] space-y-1 overflow-y-auto pr-1">
          {shown.map((track, index) => {
            const active = track.id === music.currentTrack.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => music.playTrack(track, music.radioTracks)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition",
                  active ? "bg-emerald-400/15 text-white ring-1 ring-emerald-400/30" : "hover:bg-white/7",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-black text-emerald-300">
                  {active && music.playing ? <Pause className="h-3 w-3" fill="currentColor" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-black text-white">{track.title}</span>
                  <span className="block truncate text-[10px] text-slate-500">{track.artist}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Sidebar({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();
  const [playlistFilter, setPlaylistFilter] = useState("");
  const filteredPlaylists = music.playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(playlistFilter.toLowerCase()),
  );

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-white/10 bg-[#0b0d12] p-2.5 text-white">
      <div className="shrink-0 rounded-2xl border border-white/10 bg-[#14171f] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-white">Tu biblioteca</p>
            <p className="text-[11px] text-slate-400">Canciones y grupos</p>
          </div>
          <button
            type="button"
            onClick={() => music.setCreateOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" /> Crear
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs font-bold text-slate-300">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => music.setView(item.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 transition",
                  music.view === item.id
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-white/7 hover:bg-emerald-400/10 hover:text-emerald-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </div>

        {music.createOpen && (
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/8 p-2">
            <input
              value={music.newPlaylistName}
              onChange={(e) => music.setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && music.createPlaylist()}
              placeholder="Nombre de playlist"
              className="h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={music.createPlaylist}
              className="mt-2 h-9 w-full rounded-lg bg-emerald-400 text-xs font-black text-slate-950 hover:bg-emerald-300"
            >
              Crear playlist
            </button>
          </div>
        )}
      </div>

      <div className="mt-3">
        <RadioPanel />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <section className="flex min-h-0 flex-[0.8] flex-col rounded-2xl border border-white/10 bg-[#14171f] p-3">
          <div className="mb-2 flex h-9 items-center gap-2 rounded-xl bg-black/25 px-3">
            <Search className="h-3.5 w-3.5 text-emerald-300" />
            <input
              value={playlistFilter}
              onChange={(e) => setPlaylistFilter(e.target.value)}
              placeholder="Filtrar grupos"
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-1">
              {filteredPlaylists.map((playlist: EduMusicPlaylist) => (
                <button
                  key={playlist.id}
                  onClick={() => {
                    music.setSelectedPlaylistId(playlist.id);
                    music.setView(
                      playlist.id === "pl-liked"
                        ? "liked"
                        : playlist.id === "pl-radio"
                          ? "radio"
                          : playlist.id === "pl-online"
                            ? "search"
                            : "playlists",
                    );
                  }}
                  className={cn(
                    "flex h-[48px] w-full items-center gap-2 rounded-xl px-2 text-left transition",
                    music.selectedPlaylistId === playlist.id
                      ? "bg-white/12 ring-1 ring-emerald-400/25"
                      : "hover:bg-white/7",
                  )}
                >
                  <Cover label={playlist.name} cover={playlist.cover} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white">
                      {playlist.name}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {playlist.trackIds.length} canciones
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#14171f] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
              Canciones
            </p>
            <span className="text-xs text-slate-500">{tracks.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <SidebarTrackList tracks={tracks} limit={60} />
          </div>
        </section>
      </div>
    </aside>
  );
}

function PlaylistHeader({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();
  const playlist = music.selectedPlaylist;
  const totalSeconds = tracks.reduce(
    (sum, track) => sum + parseDuration(track.duration),
    0,
  );

  return (
    <section className="shrink-0 rounded-2xl border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,.22),rgba(17,24,39,.98)_50%,rgba(34,197,94,.12))] p-3 text-white shadow-md shadow-black/25">
      <div className="flex min-w-0 items-center gap-3">
        <Cover label={playlist.name} cover={playlist.cover} size="hero" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Playlist seleccionada
          </p>
          <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-white max-xl:text-xl">
            {playlist.name}
          </h2>
          <p className="mt-1 line-clamp-1 max-w-2xl text-xs leading-relaxed text-slate-300">
            {playlist.description}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            EduAI Music · {tracks.length} canciones · {formatSeconds(totalSeconds)} aprox.
          </p>
        </div>
        <button
          type="button"
          onClick={() => music.playPlaylist(playlist.id)}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-emerald-400 px-4 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-300"
        >
          <Play className="h-4 w-4" fill="currentColor" /> Reproducir
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <IconButton onClick={() => music.setShuffle((value) => !value)} active={music.shuffle} title="Aleatorio">
          <Shuffle className="h-4 w-4" />
        </IconButton>
        <IconButton onClick={() => music.toggleLike(music.currentTrack.id)} active={music.liked.has(music.currentTrack.id)} title="Me gusta">
          <Heart className="h-4 w-4" fill={music.liked.has(music.currentTrack.id) ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")}
          active={music.repeat !== "off"}
          title="Repetir"
        >
          <Repeat className="h-4 w-4" />
        </IconButton>
        <div className="ml-1 flex min-w-0 flex-wrap gap-1.5">
          {MOODS.map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => music.setSelectedMood(mood)}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition",
                music.selectedMood === mood
                  ? "border-emerald-300 bg-emerald-400 text-slate-950"
                  : "border-white/10 bg-white/7 text-slate-300 hover:bg-emerald-400/10 hover:text-emerald-200",
              )}
            >
              {mood === "all" ? "Todo" : MOOD_LABELS[mood]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CurrentTrackArtwork({ track }: { track: EduMusicTrack }) {
  const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);
  if (track.source === "youtube") {
    return (
      <div className="relative aspect-video w-full max-w-[620px] overflow-hidden rounded-3xl border border-red-400/25 bg-black shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div id={YOUTUBE_PLAYER_ID} className="absolute inset-0 h-full w-full bg-black" />
        {artwork && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork}
            alt={track.title}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500"
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-red-500/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-red-950/30">
          YouTube · cola automática
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 text-left">
          <p className="line-clamp-1 text-sm font-black text-white drop-shadow">{track.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-slate-200">{track.artist}</p>
        </div>
      </div>
    );
  }

  if (artwork) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artwork}
        alt={track.title}
        className="h-44 w-44 rounded-3xl object-cover shadow-2xl shadow-black/35 ring-1 ring-white/10 max-xl:h-36 max-xl:w-36"
      />
    );
  }

  return (
    <div
      className="flex h-44 w-44 flex-col items-center justify-center rounded-3xl p-5 text-center shadow-2xl shadow-black/35 ring-1 ring-white/10 max-xl:h-36 max-xl:w-36"
      style={{ background: track.cover || "linear-gradient(135deg,#34d399,#0f766e)" }}
    >
      <span className="text-4xl font-black text-slate-950 max-xl:text-3xl">
        {track.title.slice(0, 1).toUpperCase()}
      </span>
      <span className="mt-3 line-clamp-2 text-xs font-black leading-tight text-slate-950">
        {track.title}
      </span>
      <span className="mt-1 line-clamp-1 text-[10px] font-bold text-slate-800">
        {track.artist}
      </span>
    </div>
  );
}

function MainPanel({
  tracks,
  spotifyEmbed,
  onClearSpotify,
}: {
  tracks: EduMusicTrack[];
  spotifyEmbed: SpotifyEmbedItem | null;
  onClearSpotify: () => void;
}) {
  const music = useEduAIMusic();
  const track = music.currentTrack;
  const playlist = music.selectedPlaylist;
  const embedTrack = isEmbedTrack(track);
  const embedUrl = getEmbedUrl(track);

  return (
    <main className="flex min-h-0 min-w-0 flex-col bg-[#101218] p-2.5 text-white">
      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#151922] p-4 shadow-lg shadow-black/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Reproductor central
            </p>
            <h2 className="truncate text-xl font-black text-white">
              {playlist.name}
            </h2>
            <p className="truncate text-xs text-slate-400">
              Las listas quedan a los lados. Aquí se muestra solo la canción actual.
            </p>
          </div>
          {track.source !== "youtube" && (
            <button
              type="button"
              onClick={() => music.playPlaylist(playlist.id)}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-emerald-400 px-4 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-300"
            >
              <Play className="h-4 w-4" fill="currentColor" /> Reproducir lista
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-emerald-400/15 bg-[radial-gradient(circle_at_center,rgba(16,185,129,.18),rgba(15,23,42,.78)_48%,rgba(5,7,10,.95))] p-5">
          {spotifyEmbed ? (
            <div className="w-full max-w-3xl rounded-[1.75rem] border border-emerald-300/20 bg-black/25 p-4 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-4">
              <div className="mx-auto max-w-xl">
                <p className="mx-auto mb-2 w-fit rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  Spotify visual · reproductor oficial
                </p>
                <h3 className="line-clamp-2 text-2xl font-black leading-tight text-white max-xl:text-xl">
                  {spotifyEmbed.title}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-300">
                  {spotifyEmbed.subtitle}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Haz clic en play dentro del embed oficial. EduAI no controla Spotify directamente sin OAuth/Spotify Premium.
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-3xl border border-emerald-400/20 bg-black/50 shadow-2xl shadow-black/40">
                <iframe
                  data-testid="embed-iframe"
                  title={spotifyEmbed.title}
                  src={spotifyEmbed.src}
                  width="100%"
                  height="420"
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="block border-0 bg-black"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <button
                  type="button"
                  onClick={onClearSpotify}
                  className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
                >
                  Volver a EduAI Player
                </button>
                <a
                  href={spotifyOpenUrl(spotifyEmbed.src)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-400/25 bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Abrir en Spotify
                </a>
              </div>
            </div>
          ) : embedTrack ? (
            <div className="w-full max-w-4xl rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-4">
              <div className="mx-auto max-w-xl">
                <p className="mx-auto mb-2 w-fit rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {playbackKind(track)}
                </p>
                <h3 className="line-clamp-2 text-xl font-black leading-tight text-white max-xl:text-lg">
                  {track.title}
                </h3>
                <p className="mt-1 truncate text-sm font-semibold text-slate-300">
                  {track.artist}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Canal 95 usa el reproductor oficial de ConectaAPP. No se reproduce con el audio global de EduAI porque no entrega un stream directo estable.
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-3xl border border-emerald-400/20 bg-black/40 shadow-2xl shadow-black/40">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={`${track.title} - reproductor oficial`}
                    className="h-[560px] w-full border-0 bg-black max-lg:h-[520px] max-sm:h-[480px]"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
                    <CurrentTrackArtwork track={track} />
                    <p className="mt-4 text-sm font-bold text-rose-200">No hay URL de reproductor oficial configurada.</p>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() => music.toggleLike(track.id)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-black transition",
                    music.liked.has(track.id)
                      ? "border-emerald-400 bg-emerald-400 text-slate-950"
                      : "border-white/10 bg-white/7 text-slate-300 hover:bg-emerald-400/10 hover:text-emerald-200",
                  )}
                >
                  ♥ Me gusta
                </button>
                <a
                  href={track.externalUrl || embedUrl || "https://www.canal95.cl/"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
                >
                  Abrir fuente oficial
                </a>
              </div>
            </div>
          ) : (
            <div className={cn("w-full rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-4", track.source === "youtube" ? "max-w-4xl" : "max-w-xl")}>
              <div className="flex justify-center">
                <CurrentTrackArtwork track={track} />
              </div>

              <div className="mx-auto mt-4 max-w-lg">
                <p className="mx-auto mb-2 w-fit rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {playbackKind(track)}
                </p>
                <h3 className="line-clamp-2 text-xl font-black leading-tight text-white max-xl:text-lg">
                  {track.title}
                </h3>
                <p className="mt-1 truncate text-sm font-semibold text-slate-300">
                  {track.artist}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {track.album || "Sin álbum"} · {track.duration || "--:--"}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2.5">
                <IconButton onClick={() => music.setShuffle((value) => !value)} active={music.shuffle} title="Aleatorio">
                  <Shuffle className="h-4 w-4" />
                </IconButton>
                <IconButton onClick={music.prevTrack} title="Anterior">
                  <SkipBack className="h-4 w-4" fill="currentColor" />
                </IconButton>
                <PlayButton size="lg" />
                <IconButton onClick={music.nextTrack} title="Siguiente">
                  <SkipForward className="h-4 w-4" fill="currentColor" />
                </IconButton>
                <IconButton
                  onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")}
                  active={music.repeat !== "off"}
                  title="Repetir"
                >
                  <Repeat className="h-4 w-4" />
                </IconButton>
              </div>

              {track.source === "youtube" && (
                <p className="mt-3 text-xs font-semibold text-emerald-200/90">
                  {asExtendedTrack(track)?.previewSeconds
                    ? "Modo DJ 30s: este mismo video entrega la imagen y el audio; comienza en 0:00 y avanza al siguiente al llegar a 30 segundos."
                    : "YouTube usa el reproductor real al centro: el video y el audio provienen de la misma fuente y avanzan juntos."}
                </p>
              )}
              {track.source === "itunes" && (
                <p className="mt-3 text-xs font-semibold text-emerald-200/90">
                  Modo DJ 30s: al terminar el preview avanza automáticamente. Si hay YouTube API Key, se muestra un video visual tipo reel silenciado.
                </p>
              )}
              {track.source === "radio" && (
                <p className="mt-3 text-xs font-semibold text-emerald-200/90">
                  Radio online en vivo. Algunas emisoras pueden tardar unos segundos en iniciar según su servidor.
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() => music.toggleLike(track.id)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-black transition",
                    music.liked.has(track.id)
                      ? "border-emerald-400 bg-emerald-400 text-slate-950"
                      : "border-white/10 bg-white/7 text-slate-300 hover:bg-emerald-400/10 hover:text-emerald-200",
                  )}
                >
                  ♥ Me gusta
                </button>
                <button
                  type="button"
                  onClick={() => music.requestAddToPlaylist(track.id)}
                  className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
                >
                  + Agregar a playlist
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                {tracks.length} canciones disponibles en la lista lateral izquierda.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function SpotifyEmbeds({
  selectedId,
  onSelect,
  onClear,
}: {
  selectedId?: string;
  onSelect: (item: SpotifyEmbedItem) => void;
  onClear: () => void;
}) {
  return (
    <section className="shrink-0 rounded-2xl border border-white/10 bg-[#14171f] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-white">Spotify visual</p>
          <p className="text-[11px] text-slate-500">Toca una lista para abrirla al centro.</p>
        </div>
        {selectedId ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black text-slate-300 transition hover:bg-rose-400/15 hover:text-rose-200"
          >
            Cerrar lista
          </button>
        ) : (
          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black text-slate-400">
            {SPOTIFY_EMBEDS.length} listas
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SPOTIFY_EMBEDS.map((item) => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "rounded-2xl border p-2 text-left transition",
                active
                  ? "border-emerald-300/45 bg-emerald-400/14 shadow-lg shadow-emerald-950/20"
                  : "border-white/10 bg-white/6 hover:border-emerald-300/25 hover:bg-emerald-400/10",
              )}
            >
              <span className={`mb-2 block h-1.5 rounded-full bg-gradient-to-r ${item.accent}`} />
              <span className="block truncate text-[11px] font-black text-white">
                {item.title}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-[9px] leading-tight text-slate-500">
                {item.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
function RightPanel({
  selectedSpotifyId,
  onSelectSpotify,
  onClearSpotify,
}: {
  selectedSpotifyId?: string;
  onSelectSpotify: (item: SpotifyEmbedItem) => void;
  onClearSpotify: () => void;
}) {
  const music = useEduAIMusic();
  const [youtubeQuery, setYoutubeQuery] = useState("música para estudiar sin letra");
  const related = music.allTracks
    .filter((track) => track.mood === music.currentTrack.mood && track.id !== music.currentTrack.id)
    .slice(0, 6);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto border-l border-white/10 bg-[#0b0d12] p-2.5 text-white">
      <section className="shrink-0 rounded-2xl border border-emerald-400/20 bg-[#14171f] p-3">
        <p className="text-sm font-black text-white">Buscar canciones</p>
        <p className="mt-1 text-xs text-slate-400">
          Busca videos musicales: cada resultado reproduce video y audio desde la misma fuente de YouTube.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={music.onlineQuery}
            onChange={(e) => music.setOnlineQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void music.searchOnline();
              if (e.key === "Escape") {
                music.setOnlineQuery("");
                music.clearOnlineResults();
              }
            }}
            placeholder="daddy, lofi, piano, estudio..."
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
          />
          <button
            type="button"
            onClick={() => void music.searchOnline()}
            disabled={music.onlineLoading}
            className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
          >
            {music.onlineLoading ? "..." : "Buscar"}
          </button>
        </div>
        {music.onlineError && <p className="mt-2 text-xs font-bold text-rose-300">{music.onlineError}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wide">
          {[
            { id: "youtube", label: "Videos" },
            { id: "preview", label: "DJ 30s" },
          ].map((item) => {
            const provider = item.id as "all" | "full" | "preview" | "youtube";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  music.setOnlineProviderMode(provider);
                  if (music.onlineQuery.trim()) void music.searchOnline(undefined, provider);
                }}
                className={cn(
                  "rounded-full px-2 py-1 transition",
                  music.onlineProviderMode === item.id
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-white/8 text-slate-300 hover:bg-emerald-400/12 hover:text-emerald-200",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Videos reproduce cada canción completa desde YouTube. DJ 30s usa ese mismo video desde 0:00 y corta a los 30 segundos, sin mezclar audios externos.
        </p>
        {(music.onlineTracks.length > 0 || music.onlineQuery) && (
          <button
            type="button"
            onClick={() => {
              music.setOnlineQuery("");
              music.clearOnlineResults();
            }}
            className="mt-2 text-[10px] font-black text-slate-400 transition hover:text-rose-200"
          >
            Limpiar búsqueda y resultados
          </button>
        )}
      </section>

      <section className="flex min-h-0 flex-[0.65] flex-col rounded-2xl border border-white/10 bg-[#14171f] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black text-white">Resultados online</p>
          <button
            type="button"
            onClick={() => {
              music.setSelectedPlaylistId("pl-online");
              music.setView("search");
            }}
            className="text-xs font-bold text-emerald-300 hover:underline"
          >
            ver todos
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SidebarTrackList tracks={music.onlineTracks.length ? music.onlineTracks : related} limit={12} />
        </div>
      </section>

      <SpotifyEmbeds selectedId={selectedSpotifyId} onSelect={onSelectSpotify} onClear={onClearSpotify} />

      <section className="shrink-0 rounded-2xl border border-white/10 bg-[#14171f] p-3">
        <p className="text-sm font-black text-white">Ahora suena</p>
        <div className="mt-3 flex items-center gap-3">
          <Cover track={music.currentTrack} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-emerald-300">{music.currentTrack.title}</p>
            <p className="truncate text-xs text-slate-300">{music.currentTrack.artist}</p>
            <p className="truncate text-[11px] text-slate-500">{music.currentTrack.album}</p>
          </div>
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
      </section>

      <section className="shrink-0 rounded-2xl border border-white/10 bg-[#14171f] p-3">
        <p className="text-sm font-black text-white">Fuentes externas</p>
        <div className="mt-2 flex gap-2">
          <input
            value={youtubeQuery}
            onChange={(e) => setYoutubeQuery(e.target.value)}
            placeholder="Buscar en YouTube"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500"
          />
          <a
            href={youtubeSearchUrl(youtubeQuery)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white/8 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-emerald-400/10 hover:text-emerald-200"
          >
            Abrir
          </a>
        </div>
        <div className="mt-2 max-h-[88px] space-y-1 overflow-y-auto pr-1">
          {EXTERNAL_MUSIC_COLLECTIONS.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs hover:bg-white/7"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-slate-200">{item.name}</span>
                <span className="block truncate text-[10px] text-slate-500">{item.provider}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </a>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ProgressRange({
  currentTime,
  duration,
  onSeek,
  compact = false,
}: {
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  compact?: boolean;
}) {
  const safeDuration = Math.max(1, duration || 1);
  const value = Math.min(currentTime || 0, safeDuration);
  const progress = Math.min(100, (value / safeDuration) * 100);

  return (
    <div className="relative min-w-0 flex-1">
      <div className={cn("absolute left-0 right-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white/16", compact ? "h-1.5" : "h-2")}> 
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-violet-400 shadow-[0_0_14px_rgba(52,211,153,.45)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <input
        type="range"
        min="0"
        max={safeDuration}
        step="1"
        value={value}
        onChange={(e) => onSeek(Number(e.target.value))}
        className={cn("relative z-10 w-full cursor-pointer opacity-0", compact ? "h-4" : "h-5")}
        aria-label="Progreso"
      />
    </div>
  );
}

function BottomPlayer() {
  const music = useEduAIMusic();
  const duration = durationForPlayer(music.currentTrack, music.durationSeconds);

  return (
    <footer className="flex h-[76px] shrink-0 items-center gap-4 border-t border-white/10 bg-[#05070a] px-4 text-white">
      <div className="flex min-w-0 items-center gap-3" style={{ width: 320 }}>
        <Cover track={music.currentTrack} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{music.currentTrack.title}</p>
          <p className="truncate text-xs text-slate-400">{music.currentTrack.artist} · {sourceLabel(music.currentTrack.source)}</p>
        </div>
        <button
          type="button"
          onClick={() => music.toggleLike(music.currentTrack.id)}
          className={cn("text-slate-500 hover:text-emerald-300", music.liked.has(music.currentTrack.id) && "text-emerald-300")}
        >
          <Heart className="h-4 w-4" fill={music.liked.has(music.currentTrack.id) ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-center gap-3">
          <IconButton onClick={() => music.setShuffle((value) => !value)} active={music.shuffle}>
            <Shuffle className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={music.prevTrack}>
            <SkipBack className="h-4 w-4" fill="currentColor" />
          </IconButton>
          <PlayButton size="lg" />
          <IconButton onClick={music.nextTrack}>
            <SkipForward className="h-4 w-4" fill="currentColor" />
          </IconButton>
          <IconButton
            onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")}
            active={music.repeat !== "off"}
          >
            <Repeat className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="w-9 text-right">{formatSeconds(music.currentTime)}</span>
          <ProgressRange currentTime={music.currentTime} duration={duration} onSeek={music.seekTo} />
          <span className="w-9">{formatSeconds(duration)}</span>
        </div>
      </div>

      <div className="hidden items-center justify-end gap-3 pr-14 xl:flex" style={{ width: 320 }}>
        <ListMusic className="h-4 w-4 text-slate-500" />
        <Volume2 className="h-4 w-4 text-slate-500" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={music.volume}
          onChange={(e) => music.setVolume(Number(e.target.value))}
          className="w-24 accent-emerald-400"
        />
      </div>
    </footer>
  );
}

function AddToPlaylistBar() {
  const music = useEduAIMusic();
  if (!music.pendingTrackId) return null;
  const track = music.allTracks.find((item) => item.id === music.pendingTrackId);
  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-emerald-400/20 bg-[#11131a] p-3 text-white shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">Agregar {track?.title ?? "canción"} a playlist:</p>
        <button type="button" onClick={() => music.setPendingTrackId(null)} className="rounded-full px-2 text-slate-400 hover:bg-white/10">
          ×
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => music.addToPlaylist("pl-liked", music.pendingTrackId!)} className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-black text-slate-950">
          ♥ Me gusta
        </button>
        {music.userPlaylists.map((playlist) => (
          <button key={playlist.id} type="button" onClick={() => music.addToPlaylist(playlist.id, music.pendingTrackId!)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15">
            {playlist.name}
          </button>
        ))}
        <button type="button" onClick={() => music.setCreateOpen(true)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-emerald-400/15 hover:text-emerald-200">
          + Nueva
        </button>
      </div>
    </div>
  );
}

function MiniBar({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  const [collapsed, setCollapsed] = useState(false);
  const duration = durationForPlayer(music.currentTrack, music.durationSeconds);

  useEffect(() => {
    setCollapsed(false);
  }, [music.currentTrack.id]);

  if (collapsed) {
    return (
      <div className="fixed bottom-20 right-5 z-50 flex items-center gap-1 rounded-full border border-emerald-300/25 bg-[#06080d]/95 p-1.5 text-white shadow-2xl shadow-emerald-950/30 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-full px-2 py-1 text-left hover:bg-white/10"
          title="Restaurar reproductor"
          aria-label="Restaurar reproductor de música"
        >
          <Cover track={music.currentTrack} size="xs" />
          <span className="hidden max-w-[150px] truncate text-[11px] font-black sm:block">
            {music.currentTrack.title}
          </span>
        </button>
        <PlayButton size="sm" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(94vw,620px)] -translate-x-1/2 rounded-2xl border border-emerald-300/25 bg-[#06080d]/95 p-2.5 text-white shadow-2xl shadow-emerald-950/30 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenPanel}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title="Abrir reproductor"
        >
          <Cover track={music.currentTrack} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-black text-white">{music.currentTrack.title}</span>
            <span className="block truncate text-[10px] text-slate-400">{music.currentTrack.artist}</span>
          </span>
        </button>

        <div className="flex items-center gap-1">
          <IconButton onClick={music.prevTrack}>
            <SkipBack className="h-3.5 w-3.5" fill="currentColor" />
          </IconButton>
          <PlayButton size="sm" />
          <IconButton onClick={music.nextTrack}>
            <SkipForward className="h-3.5 w-3.5" fill="currentColor" />
          </IconButton>
        </div>

        <div className="hidden items-center gap-1 pl-1 sm:flex">
          <Volume2 className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={music.volume}
            onChange={(e) => music.setVolume(Number(e.target.value))}
            className="w-20 accent-emerald-400"
            aria-label="Volumen"
          />
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-base font-black leading-none text-slate-300 transition hover:bg-white/15 hover:text-white"
          title="Minimizar reproductor"
          aria-label="Minimizar reproductor de música"
        >
          −
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="w-8 text-right">{formatSeconds(music.currentTime)}</span>
        <ProgressRange currentTime={music.currentTime} duration={duration} onSeek={music.seekTo} compact />
        <span className="w-8">{formatSeconds(duration)}</span>
      </div>
    </div>
  );
}

function CompactPanel({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  const tracks = music.view === "liked" ? music.allTracks.filter((track) => music.liked.has(track.id)) : music.view === "queue" ? music.queue : music.visibleTracks;
  return (
    <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14] text-white shadow-xl">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onOpenPanel} className="min-w-0 text-left">
              <p className="text-sm font-black text-white">EduAI Music</p>
              <p className="truncate text-[10px] text-slate-400">{music.currentTrack.title}</p>
            </button>
            <Link href="/music" className="rounded-full bg-emerald-400 px-3 py-1.5 text-[10px] font-black text-slate-950 hover:bg-emerald-300">
              Abrir
            </Link>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <SidebarTrackList tracks={tracks} limit={12} />
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2">
            <Cover track={music.currentTrack} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">{music.currentTrack.title}</p>
              <p className="truncate text-[10px] text-slate-400">{music.currentTrack.artist}</p>
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
  const [selectedSpotifyEmbed, setSelectedSpotifyEmbed] = useState<SpotifyEmbedItem | null>(null);
  const setPendingTrackId = music.setPendingTrackId;

  useEffect(() => {
    if (mode === "page") setPendingTrackId(null);
  }, [mode, setPendingTrackId]);

  // Spotify vive como una vista temporal. Al navegar, elegir otra playlist o
  // reproducir una canción, desmontamos el iframe para que no quede visible ni
  // siga cargando en segundo plano.
  useEffect(() => {
    setSelectedSpotifyEmbed(null);
  }, [music.currentTrack.id, music.selectedPlaylistId, music.view]);

  const tracksForMain = useMemo(() => {
    if (music.view === "liked") return music.allTracks.filter((track) => music.liked.has(track.id));
    if (music.view === "queue") return music.queue;
    return music.visibleTracks;
  }, [music.allTracks, music.liked, music.queue, music.view, music.visibleTracks]);

  if (mode === "mini") {
    const shouldShowMini =
      music.playing || (showMiniWhenStopped && music.hasActiveSession);
    if (!shouldShowMini) return null;
    return <MiniBar onOpenPanel={onOpenPanel} />;
  }
  if (mode === "panel") return <CompactPanel onOpenPanel={onOpenPanel} />;

  return (
    <div className="h-screen min-h-[680px] overflow-hidden bg-[#05070a] text-white">
      <style jsx global>{`
        @keyframes eduai-dj-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
      <div className="flex h-full flex-col">
        <TopBar />
        <div
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateColumns: "280px minmax(0, 1fr) 320px" }}
        >
          <Sidebar tracks={tracksForMain} />
          <MainPanel
            tracks={tracksForMain}
            spotifyEmbed={selectedSpotifyEmbed}
            onClearSpotify={() => setSelectedSpotifyEmbed(null)}
          />
          <RightPanel
            selectedSpotifyId={selectedSpotifyEmbed?.id}
            onSelectSpotify={setSelectedSpotifyEmbed}
            onClearSpotify={() => setSelectedSpotifyEmbed(null)}
          />
        </div>
        {music.currentTrack.source !== "youtube" && <BottomPlayer />}
      </div>
      <AddToPlaylistBar />
    </div>
  );
}
