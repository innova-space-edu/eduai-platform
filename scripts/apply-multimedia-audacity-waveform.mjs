import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const relative = "components/multimedia/MultimediaStudioV3Client.tsx";
const target = path.join(root, relative);

if (!fs.existsSync(target)) throw new Error(`[multimedia-audacity-waveform] No se encontró ${relative}`);
let source = fs.readFileSync(target, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`[multimedia-audacity-waveform] No se encontró ${label}`);
  source = source.replace(before, after);
}

if (!source.includes('@/lib/multimedia/waveform')) {
  replaceRequired(
    `import { buildWaveform, exportProjectWav } from "@/lib/multimedia/audio";`,
    `import { exportProjectWav } from "@/lib/multimedia/audio";\nimport { buildDetailedWaveform, type DetailedWaveform } from "@/lib/multimedia/waveform";`,
    "import de waveform detallada",
  );
}

replaceRequired(
  `  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});`,
  `  const [waveforms, setWaveforms] = useState<Record<string, DetailedWaveform>>({});`,
  "estado de waveforms",
);

const oldGenerate = `      const peaks = await buildWaveform(asset.url, 420);\n      setWaveforms((current) => ({ ...current, [asset.id]: peaks }));`;
const newGenerate = `      const waveform = await buildDetailedWaveform(asset.url, 1400);\n      setWaveforms((current) => ({ ...current, [asset.id]: waveform }));`;
replaceRequired(oldGenerate, newGenerate, "generación de waveform detallada");

if (!source.includes("function waveformEnvelopePath(")) {
  const marker = `export default function MultimediaStudioV3Client() {`;
  if (!source.includes(marker)) throw new Error("[multimedia-audacity-waveform] No se encontró entrada del cliente V3");
  const helper = `function waveformEnvelopePath(\n  channel: DetailedWaveform["channels"][number],\n  waveformDuration: number,\n  clipOffset: number,\n  clipDuration: number,\n  top: number,\n  height: number,\n) {\n  const total = Math.min(channel.min.length, channel.max.length);\n  if (total < 2) return "";\n  const safeDuration = Math.max(0.001, waveformDuration);\n  const fromRatio = clamp(clipOffset / safeDuration, 0, 1);\n  const toRatio = clamp((clipOffset + clipDuration) / safeDuration, fromRatio, 1);\n  const first = Math.min(total - 1, Math.floor(fromRatio * (total - 1)));\n  const last = Math.max(first + 1, Math.min(total - 1, Math.ceil(toRatio * (total - 1))));\n  const count = Math.max(2, last - first + 1);\n  const center = top + height / 2;\n  const amplitude = height * 0.46;\n  const upper: string[] = [];\n  const lower: string[] = [];\n\n  for (let index = first; index <= last; index += 1) {\n    const x = ((index - first) / (count - 1)) * 1000;\n    const yUpper = center - clamp(channel.max[index] || 0, -1, 1) * amplitude;\n    const yLower = center - clamp(channel.min[index] || 0, -1, 1) * amplitude;\n    upper.push(x.toFixed(2) + "," + yUpper.toFixed(2));\n    lower.push(x.toFixed(2) + "," + yLower.toFixed(2));\n  }\n\n  return "M " + upper.join(" L ") + " L " + lower.reverse().join(" L ") + " Z";\n}\n\n`;
  source = source.replace(marker, `${helper}${marker}`);
}

replaceRequired(
  `                        const peaks = asset ? waveforms[asset.id] : undefined;`,
  `                        const waveform = asset ? waveforms[asset.id] : undefined;`,
  "waveform del clip",
);

const oldVisual = `{peaks && (track.kind === "audio" || track.kind === "music") ? <>\n                            <div className="pointer-events-none absolute inset-0 flex items-center gap-[1px] px-3 opacity-75">{peaks.map((peak, index) => <span key={index} className="min-w-px flex-1 bg-current" style={{ height: \`${"${Math.max(2, peak * 90)}"}%\`, borderRadius: "1px" }} />)}</div>`;
const newVisual = `{waveform && (track.kind === "audio" || track.kind === "music") ? <>\n                            <div className="pointer-events-none absolute inset-x-3 inset-y-1 opacity-95">\n                              <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">\n                                {waveform.channels.slice(0, 2).map((channel, channelIndex) => {\n                                  const visibleChannels = Math.max(1, Math.min(2, waveform.channels.length));\n                                  const channelHeight = 100 / visibleChannels;\n                                  const channelTop = channelIndex * channelHeight;\n                                  const center = channelTop + channelHeight / 2;\n                                  return <g key={channelIndex}>\n                                    <line x1="0" x2="1000" y1={center} y2={center} stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.8" />\n                                    <path d={waveformEnvelopePath(channel, waveform.duration, clip.offset, clip.duration, channelTop, channelHeight)} fill="currentColor" fillOpacity="0.9" />\n                                    {visibleChannels > 1 && <text x="5" y={channelTop + 9} fill="currentColor" fillOpacity="0.55" fontSize="8">{channelIndex === 0 ? "L" : "R"}</text>}\n                                  </g>;\n                                })}\n                              </svg>\n                            </div>`;
replaceRequired(oldVisual, newVisual, "render Audacity de waveform");

fs.writeFileSync(target, source);
console.log("[multimedia-audacity-waveform] waveform real min/max, mono/estéreo y recorte visual aplicados");
