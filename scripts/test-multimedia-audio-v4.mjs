import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`[multimedia-v4] Falta ${label}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`[multimedia-v4] Sigue presente ${label}`);
}

const client = read("components/multimedia/MultimediaStudioV3Client.tsx");
const waveform = read("components/multimedia/AudioWaveformCanvas.tsx");
const prerender = read("scripts/test-client-supabase-prerender-safety.mjs");
const auth = read("scripts/test-multi-device-auth.mjs");
const pkg = JSON.parse(read("package.json"));

requireText(client, `import AudioWaveformCanvas from "@/components/multimedia/AudioWaveformCanvas";`, "renderer Canvas en el editor");
requireText(client, "function resolveAudioTrack", "pistas de audio dinámicas");
requireText(client, 'mode: "fade-in"', "fade-in por puntero");
requireText(client, 'mode: "fade-out"', "fade-out por puntero");
requireText(client, ">+ Audio</button>", "botón + Audio");
requireText(client, ">+ Música</button>", "botón + Música");
requireText(client, "Escala vertical de la onda", "control de amplitud visual");
requireText(client, "<AudioWaveformCanvas", "waveform Canvas dentro de la timeline");
forbidText(client, "buildDetailedWaveform", "renderer SVG previo");
forbidText(client, "waveformEnvelopePath", "helper SVG previo");
forbidText(client, "const [waveforms,", "estado global de waveform estirada");
forbidText(client, "generateWaveform(asset", "pre-render estático de waveform");

requireText(waveform, `from "@waveform-playlist/webaudio-peaks"`, "webaudio-peaks");
requireText(waveform, "new ResizeObserver", "resolución adaptativa al ancho real");
requireText(waveform, "extractPeaksFromBuffer(buffer, samplesPerPixel, false", "peaks estéreo min/max");
requireText(waveform, "for (let x = 0; x < size.width; x += 1)", "render por columna visible");
requireText(waveform, "const divisor = peakDivisor(peaks.bits)", "escala de amplitud real sin normalización global");

forbidText(prerender, "apply-multimedia-timeline-enhancements", "parche de timeline en prebuild");
forbidText(auth, "apply-multimedia-audacity-waveform", "parche Audacity en prebuild");

if (pkg.dependencies?.["@waveform-playlist/webaudio-peaks"] !== "^12.0.2") {
  throw new Error("[multimedia-v4] Dependencia @waveform-playlist/webaudio-peaks no configurada");
}
if (!String(pkg.scripts?.prebuild || "").includes("test-multimedia-audio-v4.mjs")) {
  throw new Error("[multimedia-v4] El test V4 no está conectado al prebuild");
}

console.log("[multimedia-v4] OK · Canvas adaptativa, peaks reales, estéreo, fades y pistas dinámicas verificados");
