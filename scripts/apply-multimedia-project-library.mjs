import fs from "node:fs";

const path = "components/multimedia/MultimediaStudioV3Client.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[multimedia-library] No se encontró ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'type Tab = "files" | "videos" | "gallery" | "music" | "text" | "project";\n',
  'type Tab = "files" | "videos" | "gallery" | "music" | "text" | "project";\ntype StudioExportFormat = ExportFormat | "mp3" | "wav";\n',
  "tipo de formato de exportación",
);

replaceOnce(
  '  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");',
  '  const [exportFormat, setExportFormat] = useState<StudioExportFormat>("mp4");',
  "estado de exportación",
);

replaceOnce(
  '  useEffect(() => { void refreshSavedProjects(); }, []);',
  [
    '  useEffect(() => {',
    '    void refreshSavedProjects();',
    '    const requestedProjectId = new URLSearchParams(window.location.search).get("project");',
    '    if (requestedProjectId) void openSavedProject(requestedProjectId);',
    '  }, []); // eslint-disable-line react-hooks/exhaustive-deps',
  ].join("\n"),
  "carga inicial de proyectos",
);

replaceOnce(
  '      const result = await exportProjectVideo(project, assets, { format: exportFormat, onProgress: setExportProgress });',
  '      const result = await exportProjectVideo(project, assets, { format: exportFormat as ExportFormat, onProgress: setExportProgress });',
  "cast de formato de video",
);

replaceOnce(
  '  async function refreshSavedProjects() {',
  [
    '  async function exportCurrentFormat() {',
    '    if (exportFormat === "mp3") return exportMp3();',
    '    if (exportFormat === "wav") return exportWav();',
    '    return exportVideo();',
    '  }',
    '',
    '  async function refreshSavedProjects() {',
  ].join("\n"),
  "despachador de exportación",
);

replaceOnce(
  '  function removeClip() {',
  [
    '  function removeAsset(asset: StudioAsset) {',
    '    const usedClips = projectRef.current.tracks.flatMap((track) => track.clips).filter((clip) => clip.assetId === asset.id);',
    '    if (usedClips.length) {',
    '      const accepted = window.confirm("El archivo “" + asset.name + "” está usado en " + usedClips.length + " clip(s). ¿Eliminar también esos clips de la línea de tiempo?");',
    '      if (!accepted) return;',
    '      commitProject((current) => ({',
    '        ...current,',
    '        tracks: current.tracks.map((track) => ({',
    '          ...track,',
    '          clips: track.clips.filter((clip) => clip.assetId !== asset.id),',
    '        })),',
    '      }));',
    '      if (selectedClip?.assetId === asset.id) setSelectedClipId(null);',
    '    }',
    '    if (asset.local && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);',
    '    const nextAssets = assetsRef.current.filter((item) => item.id !== asset.id);',
    '    assetsRef.current = nextAssets;',
    '    setAssets(nextAssets);',
    '    setNotice(asset.name + " eliminado del proyecto.");',
    '  }',
    '',
    '  function removeClip() {',
  ].join("\n"),
  "eliminación de recursos",
);

replaceOnce(
  'onChange={(event) => setExportFormat(event.target.value as ExportFormat)}',
  'onChange={(event) => setExportFormat(event.target.value as StudioExportFormat)}',
  "selector de formato ampliado",
);

replaceOnce(
  '              <option value="webm">WebM</option>',
  [
    '              <option value="webm">WebM</option>',
    '              <option value="mp3">MP3 · solo audio · 192 kbps</option>',
    '              <option value="wav">WAV · solo audio · sin compresión</option>',
  ].join("\n"),
  "opciones MP3/WAV",
);

replaceOnce(
  'onClick={exportVideo} className="rounded-xl bg-cyan-600',
  'onClick={() => void exportCurrentFormat()} className="rounded-xl bg-cyan-600',
  "botón exportar multipropósito",
);

