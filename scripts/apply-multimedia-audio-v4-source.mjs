import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientPath = path.join(root, "components/multimedia/MultimediaStudioV3Client.tsx");
const prerenderTestPath = path.join(root, "scripts/test-client-supabase-prerender-safety.mjs");
const authTestPath = path.join(root, "scripts/test-multi-device-auth.mjs");
const packagePath = path.join(root, "package.json");

// Materializa una sola vez las mejoras que antes se aplicaban durante prebuild.
await import("./apply-multimedia-timeline-enhancements.mjs");
await import("./apply-multimedia-audacity-waveform.mjs");

let client = fs.readFileSync(clientPath, "utf8");

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`[multimedia-v4] No se encontró ${label}`);
  return source.replace(before, after);
}

client = replaceRequired(
  client,
  `import { buildDetailedWaveform, type DetailedWaveform } from "@/lib/multimedia/waveform";`,
  `import AudioWaveformCanvas from "@/components/multimedia/AudioWaveformCanvas";`,
  "import de waveform anterior",
);

client = replaceRequired(
  client,
  `  const [waveforms, setWaveforms] = useState<Record<string, DetailedWaveform>>({});`,
  `  const [waveformScale, setWaveformScale] = useState(1);`,
  "estado de waveform",
);

// El renderer Canvas no necesita precalcular una única figura global por asset.
client = client.replace(
  /\n  async function generateWaveform\(asset: StudioAsset\) \{[\s\S]*?\n  \}\n\n  async function createAssetsFromFiles/,
  `\n  async function createAssetsFromFiles`,
);
client = client.replaceAll(`    if (asset.kind === "audio" || asset.kind === "music") void generateWaveform(asset);\n`, "");
client = client.replaceAll(`    incoming.filter((asset) => asset.kind === "audio").forEach((asset) => void generateWaveform(asset));\n`, "");

// El helper SVG anterior ya no se usa: Canvas dibuja min/max reales por columna visible.
client = client.replace(
  /function waveformEnvelopePath\([\s\S]*?\n\}\n\nexport default function MultimediaStudioV3Client\(\) \{/,
  `export default function MultimediaStudioV3Client() {`,
);

client = client.replaceAll(`                        const waveform = asset ? waveforms[asset.id] : undefined;\n`, "");

const svgWaveform = /\{waveform && \(track\.kind === "audio" \|\| track\.kind === "music"\) \? <>\s*<div className="pointer-events-none absolute inset-x-3 inset-y-1 opacity-95">[\s\S]*?<\/div>\s*(?=<div className="pointer-events-none absolute bottom-0 left-0 top-0)/;
if (!svgWaveform.test(client) && !client.includes("<AudioWaveformCanvas")) {
  throw new Error("[multimedia-v4] No se encontró el renderer SVG Audacity para reemplazar");
}
client = client.replace(
  svgWaveform,
  `{asset?.url && (track.kind === "audio" || track.kind === "music") ? <>\n                            <AudioWaveformCanvas url={asset.url} offset={clip.offset} duration={clip.duration} amplitudeScale={waveformScale} />\n                            `,
);

if (!client.includes("Escala vertical de la onda")) {
  client = replaceRequired(
    client,
    `              <button onClick={() => setTimelineTail((value) => Math.min(120, value + 10))} title="Añadir espacio al final" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px]">+10s</button>`,
    `              <label title="Escala vertical de la onda" className="flex items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[9px] text-violet-100">Onda<select value={waveformScale} onChange={(event) => setWaveformScale(Number(event.target.value))} className="bg-transparent text-[9px] outline-none"><option className="bg-[#0b1020]" value={0.5}>0.5×</option><option className="bg-[#0b1020]" value={1}>1×</option><option className="bg-[#0b1020]" value={2}>2×</option><option className="bg-[#0b1020]" value={4}>4×</option></select></label>\n              <button onClick={() => setTimelineTail((value) => Math.min(120, value + 10))} title="Añadir espacio al final" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px]">+10s</button>`,
    "botón +10s para insertar escala de onda",
  );
}

client = client.replace(
  `Clic en la regla o pista = mover cabezal · Centro = mover · Bordes = recortar · Puntos turquesa = fade-in/fade-out · S = dividir.`,
  `Clic en la regla o pista = mover cabezal · Centro = mover · Bordes = recortar · Puntos turquesa = fade-in/fade-out · Onda = escala vertical · S = dividir.`,
);

fs.writeFileSync(clientPath, client);

function removeBuildHook(filePath, pattern) {
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(pattern, "");
  fs.writeFileSync(filePath, source);
}

removeBuildHook(
  prerenderTestPath,
  /\n\/\/ Este hook se ejecuta en prebuild\.[\s\S]*?await import\("\.\/apply-multimedia-timeline-enhancements\.mjs"\)\n?/,
);
removeBuildHook(
  authTestPath,
  /\n\/\/ Se ejecuta después del parche base de timeline aplicado durante prebuild\.[\s\S]*?await import\("\.\/apply-multimedia-audacity-waveform\.mjs"\)\n?/,
);

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies["@waveform-playlist/webaudio-peaks"] = "^12.0.2";
const prebuildCheck = "node scripts/test-multimedia-audio-v4.mjs";
if (!String(pkg.scripts?.prebuild || "").includes(prebuildCheck)) {
  pkg.scripts.prebuild = `${pkg.scripts.prebuild} && ${prebuildCheck}`;
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log("[multimedia-v4] timeline/fades materializados, waveform Canvas adaptativa conectada y hooks de build eliminados");
