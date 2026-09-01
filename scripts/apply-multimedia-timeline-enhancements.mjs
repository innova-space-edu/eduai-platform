import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) throw new Error(`[multimedia-timeline] No se encontró ${relativePath}`);
  return fs.readFileSync(target, "utf8");
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(root, relativePath), source);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`[multimedia-timeline] No se encontró ${label}`);
  return source.replace(before, after);
}

const clientPath = "components/multimedia/MultimediaStudioV3Client.tsx";
let client = read(clientPath);

if (!client.includes("audioFadeFactor,")) {
  client = replaceRequired(
    client,
    `  createMediaClip,\n  createTextClip,`,
    `  audioFadeFactor,\n  createMediaClip,\n  createTextClip,`,
    "import audioFadeFactor",
  );
}

if (!client.includes('mode: "fade-in"')) {
  client = replaceRequired(
    client,
    `  | { mode: "trim-right"; clipId: string; pointerId: number; startX: number; originalDuration: number };`,
    `  | { mode: "trim-right"; clipId: string; pointerId: number; startX: number; originalDuration: number }\n  | { mode: "fade-in"; clipId: string; pointerId: number; startX: number; originalFade: number }\n  | { mode: "fade-out"; clipId: string; pointerId: number; startX: number; originalFade: number };`,
    "acciones de fade por puntero",
  );
}

client = client.replaceAll(
  `clamp(animated.volume * transition.opacity, 0, 1)`,
  `clamp(animated.volume * transition.opacity * audioFadeFactor(clip, playhead - clip.start), 0, 1)`,
);

if (!client.includes("const selectedTrack = project.tracks.find")) {
  client = replaceRequired(
    client,
    `  const selectedAsset = selectedClip?.assetId ? assetMap.get(selectedClip.assetId) : undefined;`,
    `  const selectedAsset = selectedClip?.assetId ? assetMap.get(selectedClip.assetId) : undefined;\n  const selectedTrack = selectedClip ? project.tracks.find((track) => track.id === selectedClip.trackId) : undefined;`,
    "pista seleccionada",
  );
}

const oldTrackBlock = `  function targetTrackId(asset: StudioAsset) {
    if (asset.kind === "video") return "video-main";
    if (asset.kind === "image") return "overlay-main";
    if (asset.kind === "music") return "music-main";
    return "audio-main";
  }

  function addAssetToTimeline(asset: StudioAsset, at = playhead) {
    if (!asset.url) { setNotice("El recurso no está disponible. Vuelve a enlazarlo."); return; }
    const trackId = targetTrackId(asset);
    const clip = createMediaClip(asset, trackId, Math.max(0, at));
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track),
    }));
    setSelectedClipId(clip.id);
    setPlayhead(clip.start);
    setNotice(\`${"${asset.name}"} agregado a ${"${fmt(clip.start)}"}.\`);
    if (asset.kind === "audio" || asset.kind === "music") void generateWaveform(asset);
  }`;

