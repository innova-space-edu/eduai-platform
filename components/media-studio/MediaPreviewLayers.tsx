"use client";

import { useEffect, useRef } from "react";
import { resolveClipFrame } from "@/lib/media-studio/keyframes";
import type { TimelineClip } from "@/lib/media-studio/types";

function visualStyle(clip: TimelineClip, playhead: number): React.CSSProperties {
  const frame = resolveClipFrame(clip, playhead);
  return {
    transform: `translate(calc(-50% + ${frame.transform.x}px), calc(-50% + ${frame.transform.y}px)) scale(${frame.transform.scale}) rotate(${frame.transform.rotation}deg)`,
    opacity: frame.transform.opacity,
    filter: `brightness(${frame.style.brightness}) contrast(${frame.style.contrast}) saturate(${frame.style.saturation}) blur(${frame.style.blur}px)`,
    borderRadius: `${frame.style.borderRadius}px`,
  };
}

export function MediaVisualLayer({ clip, playhead, playing }: { clip: TimelineClip; playhead: number; playing: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frame = resolveClipFrame(clip, playhead);
  const localTime = Math.max(0, (playhead - clip.start) * frame.playbackRate + clip.trimStart);

  useEffect(() => {
    if (clip.type !== "video") return;
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - localTime) > 0.2) video.currentTime = localTime;
    video.playbackRate = Math.max(0.25, Math.min(4, frame.playbackRate));
    video.volume = clip.muted ? 0 : Math.max(0, Math.min(1, frame.volume));
    if (playing) video.play().catch(() => undefined);
    else video.pause();
  }, [clip.type, clip.muted, localTime, playing, frame.playbackRate, frame.volume]);

  if (clip.type === "video") {
    return <video ref={videoRef} src={clip.sourceUrl} playsInline muted={clip.muted} className="absolute left-1/2 top-1/2 max-h-full max-w-full object-contain" style={visualStyle(clip, playhead)} />;
  }

  if (clip.type === "image") {
    return <img src={clip.sourceUrl} alt="" className="absolute left-1/2 top-1/2 max-h-full max-w-full object-contain" style={visualStyle(clip, playhead)} />;
  }

  return (
    <div
      className="absolute left-1/2 top-1/2 max-w-[90%] whitespace-pre-wrap px-3 py-1.5 text-center font-bold"
      style={{
        ...visualStyle(clip, playhead),
        color: clip.textColor,
        fontSize: `${Math.max(10, (clip.fontSize || 56) * 0.55)}px`,
        background: clip.backgroundColor,
      }}
    >
      {clip.text}
    </div>
  );
}

export function MediaAudioLayer({ clip, playhead, playing, trackMuted }: { clip: TimelineClip; playhead: number; playing: boolean; trackMuted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const frame = resolveClipFrame(clip, playhead);
  const localTime = Math.max(0, (playhead - clip.start) * frame.playbackRate + clip.trimStart);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - localTime) > 0.25) audio.currentTime = localTime;
    audio.playbackRate = Math.max(0.25, Math.min(4, frame.playbackRate));
    audio.volume = clip.muted || trackMuted ? 0 : Math.max(0, Math.min(1, frame.volume));
    if (playing) audio.play().catch(() => undefined);
    else audio.pause();
  }, [localTime, playing, clip.muted, trackMuted, frame.playbackRate, frame.volume]);

  return <audio ref={ref} src={clip.sourceUrl} preload="auto" />;
}
