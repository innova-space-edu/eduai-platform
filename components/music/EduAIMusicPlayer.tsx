"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  type EduMusicDjReel,
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

type ExtendedMusicTrack = EduMusicTrack & {
  playable?: boolean;
  externalOnly?: boolean;
  embedOnly?: boolean;
  embedUrl?: string;
  loaderUrl?: string;
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

function getDjReelEmbedUrlById(videoId?: string) {
  if (!videoId) return "";
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: videoId,
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function getDjReelEmbedUrl(track?: EduMusicTrack | null) {
  return getDjReelEmbedUrlById(track?.youtubeVideoId);
}

function getYouTubeDirectEmbedUrl(track?: EduMusicTrack | null, autoplay = false) {
  const videoId = track?.youtubeVideoId;
  const playlistId = (track as (EduMusicTrack & { youtubePlaylistId?: string }) | null | undefined)?.youtubePlaylistId;
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (playlistId) params.set("list", playlistId);
  if (typeof window !== "undefined") params.set("origin", window.location.origin);

  if (!videoId && playlistId) {
    return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
  }
  if (!videoId) return "";
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function getYouTubeThumb(track?: EduMusicTrack | null) {
  return track?.videoThumbnail || track?.artworkUrl || (track?.youtubeVideoId ? `https://i.ytimg.com/vi/${track.youtubeVideoId}/hqdefault.jpg` : undefined);
}


let djReelYouTubeApiPromise: Promise<void> | null = null;

function loadDjReelYouTubeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as typeof window & { YT?: any; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve();
  if (djReelYouTubeApiPromise) return djReelYouTubeApiPromise;

  djReelYouTubeApiPromise = new Promise<void>((resolve) => {
    const previousReady = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.();
      } catch {}
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return djReelYouTubeApiPromise;
}

function safeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "track";
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

const SPOTIFY_EMBEDS = [
  {
    id: "spotify-mix-1",
    title: "Calvin Harris Mix",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1EIZna6YqhjeY0?utm_source=generator&theme=0",
  },
  {
    id: "spotify-top-global",
    title: "Top Global",
    src: "https://open.spotify.com/embed/playlist/37i9dQZEVXddk5AflVss6A?utm_source=generator",
  },
  {
    id: "spotify-mix-2",
    title: "Mix electrónico",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1E8KVBYF00LoMc?utm_source=generator",
  },
  {
    id: "spotify-custom-1",
    title: "Lista personal 1",
    src: "https://open.spotify.com/embed/playlist/3z0zQdiFbPdiZ1I7xRpqPx?utm_source=generator",
  },
  {
    id: "spotify-custom-2",
    title: "Lista personal 2",
    src: "https://open.spotify.com/embed/playlist/6VjXyFH9Z5HlGPAjRBKR32?utm_source=generator&theme=0",
  },
  {
    id: "spotify-focus",
    title: "Focus / estudio",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1DX6aTaZa0K6VA?utm_source=generator&theme=0",
  },
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function NeonGamingSkin() {
  return (
    <style>{`
      .eduai-music-neon {
        --neon-green: #00ffa3;
        --neon-cyan: #00e5ff;
        --neon-blue: #2563ff;
        --neon-purple: #a855f7;
        --neon-pink: #ff2d75;
        --neon-red: #ff314f;
        position: relative;
        isolation: isolate;
        background:
          radial-gradient(circle at 12% 18%, rgba(0, 229, 255, 0.2), transparent 25%),
          radial-gradient(circle at 88% 16%, rgba(168, 85, 247, 0.22), transparent 30%),
          radial-gradient(circle at 50% 86%, rgba(255, 45, 117, 0.17), transparent 34%),
          linear-gradient(120deg, #02030a 0%, #061015 34%, #120722 65%, #04050c 100%) !important;
      }

      .eduai-music-neon::before {
        content: "";
        position: fixed;
        inset: -25%;
        pointer-events: none;
        z-index: 0;
        background:
          linear-gradient(115deg, transparent 0 10%, rgba(0,229,255,.12) 13%, transparent 18% 27%, rgba(168,85,247,.12) 31%, transparent 37% 52%, rgba(255,45,117,.13) 57%, transparent 63% 72%, rgba(0,255,163,.15) 78%, transparent 84% 100%),
          repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 28px),
          repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 24px);
        filter: blur(.2px) saturate(1.35);
        opacity: .88;
        transform: translate3d(0,0,0);
        animation: eduai-aurora-slide 18s linear infinite;
        mask-image: radial-gradient(circle at 50% 42%, rgba(0,0,0,.96), rgba(0,0,0,.4) 60%, transparent 88%);
      }

      .eduai-music-neon::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        background:
          repeating-linear-gradient(to bottom, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 2px, transparent 7px),
          radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,.36) 78%);
        opacity: .22;
        mix-blend-mode: screen;
      }

      .eduai-music-neon > div,
      .eduai-music-neon header,
      .eduai-music-neon footer,
      .eduai-music-neon aside,
      .eduai-music-neon main {
        position: relative;
        z-index: 2;
      }

      .eduai-music-neon header,
      .eduai-music-neon footer {
        background: rgba(2, 4, 12, 0.82) !important;
        border-color: rgba(0, 255, 163, 0.28) !important;
        box-shadow: 0 0 34px rgba(0, 229, 255, 0.11), 0 0 42px rgba(168,85,247,.1), inset 0 1px 0 rgba(255,255,255,.08);
        backdrop-filter: blur(22px) saturate(160%);
      }

      .eduai-music-neon header::after,
      .eduai-music-neon footer::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        pointer-events: none;
        background: linear-gradient(90deg, #00ffa3, #00e5ff, #2563ff, #a855f7, #ff2d75, #ff314f, #00ffa3);
        background-size: 260% 100%;
        filter: drop-shadow(0 0 10px rgba(0,255,163,.55));
        animation: eduai-rainbow-flow 5.5s linear infinite;
      }
      .eduai-music-neon header::after { bottom: -1px; }
      .eduai-music-neon footer::before { top: -1px; }

      .eduai-music-neon aside {
        background:
          linear-gradient(180deg, rgba(4, 7, 18, 0.9), rgba(5, 8, 15, 0.94)),
          radial-gradient(circle at 10% 12%, rgba(0,229,255,.14), transparent 30%) !important;
        border-color: rgba(0, 255, 163, 0.19) !important;
      }

      .eduai-music-neon main {
        background:
          radial-gradient(circle at 50% 0%, rgba(0, 229, 255, 0.09), transparent 44%),
          radial-gradient(circle at 80% 80%, rgba(255,45,117,.08), transparent 38%) !important;
      }

      .eduai-music-neon .neon-panel {
        position: relative;
        overflow: hidden;
        background:
          linear-gradient(145deg, rgba(5, 11, 22, 0.82), rgba(4, 6, 13, 0.88)),
          radial-gradient(circle at 14% 8%, rgba(0, 229, 255, 0.16), transparent 34%),
          radial-gradient(circle at 88% 18%, rgba(168, 85, 247, 0.14), transparent 40%),
          radial-gradient(circle at 64% 96%, rgba(255, 45, 117, 0.10), transparent 34%) !important;
        border: 1px solid rgba(0, 255, 163, 0.26) !important;
        box-shadow:
          0 24px 70px rgba(0,0,0,.54),
          0 0 34px rgba(0,229,255,.09),
          0 0 46px rgba(168,85,247,.08),
          inset 0 1px 0 rgba(255,255,255,.09) !important;
        backdrop-filter: blur(20px) saturate(160%);
      }

      .eduai-music-neon .neon-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          linear-gradient(115deg, transparent 0 18%, rgba(0,255,163,.12) 21%, transparent 27% 100%),
          linear-gradient(90deg, rgba(0,229,255,.08), transparent 30%, rgba(255,45,117,.08));
        opacity: .55;
      }

      .eduai-music-neon .neon-panel > * {
        position: relative;
        z-index: 1;
      }

      .eduai-music-neon .neon-stage {
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 38%, rgba(0, 229, 255, 0.19), transparent 28%),
          radial-gradient(circle at 24% 74%, rgba(168, 85, 247, 0.14), transparent 34%),
          radial-gradient(circle at 78% 70%, rgba(255, 45, 117, 0.13), transparent 36%),
          linear-gradient(145deg, rgba(2, 8, 14, 0.76), rgba(6, 4, 16, 0.88)) !important;
        border-color: rgba(0, 255, 163, 0.25) !important;
        box-shadow:
          inset 0 0 90px rgba(0, 229, 255, 0.055),
          0 0 38px rgba(0, 255, 163, 0.07),
          0 0 48px rgba(168, 85, 247, 0.07) !important;
      }

      .eduai-music-neon .neon-stage::before {
        content: "";
        position: absolute;
        inset: auto 8% 18px 8%;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg,#00ffa3,#00e5ff,#2563ff,#a855f7,#ff2d75,#ff314f,#00ffa3);
        background-size: 260% 100%;
        filter: blur(10px);
        opacity: .48;
        animation: eduai-rainbow-flow 6s linear infinite;
      }

      .eduai-music-neon .neon-current-card {
        background:
          linear-gradient(155deg, rgba(9, 17, 31, 0.72), rgba(0,0,0,.36)),
          radial-gradient(circle at 12% 8%, rgba(0,229,255,.14), transparent 38%),
          radial-gradient(circle at 92% 0%, rgba(255,45,117,.10), transparent 44%) !important;
        border-color: rgba(0, 255, 163, 0.28) !important;
        box-shadow:
          0 22px 64px rgba(0,0,0,.48),
          0 0 28px rgba(0,255,163,.13),
          0 0 34px rgba(37,99,255,.09),
          inset 0 1px 0 rgba(255,255,255,.09) !important;
      }

      .eduai-music-neon .neon-chip {
        border: 1px solid rgba(0,255,163,.46) !important;
        background: linear-gradient(90deg, rgba(0,255,163,.28), rgba(0,229,255,.14), rgba(168,85,247,.14)) !important;
        color: #d9ffef !important;
        text-shadow: 0 0 12px rgba(0,255,163,.55);
        box-shadow: inset 0 0 18px rgba(0,255,163,.10), 0 0 18px rgba(0,255,163,.11);
      }

      .eduai-music-neon .neon-title {
        color: #ffffff;
        text-shadow: 0 0 18px rgba(0,255,163,.32), 0 0 32px rgba(0,229,255,.18), 0 0 46px rgba(168,85,247,.12);
      }

      .eduai-music-neon .neon-accent-button,
      .eduai-music-neon .neon-metal-button {
        color: #02120c !important;
        background:
          linear-gradient(180deg, rgba(255,255,255,.55), transparent 38%),
          linear-gradient(90deg, #a7ffd3, #00ffa3 34%, #00d084 58%, #39ff88) !important;
        border: 1px solid rgba(202,255,226,.72) !important;
        box-shadow:
          0 0 18px rgba(0,255,163,.38),
          0 0 36px rgba(0,229,255,.16),
          inset 0 1px 0 rgba(255,255,255,.74),
          inset 0 -10px 18px rgba(0,74,52,.22) !important;
      }

      .eduai-music-neon .neon-accent-button:hover,
      .eduai-music-neon .neon-metal-button:hover {
        transform: translateY(-1px) scale(1.025);
        filter: saturate(1.2) contrast(1.05);
      }

      .eduai-music-neon .rainbow-edge {
        position: relative;
      }
      .eduai-music-neon .rainbow-edge::before {
        content: "";
        position: absolute;
        inset: -1px;
        z-index: -1;
        border-radius: inherit;
        background: linear-gradient(120deg,#00ffa3,#00e5ff,#2563ff,#a855f7,#ff2d75,#ff314f,#00ffa3);
        background-size: 240% 100%;
        opacity: .72;
        animation: eduai-rainbow-flow 5.2s linear infinite;
      }

      .eduai-music-neon .neon-playlist-shelf {
        background:
          linear-gradient(135deg, rgba(0,229,255,.10), rgba(5,8,18,.88) 36%, rgba(168,85,247,.11) 70%, rgba(255,45,117,.08)) !important;
        border-color: rgba(0,255,163,.22) !important;
        box-shadow: 0 -8px 42px rgba(0,229,255,.08), inset 0 1px 0 rgba(255,255,255,.08) !important;
      }

      .eduai-music-neon .neon-spotify-card,
      .eduai-music-neon .neon-playlist-card,
      .eduai-music-neon .neon-instrumental-card {
        background:
          linear-gradient(145deg, rgba(255,255,255,.075), rgba(255,255,255,.025)),
          radial-gradient(circle at 16% 0%, rgba(0,229,255,.18), transparent 44%),
          radial-gradient(circle at 88% 100%, rgba(255,45,117,.12), transparent 42%) !important;
        border-color: rgba(0,255,163,.2) !important;
        box-shadow: 0 16px 42px rgba(0,0,0,.36), 0 0 22px rgba(0,229,255,.06) !important;
      }

      .eduai-music-neon .neon-spotify-card:hover,
      .eduai-music-neon .neon-playlist-card:hover,
      .eduai-music-neon .neon-instrumental-card:hover {
        border-color: rgba(0,255,163,.5) !important;
        box-shadow: 0 20px 54px rgba(0,0,0,.44), 0 0 28px rgba(0,255,163,.16), 0 0 40px rgba(255,45,117,.08) !important;
        transform: translateY(-2px);
      }

      .eduai-music-neon .neon-eq {
        display: inline-flex;
        align-items: end;
        gap: 3px;
        height: 18px;
      }
      .eduai-music-neon .neon-eq span {
        width: 3px;
        min-height: 5px;
        border-radius: 999px;
        background: linear-gradient(180deg,#00e5ff,#a855f7,#ff2d75,#00ffa3);
        box-shadow: 0 0 9px rgba(0,255,163,.42);
        animation: eduai-eq 1.05s ease-in-out infinite;
      }
      .eduai-music-neon .neon-eq span:nth-child(2) { animation-delay: .12s; }
      .eduai-music-neon .neon-eq span:nth-child(3) { animation-delay: .24s; }
      .eduai-music-neon .neon-eq span:nth-child(4) { animation-delay: .36s; }
      .eduai-music-neon .neon-eq span:nth-child(5) { animation-delay: .48s; }

      .eduai-music-neon input[type="range"] {
        height: 6px;
        border-radius: 999px;
        filter: drop-shadow(0 0 9px rgba(0,255,163,.38)) drop-shadow(0 0 13px rgba(168,85,247,.18));
      }
      .eduai-music-neon input[type="range"]::-webkit-slider-thumb {
        box-shadow: 0 0 0 4px rgba(0,255,163,.14), 0 0 18px rgba(0,255,163,.65);
      }

      .eduai-music-neon ::selection {
        background: rgba(0,255,163,.35);
        color: white;
      }

      .eduai-music-neon {
        background-size: 180% 180% !important;
        animation: eduai-bg-shift 22s ease-in-out infinite;
      }

      .eduai-music-neon button,
      .eduai-music-neon a {
        -webkit-tap-highlight-color: transparent;
      }

      .eduai-music-neon button {
        position: relative;
        overflow: hidden;
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease, filter .18s ease;
      }

      .eduai-music-neon button:not(:disabled):hover {
        transform: translateY(-1px);
        filter: brightness(1.12) saturate(1.25);
      }

      .eduai-music-neon button:not(:disabled):active {
        transform: translateY(0) scale(.98);
      }

      .eduai-music-neon .neon-control-button {
        border: 1px solid rgba(0,255,163,.22) !important;
        background:
          radial-gradient(circle at 32% 18%, rgba(255,255,255,.20), transparent 28%),
          linear-gradient(145deg, rgba(17,24,39,.86), rgba(5,8,16,.92)) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.12),
          0 0 0 1px rgba(0,229,255,.05),
          0 0 20px rgba(0,255,163,.10) !important;
      }

      .eduai-music-neon .neon-control-button:hover {
        border-color: rgba(0,255,163,.55) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.18),
          0 0 22px rgba(0,255,163,.22),
          0 0 30px rgba(168,85,247,.10) !important;
      }

      .eduai-music-neon .neon-control-button.is-active {
        color: #03130c !important;
        background:
          linear-gradient(180deg, rgba(255,255,255,.42), transparent 42%),
          linear-gradient(100deg, #93ffcb, #00ffa3 38%, #00d084 64%, #58ff8a) !important;
        border-color: rgba(217,255,236,.76) !important;
        box-shadow:
          0 0 18px rgba(0,255,163,.42),
          0 0 32px rgba(0,229,255,.18),
          inset 0 1px 0 rgba(255,255,255,.72),
          inset 0 -8px 18px rgba(0,88,58,.24) !important;
      }

      .eduai-music-neon .neon-metal-button::after,
      .eduai-music-neon .neon-accent-button::after,
      .eduai-music-neon .neon-control-button::after {
        content: "";
        position: absolute;
        inset: -80% auto -80% -45%;
        width: 42%;
        transform: rotate(18deg);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.52), transparent);
        opacity: .0;
        transition: opacity .18s ease, left .55s ease;
        pointer-events: none;
      }

      .eduai-music-neon .neon-metal-button:hover::after,
      .eduai-music-neon .neon-accent-button:hover::after,
      .eduai-music-neon .neon-control-button:hover::after {
        left: 118%;
        opacity: .55;
      }

      .eduai-music-neon .neon-keyboard-line {
        position: absolute;
        left: 16px;
        right: 16px;
        height: 2px;
        pointer-events: none;
        border-radius: 999px;
        background: linear-gradient(90deg,#00ffa3,#00e5ff,#2563ff,#a855f7,#ff2d75,#ff314f,#ffcc00,#00ffa3);
        background-size: 300% 100%;
        filter: drop-shadow(0 0 9px rgba(0,255,163,.5)) drop-shadow(0 0 12px rgba(168,85,247,.35));
        animation: eduai-rainbow-flow 4.2s linear infinite;
        opacity: .85;
      }

      .eduai-music-neon .neon-keyboard-line.top { top: 0; }
      .eduai-music-neon .neon-keyboard-line.bottom { bottom: 0; }

      .eduai-music-neon .neon-stage {
        min-height: 0;
      }

      .eduai-music-neon .neon-current-card {
        max-height: 100%;
      }

      .eduai-music-neon .neon-now-compact {
        background:
          linear-gradient(135deg, rgba(0,255,163,.10), rgba(0,0,0,.34) 36%, rgba(168,85,247,.12) 70%, rgba(255,45,117,.10)),
          rgba(1,4,10,.68) !important;
        border-color: rgba(0,255,163,.30) !important;
      }

      .eduai-music-neon .neon-bottom-visualizer {
        background:
          linear-gradient(180deg, rgba(2,3,10,.74), rgba(3,6,12,.94)),
          radial-gradient(circle at 22% 50%, rgba(0,229,255,.18), transparent 38%),
          radial-gradient(circle at 72% 70%, rgba(255,45,117,.14), transparent 42%) !important;
        box-shadow:
          0 -18px 54px rgba(0,0,0,.55),
          inset 0 1px 0 rgba(255,255,255,.08),
          0 0 28px rgba(0,255,163,.08) !important;
      }

      .eduai-music-neon .neon-visualizer-bars {
        display: flex;
        align-items: end;
        justify-content: center;
        gap: 4px;
        height: 42px;
        min-width: 190px;
      }

      .eduai-music-neon .neon-visualizer-bars span {
        width: clamp(4px, .42vw, 7px);
        min-height: 7px;
        border-radius: 999px 999px 4px 4px;
        background: linear-gradient(180deg,#fff 0%,#00e5ff 18%,#2563ff 42%,#a855f7 62%,#ff2d75 80%,#00ffa3 100%);
        box-shadow: 0 0 10px rgba(0,255,163,.4), 0 0 16px rgba(168,85,247,.22);
        animation: eduai-eq-big 1.05s ease-in-out infinite;
      }

      .eduai-music-neon .neon-visualizer-bars span:nth-child(2n) { animation-duration: .82s; animation-delay: -.12s; }
      .eduai-music-neon .neon-visualizer-bars span:nth-child(3n) { animation-duration: 1.24s; animation-delay: -.28s; }
      .eduai-music-neon .neon-visualizer-bars span:nth-child(4n) { animation-duration: .96s; animation-delay: -.38s; }
      .eduai-music-neon .neon-visualizer-bars span:nth-child(5n) { animation-duration: 1.36s; animation-delay: -.52s; }

      .eduai-music-neon .neon-progress-track {
        position: relative;
        height: 7px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,.10);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 0 16px rgba(0,255,163,.16);
      }

      .eduai-music-neon .neon-progress-track::before {
        content: "";
        position: absolute;
        inset: 0;
        width: var(--eduai-progress, 0%);
        border-radius: inherit;
        background: linear-gradient(90deg,#00ffa3,#00e5ff,#2563ff,#a855f7,#ff2d75,#ff314f,#00ffa3);
        background-size: 260% 100%;
        box-shadow: 0 0 18px rgba(0,255,163,.42), 0 0 28px rgba(168,85,247,.22);
        animation: eduai-rainbow-flow 4.6s linear infinite;
      }

      .eduai-music-neon .neon-side-hub {
        background:
          linear-gradient(145deg, rgba(6,10,22,.86), rgba(3,5,10,.94)),
          radial-gradient(circle at 0% 0%, rgba(0,229,255,.18), transparent 42%),
          radial-gradient(circle at 100% 40%, rgba(255,45,117,.13), transparent 44%) !important;
      }

      .eduai-music-neon .neon-compact-card {
        background:
          linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.025)),
          radial-gradient(circle at 16% 18%, rgba(0,255,163,.14), transparent 44%) !important;
        border-color: rgba(0,255,163,.19) !important;
      }

      .eduai-music-neon .neon-compact-card:hover {
        border-color: rgba(0,255,163,.52) !important;
        box-shadow: 0 0 22px rgba(0,255,163,.14), 0 0 34px rgba(168,85,247,.08) !important;
      }



      /* EduAI Music Pro Gamer Patch: UI más ligera, RGB siempre activo y un solo visualizador */
      .eduai-music-neon {
        background:
          radial-gradient(circle at var(--gx, 18%) var(--gy, 20%), rgba(0,229,255,.25), transparent 28%),
          radial-gradient(circle at 88% 18%, rgba(139,92,246,.25), transparent 32%),
          radial-gradient(circle at 68% 88%, rgba(255,45,117,.19), transparent 36%),
          linear-gradient(125deg, #02030a 0%, #061221 26%, #17072a 52%, #2a0612 76%, #02030a 100%) !important;
        background-size: 180% 180%, 160% 160%, 160% 160%, 260% 260% !important;
        animation: eduai-bg-shift 16s ease-in-out infinite !important;
      }

      .eduai-music-neon .neon-accent-button,
      .eduai-music-neon .neon-metal-button {
        background:
          linear-gradient(180deg, rgba(255,255,255,.66), rgba(255,255,255,0) 42%),
          linear-gradient(105deg, #d6ffe7, #00ffa3 18%, #00d084 36%, #13f7ff 54%, #98ff72 72%, #00ffa3 100%) !important;
        background-size: 100% 100%, 280% 100% !important;
        animation: eduai-metal-rgb 3.4s linear infinite, eduai-button-breathe 2.8s ease-in-out infinite !important;
        border-color: rgba(217,255,236,.82) !important;
      }
      .eduai-music-neon .neon-accent-button:active,
      .eduai-music-neon .neon-metal-button:active,
      .eduai-music-neon .neon-control-button:active {
        transform: translateY(1px) scale(.965) !important;
        filter: brightness(1.35) saturate(1.5) !important;
        box-shadow: 0 0 10px rgba(0,255,163,.75), 0 0 36px rgba(0,229,255,.34), inset 0 0 22px rgba(255,255,255,.38) !important;
      }
      .eduai-music-neon .neon-control-button.is-active {
        background-size: 240% 100% !important;
        animation: eduai-metal-rgb 3.2s linear infinite !important;
      }

      .eduai-music-neon .neon-player-frame {
        width: 100%;
        height: 100%;
        max-width: none !important;
        border-radius: 2rem;
        border: 1px solid rgba(0,255,163,.28);
        box-shadow: 0 26px 82px rgba(0,0,0,.58), 0 0 38px rgba(0,229,255,.12), 0 0 46px rgba(168,85,247,.10);
      }

      .eduai-music-neon .neon-visualizer-bars span {
        height: var(--eq-height, 14px) !important;
        opacity: var(--eq-opacity, .86) !important;
        animation: none !important;
        background: linear-gradient(180deg, #ffffff 0%, var(--eq-a, #00e5ff) 20%, var(--eq-b, #a855f7) 55%, var(--eq-c, #ff2d75) 78%, #00ffa3 100%) !important;
        box-shadow: 0 0 12px color-mix(in srgb, var(--eq-a, #00e5ff) 68%, transparent), 0 0 22px rgba(168,85,247,.28) !important;
        transition: height .08s linear, opacity .08s linear, filter .12s ease;
      }
      .eduai-music-neon .neon-visualizer-bars {
        filter: drop-shadow(0 0 12px rgba(0,229,255,.25));
      }
      .eduai-music-neon .neon-single-eq-footer {
        min-height: 96px;
      }

      .eduai-music-neon .neon-collapsed-sidebar {
        width: 74px;
        align-items: center;
      }
      .eduai-music-neon .neon-collapsed-sidebar .collapsed-icon-button {
        width: 48px;
        height: 48px;
        justify-content: center;
      }


      .eduai-music-neon button[class*="bg-emerald-400"],
      .eduai-music-neon a[class*="bg-emerald-400"] {
        background:
          linear-gradient(180deg, rgba(255,255,255,.62), rgba(255,255,255,0) 42%),
          linear-gradient(105deg, #d6ffe7, #00ffa3 18%, #00d084 36%, #13f7ff 54%, #98ff72 72%, #00ffa3 100%) !important;
        background-size: 100% 100%, 280% 100% !important;
        animation: eduai-metal-rgb 3.4s linear infinite, eduai-button-breathe 2.8s ease-in-out infinite !important;
        color: #03130c !important;
        border-color: rgba(217,255,236,.82) !important;
      }


      .eduai-music-neon::before {
        filter: none !important;
        opacity: .52 !important;
        animation-duration: 28s !important;
      }
      .eduai-music-neon::after {
        opacity: .15 !important;
      }
      .eduai-music-neon .neon-panel::before {
        opacity: .32 !important;
      }

      @keyframes eduai-metal-rgb {
        0% { background-position: 0 0, 0% 50%; }
        100% { background-position: 0 0, 280% 50%; }
      }
      @keyframes eduai-button-breathe {
        0%, 100% { box-shadow: 0 0 18px rgba(0,255,163,.42), 0 0 30px rgba(0,229,255,.18), inset 0 1px 0 rgba(255,255,255,.76); }
        50% { box-shadow: 0 0 28px rgba(0,255,163,.70), 0 0 48px rgba(0,229,255,.32), 0 0 26px rgba(168,85,247,.25), inset 0 1px 0 rgba(255,255,255,.86); }
      }

      @keyframes eduai-bg-shift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      @keyframes eduai-eq-big {
        0%, 100% { height: 9px; opacity: .58; transform: scaleY(.72); }
        38% { height: 38px; opacity: 1; transform: scaleY(1); }
        62% { height: 18px; opacity: .82; transform: scaleY(.86); }
      }

      @media (prefers-reduced-motion: no-preference) {
        .eduai-music-neon .neon-pulse {
          animation: eduai-neon-pulse 2.4s ease-in-out infinite;
        }
        .eduai-music-neon .neon-scan {
          background-size: 220% 100%;
          animation: eduai-neon-scan 6s linear infinite;
        }
      }

      @keyframes eduai-rainbow-flow {
        0% { background-position: 0% 50%; }
        100% { background-position: 240% 50%; }
      }

      @keyframes eduai-aurora-slide {
        0% { transform: translate3d(-8%, -3%, 0) rotate(0deg); }
        50% { transform: translate3d(7%, 4%, 0) rotate(1.6deg); }
        100% { transform: translate3d(-8%, -3%, 0) rotate(0deg); }
      }

      @keyframes eduai-neon-pulse {
        0%, 100% { box-shadow: 0 0 18px rgba(0,255,163,.24), 0 0 0 rgba(34,211,238,0); }
        50% { box-shadow: 0 0 34px rgba(0,255,163,.48), 0 0 24px rgba(0,229,255,.2); }
      }

      @keyframes eduai-neon-scan {
        0% { background-position: 0% 0; }
        100% { background-position: 220% 0; }
      }

      @keyframes eduai-eq {
        0%, 100% { height: 5px; opacity: .62; }
        50% { height: 18px; opacity: 1; }
      }
    `}</style>
  );
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

function sourceLabel(source?: EduMusicTrack["source"]) {
  if (source === "jamendo") return "Jamendo";
  if (source === "audius") return "Audius";
  if (source === "itunes") return "DJ 30s";
  if (source === "youtube") return "YouTube video";
  if (source === "radio") return "Radio online";
  if (source === "external") return "Externo";
  return "EduAI";
}

function playbackKind(track?: EduMusicTrack) {
  if (isEmbedTrack(track)) return "Reproductor oficial ConectaAPP";
  if (track?.source === "itunes" && (track.youtubeVideoId || track.djReels?.length)) return "Audio iTunes · visual YouTube silenciado · modo DJ";
  if (track?.source === "itunes") return "Audio 30 segundos · imagen de fondo";
  if (track?.source === "youtube") return "YouTube · video/playlist embebido";
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
  const [imageFailed, setImageFailed] = useState(false);
  const artwork =
    track?.artworkUrl ||
    (track?.cover?.startsWith("http") ? track.cover : undefined);

  if (artwork && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artwork}
        alt={title}
        onError={() => setImageFailed(true)}
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
        "neon-control-button inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition",
        active
          ? "is-active bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/25"
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
        `${cls} neon-metal-button rainbow-edge inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition`,
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
    <header className="flex h-[58px] shrink-0 items-center gap-4 border-b border-emerald-400/20 bg-[#03090a]/95 px-4 text-white">
      <div className="flex w-[300px] shrink-0 items-center gap-3">
        <div className="neon-pulse flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00ffa3,#00e5ff,#a855f7)] text-slate-950 shadow-md shadow-emerald-500/20">
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

      <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-emerald-400/20 bg-black/35 px-4 shadow-inner shadow-black/30 ring-1 ring-white/5 max-md:hidden">
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
          className="neon-accent-button rounded-full px-3 py-1.5 text-[10px] font-black disabled:opacity-50"
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

function Sidebar({ tracks, collapsed, onToggleCollapsed }: { tracks: EduMusicTrack[]; collapsed: boolean; onToggleCollapsed: () => void }) {
  const music = useEduAIMusic();
  const [playlistFilter, setPlaylistFilter] = useState("");
  const filteredPlaylists = music.playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(playlistFilter.toLowerCase()),
  );

  if (collapsed) {
    return (
      <aside className="neon-collapsed-sidebar flex min-h-0 flex-col gap-2 border-r border-emerald-400/15 bg-[#03090a]/90 p-2 text-white">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="neon-metal-button collapsed-icon-button rainbow-edge inline-flex rounded-2xl text-slate-950"
          title="Abrir biblioteca"
          aria-label="Abrir biblioteca"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="mt-2 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => music.setView(item.id)}
                className={cn(
                  "collapsed-icon-button neon-control-button inline-flex rounded-2xl text-slate-300",
                  music.view === item.id && "is-active",
                )}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col items-center gap-2 rounded-2xl border border-emerald-400/15 bg-black/35 p-2">
          <Cover track={music.currentTrack} size="sm" />
          <PlayButton size="sm" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-emerald-400/15 bg-[#03090a]/90 p-2.5 text-white">
      <div className="shrink-0 neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-white">Tu biblioteca</p>
            <p className="text-[11px] text-slate-400">Canciones y grupos</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="neon-control-button inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-200"
              title="Contraer biblioteca"
              aria-label="Contraer biblioteca"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => music.setCreateOpen((value) => !value)}
              className="neon-metal-button inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black text-slate-950"
            >
              <Plus className="h-3.5 w-3.5" /> Crear
            </button>
          </div>
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
        <section className="flex min-h-0 flex-[0.8] flex-col neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
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

        <section className="flex min-h-0 flex-1 flex-col neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
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
          className="neon-accent-button rainbow-edge inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-black transition hover:bg-emerald-300"
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

function getDjReels(track: EduMusicTrack): EduMusicDjReel[] {
  const reels = Array.isArray(track.djReels) ? track.djReels.filter((reel) => reel.videoId) : [];
  if (reels.length) return reels;
  if (!track.youtubeVideoId) return [];
  return [
    {
      videoId: track.youtubeVideoId,
      title: track.title,
      channelTitle: track.artist,
      thumbnail: track.videoThumbnail || track.artworkUrl,
      embedUrl: track.videoEmbedUrl || `https://www.youtube.com/embed/${track.youtubeVideoId}`,
      externalUrl: `https://www.youtube.com/watch?v=${track.youtubeVideoId}`,
      score: track.djReelMatchScore || 0,
      matchReason: track.djReelMatchReason || "video visual asociado",
    },
  ];
}

function DjReelFallbackCard({ track, artwork }: { track: EduMusicTrack; artwork?: string }) {
  return (
    <div className="relative aspect-[9/16] h-[420px] max-h-[56vh] w-[238px] overflow-hidden rounded-[2.2rem] border border-emerald-400/20 bg-black shadow-2xl shadow-black/45 ring-1 ring-white/10 max-xl:h-[360px] max-xl:w-[205px]">
      {artwork ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artwork} alt={track.title} className="h-full w-full scale-110 object-cover opacity-85" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-emerald-400 via-cyan-500 to-slate-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-left">
        <p className="mb-2 w-fit rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-950">
          DJ 30s
        </p>
        <p className="line-clamp-2 text-sm font-black text-white">{track.title}</p>
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-300">{track.artist}</p>
      </div>
    </div>
  );
}

function getDjReelVisualUrl(videoId?: string) {
  if (!videoId) return "";
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    loop: "1",
    playlist: videoId,
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function DjReelCarousel3D({ track, artwork }: { track: EduMusicTrack; artwork?: string }) {
  const reels = useMemo(() => getDjReels(track).slice(0, 5), [track]);
  const { playing, setPlaying } = useEduAIMusic();
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 34 });

  const activeIndex = reels.length ? active % reels.length : 0;
  const activeReel = reels[activeIndex];
  const previousIndex = reels.length > 2 ? (activeIndex - 1 + reels.length) % reels.length : null;
  const nextIndex = reels.length > 1 ? (activeIndex + 1) % reels.length : null;
  const fallbackArtwork = artwork || activeReel?.thumbnail;

  const goClockwise = useCallback(() => {
    if (reels.length < 2) return;
    setDirection(1);
    setActive((value) => (value + 1) % reels.length);
  }, [reels.length]);

  const goCounterClockwise = useCallback(() => {
    if (reels.length < 2) return;
    setDirection(-1);
    setActive((value) => (value - 1 + reels.length) % reels.length);
  }, [reels.length]);

  const selectReel = useCallback(
    (index: number) => {
      if (reels.length < 2 || index === activeIndex) return;
      const clockwiseDistance = (index - activeIndex + reels.length) % reels.length;
      const counterDistance = (activeIndex - index + reels.length) % reels.length;
      setDirection(clockwiseDistance <= counterDistance ? 1 : -1);
      setActive(index);
    },
    [activeIndex, reels.length],
  );

  useEffect(() => {
    setActive(0);
    setHovered(false);
    setDirection(1);
    setTilt({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 34 });
  }, [track.id]);

  useEffect(() => {
    if (!playing || reels.length < 2 || hovered) return;
    const timer = window.setInterval(goClockwise, 7800);
    return () => window.clearInterval(timer);
  }, [goClockwise, hovered, playing, reels.length]);

  if (!reels.length) return <DjReelFallbackCard track={track} artwork={artwork} />;

  const renderSideCard = (index: number | null, side: "left" | "right") => {
    if (index === null) return null;
    const reel = reels[index];
    const thumb = reel.thumbnail || artwork;
    const sideMultiplier = side === "right" ? 1 : -1;

    return (
      <motion.button
        key={`${side}-${reel.videoId}-${index}`}
        type="button"
        onClick={() => (side === "right" ? selectReel(index) : goCounterClockwise())}
        className="absolute left-1/2 top-1/2 hidden aspect-[9/16] h-[310px] w-[174px] overflow-hidden rounded-[1.9rem] border border-emerald-300/16 bg-black/85 text-left shadow-2xl shadow-black/40 ring-1 ring-white/10 lg:block max-xl:h-[268px] max-xl:w-[151px]"
        initial={false}
        animate={{
          x: sideMultiplier * 205 - 87,
          y: "-50%",
          rotateY: sideMultiplier * -34,
          rotateZ: sideMultiplier * -2.5,
          scale: 0.82,
          opacity: 0.72,
          filter: "saturate(0.92) brightness(0.82)",
        }}
        whileHover={{
          x: sideMultiplier * 218 - 87,
          rotateY: sideMultiplier * -18,
          rotateZ: sideMultiplier * -1,
          scale: 0.9,
          opacity: 0.95,
          filter: "saturate(1.08) brightness(1)",
        }}
        transition={{ type: "spring", stiffness: 210, damping: 26 }}
        style={{ transformStyle: "preserve-3d", zIndex: 12 }}
        aria-label={side === "right" ? "Siguiente reel visual" : "Reel visual anterior"}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={reel.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-emerald-400/70 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-emerald-200">
            {side === "right" ? "Siguiente" : "Anterior"}
          </p>
          <p className="mt-1 line-clamp-1 text-[11px] font-black text-white/90">{reel.title || track.title}</p>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="relative flex h-[500px] w-full max-w-[660px] items-center justify-center overflow-visible [perspective:1150px] max-xl:h-[430px] max-xl:max-w-[560px] max-sm:h-[380px] max-sm:max-w-[330px]">
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.2),transparent_64%)] blur-2xl max-xl:h-[320px] max-xl:w-[320px]"
        animate={{ scale: playing ? [0.96, 1.04, 0.96] : 1, opacity: playing ? [0.62, 0.9, 0.62] : 0.55 }}
        transition={{ duration: 4.8, repeat: playing ? Infinity : 0, ease: "easeInOut" }}
      />

      {renderSideCard(previousIndex, "left")}
      {renderSideCard(nextIndex, "right")}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={activeReel.videoId}
          role="button"
          tabIndex={0}
          onMouseEnter={() => setHovered(true)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const px = (event.clientX - rect.left) / rect.width;
            const py = (event.clientY - rect.top) / rect.height;
            setTilt({
              rotateX: (0.5 - py) * 8,
              rotateY: (px - 0.5) * 11,
              glowX: Math.max(0, Math.min(100, px * 100)),
              glowY: Math.max(0, Math.min(100, py * 100)),
            });
          }}
          onMouseLeave={() => {
            setHovered(false);
            setTilt({ rotateX: 0, rotateY: 0, glowX: 50, glowY: 34 });
          }}
          onClick={() => {
            if (playing && reels.length > 1) goClockwise();
            else setPlaying((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (playing && reels.length > 1) goClockwise();
              else setPlaying((value) => !value);
            }
          }}
          custom={direction}
          initial={{ opacity: 0, x: 120 * direction, rotateY: -42 * direction, scale: 0.9 }}
          animate={{
            opacity: 1,
            x: 0,
            rotateX: tilt.rotateX,
            rotateY: tilt.rotateY,
            scale: hovered ? 1.025 : 1,
          }}
          exit={{ opacity: 0, x: -120 * direction, rotateY: 42 * direction, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 230, damping: 27, mass: 0.72 }}
          className="group relative z-30 aspect-[9/16] h-[470px] max-h-[62vh] w-[264px] cursor-pointer overflow-hidden rounded-[2.4rem] border border-emerald-300/35 bg-black shadow-[0_32px_85px_rgba(0,0,0,0.62)] ring-1 ring-white/10 will-change-transform max-xl:h-[405px] max-xl:w-[228px] max-sm:h-[345px] max-sm:w-[194px]"
          style={{ transformStyle: "preserve-3d" }}
          aria-label="Reel visual 3D: mueve el mouse para inclinarlo"
        >
          {fallbackArtwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackArtwork}
              alt={track.title}
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
            />
          ) : null}

          <div className="absolute inset-0 overflow-hidden bg-black">
            <iframe
              key={activeReel.videoId}
              title={`Visual DJ 30s ${track.title}`}
              src={getDjReelVisualUrl(activeReel.videoId)}
              className="pointer-events-none absolute left-1/2 top-1/2 h-full w-[178%] -translate-x-1/2 -translate-y-1/2 border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/95 text-slate-950 shadow-2xl shadow-emerald-500/25 ring-1 ring-white/40">
              {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" />}
            </div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen transition-opacity duration-200 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at ${tilt.glowX}% ${tilt.glowY}%, rgba(52,211,153,0.28), rgba(14,165,233,0.12) 26%, transparent 54%)`,
              transform: "translateZ(30px)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[2.4rem] border border-white/10 shadow-[inset_0_0_28px_rgba(16,185,129,0.12)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/42 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/48 to-transparent p-4 text-left" style={{ transform: "translateZ(36px)" }}>
            <p className="mb-2 w-fit rounded-full bg-emerald-400 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg shadow-emerald-500/25">
              Visual YouTube · Audio iTunes
            </p>
            <p className="line-clamp-1 text-base font-black text-white drop-shadow">{track.title}</p>
            <p className="line-clamp-1 text-xs font-semibold text-slate-200">{track.artist}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {reels.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur">
          {reels.length > 2 && (
            <button
              type="button"
              onClick={goCounterClockwise}
              className="rounded-full px-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:text-emerald-200"
            >
              ←
            </button>
          )}
          {reels.map((reel, index) => (
            <button
              key={reel.videoId}
              type="button"
              onClick={() => selectReel(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex ? "w-7 bg-emerald-300 shadow shadow-emerald-300/40" : "w-1.5 bg-white/35 hover:bg-white/75",
              )}
              aria-label={`Cambiar al reel ${index + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={goClockwise}
            className="rounded-full px-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 transition hover:text-emerald-200"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}


function YouTubeDirectPlayer({ track, artwork }: { track: EduMusicTrack; artwork?: string }) {
  const music = useEduAIMusic();
  const thumb = artwork || getYouTubeThumb(track);
  const embedUrl = getYouTubeDirectEmbedUrl(track, music.playing);
  const playlistId = (track as EduMusicTrack & { youtubePlaylistId?: string }).youtubePlaylistId;

  if (!music.playing || !embedUrl) {
    return (
      <button
        type="button"
        onClick={() => music.setPlaying(true)}
        className="neon-player-frame group relative h-full min-h-[420px] w-full overflow-hidden bg-black text-left transition hover:scale-[1.005] hover:border-emerald-300/50"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={track.title} className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-red-500 via-slate-950 to-emerald-500" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.78))]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl shadow-red-500/30 transition group-hover:scale-110">
            <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
          </span>
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
            Reproducir YouTube aquí
          </p>
          <h4 className="mt-1 line-clamp-2 max-w-xl text-xl font-black text-white">{track.title}</h4>
          <p className="mt-1 max-w-xl truncate text-sm font-semibold text-slate-200">{track.artist}</p>
          {playlistId && <p className="mt-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-slate-200">Incluye lista / radio de YouTube</p>}
        </div>
      </button>
    );
  }

  return (
    <div className="neon-player-frame overflow-hidden bg-black">
      <iframe
        key={`${track.id}-${music.playing ? "play" : "pause"}`}
        src={embedUrl}
        title={`${track.title} - YouTube`}
        className="h-full min-h-[420px] w-full border-0 bg-black"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="eager"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/70 px-4 py-2 text-left">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white">{track.title}</p>
          <p className="truncate text-[11px] text-slate-400">{playlistId ? "YouTube playlist / radio" : "YouTube video"}</p>
        </div>
        {track.externalUrl && (
          <a href={track.externalUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-emerald-200 hover:bg-emerald-400/20">
            Abrir YouTube
          </a>
        )}
      </div>
    </div>
  );
}

function CurrentTrackArtwork({ track }: { track: EduMusicTrack }) {
  const artwork = track.artworkUrl || track.videoThumbnail || (track.cover?.startsWith("http") ? track.cover : undefined);

  if (track.source === "itunes") {
    return <DjReelCarousel3D track={track} artwork={artwork} />;
  }

  if (track.source === "youtube") {
    return <YouTubeDirectPlayer track={track} artwork={artwork} />;
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

function MainPanel({ tracks }: { tracks: EduMusicTrack[] }) {
  const music = useEduAIMusic();
  const track = music.currentTrack;
  const playlist = music.selectedPlaylist;
  const embedTrack = isEmbedTrack(track);
  const embedUrl = getEmbedUrl(track);

  return (
    <main className="flex min-h-0 min-w-0 flex-col bg-transparent p-2.5 text-white">
      <section className="neon-panel flex min-h-0 flex-1 flex-col rounded-3xl border border-emerald-400/20 bg-[#07100f]/90 p-4 shadow-lg shadow-black/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Reproductor central
            </p>
            <h2 className="truncate text-xl font-black text-white">
              {playlist.name}
            </h2>
            <p className="truncate text-xs text-slate-400">
              El video/canción actual queda arriba y las playlists aparecen al centro.
            </p>
          </div>
          <button
            type="button"
            onClick={() => music.playPlaylist(playlist.id)}
            className="neon-accent-button rainbow-edge inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-black transition hover:bg-emerald-300"
          >
            <Play className="h-4 w-4" fill="currentColor" /> Reproducir lista
          </button>
        </div>

        <div className={cn("neon-stage flex min-h-0 flex-1 items-center justify-center rounded-[2rem] border border-emerald-400/20 p-3", track.source === "youtube" && "p-4")}>
          {embedTrack ? (
            <div className="w-full max-w-4xl rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-4">
              <div className="mx-auto max-w-xl">
                <p className="neon-chip mx-auto mb-2 w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {playbackKind(track)}
                </p>
                <h3 className="neon-title line-clamp-2 text-xl font-black leading-tight text-white max-xl:text-lg">
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

              {track.source !== "youtube" && (
              <>
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
              </>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "neon-current-card w-full rounded-[1.8rem] border border-emerald-400/20 bg-black/20 p-3 text-center shadow-xl shadow-black/25 backdrop-blur-xl max-xl:p-3",
                track.source === "youtube" ? "h-full max-w-none" : track.source === "itunes" ? "max-w-4xl" : "max-w-2xl",
              )}
            >
              <div className={cn("flex justify-center", track.source === "youtube" && "h-full min-h-[420px]")}>
                <CurrentTrackArtwork track={track} />
              </div>

              {track.source !== "youtube" && (
              <div className="mx-auto mt-4 max-w-lg">
                <p className="neon-chip mx-auto mb-2 w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {playbackKind(track)}
                </p>
                <h3 className="neon-title line-clamp-2 text-xl font-black leading-tight text-white max-xl:text-lg">
                  {track.title}
                </h3>
                <p className="mt-1 truncate text-sm font-semibold text-slate-300">
                  {track.artist}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {track.album || "Sin álbum"} · {track.duration || "--:--"}
                </p>
              </div>
              )}

              {track.source !== "youtube" && (
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
              )}

              {track.source === "youtube" && (
                <p className="mt-3 text-xs font-semibold text-emerald-200/90">
                  YouTube se reproduce en el reproductor central visible. Si el navegador bloquea autoplay, presiona play dentro del video.
                </p>
              )}
              {track.source === "itunes" && (
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/80">
                  Reel visual YouTube + audio iTunes estable
                </p>
              )}
              {track.source === "radio" && (
                <p className="mt-3 text-xs font-semibold text-emerald-200/90">
                  Radio online en vivo. Algunas emisoras pueden tardar unos segundos en iniciar según su servidor.
                </p>
              )}

              {track.source !== "youtube" && (
              <>
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
              </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


function SideMusicHub() {
  const music = useEduAIMusic();
  const [spotifyOpen, setSpotifyOpen] = useState(true);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [activeSpotify, setActiveSpotify] = useState(0);
  const featuredPlaylists = music.playlists.filter((playlist) => playlist.trackIds.length > 0).slice(0, 8);
  const focusTracks = music.allTracks
    .filter((track) => {
      if (track.id === music.currentTrack.id) return false;
      if (track.source === "radio" || track.source === "external") return false;
      const text = `${track.title} ${track.artist} ${track.album || ""} ${track.mood || ""} ${track.tags?.join(" ") || ""}`.toLowerCase();
      return (
        ["focus", "calm", "reading", "deep", "creative", "classical"].includes(track.mood) ||
        text.includes("focus") ||
        text.includes("lofi") ||
        text.includes("study") ||
        text.includes("instrumental") ||
        text.includes("aula") ||
        text.includes("calm")
      );
    })
    .slice(0, 8);

  const activeEmbed = SPOTIFY_EMBEDS[activeSpotify] || SPOTIFY_EMBEDS[0];

  return (
    <section className="neon-panel neon-side-hub shrink-0 rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">Playlists / foco</p>
          <p className="truncate text-[10px] text-slate-400">Todo queda plegable para no tapar el video central.</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="neon-compact-card overflow-hidden rounded-2xl border border-emerald-400/15 bg-black/35 p-2">
          <button
            type="button"
            onClick={() => setSpotifyOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Spotify visual · {SPOTIFY_EMBEDS.length} listas</span>
            <span className="neon-metal-button rounded-full px-2 py-0.5 text-[9px] font-black text-slate-950">{spotifyOpen ? "cerrar" : "abrir"}</span>
          </button>
          {spotifyOpen && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {SPOTIFY_EMBEDS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSpotify(index)}
                    className={cn(
                      "neon-control-button rounded-xl px-2 py-1.5 text-left text-[9px] font-black text-slate-200",
                      index === activeSpotify && "is-active",
                    )}
                  >
                    <span className="block truncate">{item.title}</span>
                  </button>
                ))}
              </div>
              <iframe
                data-testid="embed-iframe"
                title={activeEmbed.title}
                style={{ borderRadius: 14 }}
                src={activeEmbed.src}
                width="100%"
                height="96"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="block border-0"
              />
            </div>
          )}
        </div>

        <div className="neon-compact-card rounded-2xl border border-emerald-400/15 bg-black/25 p-2">
          <button
            type="button"
            onClick={() => setPlaylistsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Listas EduAI · {featuredPlaylists.length}</span>
            <span className="neon-control-button rounded-full px-2 py-1 text-[9px] font-black text-slate-200">{playlistsOpen ? "ocultar" : "ver"}</span>
          </button>
          {playlistsOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {featuredPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => {
                    music.setSelectedPlaylistId(playlist.id);
                    music.setView("playlists");
                    music.playPlaylist(playlist.id);
                  }}
                  className="neon-compact-card group flex min-w-0 items-center gap-2 rounded-2xl border border-emerald-400/15 bg-white/6 p-2 text-left"
                >
                  <Cover label={playlist.name} cover={playlist.cover} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-black text-white">{playlist.name}</span>
                    <span className="block truncate text-[8px] text-slate-500">{playlist.trackIds.length} canciones</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-fuchsia-300/15 bg-black/25 p-2">
          <button
            type="button"
            onClick={() => setFocusOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-200">Instrumental / foco · {focusTracks.length}</span>
            <span className="neon-control-button rounded-full px-2 py-1 text-[9px] font-black text-slate-200">{focusOpen ? "cerrar" : "abrir"}</span>
          </button>
          {focusOpen && (
            <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
              {focusTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => music.playTrack(track, focusTracks)}
                  className="neon-compact-card group flex w-full items-center gap-2 rounded-xl border border-emerald-400/15 bg-white/6 p-1.5 text-left"
                >
                  <Cover track={track} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-black text-white">{track.title}</span>
                    <span className="block truncate text-[8px] text-slate-500">{track.artist}</span>
                  </span>
                  <span className="neon-metal-button flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-950">
                    <Play className="h-3 w-3 translate-x-0.5" fill="currentColor" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RightPanel() {
  const music = useEduAIMusic();
  const [youtubeQuery, setYoutubeQuery] = useState("música para estudiar sin letra");
  const related = music.allTracks
    .filter((track) => track.mood === music.currentTrack.mood && track.id !== music.currentTrack.id)
    .slice(0, 6);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-y-auto border-l border-emerald-400/15 bg-[#03090a]/90 p-2.5 text-white">
      <section className="shrink-0 neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
        <p className="text-sm font-black text-white">Buscar canciones</p>
        <p className="mt-1 text-xs text-slate-400">
          Busca canciones completas, previews DJ o pega un link de YouTube/playlist/radio para reproducirlo al centro.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={music.onlineQuery}
            onChange={(e) => music.setOnlineQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void music.searchOnline()}
            placeholder="daddy, link YouTube, playlist..."
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
          />
          <button
            type="button"
            onClick={() => void music.searchOnline()}
            disabled={music.onlineLoading}
            className="neon-accent-button rounded-full px-4 py-2 text-xs font-black disabled:opacity-50"
          >
            {music.onlineLoading ? "..." : "Buscar"}
          </button>
        </div>
        {music.onlineError && <p className="mt-2 text-xs font-bold text-rose-300">{music.onlineError}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wide">
          {[
            { id: "full", label: "Completas" },
            { id: "preview", label: "DJ 30s" },
            { id: "all", label: "Todo" },
            { id: "youtube", label: "YouTube" },
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
          DJ 30s usa un solo audio estable: iTunes preview. Si hay video, se muestra como visual silenciado; si falla o no existe, queda la imagen de fondo con audio.
        </p>
      </section>

      <section className="flex min-h-0 flex-[0.65] flex-col neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
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


      <section className="shrink-0 neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
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

      <SideMusicHub />

      <section className="shrink-0 neon-panel rounded-2xl border border-emerald-400/20 bg-[#07100f]/90 p-3">
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

function BottomPlayer() {
  const music = useEduAIMusic();
  const duration = music.durationSeconds || parseDuration(music.currentTrack.duration);
  const progress = duration ? Math.min(100, (music.currentTime / duration) * 100) : 0;
  const bars = music.audioLevels?.length ? music.audioLevels : Array.from({ length: 36 }, () => 0.1);

  return (
    <footer className="neon-bottom-visualizer neon-single-eq-footer relative flex h-[96px] shrink-0 items-center gap-4 border-t border-emerald-400/20 bg-[#03090a]/95 px-4 text-white">
      <div className="neon-keyboard-line top" aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-3" style={{ width: 330 }}>
        <Cover track={music.currentTrack} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{music.currentTrack.title}</p>
          <p className="truncate text-xs text-slate-400">{music.currentTrack.artist} · {sourceLabel(music.currentTrack.source)}</p>
        </div>
        <button
          type="button"
          onClick={() => music.toggleLike(music.currentTrack.id)}
          className={cn("neon-control-button flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-emerald-300", music.liked.has(music.currentTrack.id) && "is-active text-emerald-300")}
        >
          <Heart className="h-4 w-4" fill={music.liked.has(music.currentTrack.id) ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="neon-visualizer-bars mx-auto" aria-hidden="true">
          {bars.map((level, index) => {
            const height = Math.max(6, Math.min(52, Math.round(7 + level * 48)));
            const hue = (index * 17 + Math.round((music.currentTime || 0) * 24)) % 360;
            return (
              <span
                key={index}
                style={{
                  "--eq-height": `${height}px`,
                  "--eq-opacity": `${0.52 + Math.min(0.48, level * 0.5)}`,
                  "--eq-a": `hsl(${hue} 100% 62%)`,
                  "--eq-b": `hsl(${(hue + 82) % 360} 100% 64%)`,
                  "--eq-c": `hsl(${(hue + 154) % 360} 100% 58%)`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <span className="w-9 text-right">{formatSeconds(music.currentTime)}</span>
          <button type="button" onClick={() => music.setPlaying((value) => !value)} className="neon-metal-button rainbow-edge inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-950">
            {music.playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" fill="currentColor" />}
          </button>
          <div className="neon-progress-track flex-1" style={{ "--eduai-progress": `${progress}%` } as React.CSSProperties} />
          <span className="w-9">{formatSeconds(duration)}</span>
        </div>
      </div>

      <div className="hidden items-center justify-end gap-3 pr-14 xl:flex" style={{ width: 300 }}>
        <Volume2 className="h-4 w-4 text-cyan-200" />
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
  const duration = music.durationSeconds || parseDuration(music.currentTrack.duration);
  const progress = duration ? Math.min(100, (music.currentTime / duration) * 100) : 0;

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
        <input
          type="range"
          min="0"
          max={Math.max(1, duration)}
          step="1"
          value={Math.min(music.currentTime, Math.max(1, duration))}
          onChange={(e) => music.seekTo(Number(e.target.value))}
          className="h-1 min-w-0 flex-1 accent-emerald-400"
          style={{ background: `linear-gradient(90deg,#00e5ff 0%,#2563ff ${Math.max(6, progress * 0.28)}%,#a855f7 ${Math.max(8, progress * 0.55)}%,#ff2d75 ${Math.max(10, progress * 0.78)}%,#00ffa3 ${progress}%,rgba(255,255,255,.18) ${progress}%)` }}
          aria-label="Progreso"
        />
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
  const setPendingTrackId = music.setPendingTrackId;
  const [libraryOpen, setLibraryOpen] = useState(true);

  useEffect(() => {
    if (mode === "page") setPendingTrackId(null);
  }, [mode, setPendingTrackId]);

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
    <div className="eduai-music-neon h-screen min-h-[680px] overflow-hidden bg-[#020403] text-white">
      <NeonGamingSkin />
      <div className="flex h-full flex-col">
        <TopBar />
        <div
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateColumns: libraryOpen ? "300px minmax(0, 1fr) 340px" : "74px minmax(0, 1fr) 340px" }}
        >
          <Sidebar tracks={tracksForMain} collapsed={!libraryOpen} onToggleCollapsed={() => setLibraryOpen((value) => !value)} />
          <MainPanel tracks={tracksForMain} />
          <RightPanel />
        </div>
        <BottomPlayer />
      </div>
      <AddToPlaylistBar />
    </div>
  );
}