const newTrackBlock = `  function trackHasSpace(track: MultimediaProject["tracks"][number], start: number, clipDuration: number) {
    const end = start + clipDuration;
    return track.clips.every((clip) => end <= clip.start + 0.001 || start >= clip.start + clip.duration - 0.001);
  }

  function makeAudioTrack(kind: "audio" | "music", current: MultimediaProject) {
    const matching = current.tracks.filter((track) => track.kind === kind);
    const number = matching.length + 1;
    return {
      id: \`${"${kind}"}-${"${uid(\"track\")}"}\`,
      name: kind === "music" ? \`Música ${"${number}"}\` : \`Audio ${"${number}"}\`,
      kind,
      clips: [] as TimelineClip[],
    };
  }

  function resolveAudioTrack(current: MultimediaProject, kind: "audio" | "music", start: number, clipDuration: number) {
    const available = current.tracks.find((track) => track.kind === kind && trackHasSpace(track, start, clipDuration));
    if (available) return { trackId: available.id, newTrack: null };
    const newTrack = makeAudioTrack(kind, current);
    return { trackId: newTrack.id, newTrack };
  }

  function addAudioTrack(kind: "audio" | "music") {
    const track = makeAudioTrack(kind, projectRef.current);
    commitProject((current) => ({ ...current, tracks: [...current.tracks, track] }));
    setNotice(\`${"${track.name}"} creada. Los clips de esta pista se editan y mezclan por separado.\`);
  }

  function moveClipToTrack(clipId: string, targetTrackId: string) {
    const clip = projectRef.current.tracks.flatMap((track) => track.clips).find((item) => item.id === clipId);
    if (!clip || clip.trackId === targetTrackId) return;
    const target = projectRef.current.tracks.find((track) => track.id === targetTrackId);
    if (!target) return;
    commitProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => {
        const without = track.clips.filter((item) => item.id !== clipId);
        if (track.id === targetTrackId) return { ...track, clips: [...without, { ...clip, trackId: targetTrackId }] };
        return { ...track, clips: without };
      }),
    }));
    setNotice(\`Clip movido a ${"${target.name}"}.\`);
  }

  function addAssetToTimeline(asset: StudioAsset, at = playhead) {
    if (!asset.url) { setNotice("El recurso no está disponible. Vuelve a enlazarlo."); return; }
    const start = Math.max(0, at);
    let trackId = asset.kind === "video" ? "video-main" : asset.kind === "image" ? "overlay-main" : asset.kind === "music" ? "music-main" : "audio-main";
    let newTrack: MultimediaProject["tracks"][number] | null = null;

    if (asset.kind === "audio" || asset.kind === "music") {
      const resolved = resolveAudioTrack(projectRef.current, asset.kind, start, Math.max(0.5, asset.duration || 10));
      trackId = resolved.trackId;
      newTrack = resolved.newTrack;
    }

    const clip = createMediaClip(asset, trackId, start);
    commitProject((current) => {
      const tracks = newTrack ? [...current.tracks, newTrack] : current.tracks;
      return {
        ...current,
        tracks: tracks.map((track) => track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track),
      };
    });
    setSelectedClipId(clip.id);
    setPlayhead(clip.start);
    const trackName = (newTrack || projectRef.current.tracks.find((track) => track.id === trackId))?.name || trackId;
    setNotice(\`${"${asset.name}"} agregado a ${"${trackName}"} en ${"${fmt(clip.start)}"}.\`);
    if (asset.kind === "audio" || asset.kind === "music") void generateWaveform(asset);
  }`;

if (!client.includes("function resolveAudioTrack")) {
  client = replaceRequired(client, oldTrackBlock, newTrackBlock, "pistas de audio dinámicas");
}

client = client.replace(
  `const peaks = await buildWaveform(asset.url, 120);`,
  `const peaks = await buildWaveform(asset.url, 420);`,
);

if (!client.includes('pointerAction.mode === "fade-in"')) {
  client = replaceRequired(
    client,
    `    const maxSource = sourceMaxDuration(clip);\n    const wanted = Math.max(0.05, pointerAction.originalDuration + dxSeconds);`,
    `    if (pointerAction.mode === "fade-in") {\n      const value = clamp(pointerAction.originalFade + dxSeconds, 0, clip.duration / 2);\n      updateClip(clip.id, { audioFadeIn: value }, false);\n      return;\n    }\n\n    if (pointerAction.mode === "fade-out") {\n      const value = clamp(pointerAction.originalFade - dxSeconds, 0, clip.duration / 2);\n      updateClip(clip.id, { audioFadeOut: value }, false);\n      return;\n    }\n\n    const maxSource = sourceMaxDuration(clip);\n    const wanted = Math.max(0.05, pointerAction.originalDuration + dxSeconds);`,
    "edición de fades por arrastre",
  );
}

client = client.replace(
  `setNotice(pointerAction.mode === "move" ? "Clip movido." : "Recorte aplicado.");`,
  `setNotice(pointerAction.mode === "move" ? "Clip movido." : pointerAction.mode === "fade-in" || pointerAction.mode === "fade-out" ? "Fade de audio ajustado." : "Recorte aplicado.");`,
);

