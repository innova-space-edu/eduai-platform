import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

type RadioBrowserStation = {
  stationuuid?: string;
  name?: string;
  url?: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  codec?: string;
  bitrate?: number;
  hls?: number;
  lastcheckok?: number;
  votes?: number;
};

type NormalizedRadioTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  mood: "focus" | "calm" | "classical" | "nature" | "energy" | "deep" | "reading" | "creative";
  duration: string;
  src: string;
  cover: string;
  artworkUrl?: string;
  externalUrl?: string;
  source: "radio";
  tags: string[];
};

type ManualRadioPreset = NormalizedRadioTrack & {
  aliases: string[];
  countryCode?: string;
};

const API_BASE = "https://de1.api.radio-browser.info";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

// Presets manuales para radios chilenas que a veces no aparecen bien en Radio Browser
// o que devuelven URLs temporales/difíciles de reproducir en navegador.
// IMPORTANTE:
// - FMDOS usa StreamTheWorld/Triton. Es mejor usar el endpoint livestream-redirect,
//   no el host temporal tipo 27363.live.streamtheworld.com:3690.
// - Canal 95 no siempre aparece en Radio Browser, por eso queda como preset manual.
const MANUAL_RADIOS: ManualRadioPreset[] = [
  {
    id: "radio-preset-fmdos",
    title: "FM Dos",
    artist: "Chile · CL",
    album: "StreamTheWorld · HLS/AAC estable",
    mood: "calm",
    duration: "En vivo",
    src: "https://playerservices.streamtheworld.com/api/livestream-redirect/FMDOSAAC.m3u8",
    cover: "linear-gradient(135deg,#f9a8d4,#f43f5e)",
    externalUrl: "https://envivo.fmdos.cl/",
    source: "radio",
    tags: ["radio", "chile", "cl", "fmdos", "fm dos", "fm2", "romantica", "hls"],
    aliases: ["fm dos", "fmdos", "fm2", "fm 2", "radio fm dos", "radio fmdos"],
    countryCode: "CL",
  },
  {
    id: "radio-preset-canal95",
    title: "Canal 95",
    artist: "Antofagasta · Chile",
    album: "Señal online · preset manual",
    mood: "energy",
    duration: "En vivo",
    // Si este HTTPS no responde en algún navegador, usa el enlace oficial en externalUrl.
    // El stream antiguo público aparece como http://sonando.us.digitalproserver.com/canal95_aac,
    // pero una página HTTPS como Vercel necesita HTTPS para evitar mixed content.
    src: "https://sonando.us.digitalproserver.com/canal95_aac",
    cover: "linear-gradient(135deg,#fde047,#f97316)",
    externalUrl: "https://www.canal95.cl/",
    source: "radio",
    tags: ["radio", "chile", "cl", "antofagasta", "canal 95", "top 40", "pop", "aac"],
    aliases: ["canal 95", "canal95", "radio canal 95", "canal antogafasta", "canal antofagasta"],
    countryCode: "CL",
  },
];

function clampLimit(value: unknown) {
  const raw = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(raw)));
}