replaceOnce(
  '                  {!asset.missing && <button onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}',
  [
    '                  {!asset.missing && <button title="Agregar a la línea de tiempo" onClick={() => addAssetToTimeline(asset)} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><Plus size={13} /></button>}',
    '                  <button title="Eliminar archivo del proyecto" onClick={() => removeAsset(asset)} className="rounded-lg bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"><Trash2 size={13} /></button>',
  ].join("\n"),
  "botón para borrar archivos",
);

const saveButton = '            <button disabled={savingProject} onClick={saveProjectHere} className="w-full rounded-xl border border-cyan-400/25 bg-cyan-500/15 p-3 font-semibold text-cyan-100 disabled:opacity-50"><Save size={14} className="mr-1 inline" />{savingProject ? "Guardando…" : savedProjectId ? "Guardar ahora" : "Guardar en EDUAI"}</button>';
replaceOnce(
  saveButton,
  saveButton + '\n            <Link href="/multimedia-studio/projects" className="block w-full rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-center font-semibold text-violet-100"><FolderOpen size={14} className="mr-1 inline" />Abrir biblioteca de proyectos</Link>',
  "enlace a biblioteca",
);

replaceOnce(
  '            <p className="text-[9px] leading-4 text-slate-500">Después del primer guardado, cada edición se actualiza automáticamente en este navegador.</p>',
  '            <p className="text-[9px] leading-4 text-slate-500">Después del primer guardado, cada edición se conserva localmente y, con sesión iniciada, se sincroniza con tu biblioteca EDUAI para abrirla desde otros equipos.</p>',
  "mensaje de persistencia",
);

const trackIconBlock = [
  'function trackIcon(kind: string) {',
  '  if (kind === "video") return <Video size={13} />;',
  '  if (kind === "overlay") return <ImageIcon size={13} />;',
  '  if (kind === "text") return <Captions size={13} />;',
  '  if (kind === "music") return <Music2 size={13} />;',
  '  return <AudioLines size={13} />;',
  '}',
].join("\n");

const equalizerComponent = [
  trackIconBlock,
  '',
  'function CompactAudioEqualizer({ playing }: { playing: boolean }) {',
  '  const bars = [38, 64, 48, 82, 56, 92, 70, 102, 62, 88, 54, 78, 44, 68];',
  '  const gradients = [',
  '    "linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)",',
  '    "linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)",',
  '    "linear-gradient(180deg, #34d399 0%, #059669 100%)",',
  '    "linear-gradient(180deg, #fb7185 0%, #e11d48 100%)",',
  '  ];',
  '',
  '  return (',
  '    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">',
  '      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.14),transparent_38%),radial-gradient(circle_at_75%_80%,rgba(139,92,246,0.12),transparent_36%)]" />',
  '      <div className="relative w-[min(88%,390px)] rounded-[26px] border border-white/10 bg-white/[0.045] px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl">',
  '        <div className="mb-4 flex items-center justify-between gap-3">',
  '          <div className="flex items-center gap-2">',
  '            <span className={`h-2 w-2 rounded-full ${playing ? "animate-pulse bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" : "bg-slate-600"}`} />',
  '            <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200">Audio mix</p><p className="text-[8px] text-slate-500">Equalizer monitor</p></div>',
  '          </div>',
  '          <AudioLines size={16} className="text-cyan-300" />',
  '        </div>',
  '        <div className="flex h-[104px] items-end justify-center gap-2">',
  '          {bars.map((height, index) => (',
  '            <span',
  '              key={index}',
  '              className="origin-bottom rounded-full shadow-[0_0_12px_rgba(34,211,238,0.16)]"',
  '              style={{',
  '                width: "9px",',
  '                height: `${height}px`,',
  '                background: gradients[index % gradients.length],',
  '                animation: playing ? `eduaiAudioEq ${0.58 + (index % 5) * 0.11}s ease-in-out ${index * 0.035}s infinite alternate` : "none",',
  '                transform: playing ? undefined : `scaleY(${0.36 + (index % 4) * 0.08})`,',
  '                opacity: playing ? 1 : 0.72,',
  '              }}',
  '            />',
  '          ))}',
  '        </div>',
  '      </div>',
  '      <style>{`@keyframes eduaiAudioEq { 0% { transform: scaleY(0.28); filter: brightness(0.85); } 55% { transform: scaleY(0.74); filter: brightness(1); } 100% { transform: scaleY(1); filter: brightness(1.18); } }`}</style>',
  '    </div>',
  '  );',
  '}',
].join("\n");