if (!client.includes(">+ Audio</button>")) {
  client = replaceRequired(
    client,
    `              <button onClick={() => setTimelineTail((value) => Math.min(120, value + 10))} title="Añadir espacio al final" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px]">+10s</button>`,
    `              <button onClick={() => addAudioTrack("audio")} title="Añadir pista de audio" className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[9px] text-violet-100">+ Audio</button>\n              <button onClick={() => addAudioTrack("music")} title="Añadir pista de música" className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-100">+ Música</button>\n              <button onClick={() => setTimelineTail((value) => Math.min(120, value + 10))} title="Añadir espacio al final" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px]">+10s</button>`,
    "botones de pistas de audio",
  );
}

client = client.replace(
  `Clic en la regla o pista = mover cabezal · Arrastra el centro del clip = mover · Arrastra los bordes = recortar · S = dividir.`,
  `Clic en la regla o pista = mover cabezal · Centro = mover · Bordes = recortar · Puntos turquesa = fade-in/fade-out · S = dividir.`,
);

client = client.replace(
  `<div className="relative min-h-[330px]" style={{ width: 118 + timelineWidth }}>`,
  `<div className="relative" style={{ width: 118 + timelineWidth, minHeight: 40 + project.tracks.length * 58 }}>`,
);

const oldWaveform = `{peaks && (track.kind === "audio" || track.kind === "music") ? <div className="pointer-events-none absolute inset-0 flex items-center gap-px px-3 opacity-55">{peaks.map((peak, index) => <span key={index} className="min-w-[1px] flex-1 rounded-full bg-current" style={{ height: \`${"${Math.max(7, peak * 86)}"}%\` }} />)}</div> : null}`;
const newWaveform = `{peaks && (track.kind === "audio" || track.kind === "music") ? <>\n                            <div className="pointer-events-none absolute inset-0 flex items-center gap-[1px] px-3 opacity-75">{peaks.map((peak, index) => <span key={index} className="min-w-px flex-1 bg-current" style={{ height: \`${"${Math.max(2, peak * 90)}"}%\`, borderRadius: "1px" }} />)}</div>\n                            <div className="pointer-events-none absolute bottom-0 left-0 top-0 bg-current opacity-10" style={{ width: \`${"${Math.min(50, ((clip.audioFadeIn || 0) / Math.max(0.05, clip.duration)) * 100)}"}%\`, clipPath: "polygon(0 100%, 100% 0, 100% 100%)" }} />\n                            <div className="pointer-events-none absolute bottom-0 right-0 top-0 bg-current opacity-10" style={{ width: \`${"${Math.min(50, ((clip.audioFadeOut || 0) / Math.max(0.05, clip.duration)) * 100)}"}%\`, clipPath: "polygon(0 0, 100% 100%, 0 100%)" }} />\n                            <button aria-label="Fade de entrada" title={\`Fade entrada ${"${fmt(clip.audioFadeIn || 0)}"}\`} onPointerDown={(event) => beginPointerAction(event, { mode: "fade-in", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalFade: clip.audioFadeIn || 0 })} className="absolute top-1 z-30 h-3 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-[#07111f] bg-cyan-300 shadow" style={{ left: \`clamp(8px, ${"${Math.min(50, ((clip.audioFadeIn || 0) / Math.max(0.05, clip.duration)) * 100)}"}%, calc(100% - 8px))\` }} />\n                            <button aria-label="Fade de salida" title={\`Fade salida ${"${fmt(clip.audioFadeOut || 0)}"}\`} onPointerDown={(event) => beginPointerAction(event, { mode: "fade-out", clipId: clip.id, pointerId: event.pointerId, startX: event.clientX, originalFade: clip.audioFadeOut || 0 })} className="absolute top-1 z-30 h-3 w-3 translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-[#07111f] bg-cyan-300 shadow" style={{ right: \`clamp(8px, ${"${Math.min(50, ((clip.audioFadeOut || 0) / Math.max(0.05, clip.duration)) * 100)}"}%, calc(100% - 8px))\` }} />\n                          </> : null}`;

