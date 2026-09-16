import fs from "node:fs";

const path = "components/multimedia/MultimediaStudioV3Client.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[multimedia-audio-preview] No se encontró ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "  Volume2,\n  ZoomIn,",
  "  Volume2,\n  VolumeX,\n  ZoomIn,",
  "icono VolumeX",
);

replaceOnce(
  '  const [pointerAction, setPointerAction] = useState<PointerAction | null>(null);',
  [
    '  const [pointerAction, setPointerAction] = useState<PointerAction | null>(null);',
    '  const [mutedTrackIds, setMutedTrackIds] = useState<Set<string>>(() => new Set());',
    '  const [assetPreviewId, setAssetPreviewId] = useState<string | null>(null);',
    '  const [assetPreviewPlaying, setAssetPreviewPlaying] = useState(false);',
  ].join("\n"),
  "estados de preview y mute de pista",
);

replaceOnce(
  '  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());',
  [
    '  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());',
    '  const assetPreviewRef = useRef<HTMLAudioElement | null>(null);',
  ].join("\n"),
  "referencia de preescucha",
);

replaceOnce(
  '    audioRefs.current.forEach((audio) => audio.pause());\n  }, []);',
  '    audioRefs.current.forEach((audio) => audio.pause());\n    assetPreviewRef.current?.pause();\n  }, []);',
  "limpieza de preescucha",
);

replaceOnce(
  '  useEffect(() => {\n    if (!playing) {',
  [
    '  useEffect(() => {',
    '    if (playing && assetPreviewRef.current && !assetPreviewRef.current.paused) {',
    '      assetPreviewRef.current.pause();',
    '      setAssetPreviewPlaying(false);',
    '    }',
    '  }, [playing]);',
    '',
    '  useEffect(() => {',
    '    if (!playing) {',
  ].join("\n"),
  "pausa de preescucha al reproducir timeline",
);

replaceOnce(
  '    for (const track of project.tracks.filter((item) => item.kind === "audio" || item.kind === "music")) {\n      for (const clip of track.clips) {',
  [
    '    for (const track of project.tracks.filter((item) => item.kind === "audio" || item.kind === "music")) {',
    '      const trackMuted = mutedTrackIds.has(track.id);',
    '      for (const clip of track.clips) {',
  ].join("\n"),
  "estado mute dentro de reproducción de audio",
);

replaceOnce(
  '        element.volume = clip.muted ? 0 : clamp(animated.volume * transition.opacity * audioFadeFactor(clip, playhead - clip.start), 0, 1);\n        if (playing) void element.play().catch(() => undefined);',
  '        element.volume = trackMuted || clip.muted ? 0 : clamp(animated.volume * transition.opacity * audioFadeFactor(clip, playhead - clip.start), 0, 1);\n        if (playing) void element.play().catch(() => undefined);',
  "mute de pista durante reproducción",
);

replaceOnce(
  '  }, [assetMap, playhead, playing, project]);\n\n  useEffect(() => {\n    function keyHandler',
  '  }, [assetMap, mutedTrackIds, playhead, playing, project]);\n\n  useEffect(() => {\n    function keyHandler',
  "dependencia del mute de pistas",
);