function safeId(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function moodFromRadio(text: string): NormalizedRadioTrack["mood"] {
  const s = text.toLowerCase();
  if (/(news|noticias|talk|deportes|informaci[oó]n|actualidad)/.test(s)) return "reading";
  if (/(classical|cl[aá]sica|orchestra|piano|jazz)/.test(s)) return "classical";
  if (/(relax|ambient|chill|calm|suave|meditation|romantica|romántica)/.test(s)) return "calm";
  if (/(dance|pop|rock|hit|top|reggaeton|urbana|party|juvenil)/.test(s)) return "energy";
  return "focus";
}

function normalizeStreamUrl(src: string) {
  // No transformamos a ciegas todos los http:// a https:// porque algunas radios antiguas
  // solo existen en HTTP. Para Vercel/HTTPS conviene priorizar URLs HTTPS desde el origen.
  // Si Radio Browser trae HTTP y no existe HTTPS, el navegador puede bloquearlo.
  if (!src) return "";
  if (/^https:\/\//i.test(src)) return src;
  if (/^http:\/\//i.test(src)) return src.replace(/^http:/i, "https:");
  return src;
}

function normalizeStation(station: RadioBrowserStation): NormalizedRadioTrack | null {
  const src = normalizeStreamUrl(station.url_resolved || station.url || "");
  const name = (station.name || "").trim();
  if (!src || !name) return null;
  const tags = [
    "radio",
    station.country,
    station.countrycode,
    station.language,
    station.codec,
    ...(station.tags || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5),
  ].filter(Boolean) as string[];
  const country = [station.country, station.countrycode].filter(Boolean).join(" · ") || "Radio online";
  const codec = [station.codec, station.bitrate ? `${station.bitrate} kbps` : null, station.hls ? "HLS" : null]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `radio-${station.stationuuid || safeId(`${name}-${src}`)}`,
    title: name,
    artist: country,
    album: codec || "Radio online en vivo",
    mood: moodFromRadio(`${name} ${tags.join(" ")}`),
    duration: "En vivo",
    src,
    cover: station.favicon || "linear-gradient(135deg,#34d399,#0f766e)",
    artworkUrl: station.favicon || undefined,
    externalUrl: station.homepage || undefined,
    source: "radio",
    tags,
  };
}

function manualMatches(query: string, countryCode: string, limit: number) {
  const q = normalizeText(query);
  const cc = countryCode.trim().toUpperCase();

  // Cuando se pide "Chile" o búsqueda vacía, mostramos favoritos útiles primero.
  const wantsChile = !q || q === "chile" || q === "cl" || q === "radio chile" || q === "radios chile";

  return MANUAL_RADIOS.filter((station) => {
    const sameCountry = !cc || !station.countryCode || station.countryCode === cc;
    if (!sameCountry) return false;
    if (wantsChile) return true;
    const haystack = normalizeText([station.title, station.artist, station.album, ...station.tags, ...station.aliases].join(" "));
    return station.aliases.some((alias) => normalizeText(alias) === q) || haystack.includes(q) || q.includes(normalizeText(station.title));
  }).slice(0, limit);
}

async function searchRadio(query: string, countryCode: string, limit: number) {
  const params = new URLSearchParams({
    limit: String(limit),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });

  if (query) params.set("name", query);
  if (countryCode) params.set("countrycode", countryCode.toUpperCase());

  const res = await fetch(`${API_BASE}/json/stations/search?${params.toString()}`, {
    headers: {
      "User-Agent": "EduAI-Platform/1.0 (emorales@colprovidencia.cl)",
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) throw new Error(`Radio Browser API ${res.status}`);
  const data = (await res.json()) as RadioBrowserStation[];
  return data
    .filter((station) => station.lastcheckok !== 0)
    .map(normalizeStation)
    .filter(Boolean)
    .slice(0, limit) as NormalizedRadioTrack[];
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const query = String(body.query || url.searchParams.get("q") || url.searchParams.get("query") || "").trim();
  const countryCode = String(body.countryCode || url.searchParams.get("countryCode") || "CL").trim();
  const limit = clampLimit(body.limit || url.searchParams.get("limit"));

  const manual = manualMatches(query || "Chile", countryCode, limit);
  const primary = await searchRadio(query || "Chile", countryCode, limit).catch(() => []);
  const fallback = primary.length || manual.length ? [] : await searchRadio(query || "", "", limit).catch(() => []);

  const map = new Map<string, NormalizedRadioTrack>();
  [...manual, ...primary, ...fallback].forEach((track) => map.set(track.id, track));

  return NextResponse.json({
    ok: true,
    query,
    countryCode,
    limit,
    provider: "radio-browser + manual-presets",
    tracks: Array.from(map.values()).slice(0, limit),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