if (!client.includes('aria-label="Fade de entrada"')) {
  client = replaceRequired(client, oldWaveform, newWaveform, "forma de onda detallada y puntos de fade");
}

const oldVolume = `{(selectedClip.trackId === "audio-main" || selectedClip.trackId === "music-main" || selectedClip.trackId === "video-main") && <div className="rounded-xl border border-violet-400/15 bg-violet-500/5 p-3"><label>Volumen · {Math.round(selectedClip.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) })} className="w-full accent-violet-500" /></label><button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} className={\`mt-2 rounded-lg px-2 py-1 ${"${selectedClip.muted ? \"bg-rose-500/20 text-rose-200\" : \"bg-white/5\"}"}\`}>{selectedClip.muted ? "Silenciado" : "Audio activo"}</button></div>}`;
const newVolume = `{selectedTrack && (selectedTrack.kind === "audio" || selectedTrack.kind === "music" || selectedTrack.kind === "video") && <div className="space-y-3 rounded-xl border border-violet-400/15 bg-violet-500/5 p-3">\n              <label>Volumen · {Math.round(selectedClip.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.volume} onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) })} className="w-full accent-violet-500" /></label>\n              {(selectedTrack.kind === "audio" || selectedTrack.kind === "music") && <>\n                <label className="block">Pista<select value={selectedClip.trackId} onChange={(event) => moveClipToTrack(selectedClip.id, event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-2 py-1.5">{project.tracks.filter((track) => track.kind === selectedTrack.kind).map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>\n                <div className="grid grid-cols-2 gap-2">\n                  <label>Fade entrada · {fmt(selectedClip.audioFadeIn || 0)}<input type="range" min={0} max={Math.max(0.05, selectedClip.duration / 2)} step={0.05} value={selectedClip.audioFadeIn || 0} onChange={(event) => updateClip(selectedClip.id, { audioFadeIn: Number(event.target.value) })} className="w-full accent-cyan-400" /></label>\n                  <label>Fade salida · {fmt(selectedClip.audioFadeOut || 0)}<input type="range" min={0} max={Math.max(0.05, selectedClip.duration / 2)} step={0.05} value={selectedClip.audioFadeOut || 0} onChange={(event) => updateClip(selectedClip.id, { audioFadeOut: Number(event.target.value) })} className="w-full accent-cyan-400" /></label>\n                </div>\n              </>}\n              <button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} className={\`rounded-lg px-2 py-1 ${"${selectedClip.muted ? \"bg-rose-500/20 text-rose-200\" : \"bg-white/5\"}"}\`}>{selectedClip.muted ? "Silenciado" : "Audio activo"}</button>\n            </div>}`;

if (!client.includes("Fade entrada · {fmt(selectedClip.audioFadeIn")) {
  client = replaceRequired(client, oldVolume, newVolume, "inspector de audio por pista");
}

write(clientPath, client);
console.log("[multimedia-timeline] Editor Multimedia: pistas dinámicas, waveform detallada y fades aplicados");

const exportPath = "lib/multimedia/export-media.ts";
let exportMedia = read(exportPath);
if (!exportMedia.includes("audioFadeFactor,")) {
  exportMedia = replaceRequired(
    exportMedia,
    `import { interpolateClip, projectDuration, transitionFactor } from "./types";`,
    `import { audioFadeFactor, interpolateClip, projectDuration, transitionFactor } from "./types";`,
    "audioFadeFactor en exportador de video",
  );
}
exportMedia = exportMedia.replace(
  `Math.max(0, animated.volume * transition.opacity) : 0;`,
  `Math.max(0, animated.volume * transition.opacity * audioFadeFactor(entry.clip, Math.max(0, local))) : 0;`,
);
write(exportPath, exportMedia);
console.log("[multimedia-timeline] Exportación MP4/WebM respeta fades de audio");
