"use client";

import { useEffect, useRef } from "react";

type Props = {
  active: boolean;
  currentTime: number;
  lighting: "dynamic" | "calm" | "off";
};

// Decorative playback-clock animation, not a frequency analyser. Keep it out
// of the audio graph: cross-origin players must never be rerouted or muted.
export function MusicParticleOrb({ active, currentTime, lighting }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackRef = useRef({ active, currentTime, sampledAt: 0 });

  useEffect(() => {
    playbackRef.current = { active, currentTime, sampledAt: performance.now() };
  }, [active, currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let lastDraw = -Infinity;
    let visible = true;
    let size = 48;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const palette = ["#3776ff", "#12eaff", "#39f5a3", "#a5ff39"];
    const tau = Math.PI * 2;

    const draw = (now: number) => {
      ctx.clearRect(0, 0, size, size);
      const reduced = motion.matches || lighting === "off";
      const state = playbackRef.current;
      const elapsed = state.active ? Math.min(1, (now - state.sampledAt) / 1000) : 0;
      const clock = state.currentTime + elapsed;
      const time = reduced ? 0 : now / 1000;
      const turn = time * (state.active ? .36 : .16);
      const pulse = reduced ? 0 : state.active ? .035 * (1 + Math.sin(clock * tau * 2)) : .01 * Math.sin(time);
      const radius = size * (.32 + pulse);
      const center = size / 2;
      const glow = ctx.createRadialGradient(center, center, 0, center, center, size * .49);
      glow.addColorStop(0, "#12eaff20");
      glow.addColorStop(.6, "#126aff14");
      glow.addColorStop(1, "#12eaff00");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Rotating latitude waves give the sphere depth without WebGL or a
      // large scene library. Back-facing points are dimmer and smaller.
      for (let ring = 1; ring < 19; ring++) {
        const latitude = Math.PI * ring / 19;
        const color = palette[Math.floor(ring / 5) % palette.length];
        let previous: { x: number; y: number; front: boolean } | null = null;
        for (let point = 0; point <= 38; point++) {
          const longitude = tau * point / 38;
          const ripple = reduced ? 0 : Math.sin(longitude * 5 + latitude * 4 - time * 2.1) * (state.active ? .09 : .035);
          const r = radius * (1 + ripple);
          const x = Math.sin(latitude) * Math.cos(longitude + turn);
          const y = Math.cos(latitude);
          const z = Math.sin(latitude) * Math.sin(longitude + turn);
          const tiltedY = y * .92 - z * .39;
          const depth = y * .39 + z * .92;
          const scale = 1 + depth * .12;
          const px = center + x * r * scale;
          const py = center + tiltedY * r * scale;
          const front = depth > 0;
          ctx.strokeStyle = color;
          ctx.globalAlpha = front ? .30 : .07;
          ctx.lineWidth = .35;
          if (previous && previous.front === front) {
            ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(px, py); ctx.stroke();
          }
          if (point < 38) {
            ctx.globalAlpha = front ? .65 + depth * .35 : .18;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(px, py, front ? .55 + depth * .25 : .35, 0, tau); ctx.fill();
          }
          previous = { x: px, y: py, front };
        }
      }
      for (let i = 0; i < 18; i++) {
        const angle = i * 2.39996 + turn * .6;
        const drift = Math.sin(time * .7 + i) * .025;
        const r = size * (.39 + (i % 3) * .025 + drift);
        ctx.fillStyle = palette[i % palette.length];
        ctx.globalAlpha = .3 + .4 * (1 + Math.sin(time + i)) / 2;
        ctx.beginPath(); ctx.arc(center + Math.cos(angle) * r, center + Math.sin(angle) * r * .88, .45, 0, tau); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (now - lastDraw >= (lighting === "calm" ? 100 : 1000 / 30)) {
        draw(now);
        lastDraw = now;
      }
      if (!motion.matches && lighting !== "off") frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (visible && !document.hidden) {
        lastDraw = -Infinity;
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      size = Math.max(1, canvas.getBoundingClientRect().width);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      resume();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", resume);
    motion.addEventListener("change", resume);
    resize();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", resume);
    };
  }, [lighting]);

  return <canvas ref={canvasRef} aria-hidden="true" className="music-particle-orb h-12 w-12 shrink-0" style={{ pointerEvents: "none" }} />;
}