replaceOnce(trackIconBlock, equalizerComponent, "ecualizador compacto");

replaceOnce(
  '  const visualTracks = project.tracks.filter((track) => track.kind === "video" || track.kind === "overlay" || track.kind === "text");',
  [
    '  const hasVisualTimelineContent = project.tracks.some((track) => (track.kind === "video" || track.kind === "overlay" || track.kind === "text") && track.clips.length > 0);',
    '  const hasAudioTimelineContent = project.tracks.some((track) => (track.kind === "audio" || track.kind === "music") && track.clips.length > 0);',
    '  const isAudioOnlyMode = hasAudioTimelineContent && !hasVisualTimelineContent;',
    '  const visualTracks = project.tracks.filter((track) => track.kind === "video" || track.kind === "overlay" || track.kind === "text");',
  ].join("\n"),
  "detección automática de modo solo audio",
);

replaceOnce(
  '            <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">Monitor</p><p className="text-[10px] text-slate-500">{fmt(playhead)} / {fmt(duration)}</p></div><div className="flex gap-2"><Link href="/video-studio" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">Video Studio</Link><Link href="/audio-lab" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px]">Audio Lab</Link></div></div>',
  [
    '            <div className="mb-2 flex items-center justify-between gap-2">',
    '              <div className="flex items-center gap-2"><div><p className="text-xs font-semibold">{isAudioOnlyMode ? "Monitor de audio" : "Monitor"}</p><p className="text-[10px] text-slate-500">{fmt(playhead)} / {fmt(duration)}</p></div>{isAudioOnlyMode && <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[8px] font-medium text-violet-200">Solo audio</span>}</div>',
    '              <div className="flex gap-2"><Link href="/video-studio" className={`rounded-lg border px-2 py-1 text-[10px] ${isAudioOnlyMode ? "border-white/10 bg-white/5 text-slate-400" : "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"}`}>Video Studio</Link><Link href="/audio-lab" className={`rounded-lg border px-2 py-1 text-[10px] ${isAudioOnlyMode ? "border-violet-400/25 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/5 text-slate-300"}`}>Audio Lab</Link></div>',
    '            </div>',
  ].join("\n"),
  "cabecera dinámica del monitor",
);

replaceOnce(
  '              <div ref={previewRef} className="relative w-full max-w-[980px] overflow-hidden rounded-xl bg-[#050816]" style={{ aspectRatio: `${project.width}/${project.height}` }}>',
  [
    '              <div',
    '                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-[0_16px_46px_rgba(0,0,0,0.28)] transition-[width,height] duration-300 ${isAudioOnlyMode ? "audio-only-monitor" : "w-full max-w-[980px]"}`}',
    '                style={isAudioOnlyMode ? { width: "min(100%, 520px)", height: 210 } : { aspectRatio: `${project.width}/${project.height}` }}',
    '              >',
    '                {isAudioOnlyMode ? (',
    '                  <CompactAudioEqualizer playing={playing} />',
    '                ) : (',
    '                  <div ref={previewRef} className="absolute inset-0">',
  ].join("\n"),
  "contenedor contraíble del monitor",
);

replaceOnce(
  '                {!activeVisualClips.length && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600"><Film size={44} /><p className="mt-3 text-xs">Agrega video, imágenes o texto</p></div>}\n              </div>\n            </div>\n            <div className="mt-3 flex items-center gap-3">',
  [
    '                {!activeVisualClips.length && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600"><Film size={44} /><p className="mt-3 text-xs">Agrega video, imágenes o texto</p></div>}',
    '                  </div>',
    '                )}',
    '              </div>',
    '            </div>',
    '            <div className="mt-3 flex items-center gap-3">',
  ].join("\n"),
  "cierre de vista previa dinámica",
);

fs.writeFileSync(path, source);
console.log("[multimedia-library] OK · MP3/WAV, biblioteca, borrado de recursos y monitor automático audio/video");
