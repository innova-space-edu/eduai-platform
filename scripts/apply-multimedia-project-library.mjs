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

fs.writeFileSync(path, source);
console.log("[multimedia-library] OK · MP3/WAV superior, borrado de recursos, biblioteca y apertura por URL");
