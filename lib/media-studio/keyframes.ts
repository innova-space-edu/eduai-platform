import type { ClipKeyframe, ClipKeyframeValues, TimelineClip } from "./types";

const numericKeys = [
  "x", "y", "scale", "rotation", "opacity", "brightness", "contrast", "saturation", "blur", "borderRadius", "volume", "playbackRate",
] as const;

type NumericKey = (typeof numericKeys)[number];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function eased(t: number, easing: ClipKeyframe["easing"]) {
  const x = clamp(t);
  if (easing === "ease-in") return x * x;
  if (easing === "ease-out") return 1 - (1 - x) * (1 - x);
  if (easing === "ease-in-out") return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  return x;
}

function baseValues(clip: TimelineClip): Record<NumericKey, number> {
  return {
    x: clip.transform.x,
    y: clip.transform.y,
    scale: clip.transform.scale,
    rotation: clip.transform.rotation,
    opacity: clip.transform.opacity,
    brightness: clip.style.brightness,
    contrast: clip.style.contrast,
    saturation: clip.style.saturation,
    blur: clip.style.blur,
    borderRadius: clip.style.borderRadius,
    volume: clip.volume,
    playbackRate: clip.playbackRate,
  };
}

function applyValues(target: Record<NumericKey, number>, values?: ClipKeyframeValues) {
  if (!values) return;
  for (const key of numericKeys) {
    const value = values[key];
    if (typeof value === "number" && Number.isFinite(value)) target[key] = value;
  }
}

export function resolveClipFrame(clip: TimelineClip, playhead: number) {
  const local = clamp(playhead - clip.start, 0, clip.duration);
  const keyframes = [...(clip.keyframes || [])]
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);
  const values = baseValues(clip);

  if (keyframes.length) {
    const before = [...keyframes].reverse().find((item) => item.time <= local);
    const after = keyframes.find((item) => item.time >= local);

    if (before && after && before.id !== after.id && after.time > before.time) {
      const from = { ...values };
      applyValues(from, before.values);
      const to = { ...from };
      applyValues(to, after.values);
      const t = eased((local - before.time) / (after.time - before.time), after.easing);
      for (const key of numericKeys) values[key] = from[key] + (to[key] - from[key]) * t;
    } else {
      applyValues(values, before?.values || after?.values);
    }
  }

  const transitionIn = clip.transitionIn;
  if (transitionIn?.kind && transitionIn.kind !== "none" && transitionIn.duration > 0 && local < transitionIn.duration) {
    const t = clamp(local / transitionIn.duration);
    values.opacity *= t;
    if (transitionIn.kind === "slide-left") values.x += (1 - t) * 180;
    if (transitionIn.kind === "slide-right") values.x -= (1 - t) * 180;
    if (transitionIn.kind === "zoom") values.scale *= 0.72 + 0.28 * t;
  }

  const transitionOut = clip.transitionOut;
  const remaining = clip.duration - local;
  if (transitionOut?.kind && transitionOut.kind !== "none" && transitionOut.duration > 0 && remaining < transitionOut.duration) {
    const t = clamp(remaining / transitionOut.duration);
    values.opacity *= t;
    if (transitionOut.kind === "slide-left") values.x -= (1 - t) * 180;
    if (transitionOut.kind === "slide-right") values.x += (1 - t) * 180;
    if (transitionOut.kind === "zoom") values.scale *= 0.72 + 0.28 * t;
  }

  return {
    transform: { x: values.x, y: values.y, scale: values.scale, rotation: values.rotation, opacity: values.opacity },
    style: { brightness: values.brightness, contrast: values.contrast, saturation: values.saturation, blur: values.blur, borderRadius: values.borderRadius },
    volume: values.volume,
    playbackRate: values.playbackRate,
  };
}
