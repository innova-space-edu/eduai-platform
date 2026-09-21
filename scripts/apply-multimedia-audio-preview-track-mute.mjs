import fs from "node:fs";

const path = "components/multimedia/MultimediaStudioV3Client.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[multimedia-audio-preview] No se encontró ${label}`);
  source = source.replace(before, after);
}

// La mezcla profesional (mute/solo persistente por pista) ya vive en el modelo
// MultimediaProject. Este parche de prebuild solo mantiene la preescucha de
// recursos del panel Archivos y debe ser idempotente.
replaceOnce(
  '  const [pointerAction, setPointerAction] = useState<PointerAction | null>(null);',
  [
    '  const [pointerAction, setPointerAction] = useState<PointerAction | null>(null);',
    '  const [assetPreviewId, setAssetPreviewId] = useState<string | null>(null);',
    '  const [assetPreviewPlaying, setAssetPreviewPlaying] = useState(false);',
  ].join("\n"),
  "estados de preescucha",
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
    '        setNotice(\`No se pudo reproducir \${asset.name}.\`);',
    '      }',
    '    }, { once: true });',
    '    assetPreviewRef.current = preview;',
    '    setAssetPreviewId(asset.id);',
    '    try {',
    '      await preview.play();',
    '      setAssetPreviewPlaying(true);',
    '      setNotice(\`Preescuchando \${asset.name}.\`);',
    '    } catch {',
    '      setAssetPreviewPlaying(false);',
    '      setNotice("El navegador bloqueó la preescucha. Pulsa Play nuevamente.");',
    '    }',
    '  }',
    '',
    '  function trackHasSpace(track: MultimediaProject["tracks"][number], start: number, clipDuration: number) {',
  ].join("\n"),
  "funciones de preescucha",
);

replaceOnce(
  '  function removeAsset(asset: StudioAsset) {\n    const usedClips = projectRef.current.tracks.flatMap((track) => track.clips).filter((clip) => clip.assetId === asset.id);',
  '  function removeAsset(asset: StudioAsset) {\n    if (assetPreviewId === asset.id) stopAssetPreview(true);\n    const usedClips = projectRef.current.tracks.flatMap((track) => track.clips).filter((clip) => clip.assetId === asset.id);',
  "detención de preview al borrar recurso",
);

replaceOnce(
  '                  {!asset.missing && <button title="Agregar a la línea de tiempo" onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}',
  [
    '                  {!asset.missing && (asset.kind === "audio" || asset.kind === "music") && <button title={assetPreviewId === asset.id && assetPreviewPlaying ? "Pausar preescucha" : "Reproducir preescucha"} aria-label={assetPreviewId === asset.id && assetPreviewPlaying ? \`Pausar \${asset.name}\` : \`Reproducir \${asset.name}\`} onClick={() => void toggleAssetPreview(asset)} className={\`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition \${assetPreviewId === asset.id && assetPreviewPlaying ? "border-cyan-400/35 bg-cyan-500/20 text-cyan-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}\`}>{assetPreviewId === asset.id && assetPreviewPlaying ? <Pause size={12} /> : <Play size={12} />}</button>}',
    '                  {!asset.missing && <button title="Agregar a la línea de tiempo" onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}',
  ].join("\n"),
  "botón Play/Pausa por audio",
);

for (const [needle, label] of [
  ['function toggleTrackMute(trackId: string)', "mute persistente por pista"],
  ['function toggleTrackSolo(trackId: string)', "solo persistente por pista"],
  ['trackSuppressed', "mute/solo aplicado a reproducción real"],
  ['toggleTrackMute(track.id)', "control M en cabecera"],
  ['toggleTrackSolo(track.id)', "control S en cabecera"],
]) {
  if (!source.includes(needle)) throw new Error(`[multimedia-audio-preview] Falta ${label}`);
}

fs.writeFileSync(path, source);
console.log("[multimedia-audio-preview] OK · Play/Pausa por archivo + mute/solo persistente por pista");
