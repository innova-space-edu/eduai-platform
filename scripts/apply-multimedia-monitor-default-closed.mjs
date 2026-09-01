import fs from "node:fs";

const path = "components/multimedia/MultimediaStudioV3Client.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[multimedia-monitor-default] No se encontró ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  '  const isAudioOnlyMode = hasAudioTimelineContent && !hasVisualTimelineContent;\n',
  [
    '  const shouldShowVisualPreview = hasVisualTimelineContent;',
    '  const isAudioOnlyMode = hasAudioTimelineContent && !shouldShowVisualPreview;',
    '  const isMonitorCollapsed = !shouldShowVisualPreview;',
  ].join("\n") + "\n",
  "estado automático del monitor",
);

replaceOnce(
  '<div className="flex items-center gap-2"><div><p className="text-xs font-semibold">{isAudioOnlyMode ? "Monitor de audio" : "Monitor"}</p><p className="text-[10px] text-slate-500">{fmt(playhead)} / {fmt(duration)}</p></div>{isAudioOnlyMode && <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[8px] font-medium text-violet-200">Solo audio</span>}</div>',
  '<div className="flex items-center gap-2"><div><p className="text-xs font-semibold">{isAudioOnlyMode ? "Monitor de audio" : "Monitor"}</p><p className="text-[10px] text-slate-500">{fmt(playhead)} / {fmt(duration)}</p></div>{isAudioOnlyMode ? <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[8px] font-medium text-violet-200">Solo audio</span> : isMonitorCollapsed ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-medium text-slate-400">Cerrado</span> : null}</div>',
  "estado visible de monitor cerrado",
);

replaceOnce(
  'className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-[0_16px_46px_rgba(0,0,0,0.28)] transition-[width,height] duration-300 ${isAudioOnlyMode ? "audio-only-monitor" : "w-full max-w-[980px]"}`}',
  'className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#050816] shadow-[0_16px_46px_rgba(0,0,0,0.28)] transition-[width,height] duration-300 ${isMonitorCollapsed ? "audio-only-monitor" : "w-full max-w-[980px]"}`}',
  "clase de monitor colapsado",
);

replaceOnce(
  'style={isAudioOnlyMode ? { width: "min(100%, 520px)", height: 210 } : { aspectRatio: `${project.width}/${project.height}` }}',
  'style={isMonitorCollapsed ? { width: "min(100%, 520px)", height: isAudioOnlyMode ? 210 : 112 } : { aspectRatio: `${project.width}/${project.height}` }}',
  "tamaño predeterminado cerrado",
);

replaceOnce(
  '                {isAudioOnlyMode ? (\n                  <CompactAudioEqualizer playing={playing} />\n                ) : (',
  [
    '                {isMonitorCollapsed ? (',
    '                  isAudioOnlyMode ? (',
    '                    <CompactAudioEqualizer playing={playing} />',
    '                  ) : (',
    '                    <div className="flex h-full w-full items-center justify-center">',
    '                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 text-slate-500">',
    '                        <Film size={20} className="text-slate-600" />',
    '                        <div><p className="text-[10px] font-medium text-slate-300">Monitor cerrado</p><p className="text-[8px]">Se abrirá al agregar video, imagen o texto.</p></div>',
    '                      </div>',
    '                    </div>',
    '                  )',
    '                ) : (',
  ].join("\n"),
  "contenido del monitor cerrado",
);

fs.writeFileSync(path, source);
console.log("[multimedia-monitor-default] OK · cerrado por defecto, ecualizador en audio y preview al agregar contenido visual");