replaceOnce(
  '  function trackHasSpace(track: MultimediaProject["tracks"][number], start: number, clipDuration: number) {',
  [
    '  function stopAssetPreview(reset = true) {',
    '    const preview = assetPreviewRef.current;',
    '    if (preview) {',
    '      preview.pause();',
    '      if (reset) preview.currentTime = 0;',
    '    }',
    '    setAssetPreviewPlaying(false);',
    '    if (reset) {',
    '      assetPreviewRef.current = null;',
    '      setAssetPreviewId(null);',
    '    }',
    '  }',
    '',
    '  async function toggleAssetPreview(asset: StudioAsset) {',
    '    if ((asset.kind !== "audio" && asset.kind !== "music") || !asset.url || asset.missing) return;',
    '    setPlaying(false);',
    '',
    '    const current = assetPreviewRef.current;',
    '    if (assetPreviewId === asset.id && current) {',
    '      if (current.paused) {',
    '        try {',
    '          await current.play();',
    '          setAssetPreviewPlaying(true);',
    '        } catch {',
    '          setAssetPreviewPlaying(false);',
    '          setNotice("El navegador bloqueó la preescucha. Pulsa Play nuevamente.");',
    '        }',
    '      } else {',
    '        current.pause();',
    '        setAssetPreviewPlaying(false);',
    '      }',
    '      return;',
    '    }',
    '',
    '    stopAssetPreview(true);',
    '    const preview = new Audio(asset.url);',
    '    preview.preload = "auto";',
    '    if (/^https?:/i.test(asset.url)) preview.crossOrigin = "anonymous";',
    '    preview.addEventListener("ended", () => {',
    '      if (assetPreviewRef.current === preview) {',
    '        assetPreviewRef.current = null;',
    '        setAssetPreviewId(null);',
    '        setAssetPreviewPlaying(false);',
    '      }',
    '    }, { once: true });',
    '    preview.addEventListener("error", () => {',
    '      if (assetPreviewRef.current === preview) {',
    '        setAssetPreviewPlaying(false);',
    '        setNotice(`No se pudo reproducir ${asset.name}.`);',
    '      }',
    '    }, { once: true });',
    '    assetPreviewRef.current = preview;',
    '    setAssetPreviewId(asset.id);',
    '    try {',
    '      await preview.play();',
    '      setAssetPreviewPlaying(true);',
    '      setNotice(`Preescuchando ${asset.name}.`);',
    '    } catch {',
    '      setAssetPreviewPlaying(false);',
    '      setNotice("El navegador bloqueó la preescucha. Pulsa Play nuevamente.");',
    '    }',
    '  }',
    '',
    '  function toggleTrackMute(trackId: string) {',
    '    setMutedTrackIds((current) => {',
    '      const next = new Set(current);',
    '      if (next.has(trackId)) next.delete(trackId);',
    '      else next.add(trackId);',
    '      return next;',
    '    });',
    '  }',
    '',
    '  function trackHasSpace(track: MultimediaProject["tracks"][number], start: number, clipDuration: number) {',
  ].join("\n"),
  "funciones de preescucha y mute",
);

replaceOnce(
  '  function removeAsset(asset: StudioAsset) {\n    const usedClips = projectRef.current.tracks.flatMap((track) => track.clips).filter((clip) => clip.assetId === asset.id);',
  '  function removeAsset(asset: StudioAsset) {\n    if (assetPreviewId === asset.id) stopAssetPreview(true);\n    const usedClips = projectRef.current.tracks.flatMap((track) => track.clips).filter((clip) => clip.assetId === asset.id);',
  "detención de preview al borrar recurso",
);

replaceOnce(
  '                  {!asset.missing && <button title="Agregar a la línea de tiempo" onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}',
  [
    '                  {!asset.missing && (asset.kind === "audio" || asset.kind === "music") && <button title={assetPreviewId === asset.id && assetPreviewPlaying ? "Pausar preescucha" : "Reproducir preescucha"} aria-label={assetPreviewId === asset.id && assetPreviewPlaying ? `Pausar ${asset.name}` : `Reproducir ${asset.name}`} onClick={() => void toggleAssetPreview(asset)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${assetPreviewId === asset.id && assetPreviewPlaying ? "border-cyan-400/35 bg-cyan-500/20 text-cyan-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>{assetPreviewId === asset.id && assetPreviewPlaying ? <Pause size={12} /> : <Play size={12} />}</button>}',
    '                  {!asset.missing && <button title="Agregar a la línea de tiempo" onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}',
  ].join("\n"),
  "botón Play/Pausa por audio",
);

replaceOnce(
  '                    <div className="sticky left-0 z-30 flex h-[54px] w-[118px] items-center gap-2 border-r border-white/10 bg-[#090d19] px-2 text-[10px] text-slate-300">{trackIcon(track.kind)}<span className="truncate">{track.name}</span></div>',
  [
    '                    <div className="sticky left-0 z-30 flex h-[54px] w-[118px] items-center gap-1.5 border-r border-white/10 bg-[#090d19] px-2 text-[10px] text-slate-300">',
    '                      {trackIcon(track.kind)}',
    '                      <span className="min-w-0 flex-1 truncate">{track.name}</span>',
    '                      {(track.kind === "audio" || track.kind === "music") && <button type="button" title={mutedTrackIds.has(track.id) ? `Activar ${track.name}` : `Silenciar ${track.name}`} aria-label={mutedTrackIds.has(track.id) ? `Activar ${track.name}` : `Silenciar ${track.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleTrackMute(track.id); }} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${mutedTrackIds.has(track.id) ? "border-rose-400/35 bg-rose-500/20 text-rose-200" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"}`}>{mutedTrackIds.has(track.id) ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>}',
    '                    </div>',
  ].join("\n"),
  "mute por pista en timeline",
);

fs.writeFileSync(path, source);
console.log("[multimedia-audio-preview] OK · Play/Pausa por archivo y mute independiente por pista");
