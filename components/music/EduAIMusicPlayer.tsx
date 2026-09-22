"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
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
  Upload,
  Volume2,
} from "lucide-react";
import {
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
  previewStartSeconds?: number;
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
  { id: "home", view: "home", label: "Inicio", icon: Home },
  { id: "youtube", view: "search", label: "YouTube", icon: Play },
  { id: "spotify", view: null, label: "Spotify", icon: Music2 },
  { id: "radio", view: "radio", label: "Radio", icon: Radio },
  { id: "library", view: "library", label: "Mis audios", icon: Library },
  { id: "playlists", view: "playlists", label: "Playlists", icon: ListMusic },
  { id: "liked", view: "liked", label: "Favoritos", icon: Heart },
  { id: "queue", view: "queue", label: "Cola", icon: Menu },
] as const;

const SPOTIFY_EMBEDS: SpotifyEmbedItem[] = [
  {
    id: "spotify-calvin-mix",
    title: "Calvin Harris Mix",
    subtitle: "Electrónica y energía para modo DJ visual",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1EIZna6YqhjeY0?utm_source=generator&theme=0",
    accent: "from-cyan-400 to-cyan-400",
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
    accent: "from-lime-300 to-cyan-400",
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
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const RHYTHM_PENTAGONS = [
  { left: "-1%", top: "8%", size: 78, glow: "#25f4ff", delay: 0, travelX: 18, travelY: -8, rotate: -8 },
  { left: "8%", top: "25%", size: 54, glow: "#ff42cf", delay: -0.08, travelX: 22, travelY: 5, rotate: 11 },
  { left: "-2%", top: "49%", size: 68, glow: "#9b6cff", delay: -0.16, travelX: 19, travelY: 8, rotate: -13 },
  { left: "11%", top: "70%", size: 48, glow: "#25f4ff", delay: -0.24, travelX: 20, travelY: -5, rotate: 8 },
  { left: "3%", top: "84%", size: 62, glow: "#ff42cf", delay: -0.32, travelX: 15, travelY: -10, rotate: -6 },
  { left: "95%", top: "7%", size: 72, glow: "#ff42cf", delay: -0.04, travelX: -18, travelY: 8, rotate: 9 },
  { left: "88%", top: "24%", size: 50, glow: "#25f4ff", delay: -0.12, travelX: -22, travelY: -4, rotate: -10 },
  { left: "96%", top: "45%", size: 64, glow: "#9b6cff", delay: -0.2, travelX: -18, travelY: 7, rotate: 12 },
  { left: "87%", top: "68%", size: 54, glow: "#ff42cf", delay: -0.28, travelX: -23, travelY: 0, rotate: -8 },
  { left: "94%", top: "83%", size: 74, glow: "#25f4ff", delay: -0.36, travelX: -16, travelY: -9, rotate: 7 },
  { left: "28%", top: "-2%", size: 44, glow: "#25f4ff", delay: -0.1, travelX: 0, travelY: 17, rotate: 6 },
  { left: "70%", top: "-2%", size: 46, glow: "#ff42cf", delay: -0.22, travelX: 0, travelY: 18, rotate: -7 },
  { left: "30%", top: "93%", size: 42, glow: "#9b6cff", delay: -0.3, travelX: 0, travelY: -18, rotate: 9 },
  { left: "69%", top: "92%", size: 48, glow: "#25f4ff", delay: -0.38, travelX: 0, travelY: -17, rotate: -5 },
] as const;

function CyberStaticBackdrop() {
  return <div className="cyber-static-backdrop" aria-hidden="true" />;
}

function RhythmPentagonField({
  active,
  currentTime,
}: {
  active: boolean;
  currentTime: number;
}) {
  // 0.5 s = pulso visual de 120 BPM. Se recalibra con el reloj real de
  // reproducción para que pausa/seek no desfasen las figuras.
  const cycleSeconds = 0.5;
  const phase = -(Math.max(0, currentTime) % cycleSeconds);

  return (
    <div
      className={cn("cyber-rhythm-field", active && "is-playing")}
      aria-hidden="true"
    >
      {RHYTHM_PENTAGONS.map((pentagon, index) => (
        <span
          key={index}
          className="rhythm-pentagon"
          style={
            {
              left: pentagon.left,
              top: pentagon.top,
              width: `${pentagon.size}px`,
              "--pentagon-glow": pentagon.glow,
              "--travel-x": `${pentagon.travelX}px`,
              "--travel-y": `${pentagon.travelY}px`,
              "--pentagon-rotate": `${pentagon.rotate}deg`,
              animationDelay: `${phase + pentagon.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function CyberHeroIllustration() {
  return (
    <svg viewBox="0 0 520 250" className="absolute inset-y-0 right-0 h-full w-[54%] min-w-[420px]" aria-hidden="true">
      <defs>
        <linearGradient id="hero-neon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#25f4ff" />
          <stop offset="46%" stopColor="#5d7cff" />
          <stop offset="100%" stopColor="#ff42cf" />
        </linearGradient>
        <radialGradient id="hero-aura" cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor="#25f4ff" stopOpacity=".3" />
          <stop offset="45%" stopColor="#9b6cff" stopOpacity=".16" />
          <stop offset="100%" stopColor="#ff42cf" stopOpacity="0" />
        </radialGradient>
        <filter id="hero-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="heroBlur" />
          <feMerge><feMergeNode in="heroBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="345" cy="120" r="118" fill="url(#hero-aura)" />
      <g opacity=".28" stroke="#25f4ff" fill="none">
        <path d="M35 28H115L145 72 115 116H35L5 72Z" />
        <path d="M136 76H216L246 120 216 164H136L106 120Z" />
        <path d="M38 126H118L148 170 118 214H38L8 170Z" />
      </g>
      <g className="cyber-hero-rings" fill="none" stroke="url(#hero-neon)" filter="url(#hero-glow)">
        <circle cx="350" cy="112" r="62" strokeWidth="3" strokeDasharray="12 10" />
        <circle cx="350" cy="112" r="82" strokeWidth="1.5" strokeDasharray="4 14" opacity=".65" />
      </g>
      <g transform="translate(285 48)">
        <path
          d="M64 22c34 0 62 28 62 63v32c0 19-8 35-22 47l-4 3v23H35v-24l-3-2C18 152 10 136 10 117V84C10 49 31 22 64 22Z"
          fill="#030814"
          stroke="#25f4ff"
          strokeOpacity=".6"
          strokeWidth="2"
        />
        <path d="M18 91c-16 4-22 17-19 34s14 26 31 24M110 91c16 4 22 17 19 34s-14 26-31 24" fill="none" stroke="url(#hero-neon)" strokeWidth="8" strokeLinecap="round" filter="url(#hero-glow)" />
        <path d="M17 90c0-40 19-72 48-72s49 31 49 72" fill="none" stroke="#9b6cff" strokeWidth="4" strokeLinecap="round" />
        <path d="M38 58c14-18 43-25 68-9M35 78c21-18 50-18 73-3" fill="none" stroke="#ff42cf" strokeOpacity=".65" strokeWidth="2" />
        <path d="M26 167c-33 15-55 39-66 72h211c-10-35-34-59-67-72-19 15-57 16-78 0Z" fill="#020611" stroke="url(#hero-neon)" strokeOpacity=".55" strokeWidth="2" />
      </g>
      <path className="cyber-hero-streak" d="M180 206C270 156 330 188 418 140S508 92 560 78" fill="none" stroke="url(#hero-neon)" strokeWidth="3" strokeLinecap="round" filter="url(#hero-glow)" />
    </svg>
  );
}

function CyberEqualizer({ active }: { active: boolean }) {
  return (
    <div className={cn("cyber-equalizer", active && "is-playing")} aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <span key={index} style={{ "--bar-delay": `${-(index % 7) * 0.11}s` } as CSSProperties} />
      ))}
    </div>
  );
}

function LoadingBar({ active, label = "Cargando" }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 overflow-hidden bg-cyan-400/10" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <span className="block h-full w-2/5 animate-[eduai-loading_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-cyan-300" />
    </div>
  );
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
  if (asExtendedTrack(track)?.previewSeconds) return "DJ mix · audio YouTube · 0:50–1:20";
  if (track?.source === "itunes") return "Preview 30 segundos · modo DJ";
  if (track?.source === "youtube") return "YouTube · fuente oficial";
  if (track?.source === "radio") return "Radio online en vivo";
  if (track?.source === "jamendo" || track?.source === "audius")
    return "Canción completa reproducible";
  if (track?.id === "eduai-music-empty") return "Elige una fuente para comenzar";
  return "Audio personal / fuente externa";
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
          ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/25"
          : "bg-white/8 text-slate-300 hover:bg-cyan-400/15 hover:text-cyan-200",
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
        `${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 transition`,
        embedTrack ? "cursor-default opacity-75" : "hover:scale-105 hover:bg-cyan-300",
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
          ? "bg-cyan-400/14 text-white ring-1 ring-cyan-400/35"
          : "text-slate-300 hover:bg-white/7 hover:text-white",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
          active ? "bg-cyan-400 text-slate-950" : "bg-white/8 text-slate-400",
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
            active ? "text-cyan-300" : "text-current",
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
          ? "bg-cyan-400/12 text-white ring-1 ring-cyan-400/25"
          : "text-slate-300 hover:bg-white/7 hover:text-white",
      )}
    >
      <button
        type="button"
        onClick={() => music.playTrack(track, tracks)}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition",
          active
            ? "bg-cyan-400 text-slate-950"
            : "bg-white/8 text-slate-400 group-hover:bg-cyan-400 group-hover:text-slate-950",
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
            active ? "text-cyan-300" : "text-current",
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
            "text-slate-500 hover:text-cyan-300",
            music.liked.has(track.id) && "text-cyan-300",
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
          onClick={() => music.addToQueue(track.id)}
          className="text-slate-500 hover:text-fuchsia-300"
          aria-label="Agregar a cola"
          title="Agregar a cola"
        >
          <ListMusic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => music.requestAddToPlaylist(track.id)}
          className="text-slate-500 hover:text-cyan-300"
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
    <header className="cyber-topbar relative flex h-[64px] shrink-0 items-center gap-4 border-b border-white/10 bg-[#07090d] px-5 text-white">
      <div className="flex w-[236px] shrink-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20">
          <Music2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="cyber-brand truncate text-lg font-black tracking-tight">
            EDUAI <span>Music</span>
          </h1>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
            Neon audio // live
          </p>
        </div>
      </div>

      <div className="flex h-10 min-w-0 max-w-2xl flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 shadow-inner shadow-black/30 max-md:hidden focus-within:border-cyan-400/50">
        <Search className="h-4 w-4 text-cyan-300" />
        <input
          value={music.query}
          onChange={(e) => music.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && music.query.trim())
              void music.searchOnline(music.query);
          }}
          placeholder="Buscar canciones, artistas, álbumes, playlists..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
      </div>

      <Link
        href="/agentes"
        className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/12 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <LoadingBar active={music.onlineLoading || music.radioLoading} label="Buscando música" />
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
    <section className="shrink-0 rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,.16),rgba(20,23,31,.96))] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-black text-white">
            <Radio className="h-4 w-4 text-cyan-300" /> Radio online
          </p>
          <p className="text-[10px] text-slate-400">Sintoniza emisoras en vivo.</p>
        </div>
        <button
          type="button"
          onClick={() => void music.searchRadio("", "CL")}
          disabled={music.radioLoading}
          className="rounded-full bg-cyan-400 px-3 py-1.5 text-[10px] font-black text-slate-950 disabled:opacity-50"
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
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((item) => (
          <button
            key={`${item.label}-${item.countryCode}`}
            type="button"
            onClick={() => void music.searchRadio(item.term, item.countryCode)}
            className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-black text-slate-300 transition hover:bg-cyan-400/15 hover:text-cyan-200"
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
                  active ? "bg-cyan-400/15 text-white ring-1 ring-cyan-400/30" : "hover:bg-white/7",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-black text-cyan-300">
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

function Sidebar({
  tracks,
  onOpenSpotify,
  onNavigate,
  spotifyActive,
}: {
  tracks: EduMusicTrack[];
  onOpenSpotify: () => void;
  onNavigate: () => void;
  spotifyActive: boolean;
}) {
  const music = useEduAIMusic();
  const [playlistFilter, setPlaylistFilter] = useState("");
  const filteredPlaylists = music.playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(playlistFilter.toLowerCase()),
  );

  return (
    <aside className="cyber-sidebar flex min-h-0 min-w-0 flex-col border-r border-white/10 bg-[#030a13]/84 p-2.5 text-white">
      <div className="shrink-0 rounded-2xl border border-white/10 bg-[#07111d]/78 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-white">Tu biblioteca</p>
            <p className="text-[11px] text-slate-400">Canciones y grupos</p>
          </div>
          <button
            type="button"
            onClick={() => music.setCreateOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-cyan-300"
          >
            <Plus className="h-3.5 w-3.5" /> Crear
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs font-bold text-slate-300">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.id === "spotify" ? spotifyActive : music.view === item.view;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "spotify") {
                    onOpenSpotify();
                    return;
                  }
                  onNavigate();
                  music.setView(item.view);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 transition",
                  active
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-white/7 hover:bg-cyan-400/10 hover:text-cyan-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </div>

        {music.view === "library" && (
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/8 px-3 py-2 text-xs font-black text-cyan-100 transition hover:border-fuchsia-300/35 hover:bg-fuchsia-400/8">
            <Upload className="h-4 w-4" />
            {music.audioUploadLoading ? "Subiendo audio…" : "Subir mis audios"}
            <input
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              className="hidden"
              disabled={music.audioUploadLoading}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                if (files.length) void music.uploadAudios(files);
              }}
            />
          </label>
        )}
        {music.view === "library" && music.audioUploadError && (
          <p className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/8 px-2 py-1.5 text-[10px] font-bold text-rose-200">
            {music.audioUploadError}
          </p>
        )}

        {music.createOpen && (
          <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/8 p-2">
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
              className="mt-2 h-9 w-full rounded-lg bg-cyan-400 text-xs font-black text-slate-950 hover:bg-cyan-300"
            >
              Crear playlist
            </button>
          </div>
        )}
      </div>

      <details className="group mt-3 shrink-0 rounded-2xl border border-white/10 bg-[#07111d]/78">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-black text-slate-300 marker:hidden">
          <span className="inline-flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-cyan-300" /> Radio en vivo</span>
          <span className="text-slate-500 transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-white/10 p-2"><RadioPanel /></div>
      </details>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
        <section className="flex min-h-0 flex-[0.8] flex-col rounded-2xl border border-white/10 bg-[#07111d]/78 p-3">
          <div className="mb-2 flex h-9 items-center gap-2 rounded-xl bg-black/25 px-3">
            <Search className="h-3.5 w-3.5 text-cyan-300" />
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
                      ? "bg-white/12 ring-1 ring-cyan-400/25"
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

        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#07111d]/78 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300">
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
    <section className="shrink-0 rounded-2xl border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,.22),rgba(17,24,39,.98)_50%,rgba(34,197,94,.12))] p-3 text-white shadow-md shadow-black/25">
      <div className="flex min-w-0 items-center gap-3">
        <Cover label={playlist.name} cover={playlist.cover} size="hero" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
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
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-cyan-400 px-4 text-xs font-black text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-300"
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
        <div className="ml-1 flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
            Fuentes reales
          </span>
          <button
            type="button"
            onClick={() => {
              music.setOnlineProviderMode("youtube");
              music.setView("search");
            }}
            className="rounded-full border border-white/10 bg-white/7 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
          >
            YouTube
          </button>
          <button
            type="button"
            onClick={() => music.setView("radio")}
            className="rounded-full border border-white/10 bg-white/7 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-fuchsia-300/30 hover:bg-fuchsia-400/10 hover:text-fuchsia-100"
          >
            Radio
          </button>
          <button
            type="button"
            onClick={() => music.setView("library")}
            className="rounded-full border border-white/10 bg-white/7 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:border-violet-300/30 hover:bg-violet-400/10 hover:text-violet-100"
          >
            Mis audios
          </button>
        </div>
      </div>
    </section>
  );
}

function CurrentTrackArtwork({ track }: { track: EduMusicTrack }) {
  const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);
  const isDjMix = track.source === "youtube" && Boolean(asExtendedTrack(track)?.previewSeconds);
  if (isDjMix) {
    return (
      <div className="relative flex h-56 w-56 overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#080d12] shadow-2xl shadow-cyan-950/30 ring-1 ring-white/10">
        {/* El iframe sigue montado para el audio oficial de YouTube, pero DJ no muestra video. */}
        <div id={YOUTUBE_PLAYER_ID} className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" />
        {artwork ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : null}
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-cyan-400/20 via-slate-950/30 to-violet-500/20 p-5 text-center">
          <span className="rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950">DJ mix</span>
          <span className="mt-4 text-4xl font-black text-white">0:50</span>
          <span className="mt-1 text-xs font-bold text-cyan-100">30 segundos · siguiente instantáneo</span>
        </div>
      </div>
    );
  }
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
          YouTube · fuente oficial
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


function dedupeTracks(tracks: EduMusicTrack[]) {
  const map = new Map<string, EduMusicTrack>();
  tracks.forEach((track) => {
    if (track?.id && track.id !== "eduai-music-empty") map.set(track.id, track);
  });
  return Array.from(map.values());
}

function CyberHomeDashboard({ onOpenSpotify }: { onOpenSpotify: () => void }) {
  const music = useEduAIMusic();
  const likedTracks = music.allTracks.filter((track) => music.liked.has(track.id));
  const discovery = dedupeTracks([
    ...music.recentTracks,
    ...likedTracks,
    ...music.uploadedTracks,
    ...music.onlineTracks,
    ...music.radioTracks,
  ]).slice(0, 10);
  const recent = discovery.slice(0, 6);
  const table = discovery.slice(0, 7);

  const sourceButton = (label: string, action: () => void, accent: string) => (
    <button
      type="button"
      onClick={action}
      className="cyber-source-chip"
      style={{ "--source-accent": accent } as CSSProperties}
    >
      {label}
    </button>
  );

  return (
    <main className="cyber-main min-h-0 min-w-0 overflow-y-auto p-3 text-white">
      <section className="cyber-dashboard-panel relative overflow-hidden rounded-[1.35rem] border border-cyan-300/25">
        <div className="cyber-hero-grid absolute inset-0" aria-hidden="true" />
        <CyberHeroIllustration />
        <div className="relative z-10 max-w-[68%] px-6 py-5 max-xl:max-w-[74%]">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">Más que música</p>
          <h2 className="mt-1 text-[clamp(2.1rem,3.4vw,4.2rem)] font-black leading-none tracking-[-0.06em] text-white">
            EDUAI <span className="cyber-hero-title">Music</span>
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.28em] text-slate-300">
            Sonidos que impulsan tu mundo
          </p>

          <div className="mt-5 flex max-w-3xl items-center gap-2">
            <div className="cyber-search-shell flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-4">
              <Search className="h-4 w-4 text-cyan-300" />
              <input
                value={music.onlineQuery}
                onChange={(event) => music.setOnlineQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && music.onlineQuery.trim()) {
                    music.setOnlineProviderMode("youtube");
                    void music.searchOnline(music.onlineQuery, "youtube");
                  }
                }}
                placeholder="Buscar canciones, artistas, álbumes, playlists..."
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!music.onlineQuery.trim()) return;
                music.setOnlineProviderMode("youtube");
                void music.searchOnline(music.onlineQuery, "youtube");
              }}
              className="cyber-search-button h-11 rounded-xl px-5 text-xs font-black uppercase tracking-wide text-slate-950"
            >
              Buscar
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sourceButton("Todo", () => music.setView("home"), "#25f4ff")}
            {sourceButton("YouTube", () => { music.setOnlineProviderMode("youtube"); music.setView("search"); }, "#ff4b6e")}
            {sourceButton("Spotify", onOpenSpotify, "#44ffd2")}
            {sourceButton("Radio", () => music.setView("radio"), "#9b6cff")}
            {sourceButton("Mis audios", () => music.setView("library"), "#ff42cf")}
          </div>
        </div>
      </section>

      <section className="cyber-dashboard-panel mt-3 rounded-[1.2rem] border border-cyan-300/20 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white">Escuchado recientemente</h3>
            <p className="text-[10px] text-slate-500">Solo canciones y fuentes reales que has usado.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">{recent.length} recientes</span>
        </div>

        {recent.length ? (
          <div className="grid grid-cols-3 gap-3 2xl:grid-cols-6 xl:grid-cols-4">
            {recent.map((track) => {
              const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);
              const active = music.currentTrack.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => music.playTrack(track)}
                  className={cn("cyber-track-card group text-left", active && "is-active")}
                >
                  <div className="relative aspect-[1.16] overflow-hidden rounded-xl bg-[#06101b]">
                    {artwork ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artwork} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full" style={{ background: track.cover || "linear-gradient(135deg,#25f4ff,#9b6cff,#ff42cf)" }} />
                    )}
                    <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/60 bg-[#02131d]/90 text-cyan-200 shadow-[0_0_18px_rgba(37,244,255,.35)]">
                      {active && music.playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs font-black text-white">{track.title}</p>
                  <p className="truncate text-[10px] text-slate-500">{track.artist} · {sourceLabel(track.source)}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ["YouTube", "Busca canciones y videos oficiales", "#ff4568", () => { music.setOnlineProviderMode("youtube"); music.setView("search"); }],
              ["Spotify", "Abre el reproductor oficial", "#44ffd2", onOpenSpotify],
              ["Radio", "Sintoniza emisoras en vivo", "#9b6cff", () => music.setView("radio")],
              ["Mis audios", "Sube tu propia música", "#25f4ff", () => music.setView("library")],
            ].map(([label, text, accent, action]) => (
              <button
                key={String(label)}
                type="button"
                onClick={action as () => void}
                className="cyber-empty-source text-left"
                style={{ "--empty-accent": accent } as CSSProperties}
              >
                <span className="text-sm font-black text-white">{String(label)}</span>
                <span className="mt-1 block text-[10px] text-slate-500">{String(text)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="cyber-dashboard-panel mt-3 rounded-[1.2rem] border border-cyan-300/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white">Canciones para ti</h3>
            <p className="text-[10px] text-slate-500">Favoritos, recientes, radio y tu biblioteca personal.</p>
          </div>
          <button type="button" onClick={() => music.setView("liked")} className="text-[10px] font-black text-cyan-300 hover:text-fuchsia-200">
            Ver favoritos →
          </button>
        </div>
        {table.length ? (
          <TableTrackList tracks={table} />
        ) : (
          <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-cyan-300/15 bg-black/15 px-4 text-center text-xs text-slate-500">
            Cuando reproduzcas música real, aquí aparecerán tus canciones recientes y favoritas.
          </div>
        )}
      </section>
    </main>
  );
}

function MainPanel({
  tracks,
  spotifyEmbed,
  onClearSpotify,
  onOpenSpotify,
}: {
  tracks: EduMusicTrack[];
  spotifyEmbed: SpotifyEmbedItem | null;
  onClearSpotify: () => void;
  onOpenSpotify: () => void;
}) {
  const music = useEduAIMusic();
  const track = music.currentTrack;
  const playlist = music.selectedPlaylist;
  const embedTrack = isEmbedTrack(track);
  const embedUrl = getEmbedUrl(track);

  if (music.view === "home" && !spotifyEmbed) {
    return <CyberHomeDashboard onOpenSpotify={onOpenSpotify} />;
  }

  return (
    <main className="cyber-main flex min-h-0 min-w-0 flex-col bg-[#0d1016] p-3 text-white">
      <section className="flex min-h-0 flex-1 flex-col rounded-[1.4rem] border border-white/10 bg-[#131720] p-5 shadow-lg shadow-black/20">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              Reproduciendo ahora
            </p>
            <h2 className="truncate text-xl font-black text-white">
              {track.source === "youtube" ? (asExtendedTrack(track)?.previewSeconds ? "DJ mix" : "Video musical") : playlist.name}
            </h2>
            <p className="truncate text-xs text-slate-500">{playlist.name} · {tracks.length} pistas</p>
          </div>
          {track.source !== "youtube" && (
            <button
              type="button"
              onClick={() => music.playPlaylist(playlist.id)}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-cyan-400 px-4 text-xs font-black text-slate-950 shadow-md shadow-cyan-500/20 hover:bg-cyan-300"
            >
              <Play className="h-4 w-4" fill="currentColor" /> Reproducir lista
            </button>
          )}
        </div>

        <div className="cyber-player-stage flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-cyan-400/15 p-5">
          {spotifyEmbed ? (
            <div className="w-full max-w-3xl rounded-[1.75rem] border border-cyan-300/20 bg-black/25 p-4 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-4">
              <div className="mx-auto max-w-xl">
                <p className="mx-auto mb-2 w-fit rounded-full bg-cyan-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
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

              <div className="mt-4 overflow-hidden rounded-3xl border border-cyan-400/20 bg-black/50 shadow-2xl shadow-black/40">
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
                  className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  Volver a EduAI Player
                </button>
                <a
                  href={spotifyOpenUrl(spotifyEmbed.src)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-cyan-400/25 bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Abrir en Spotify
                </a>
              </div>
            </div>
          ) : embedTrack ? (
            <div className="w-full max-w-4xl rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-4">
              <div className="mx-auto max-w-xl">
                <p className="mx-auto mb-2 w-fit rounded-full bg-cyan-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
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

              <div className="mt-4 overflow-hidden rounded-3xl border border-cyan-400/20 bg-black/40 shadow-2xl shadow-black/40">
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
                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                      : "border-white/10 bg-white/7 text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-200",
                  )}
                >
                  ♥ Me gusta
                </button>
                <a
                  href={track.externalUrl || embedUrl || "https://www.canal95.cl/"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  Abrir fuente oficial
                </a>
              </div>
            </div>
          ) : (
            <div className={cn("cyber-player-core w-full rounded-[1.5rem] border border-white/10 p-4 text-center shadow-xl shadow-black/25 max-xl:p-4", track.source === "youtube" ? "max-w-4xl" : "max-w-xl")}>
              <div className="flex justify-center">
                <CurrentTrackArtwork track={track} />
              </div>

              <div className="mx-auto mt-4 max-w-lg">
                <p className="mx-auto mb-2 w-fit rounded-full bg-cyan-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
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

              <div className="mx-auto mt-4 flex max-w-xl items-center gap-2 text-[10px] font-bold tabular-nums text-slate-500">
                <span className="w-9 text-right">{formatSeconds(music.currentTime)}</span>
                <ProgressRange
                  currentTime={music.currentTime}
                  duration={durationForPlayer(track, music.durationSeconds)}
                  onSeek={music.seekTo}
                />
                <span className="w-9 text-left">{formatSeconds(durationForPlayer(track, music.durationSeconds))}</span>
              </div>

              {track.source === "youtube" && (
                <p className="mt-3 text-xs font-semibold text-cyan-200/90">
                  {asExtendedTrack(track)?.previewSeconds
                    ? "Modo DJ mix: reproduce solo el audio de YouTube entre 0:50 y 1:20; al terminar avanza únicamente si agregaste otra pista a la cola."
                    : "YouTube usa el reproductor real al centro: el video y el audio provienen de la misma fuente y avanzan juntos."}
                </p>
              )}
              {track.source === "itunes" && (
                <p className="mt-3 text-xs font-semibold text-cyan-200/90">
                  Modo DJ 30s: al terminar el preview avanza solo si existe otra pista en la cola. Si hay YouTube API Key, se muestra un video visual tipo reel silenciado.
                </p>
              )}
              {track.source === "radio" && (
                <p className="mt-3 text-xs font-semibold text-cyan-200/90">
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
                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                      : "border-white/10 bg-white/7 text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-200",
                  )}
                >
                  ♥ Me gusta
                </button>
                <button
                  type="button"
                  onClick={() => music.requestAddToPlaylist(track.id)}
                  className="rounded-full border border-white/10 bg-white/7 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  + Agregar a playlist
                </button>
              </div>

              <p className="mt-3 text-[11px] text-slate-500">La cola avanza solo con pistas agregadas por ti o al reproducir una playlist completa.</p>
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
    <section className="shrink-0 rounded-2xl border border-white/10 bg-[#07111d]/78 p-3">
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
                  ? "border-cyan-300/45 bg-cyan-400/14 shadow-lg shadow-cyan-950/20"
                  : "border-white/10 bg-white/6 hover:border-cyan-300/25 hover:bg-cyan-400/10",
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
  const track = music.currentTrack;
  const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);
  const duration = durationForPlayer(track, music.durationSeconds);
  const idle = track.id === "eduai-music-empty";

  return (
    <aside className="cyber-rightbar flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-[#030a13]/84 p-3 text-white">
      <section className="cyber-now-card shrink-0 rounded-2xl border border-cyan-300/25 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black text-white">Reproduciendo</p>
          <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-200">
            {idle ? "Listo" : sourceLabel(track.source)}
          </span>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[232px] overflow-hidden rounded-2xl border border-cyan-200/25 bg-[#040914] shadow-[0_0_36px_rgba(37,244,255,.12)]">
          {artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork} alt={track.title} className="h-full w-full object-cover" />
          ) : (
            <div className="relative h-full w-full overflow-hidden" style={{ background: track.cover || "linear-gradient(135deg,#03101b,#251052,#6a0f67)" }}>
              <div className="absolute inset-[18%] rounded-full border-2 border-cyan-300/70 shadow-[0_0_28px_rgba(37,244,255,.4)]" />
              <div className="absolute inset-[31%] rounded-full border border-fuchsia-300/70 shadow-[0_0_22px_rgba(255,66,207,.35)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Music2 className="h-10 w-10 text-white/80" />
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-cyan-300/5" />
        </div>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-white">{track.title}</h3>
            <p className="truncate text-xs font-bold text-cyan-300">{track.artist}</p>
          </div>
          {!idle && (
            <button type="button" onClick={() => music.toggleLike(track.id)} className={cn("mt-1 text-slate-500", music.liked.has(track.id) && "text-fuchsia-400")}>
              <Heart className="h-5 w-5" fill={music.liked.has(track.id) ? "currentColor" : "none"} />
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <CyberEqualizer active={music.playing} />
          {!idle && <PlayButton size="sm" />}
        </div>

        {!idle && (
          <div className="mt-3 flex items-center gap-2 text-[9px] font-bold tabular-nums text-slate-500">
            <span className="w-8 text-right">{formatSeconds(music.currentTime)}</span>
            <ProgressRange currentTime={music.currentTime} duration={duration} onSeek={music.seekTo} compact />
            <span className="w-8">{formatSeconds(duration)}</span>
          </div>
        )}
      </section>

      <section className="cyber-dashboard-panel flex min-h-[230px] flex-1 flex-col rounded-2xl border border-white/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-white">Cola de reproducción</p>
            <p className="text-[10px] text-slate-500">{music.queue.length ? `${music.queue.length} pistas` : "Agrega canciones para continuar."}</p>
          </div>
          {music.queue.length > 0 && (
            <button type="button" onClick={music.clearQueue} className="text-[10px] font-black text-cyan-300 hover:text-rose-200">
              Limpiar
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SidebarTrackList tracks={music.queue} limit={20} />
        </div>
      </section>

      <details className="group shrink-0 rounded-2xl border border-white/10 bg-[#07111d]/78/70">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-xs font-black text-slate-300 marker:hidden">
          <span>Buscar música</span><span className="text-cyan-300 transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <input
              value={music.onlineQuery}
              onChange={(e) => music.setOnlineQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void music.searchOnline()}
              placeholder="Artista o canción"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
            />
            <button type="button" onClick={() => void music.searchOnline()} disabled={music.onlineLoading} className="rounded-xl bg-cyan-400 px-3 text-xs font-black text-slate-950 disabled:opacity-50">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
      </details>

      <details className="group shrink-0 rounded-2xl border border-white/10 bg-[#07111d]/78/70">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-3 text-xs font-black text-slate-300 marker:hidden">
          <span>Spotify y fuentes</span><span className="text-fuchsia-300 transition group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-white/10 p-2.5">
          <SpotifyEmbeds selectedId={selectedSpotifyId} onSelect={onSelectSpotify} onClear={onClearSpotify} />
        </div>
      </details>
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
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 shadow-[0_0_14px_rgba(52,211,153,.45)]"
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
    <footer className="cyber-playerbar relative flex h-[76px] shrink-0 items-center gap-4 overflow-hidden border-t border-white/10 bg-[#05070a] px-4 text-white">
      <div className="flex min-w-0 items-center gap-3" style={{ width: 320 }}>
        <Cover track={music.currentTrack} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{music.currentTrack.title}</p>
          <p className="truncate text-xs text-slate-400">{music.currentTrack.artist} · {sourceLabel(music.currentTrack.source)}</p>
        </div>
        <button
          type="button"
          onClick={() => music.toggleLike(music.currentTrack.id)}
          className={cn("text-slate-500 hover:text-cyan-300", music.liked.has(music.currentTrack.id) && "text-cyan-300")}
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

      <div className="hidden items-center justify-end gap-3 pr-6 xl:flex" style={{ width: 320 }}>
        <CyberEqualizer active={music.playing} />
        <ListMusic className="h-4 w-4 text-slate-500" />
        <Volume2 className="h-4 w-4 text-slate-500" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={music.volume}
          onChange={(e) => music.setVolume(Number(e.target.value))}
          className="w-24 accent-cyan-400"
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
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-cyan-400/20 bg-[#11131a] p-3 text-white shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">Agregar {track?.title ?? "canción"} a playlist:</p>
        <button type="button" onClick={() => music.setPendingTrackId(null)} className="rounded-full px-2 text-slate-400 hover:bg-white/10">
          ×
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => music.addToPlaylist("pl-liked", music.pendingTrackId!)} className="rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-black text-slate-950">
          ♥ Me gusta
        </button>
        {music.userPlaylists.map((playlist) => (
          <button key={playlist.id} type="button" onClick={() => music.addToPlaylist(playlist.id, music.pendingTrackId!)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15">
            {playlist.name}
          </button>
        ))}
        <button type="button" onClick={() => music.setCreateOpen(true)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-cyan-400/15 hover:text-cyan-200">
          + Nueva
        </button>
      </div>
    </div>
  );
}

function MiniBar({ onOpenPanel }: { onOpenPanel?: () => void }) {
  const music = useEduAIMusic();
  const [collapsed, setCollapsed] = useState(true);
  const duration = durationForPlayer(music.currentTrack, music.durationSeconds);

  if (collapsed) {
    return (
      <div className="fixed bottom-20 right-5 z-50 flex items-center gap-1 rounded-full border border-cyan-300/25 bg-[#06080d]/95 p-1.5 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
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
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(94vw,620px)] -translate-x-1/2 rounded-2xl border border-cyan-300/25 bg-[#06080d]/95 p-2.5 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
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
            className="w-20 accent-cyan-400"
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
      <div className="relative z-10 flex h-full flex-col">
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onOpenPanel} className="min-w-0 text-left">
              <p className="text-sm font-black text-white">EduAI Music</p>
              <p className="truncate text-[10px] text-slate-400">{music.currentTrack.title}</p>
            </button>
            <Link href="/music" className="rounded-full bg-cyan-400 px-3 py-1.5 text-[10px] font-black text-slate-950 hover:bg-cyan-300">
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


function NeonSpectrum({
  active,
  bars = 30,
  className,
}: {
  active: boolean;
  bars?: number;
  className?: string;
}) {
  return (
    <div className={cn("neon-spectrum flex items-end gap-[2px]", className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={cn("neon-spectrum-bar", active && "is-playing")}
          style={
            {
              "--eq-delay": `${-(index % 11) * 0.055}s`,
              "--eq-height": `${30 + ((index * 17) % 66)}%`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function NeonSidebar({
  onOpenSpotify,
  spotifyActive,
  onNavigate,
}: {
  onOpenSpotify: () => void;
  spotifyActive: boolean;
  onNavigate: () => void;
}) {
  const music = useEduAIMusic();

  return (
    <aside className="neon-sidebar flex min-h-0 flex-col px-[clamp(12px,1.25vw,22px)] pb-4 pt-5">
      <div className="flex items-center gap-3 pl-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_24px_rgba(37,244,255,.18)]">
          <Music2 className="h-5 w-5 text-cyan-200" />
        </div>
        <div className="min-w-0">
          <p className="neon-title-gradient text-[clamp(15px,1.25vw,22px)] font-black leading-none tracking-tight">
            EDUAI <span className="italic">Music</span>
          </p>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.23em] text-cyan-300/85">
            Neon audio // live
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === "spotify" ? spotifyActive : music.view === item.view;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "spotify") {
                  onOpenSpotify();
                  return;
                }
                onNavigate();
                if (item.view) music.setView(item.view);
              }}
              className={cn(
                "neon-nav-button group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[12px] font-bold transition",
                active
                  ? "is-active text-cyan-100"
                  : "text-slate-300 hover:text-white",
              )}
            >
              <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-cyan-200" : "text-slate-400 group-hover:text-cyan-200")} />
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(37,244,255,.95)]" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-cyan-300/15 pt-3">
        <div className="flex items-center justify-between px-2">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Biblioteca</p>
            <p className="mt-0.5 text-[9px] text-slate-500">Tus playlists</p>
          </div>
          <button
            type="button"
            onClick={() => music.setCreateOpen((value) => !value)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-cyan-400/12 hover:text-cyan-200"
            title="Crear playlist"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {music.createOpen && (
          <div className="mt-2 flex gap-1 px-1">
            <input
              value={music.newPlaylistName}
              onChange={(event) => music.setNewPlaylistName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && music.createPlaylist()}
              placeholder="Nueva playlist"
              className="min-w-0 flex-1 rounded-lg border border-cyan-300/20 bg-black/20 px-2 py-1.5 text-[10px] text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
            />
            <button
              type="button"
              onClick={music.createPlaylist}
              className="rounded-lg bg-cyan-400 px-2 text-[10px] font-black text-slate-950"
            >
              Crear
            </button>
          </div>
        )}

        <div className="mt-2 space-y-0.5">
          {music.userPlaylists.slice(0, 6).map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              onClick={() => {
                onNavigate();
                music.setSelectedPlaylistId(playlist.id);
                music.setView("playlists");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <span
                className="h-6 w-6 shrink-0 rounded-md border border-white/10"
                style={{ background: playlist.cover || "linear-gradient(135deg,#25f4ff,#9b6cff,#ff42cf)" }}
              />
              <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
              <span className="text-[9px] text-slate-600">{playlist.trackIds.length}</span>
            </button>
          ))}
          {!music.userPlaylists.length && (
            <button
              type="button"
              onClick={() => music.setCreateOpen(true)}
              className="w-full rounded-lg px-2 py-2 text-left text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-cyan-200"
            >
              + Crear tu primera playlist
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-cyan-300/15 pt-3">
        <button
          type="button"
          onClick={() => music.setView("library")}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
        >
          <span className="h-8 w-8 rounded-full border border-fuchsia-300/30 bg-[radial-gradient(circle_at_35%_30%,#25f4ff,#6d4cff_48%,#ff42cf_82%,#030713)] shadow-[0_0_16px_rgba(155,108,255,.28)]" />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-black text-white">Mi biblioteca</span>
            <span className="block truncate text-[9px] text-cyan-300/80">{music.uploadedTracks.length} audios propios</span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function NeonRecentCard({
  track,
  tracks,
}: {
  track: EduMusicTrack;
  tracks: EduMusicTrack[];
}) {
  const music = useEduAIMusic();
  const active = music.currentTrack.id === track.id;
  const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);

  return (
    <button
      type="button"
      onClick={() => music.playTrack(track, tracks)}
      className={cn("neon-recent-card group min-w-0 text-left", active && "is-active")}
    >
      <div className="relative aspect-[1.18] overflow-hidden rounded-xl border border-cyan-300/15 bg-black/18">
        {artwork ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full" style={{ background: track.cover || "linear-gradient(135deg,#03111e,#231249,#570b59)" }} />
        )}
        <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/65 bg-[#02131d]/85 text-cyan-100 shadow-[0_0_18px_rgba(37,244,255,.38)]">
          {active && music.playing ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
          )}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[11px] font-black text-white">{track.title}</p>
      <p className="truncate text-[9px] text-slate-400">{track.artist}</p>
    </button>
  );
}

function NeonTrackTable({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();

  return (
    <div className="min-h-0 overflow-y-auto pr-1">
      <div className="neon-track-header grid grid-cols-[34px_minmax(0,1.4fr)_minmax(90px,.8fr)_minmax(90px,.8fr)_58px_38px] items-center gap-2 px-2 pb-1 text-[8px] font-black uppercase tracking-[.16em] text-slate-500">
        <span>#</span>
        <span>Título</span>
        <span>Artista</span>
        <span>Álbum</span>
        <span>Tiempo</span>
        <span />
      </div>
      <div className="space-y-0.5">
        {tracks.slice(0, 8).map((track, index) => {
          const active = music.currentTrack.id === track.id;
          return (
            <div
              key={track.id}
              className={cn(
                "neon-track-row neon-track-grid grid grid-cols-[34px_minmax(0,1.4fr)_minmax(90px,.8fr)_minmax(90px,.8fr)_58px_38px] items-center gap-2 rounded-lg px-2 py-1.5",
                active && "is-active",
              )}
            >
              <button
                type="button"
                onClick={() => music.playTrack(track, tracks)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black",
                  active ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-cyan-400/20 hover:text-cyan-100",
                )}
              >
                {active && music.playing ? <Pause className="h-3 w-3" fill="currentColor" /> : active ? <Play className="h-3 w-3" fill="currentColor" /> : index + 1}
              </button>

              <button type="button" onClick={() => music.playTrack(track, tracks)} className="flex min-w-0 items-center gap-2 text-left">
                <Cover track={track} size="xs" />
                <span className="min-w-0">
                  <span className={cn("block truncate text-[10px] font-black", active ? "text-cyan-200" : "text-white")}>{track.title}</span>
                  <span className="block truncate text-[8px] text-slate-500 sm:hidden">{track.artist}</span>
                </span>
              </button>

              <span className="truncate text-[9px] text-slate-300">{track.artist}</span>
              <span className="truncate text-[9px] text-slate-400">{track.album}</span>
              <span className="text-[9px] tabular-nums text-slate-400">{track.duration}</span>
              <button
                type="button"
                onClick={() => music.toggleLike(track.id)}
                className={cn("mx-auto text-slate-500 hover:text-fuchsia-300", music.liked.has(track.id) && "text-fuchsia-400")}
                aria-label="Favorito"
              >
                <Heart className="h-3.5 w-3.5" fill={music.liked.has(track.id) ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NeonMain({
  spotifyEmbed,
  onOpenSpotify,
  onCloseSpotify,
}: {
  spotifyEmbed: SpotifyEmbedItem | null;
  onOpenSpotify: () => void;
  onCloseSpotify: () => void;
}) {
  const music = useEduAIMusic();
  const homeTracks = useMemo(
    () =>
      dedupeTracks([
        ...music.recentTracks,
        ...music.allTracks.filter((track) => music.liked.has(track.id)),
        ...music.uploadedTracks,
        ...music.onlineTracks,
        ...music.radioTracks,
      ]),
    [music.allTracks, music.liked, music.onlineTracks, music.radioTracks, music.recentTracks, music.uploadedTracks],
  );

  const tracks = useMemo(() => {
    if (music.view === "liked") return music.allTracks.filter((track) => music.liked.has(track.id));
    if (music.view === "queue") return music.queue;
    if (music.view === "library") return music.uploadedTracks;
    if (music.view === "radio") return music.radioTracks;
    if (music.view === "search") return music.onlineTracks.length ? music.onlineTracks : music.visibleTracks;
    if (music.view === "playlists") return music.baseTracks;
    return homeTracks;
  }, [homeTracks, music.allTracks, music.baseTracks, music.liked, music.onlineTracks, music.queue, music.radioTracks, music.uploadedTracks, music.view, music.visibleTracks]);

  const recentTracks = (music.recentTracks.length ? music.recentTracks : tracks).slice(0, 6);
  const catalogTracks =
    music.view === "search"
      ? tracks.slice(0, 14)
      : music.view === "home"
        ? recentTracks
        : tracks.slice(0, 10);
  const tableTracks = tracks.slice(0, 10);

  const runSearch = async () => {
    const term = music.onlineQuery.trim();
    if (!term) return;
    if (music.view === "radio") {
      await music.searchRadio(term);
      return;
    }
    music.setOnlineProviderMode("youtube");
    music.setView("search");
    await music.searchOnline(term, "youtube");
  };

  const viewTitle =
    music.view === "radio" ? "Radio en vivo" :
    music.view === "library" ? "Mis audios" :
    music.view === "liked" ? "Favoritos" :
    music.view === "queue" ? "Cola" :
    music.view === "playlists" ? music.selectedPlaylist?.name || "Playlists" :
    music.view === "search" ? "Resultados online" :
    "Inicio";

  if (spotifyEmbed) {
    return (
      <main className="neon-main min-h-0 overflow-hidden px-[clamp(12px,1.2vw,20px)] pb-3 pt-5">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-2 pb-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">Spotify</p>
              <h2 className="mt-1 text-xl font-black text-white">{spotifyEmbed.title}</h2>
            </div>
            <button type="button" onClick={onCloseSpotify} className="rounded-full border border-cyan-300/20 bg-black/20 px-3 py-1.5 text-[10px] font-black text-cyan-100 hover:bg-cyan-400/10">
              Cerrar
            </button>
          </div>
          <iframe
            src={spotifyEmbed.src}
            title={spotifyEmbed.title}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="min-h-0 flex-1 rounded-2xl border border-cyan-300/20 bg-black/10 shadow-[0_0_28px_rgba(37,244,255,.08)]"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="neon-main min-h-0 overflow-hidden px-[clamp(12px,1.2vw,20px)] pb-3 pt-5">
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative shrink-0 px-[clamp(12px,2vw,30px)] pt-[clamp(6px,1vh,14px)]">
          <p className="text-[9px] font-black uppercase tracking-[.48em] text-slate-300/90">Más que música</p>
          <h1 className="mt-0.5 text-[clamp(34px,3.8vw,64px)] font-black leading-none tracking-[-.065em] text-white">
            EDUAI <span className="neon-title-gradient italic">Music</span>
          </h1>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[.28em] text-slate-300/80">Sonidos que impulsan tu mundo</p>

          <div className="neon-search-row mt-[clamp(14px,2vh,22px)] flex max-w-[690px] items-center gap-2">
            <div className="neon-search flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-violet-400/55 bg-black/18 px-3">
              <Search className="h-4 w-4 shrink-0 text-cyan-200" />
              <input
                value={music.onlineQuery}
                onChange={(event) => music.setOnlineQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void runSearch()}
                placeholder={music.view === "radio" ? "Buscar emisora..." : "Buscar canciones, artistas, álbumes o playlists..."}
                className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={music.onlineLoading || music.radioLoading}
              className="h-10 rounded-xl bg-cyan-400 px-4 text-[10px] font-black text-slate-950 shadow-[0_0_20px_rgba(37,244,255,.25)] disabled:opacity-50"
            >
              Buscar
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["Todo", "home"],
              ["YouTube", "search"],
              ["Radio", "radio"],
              ["Mis audios", "library"],
              ["Playlists", "playlists"],
              ["Favoritos", "liked"],
              ["Cola", "queue"],
            ].map(([label, view]) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  if (view === "search") music.setOnlineProviderMode("youtube");
                  music.setView(view as typeof music.view);
                }}
                className={cn(
                  "neon-filter-chip rounded-full border px-3 py-1.5 text-[9px] font-black transition",
                  music.view === view
                    ? "is-active border-cyan-200/65 bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(37,244,255,.22)]"
                    : "border-cyan-300/20 bg-black/12 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenSpotify}
              className="neon-filter-chip rounded-full border border-fuchsia-300/25 bg-black/12 px-3 py-1.5 text-[9px] font-black text-slate-300 transition hover:border-fuchsia-300/50 hover:text-fuchsia-100"
            >
              Spotify
            </button>
            {music.view === "library" && (
              <label className="cursor-pointer rounded-full border border-dashed border-cyan-300/35 bg-cyan-400/8 px-3 py-1.5 text-[9px] font-black text-cyan-100">
                {music.audioUploadLoading ? "Subiendo..." : "+ Subir audio"}
                <input
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                  className="hidden"
                  disabled={music.audioUploadLoading}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (files.length) void music.uploadAudios(files);
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 px-2">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-black text-white">
                    {music.view === "search" ? "Catálogo de resultados" : music.view === "home" ? "Escuchado recientemente" : viewTitle}
                  </h2>
                  <p className="text-[9px] text-slate-500">
                    {catalogTracks.length
                      ? music.view === "search"
                        ? `${tracks.length} resultados · desliza para explorar`
                        : `${catalogTracks.length} pistas visibles`
                      : "Explora una fuente para comenzar."}
                  </p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-300">{sourceLabel(music.currentTrack.source)}</span>
              </div>

              {catalogTracks.length > 0 && (
                <div className="neon-catalog-surface rounded-2xl p-2">
                  <div className="neon-catalog flex gap-2 overflow-x-auto pb-1">
                    {catalogTracks.map((track) => (
                      <div key={track.id} className="w-[clamp(118px,10.5vw,162px)] shrink-0">
                        <NeonRecentCard track={track} tracks={tracks} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-[13px] font-black text-white">{music.view === "home" ? "Canciones para ti" : "Canciones"}</h2>
                <span className="text-[9px] font-bold text-cyan-300/85">{tableTracks.length} resultados</span>
              </div>
              {tableTracks.length ? (
                <NeonTrackTable tracks={tableTracks} />
              ) : (
                <div className="flex h-24 items-center justify-center text-[10px] text-slate-500">
                  No hay canciones en esta vista.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NeonRightPanel() {
  const music = useEduAIMusic();
  const track = music.currentTrack;
  const idle = track.id === "eduai-music-empty";
  const duration = durationForPlayer(track, music.durationSeconds);
  const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);

  return (
    <aside className="neon-right-panel min-h-0 overflow-hidden px-[clamp(10px,1vw,18px)] pb-3 pt-5">
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-black text-white">Reproduciendo</h2>
            <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/8 px-2 py-1 text-[8px] font-black uppercase tracking-[.16em] text-fuchsia-200">
              {idle ? "Listo" : sourceLabel(track.source)}
            </span>
          </div>

          <div className="mt-3 flex justify-center">
            {!idle && track.source === "youtube" && track.youtubeVideoId ? (
              <div className="neon-youtube-player aspect-video w-full max-w-[260px] overflow-hidden rounded-2xl border border-cyan-300/30 bg-black shadow-[0_0_34px_rgba(37,244,255,.14)]">
                <div id={YOUTUBE_PLAYER_ID} className="h-full w-full bg-black" />
              </div>
            ) : !idle && artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artwork}
                alt={track.title}
                className="aspect-square w-[min(100%,220px)] rounded-2xl border border-cyan-300/30 object-cover shadow-[0_0_34px_rgba(37,244,255,.14)]"
              />
            ) : (
              <div className="aspect-square w-[min(100%,220px)]" aria-hidden="true" />
            )}
          </div>

          <div className="mt-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black text-white">{track.title}</p>
              <p className="truncate text-[10px] font-bold text-cyan-300">{track.artist}</p>
            </div>
            {!idle && (
              <button
                type="button"
                onClick={() => music.toggleLike(track.id)}
                className={cn("mt-0.5 text-slate-500 transition hover:text-fuchsia-300", music.liked.has(track.id) && "text-fuchsia-400")}
              >
                <Heart className="h-5 w-5" fill={music.liked.has(track.id) ? "currentColor" : "none"} />
              </button>
            )}
          </div>

          <NeonSpectrum active={music.playing && !idle} bars={30} className="mt-2 h-10 w-full" />

          {!idle && (
            <div className="mt-1 flex items-center gap-2 text-[8px] font-bold tabular-nums text-slate-500">
              <span className="w-7 text-right">{formatSeconds(music.currentTime)}</span>
              <ProgressRange currentTime={music.currentTime} duration={duration} onSeek={music.seekTo} compact />
              <span className="w-7">{formatSeconds(duration)}</span>
            </div>
          )}
        </div>

        <div className="mt-4 min-h-0 flex-1 border-t border-cyan-300/15 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-black text-white">Cola de reproducción</h3>
              <p className="text-[9px] text-slate-500">{music.queue.length ? `${music.queue.length} pistas` : "Agrega canciones para continuar."}</p>
            </div>
            {music.queue.length > 0 && (
              <button type="button" onClick={music.clearQueue} className="text-[9px] font-black text-cyan-300 hover:text-fuchsia-200">Limpiar</button>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto">
            {music.queue.slice(0, 12).map((item, index) => {
              const active = item.id === track.id;
              return (
                <div key={item.id} className={cn("neon-queue-row flex items-center gap-2 rounded-lg px-1.5 py-1", active && "is-active")}>
                  <span className="w-4 text-center text-[9px] font-black text-slate-500">{index + 1}</span>
                  <Cover track={item} size="xs" />
                  <button type="button" onClick={() => music.playTrack(item, music.queue)} className="min-w-0 flex-1 text-left">
                    <span className={cn("block truncate text-[9px] font-black", active ? "text-cyan-200" : "text-white")}>{item.title}</span>
                    <span className="block truncate text-[8px] text-slate-500">{item.artist}</span>
                  </button>
                  {active && <NeonSpectrum active={music.playing} bars={4} className="h-5 w-5" />}
                  <Menu className="h-3 w-3 text-slate-600" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function NeonBottomPlayer() {
  const music = useEduAIMusic();
  const track = music.currentTrack;
  const idle = track.id === "eduai-music-empty";
  const duration = durationForPlayer(track, music.durationSeconds);

  return (
    <div className="neon-bottom-player absolute inset-x-0 bottom-0 z-20 h-[84px] px-[clamp(14px,1.5vw,24px)]">
      <div className="neon-bottom-grid grid h-full grid-cols-[minmax(190px,280px)_minmax(320px,1fr)_minmax(190px,280px)] items-center gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {!idle && <Cover track={track} size="md" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-black text-white">{track.title}</p>
            <p className="truncate text-[9px] text-slate-400">{track.artist}</p>
          </div>
          {!idle && (
            <button type="button" onClick={() => music.toggleLike(track.id)} className={cn("text-slate-500 hover:text-fuchsia-300", music.liked.has(track.id) && "text-fuchsia-400")}>
              <Heart className="h-4 w-4" fill={music.liked.has(track.id) ? "currentColor" : "none"} />
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-center gap-2.5">
            <button type="button" onClick={() => music.setShuffle((value) => !value)} className={cn("neon-control-button", music.shuffle && "is-active")}><Shuffle className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={music.prevTrack} className="neon-control-button"><SkipBack className="h-4 w-4" fill="currentColor" /></button>
            <button
              type="button"
              disabled={idle}
              onClick={() => !idle && music.setPlaying((value) => !value)}
              className={cn("neon-main-play flex h-11 w-11 items-center justify-center rounded-full text-slate-950", music.playing && !idle && "is-playing", idle && "cursor-default opacity-45")}
              aria-label={music.playing ? "Pausar" : "Reproducir"}
            >
              {music.playing && !idle ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 translate-x-px" fill="currentColor" />}
            </button>
            <button type="button" onClick={music.nextTrack} className="neon-control-button"><SkipForward className="h-4 w-4" fill="currentColor" /></button>
            <button
              type="button"
              onClick={() => music.setRepeat(music.repeat === "off" ? "all" : music.repeat === "all" ? "one" : "off")}
              className={cn("neon-control-button", music.repeat !== "off" && "is-active")}
            >
              <Repeat className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[8px] tabular-nums text-slate-500">
            <span className="w-7 text-right">{formatSeconds(music.currentTime)}</span>
            <ProgressRange currentTime={music.currentTime} duration={duration} onSeek={music.seekTo} compact />
            <span className="w-7">{formatSeconds(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <NeonSpectrum active={music.playing && !idle} bars={10} className="hidden h-7 w-14 2xl:flex" />
          <Volume2 className="h-4 w-4 text-slate-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={music.volume}
            onChange={(event) => music.setVolume(Number(event.target.value))}
            className="w-[clamp(70px,7vw,110px)] accent-cyan-400"
            aria-label="Volumen"
          />
          <ListMusic className="h-4 w-4 text-slate-500" />
        </div>
      </div>
    </div>
  );
}

function NeonMusicOverlay({
  spotifyEmbed,
  onOpenSpotify,
  onCloseSpotify,
}: {
  spotifyEmbed: SpotifyEmbedItem | null;
  onOpenSpotify: () => void;
  onCloseSpotify: () => void;
}) {
  return (
    <div className="neon-overlay relative z-10 h-full pb-[84px]">
      <div className="neon-layout grid h-full min-h-0">
        <NeonSidebar
          spotifyActive={Boolean(spotifyEmbed)}
          onOpenSpotify={onOpenSpotify}
          onNavigate={onCloseSpotify}
        />
        <NeonMain
          spotifyEmbed={spotifyEmbed}
          onOpenSpotify={onOpenSpotify}
          onCloseSpotify={onCloseSpotify}
        />
        <NeonRightPanel />
      </div>
      <NeonBottomPlayer />
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
    <div className="eduai-music-cyber relative h-screen min-h-[560px] overflow-hidden bg-[#05070a] text-white md:min-h-[680px]">
      <CyberStaticBackdrop />
      <RhythmPentagonField active={music.playing} currentTime={music.currentTime} />
      <style jsx global>{`
        @keyframes eduai-dj-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes eduai-loading {
          0% { transform: translateX(-120%); }
          55% { transform: translateX(180%); }
          100% { transform: translateX(280%); }
        }
        @keyframes cyber-player-flow {
          0% { transform: translateX(-45%); opacity: .35; }
          50% { opacity: .9; }
          100% { transform: translateX(145%); opacity: .35; }
        }
        @keyframes cyber-eq {
          0%, 100% { transform: scaleY(.18); opacity: .45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes cyber-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cyber-streak {
          0%,100% { stroke-dashoffset: 90; opacity: .3; }
          50% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes cyber-pentagon-beat {
          0%, 100% {
            transform:
              perspective(760px)
              translate3d(0, 0, -22px)
              scale(.76)
              rotate(var(--pentagon-rotate));
            opacity: .18;
            filter: brightness(.78) saturate(.92);
          }
          24% {
            opacity: .38;
          }
          46% {
            transform:
              perspective(760px)
              translate3d(var(--travel-x), var(--travel-y), 54px)
              scale(1.16)
              rotate(var(--pentagon-rotate));
            opacity: .88;
            filter: brightness(1.45) saturate(1.35);
          }
          62% {
            transform:
              perspective(760px)
              translate3d(0, 0, 14px)
              scale(.94)
              rotate(var(--pentagon-rotate));
            opacity: .52;
            filter: brightness(1.06) saturate(1.12);
          }
        }
        .eduai-music-cyber {
          --cyber-cyan: #25f4ff;
          --cyber-pink: #ff42cf;
          --cyber-violet: #9b6cff;
          --cyber-blue: #4aa8ff;
          background: #02050c;
          isolation: isolate;
          color-scheme: dark;
        }
        .cyber-static-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(1,5,12,.02), rgba(1,5,12,.10)),
            url("/music/eduai-music-ui-background.png") center / cover no-repeat;
          filter: saturate(1.08) contrast(1.04);
          transform: scale(1.01);
          transform-origin: center;
        }
        .cyber-static-backdrop::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 38%, transparent 0 42%, rgba(0,0,0,.07) 72%, rgba(0,0,0,.18) 100%),
            linear-gradient(90deg, rgba(0,0,0,.05), transparent 18%, transparent 82%, rgba(0,0,0,.05));
        }
        .cyber-rhythm-field {
          position: absolute;
          inset: 0;
          z-index: 1;
          overflow: hidden;
          pointer-events: none;
          perspective: 900px;
        }
        .rhythm-pentagon {
          --pentagon-glow: #25f4ff;
          --travel-x: 0px;
          --travel-y: 0px;
          --pentagon-rotate: 0deg;
          position: absolute;
          aspect-ratio: 1;
          display: block;
          clip-path: polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%);
          background:
            linear-gradient(
              145deg,
              color-mix(in srgb, var(--pentagon-glow) 66%, white 8%),
              color-mix(in srgb, var(--pentagon-glow) 20%, #040815)
            );
          opacity: .2;
          transform:
            perspective(760px)
            translate3d(0, 0, -22px)
            scale(.76)
            rotate(var(--pentagon-rotate));
          animation: cyber-pentagon-beat .5s cubic-bezier(.2,.72,.24,1) infinite;
          animation-play-state: paused;
          will-change: transform, opacity, filter;
          filter: drop-shadow(0 0 9px color-mix(in srgb, var(--pentagon-glow) 58%, transparent));
        }
        .rhythm-pentagon::before {
          content: "";
          position: absolute;
          inset: 3px;
          clip-path: inherit;
          background:
            radial-gradient(circle at 36% 26%, rgba(255,255,255,.08), transparent 30%),
            linear-gradient(145deg, rgba(5,17,29,.96), rgba(2,6,15,.98));
        }
        .rhythm-pentagon::after {
          content: "";
          position: absolute;
          inset: 14%;
          clip-path: inherit;
          border: 1px solid color-mix(in srgb, var(--pentagon-glow) 48%, transparent);
          background: color-mix(in srgb, var(--pentagon-glow) 8%, transparent);
          opacity: .52;
        }
        .cyber-rhythm-field.is-playing .rhythm-pentagon {
          animation-play-state: running;
        }
        .cyber-topbar,
        .cyber-sidebar,
        .cyber-rightbar,
        .cyber-playerbar {
          background: linear-gradient(180deg, rgba(3, 10, 19, .56), rgba(2, 7, 15, .44)) !important;
          border-color: rgba(77, 229, 255, .30) !important;
          backdrop-filter: blur(7px) saturate(1.12);
          -webkit-backdrop-filter: blur(7px) saturate(1.12);
        }
        .cyber-dashboard-panel,
        .cyber-now-card,
        .cyber-main > section {
          background:
            linear-gradient(145deg, rgba(4,15,27,.42), rgba(3,8,18,.36) 54%, rgba(31,5,38,.32)) !important;
          border-color: rgba(77,229,255,.30) !important;
          backdrop-filter: blur(6px) saturate(1.12);
          -webkit-backdrop-filter: blur(6px) saturate(1.12);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.035),
            inset 0 0 42px rgba(37,244,255,.025),
            0 0 0 1px rgba(255,66,207,.025),
            0 16px 40px rgba(0,0,0,.24);
        }
        .cyber-sidebar,
        .cyber-rightbar {
          box-shadow: inset 0 0 34px rgba(37,244,255,.025);
        }
        .cyber-sidebar > div:first-child,
        .cyber-sidebar > details,
        .cyber-sidebar > div > section,
        .cyber-rightbar > section,
        .cyber-rightbar > details {
          background: linear-gradient(145deg, rgba(3,12,23,.34), rgba(4,8,18,.24)) !important;
          border-color: rgba(81,224,255,.24) !important;
          backdrop-filter: blur(5px) saturate(1.08);
          -webkit-backdrop-filter: blur(5px) saturate(1.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.035),
            0 12px 30px rgba(0,0,0,.14);
        }
        .cyber-sidebar input,
        .cyber-rightbar input {
          background-color: rgba(0,5,12,.28) !important;
        }
        .cyber-main {
          background: transparent !important;
        }
        .cyber-main > section {
          background: linear-gradient(145deg, rgba(3,12,23,.34), rgba(4,8,18,.22), rgba(31,5,38,.24)) !important;
        }
        .cyber-player-stage {
          background:
            radial-gradient(circle at 50% 42%, rgba(37,244,255,.07), transparent 28%),
            linear-gradient(145deg, rgba(2,10,20,.18), rgba(5,5,17,.10), rgba(28,5,34,.16)) !important;
          border-color: rgba(78,228,255,.28) !important;
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          box-shadow:
            inset 0 0 70px rgba(0,8,18,.12),
            0 0 0 1px rgba(255,66,207,.04);
        }
        .cyber-player-core {
          background: linear-gradient(145deg, rgba(2,9,18,.44), rgba(8,5,18,.34)) !important;
          backdrop-filter: blur(5px) saturate(1.08);
          -webkit-backdrop-filter: blur(5px) saturate(1.08);
          border-color: rgba(111,225,255,.22) !important;
        }
        .cyber-hero-grid {
          background:
            radial-gradient(circle at 82% 32%, rgba(255,66,207,.16), transparent 28%),
            radial-gradient(circle at 64% 70%, rgba(37,244,255,.14), transparent 30%),
            linear-gradient(120deg, rgba(2,8,17,.96), rgba(5,20,32,.72) 48%, rgba(32,4,44,.42));
        }
        .cyber-hero-grid::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(37,244,255,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,244,255,.05) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(90deg, black, transparent 76%);
        }
        .cyber-hero-title {
          background: linear-gradient(90deg,#ff42cf 0%,#b552ff 42%,#25f4ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 28px rgba(255,66,207,.22);
          font-style: italic;
        }
        .cyber-search-shell {
          border: 1px solid rgba(139,92,246,.72);
          background: rgba(2,7,16,.76);
          box-shadow:
            inset 0 0 0 1px rgba(37,244,255,.06),
            0 0 24px rgba(155,108,255,.12);
        }
        .cyber-search-button {
          background: linear-gradient(90deg,#25f4ff,#46d7ff);
          box-shadow: 0 0 22px rgba(37,244,255,.22);
        }
        .cyber-source-chip {
          border: 1px solid color-mix(in srgb, var(--source-accent) 62%, transparent);
          background: color-mix(in srgb, var(--source-accent) 10%, rgba(2,8,18,.88));
          color: #dffbff;
          border-radius: 999px;
          padding: .48rem .9rem;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .04em;
          box-shadow: inset 0 0 16px color-mix(in srgb, var(--source-accent) 8%, transparent);
        }
        .cyber-source-chip:hover {
          background: color-mix(in srgb, var(--source-accent) 20%, rgba(2,8,18,.82));
          box-shadow: 0 0 18px color-mix(in srgb, var(--source-accent) 25%, transparent);
        }
        .cyber-track-card {
          border: 1px solid rgba(98,218,255,.18);
          border-radius: 14px;
          padding: 8px;
          background: linear-gradient(160deg, rgba(6,18,30,.9), rgba(3,8,15,.72));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
        }
        .cyber-track-card:hover,
        .cyber-track-card.is-active {
          border-color: rgba(37,244,255,.54);
          transform: translateY(-3px);
          box-shadow:
            0 0 20px rgba(37,244,255,.1),
            0 12px 24px rgba(0,0,0,.28);
        }
        .cyber-empty-source {
          border: 1px solid color-mix(in srgb, var(--empty-accent) 32%, transparent);
          border-radius: 14px;
          padding: 14px;
          background:
            radial-gradient(circle at 90% 15%, color-mix(in srgb, var(--empty-accent) 16%, transparent), transparent 36%),
            rgba(2,8,17,.72);
        }
        .cyber-now-card {
          position: relative;
          overflow: hidden;
        }
        .cyber-now-card::before {
          content: "";
          position: absolute;
          inset: -40% 20% auto -20%;
          height: 180px;
          background: radial-gradient(circle, rgba(255,66,207,.14), transparent 68%);
          pointer-events: none;
        }
        .cyber-hero-rings {
          transform-box: fill-box;
          transform-origin: center;
          animation: cyber-ring-spin 22s linear infinite;
        }
        .cyber-hero-streak {
          stroke-dasharray: 18 12;
          animation: cyber-streak 4.8s ease-in-out infinite;
        }
        .eduai-music-cyber section,
        .eduai-music-cyber details {
          border-color: rgba(101, 218, 255, .15) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.025),
            0 14px 34px rgba(0,0,0,.2);
        }
        .eduai-music-cyber section:hover {
          border-color: rgba(37,244,255,.24) !important;
        }
        .cyber-playerbar {
          box-shadow:
            0 -16px 50px rgba(0,0,0,.46),
            0 -1px 0 rgba(37,244,255,.13);
        }
        .cyber-equalizer {
          display: flex;
          align-items: center;
          gap: 2px;
          width: 58px;
          height: 24px;
          padding: 3px 5px;
          border: 1px solid rgba(37,244,255,.12);
          border-radius: 999px;
          background: rgba(0,0,0,.2);
          overflow: hidden;
        }
        .cyber-equalizer span {
          width: 2px;
          height: 100%;
          border-radius: 999px;
          transform-origin: center;
          transform: scaleY(.16);
          background: linear-gradient(to top, var(--cyber-cyan), var(--cyber-violet), var(--cyber-pink));
          opacity: .42;
        }
        .cyber-equalizer.is-playing span {
          animation: cyber-eq .72s ease-in-out infinite;
          animation-delay: var(--bar-delay);
        }
        .cyber-playerbar::before {
          content: "";
          position: absolute;
          left: -30%;
          top: 0;
          width: 34%;
          height: 1px;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, var(--cyber-cyan), var(--cyber-pink), transparent);
          box-shadow: 0 0 16px rgba(37,244,255,.72);
          animation: cyber-player-flow 6.5s linear infinite;
        }
        .cyber-brand {
          background: linear-gradient(90deg, #ffffff 0 42%, var(--cyber-cyan) 58%, var(--cyber-violet) 76%, var(--cyber-pink) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 24px rgba(37,244,255,.12);
        }
        .cyber-brand span {
          font-style: italic;
          letter-spacing: -.04em;
        }
        .music-background-title {
          position: absolute;
          left: 50%;
          top: 42px;
          z-index: 12;
          transform: translateX(-50%);
          margin: 0;
          padding: 0;
          font-size: clamp(2.2rem, 5vw, 5.8rem);
          font-weight: 950;
          line-height: .9;
          letter-spacing: -.065em;
          white-space: nowrap;
          background: linear-gradient(90deg, #ffffff 0 38%, #25f4ff 55%, #9b6cff 74%, #ff42cf 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow:
            0 0 24px rgba(37,244,255,.16),
            0 0 34px rgba(255,66,207,.10);
          pointer-events: none;
          user-select: none;
        }
        .music-background-title span {
          font-style: italic;
        }
        .neon-title-gradient {
          background: linear-gradient(
            90deg,
            #25f4ff 0%,
            #67d9ff 20%,
            #9b6cff 40%,
            #ff42cf 50%,
            #9b6cff 60%,
            #67d9ff 80%,
            #25f4ff 100%
          );
          background-size: 200% 100%;
          background-position: 0% 50%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 24px rgba(37,244,255,.14);
          animation: neon-title-flow 4.5s linear infinite;
          will-change: background-position;
        }
        @keyframes neon-title-flow {
          from { background-position: 0% 50%; }
          to { background-position: 200% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .neon-title-gradient {
            animation: none;
            background-position: 50% 50%;
          }
        }
        .neon-layout {
          grid-template-columns:
            clamp(190px, 15.5vw, 280px)
            minmax(0, 1fr)
            clamp(260px, 20.5vw, 380px);
          gap: 8px;
          padding: 8px 8px 0;
        }
        .neon-sidebar,
        .neon-main,
        .neon-right-panel {
          min-width: 0;
          border: 1px solid rgba(73, 225, 255, .20);
          border-radius: 18px;
          background:
            linear-gradient(160deg, rgba(3, 12, 24, .88), rgba(2, 8, 18, .78) 56%, rgba(20, 5, 29, .72));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.035),
            0 18px 42px rgba(0,0,0,.28),
            0 0 28px rgba(37,244,255,.035);
          backdrop-filter: blur(16px) saturate(1.08);
          -webkit-backdrop-filter: blur(16px) saturate(1.08);
        }
        .neon-sidebar {
          overflow-y: auto;
          text-shadow: 0 1px 12px rgba(0,0,0,.72);
          scrollbar-width: thin;
        }
        .neon-main {
          background:
            radial-gradient(circle at 72% 8%, rgba(37,244,255,.07), transparent 30%),
            linear-gradient(160deg, rgba(3, 12, 24, .90), rgba(2, 8, 18, .80) 54%, rgba(20, 5, 29, .70));
        }
        .neon-right-panel {
          background:
            radial-gradient(circle at 50% 18%, rgba(155,108,255,.09), transparent 34%),
            linear-gradient(165deg, rgba(3, 12, 24, .91), rgba(2, 8, 18, .83) 56%, rgba(20, 5, 29, .74));
        }
        .neon-youtube-player iframe {
          display: block;
          width: 100% !important;
          height: 100% !important;
          border: 0;
        }
        .neon-nav-button {
          position: relative;
          background: rgba(3, 13, 25, .72);
          border: 1px solid rgba(37,244,255,.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
        }
        .neon-nav-button:hover {
          background: rgba(7, 28, 44, .88);
          border-color: rgba(37,244,255,.28);
          transform: translateX(2px);
        }
        .neon-nav-button.is-active {
          background:
            linear-gradient(90deg, rgba(37,244,255,.30), rgba(37,244,255,.12) 68%, rgba(3,13,25,.76));
          border-color: rgba(87,236,255,.48);
          box-shadow:
            inset 3px 0 0 #25f4ff,
            0 0 18px rgba(37,244,255,.14);
        }
        .neon-search {
          background: rgba(2, 9, 19, .84) !important;
          border-color: rgba(139, 92, 246, .58) !important;
          box-shadow:
            inset 0 0 22px rgba(155,108,255,.08),
            0 0 20px rgba(155,108,255,.10);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .neon-filter-chip:not(.is-active) {
          background: rgba(3, 13, 25, .80);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
        }
        .neon-filter-chip.is-active {
          background: #25f4ff !important;
          color: #02131d !important;
          border-color: rgba(165, 251, 255, .86) !important;
          box-shadow: 0 0 18px rgba(37,244,255,.24), inset 0 1px 0 rgba(255,255,255,.28);
        }
        .neon-filter-chip:focus-visible {
          outline: 2px solid rgba(244, 114, 255, .9);
          outline-offset: 2px;
        }
        .neon-catalog-surface {
          background: linear-gradient(180deg, rgba(2, 10, 20, .88), rgba(2, 8, 18, .74));
          border: 1px solid rgba(37,244,255,.10);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.02);
        }
        .neon-catalog {
          scrollbar-width: thin;
          scrollbar-color: rgba(37,244,255,.28) transparent;
        }
        .neon-catalog::-webkit-scrollbar {
          height: 5px;
        }
        .neon-catalog::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(37,244,255,.26);
        }
        .neon-recent-card {
          border-radius: 14px;
          padding: 6px;
          background: linear-gradient(155deg, rgba(5,18,31,.88), rgba(2,9,18,.78));
          border: 1px solid rgba(37,244,255,.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 10px 26px rgba(0,0,0,.18);
          transition: transform .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease;
        }
        .neon-recent-card:hover,
        .neon-recent-card.is-active {
          transform: translateY(-3px);
          border-color: rgba(37,244,255,.32);
          background: rgba(2,10,19,.16);
          box-shadow: 0 10px 24px rgba(0,0,0,.16), 0 0 18px rgba(37,244,255,.07);
        }
        .neon-track-row {
          border: 1px solid rgba(37,244,255,.08);
          background: rgba(2, 10, 20, .72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.018);
          transition: background .18s ease, border-color .18s ease, transform .18s ease;
        }
        .neon-track-row:hover {
          background: rgba(6, 25, 40, .88);
          border-color: rgba(37,244,255,.24);
        }
        .neon-track-row.is-active {
          background: linear-gradient(90deg, rgba(37,244,255,.22), rgba(155,108,255,.13), rgba(3,12,24,.78));
          border-color: rgba(37,244,255,.42);
          box-shadow: inset 2px 0 0 rgba(37,244,255,.95), 0 0 16px rgba(37,244,255,.05);
        }
        .neon-track-row > button:last-child {
          display: inline-flex;
          height: 28px;
          width: 28px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(37,244,255,.10);
          border-radius: 999px;
          background: rgba(4, 16, 29, .82);
        }
        .neon-queue-row {
          border: 1px solid rgba(37,244,255,.07);
          background: rgba(2, 10, 20, .58);
          transition: background .18s ease, border-color .18s ease;
        }
        .neon-queue-row:hover {
          background: rgba(6, 24, 39, .82);
          border-color: rgba(37,244,255,.18);
        }
        .neon-queue-row.is-active {
          background: linear-gradient(90deg, rgba(37,244,255,.20), rgba(155,108,255,.10), rgba(3,12,24,.65));
          border-color: rgba(37,244,255,.30);
        }
        .neon-spectrum {
          min-width: 0;
          overflow: hidden;
        }
        .neon-spectrum-bar {
          flex: 1 1 0%;
          min-width: 2px;
          height: var(--eq-height);
          border-radius: 999px;
          transform: scaleY(.22);
          transform-origin: bottom;
          opacity: .42;
          background: linear-gradient(to top,#25f4ff 0%,#3bb8ff 34%,#9b6cff 67%,#ff42cf 100%);
          box-shadow: 0 0 6px rgba(37,244,255,.22);
        }
        .neon-spectrum-bar.is-playing {
          animation: neon-spectrum-pulse .72s ease-in-out infinite;
          animation-delay: var(--eq-delay);
        }
        .neon-bottom-player {
          background:
            linear-gradient(180deg, rgba(3, 12, 23, .94), rgba(1, 6, 14, .98));
          border-top: 1px solid rgba(37,244,255,.28);
          box-shadow: 0 -14px 36px rgba(0,0,0,.34), 0 -1px 18px rgba(37,244,255,.035);
          backdrop-filter: blur(18px) saturate(1.12);
          -webkit-backdrop-filter: blur(18px) saturate(1.12);
        }
        .neon-control-button {
          display: inline-flex;
          height: 32px;
          width: 32px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: rgba(226,232,240,.88);
          background: rgba(5, 18, 31, .92);
          border: 1px solid rgba(37,244,255,.15);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
          transition: all .18s ease;
        }
        .neon-control-button:hover,
        .neon-control-button.is-active {
          color: #c8fbff;
          border-color: rgba(37,244,255,.24);
          background: rgba(37,244,255,.11);
          box-shadow: 0 0 14px rgba(37,244,255,.10);
        }
        .neon-main-play {
          background: linear-gradient(135deg,#25f4ff 0%,#60ddff 50%,#ff42cf 130%);
          box-shadow:
            0 0 0 1px rgba(255,255,255,.12),
            0 0 22px rgba(37,244,255,.30),
            0 0 30px rgba(255,66,207,.12);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .neon-main-play:hover {
          transform: scale(1.06);
        }
        .neon-main-play.is-playing {
          animation: neon-play-breathe 1.6s ease-in-out infinite;
        }
        @keyframes neon-spectrum-pulse {
          0%,100% { transform: scaleY(.22); opacity: .42; }
          45% { transform: scaleY(1); opacity: 1; }
          68% { transform: scaleY(.54); opacity: .76; }
        }
        @keyframes neon-play-breathe {
          0%,100% {
            box-shadow: 0 0 0 1px rgba(255,255,255,.12),0 0 20px rgba(37,244,255,.28),0 0 28px rgba(255,66,207,.10);
          }
          50% {
            box-shadow: 0 0 0 2px rgba(37,244,255,.18),0 0 32px rgba(37,244,255,.50),0 0 42px rgba(255,66,207,.20);
          }
        }
        .eduai-music-cyber button {
          transition-property: transform, filter, background-color, border-color, color, box-shadow;
          transition-duration: 180ms;
          transition-timing-function: ease;
        }
        .eduai-music-cyber button:hover {
          filter: drop-shadow(0 0 8px rgba(37,244,255,.16));
        }
        .eduai-music-cyber button:active {
          transform: scale(.985);
        }
        .eduai-music-cyber input:focus {
          box-shadow: 0 0 0 1px rgba(37,244,255,.16), 0 0 22px rgba(37,244,255,.08);
        }
        .eduai-music-cyber input[type="range"] {
          accent-color: #25f4ff;
        }
        .eduai-music-cyber ::selection {
          background: rgba(255,66,207,.36);
          color: white;
        }
        @media (max-width: 1199px) {
          .cyber-static-backdrop { background-position: center; }
          .cyber-rhythm-field { opacity: .82; }
          .cyber-hero-grid + svg { opacity: .56; }
          .neon-layout {
            grid-template-columns: minmax(176px, 22%) minmax(0, 1fr);
          }
          .neon-right-panel {
            display: none;
          }
          .neon-sidebar {
            padding-left: 10px;
            padding-right: 10px;
          }
          .neon-nav-button {
            padding-left: 9px;
            padding-right: 9px;
          }
          .neon-recent-card:nth-child(n+5) {
            display: none;
          }
          .neon-bottom-grid {
            grid-template-columns: minmax(176px, 240px) minmax(280px, 1fr);
          }
          .neon-bottom-grid > :last-child {
            display: none;
          }
          .neon-track-header,
          .neon-track-grid {
            grid-template-columns: 34px minmax(0, 1.45fr) minmax(90px, .9fr) 58px 38px !important;
          }
          .neon-track-header > :nth-child(4),
          .neon-track-grid > :nth-child(4) {
            display: none;
          }
        }
        @media (max-width: 767px) {
          .eduai-music-cyber {
            height: 100dvh;
            min-height: 560px;
          }
          .neon-overlay {
            padding-bottom: calc(118px + env(safe-area-inset-bottom));
          }
          .neon-layout {
            display: block !important;
            height: 100%;
            padding: 0;
          }
          .neon-sidebar,
          .neon-right-panel {
            display: none;
          }
          .neon-main {
            height: 100%;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
            padding-left: 10px;
            padding-right: 10px;
            padding-top: 14px;
            padding-bottom: 18px;
            border: 0;
            border-radius: 0;
            background: linear-gradient(180deg, rgba(2,8,18,.88), rgba(2,7,16,.82));
            box-shadow: none;
            -webkit-overflow-scrolling: touch;
          }
          .neon-main > div {
            height: auto;
            min-height: 100%;
          }
          .neon-search-row {
            max-width: none;
          }
          .neon-filter-chip {
            min-height: 36px;
            padding-left: 12px;
            padding-right: 12px;
          }
          .neon-recent-card:nth-child(n+5) {
            display: block;
          }
          .neon-track-header {
            display: none !important;
          }
          .neon-track-grid {
            grid-template-columns: 30px minmax(0, 1fr) 32px !important;
            gap: 6px !important;
            padding: 6px 4px !important;
          }
          .neon-track-grid > :nth-child(3),
          .neon-track-grid > :nth-child(4),
          .neon-track-grid > :nth-child(5) {
            display: none;
          }
          .neon-bottom-player {
            height: calc(118px + env(safe-area-inset-bottom));
            padding: 8px 12px env(safe-area-inset-bottom);
            background: linear-gradient(180deg, rgba(1,6,14,.88), rgba(1,6,14,.98));
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }
          .neon-bottom-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            grid-template-rows: auto auto;
            align-content: center;
            gap: 4px !important;
          }
          .neon-bottom-grid > :first-child {
            min-height: 38px;
            justify-content: center;
          }
          .neon-bottom-grid > :nth-child(2) {
            min-width: 0;
          }
          .neon-bottom-grid > :last-child {
            display: none;
          }
          .neon-control-button {
            height: 34px;
            width: 34px;
          }
          .neon-main-play {
            height: 44px !important;
            width: 44px !important;
          }
        }
        @media (max-width: 479px) {
          .neon-search-row {
            flex-wrap: wrap;
          }
          .neon-search-row > .neon-search {
            flex-basis: 100%;
          }
          .neon-search-row > button {
            width: 100%;
          }
          .neon-bottom-player {
            height: calc(124px + env(safe-area-inset-bottom));
          }
          .neon-overlay {
            padding-bottom: calc(124px + env(safe-area-inset-bottom));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rhythm-pentagon,
          .cyber-hero-rings,
          .cyber-hero-streak,
          .cyber-playerbar::before {
            animation: none !important;
          }
        }
      `}</style>
      <NeonMusicOverlay
        spotifyEmbed={selectedSpotifyEmbed}
        onOpenSpotify={() => setSelectedSpotifyEmbed(SPOTIFY_EMBEDS[0] ?? null)}
        onCloseSpotify={() => setSelectedSpotifyEmbed(null)}
      />
      <AddToPlaylistBar />
    </div>
  );
}
