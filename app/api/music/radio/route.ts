import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

type RadioMood = "focus" | "calm" | "classical" | "nature" | "energy" | "deep" | "reading" | "creative";

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
  mood: RadioMood;
  duration: string;
  src: string;
  cover: string;
  artworkUrl?: string;
  externalUrl?: string;
  source: "radio";
  tags: string[];
  countryCode?: string;
  playable?: boolean;
  externalOnly?: boolean;
  embedOnly?: boolean;
  embedUrl?: string;
  loaderUrl?: string;
};

type ManualRadioPreset = NormalizedRadioTrack & {
  aliases: string[];
};

const API_BASE = "https://de1.api.radio-browser.info";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;
const RADIO_PROXY_BASE = (process.env.RADIO_PROXY_BASE || "").replace(/\/$/, "");

const fmdosUrl = RADIO_PROXY_BASE
  ? `${RADIO_PROXY_BASE}/fmdos`
  : "https://playerservices.streamtheworld.com/api/livestream-redirect/FMDOSAAC_SC";

const canal95EmbedUrl = "https://player.conectaapp.cl/canal-95";
const canal95LoaderUrl = "https://player.conectaapp.cl/embed/loader.js?id=canal-95";

// Presets manuales para radios chilenas problemáticas o importantes.
// Canal 95 no se entrega como audio directo: su señal funciona mediante
// el reproductor oficial ConectaAPP, por eso va marcado como embedOnly.
const MANUAL_RADIOS: ManualRadioPreset[] = [
  {
    id: "radio-preset-fmdos",
    title: "FM Dos",
    artist: "Chile · CL",
    album: RADIO_PROXY_BASE ? "EduAI Radio Proxy · StreamTheWorld" : "StreamTheWorld · AAC",
    mood: "calm",
    duration: "En vivo",
    src: fmdosUrl,
    cover: "linear-gradient(135deg,#f9a8d4,#f43f5e)",
    externalUrl: "https://envivo.fmdos.cl/",
    source: "radio",
    tags: ["radio", "chile", "cl", "fmdos", "fm dos", "fm2", "romantica", "streamtheworld"],
    aliases: ["fm dos", "fmdos", "fm2", "fm 2", "radio fm dos", "radio fmdos"],
    countryCode: "CL",
    playable: true,
    externalOnly: false,
  },
  {
    id: "radio-preset-carolina",
    title: "Radio Carolina",
    artist: "Santiago · Chile",
    album: "DPS · AAC",
    mood: "energy",
    duration: "En vivo",
    src: "https://unlimited3-cl.dps.live/carolinafm/aac/icecast.audio",
    cover: "linear-gradient(135deg,#22d3ee,#6366f1)",
    externalUrl: "https://www.carolina.cl/senal-en-vivo/",
    source: "radio",
    tags: ["radio", "chile", "cl", "carolina", "juvenil", "pop", "urbana", "aac"],
    aliases: ["carolina", "radio carolina", "carolina 99.3", "la mas prendida", "la más prendida"],
    countryCode: "CL",
    playable: true,
    externalOnly: false,
  },
  {
    id: "radio-preset-canal95",
    title: "Canal 95",
    artist: "Antofagasta · Chile",
    album: "Reproductor oficial ConectaAPP",
    mood: "energy",
    duration: "En vivo",
    src: "",
    cover: "linear-gradient(135deg,#fde047,#f97316)",
    externalUrl: "https://www.canal95.cl/",
    source: "radio",
    tags: ["radio", "chile", "cl", "antofagasta", "canal 95", "canal95", "conectaapp", "top 40", "pop"],
    aliases: ["canal 95", "canal95", "radio canal 95", "canal antofagasta", "canal de antofagasta"],
    countryCode: "CL",
    playable: false,
    externalOnly: false,
    embedOnly: true,
    embedUrl: canal95EmbedUrl,
    loaderUrl: canal95LoaderUrl,
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

function isFmdosQuery(query: string) {
  const q = normalizeText(query);
  return q.includes("fm dos") || q.includes("fmdos") || q === "fm2" || q.includes("fm 2");
}

function isCanal95Query(query: string) {
  const q = normalizeText(query);
  return q.includes("canal 95") || q.includes("canal95") || q === "95" || q.includes("radio canal 95");
}

function isCarolinaQuery(query: string) {
  const q = normalizeText(query);
  return q.includes("carolina") || q.includes("la mas prendida");
}

function moodFromRadio(text: string): RadioMood {
  const s = text.toLowerCase();
  if (/(news|noticias|talk|deportes|informaci[oó]n|actualidad)/.test(s)) return "reading";
  if (/(classical|cl[aá]sica|orchestra|piano|jazz)/.test(s)) return "classical";
  if (/(relax|ambient|chill|calm|suave|meditation|romantica|romántica)/.test(s)) return "calm";
  if (/(dance|pop|rock|hit|top|reggaeton|urbana|party|juvenil)/.test(s)) return "energy";
  return "focus";
}

function normalizeStreamUrl(src: string) {
  if (!src) return "";
  const clean = src.trim();

  // La app corre por HTTPS. Si una radio solo entrega HTTP, el navegador puede bloquearla
  // o forzar HTTPS y fallar por certificado. No devolvemos HTTP como audio directo.
  if (/^http:\/\//i.test(clean)) return "";

  // Evita el host antiguo de Canal 95 que causa NET::ERR_CERT_COMMON_NAME_INVALID.
  if (/sonando\.us\.digitalproserver\.com/i.test(clean)) return "";

  if (/^https:\/\//i.test(clean)) return clean;
  return "";
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
    ...(station.tags || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5),
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
    countryCode: station.countrycode,
    playable: true,
    externalOnly: false,
  };
}

function manualMatches(query: string, countryCode: string, limit: number) {
  const q = normalizeText(query);
  const cc = countryCode.trim().toUpperCase();
  const wantsChile = !q || q === "chile" || q === "cl" || q === "radio chile" || q === "radios chile";

  return MANUAL_RADIOS.filter((station) => {
    const sameCountry = !cc || !station.countryCode || station.countryCode === cc;
    if (!sameCountry) return false;
    if (wantsChile) return true;
    const haystack = normalizeText([station.title, station.artist, station.album, ...station.tags, ...station.aliases].join(" "));
    return station.aliases.some((alias) => normalizeText(alias) === q) || haystack.includes(q) || q.includes(normalizeText(station.title));
  }).slice(0, limit);
}

function presetOnlyResults(query: string, countryCode: string, limit: number) {
  const results = manualMatches(query, countryCode, limit);
  if (!results.length) return null;

  // Para estas radios usamos siempre el preset, porque Radio Browser puede devolver
  // URLs antiguas o no reproducibles.
  if (isFmdosQuery(query) || isCanal95Query(query) || isCarolinaQuery(query)) {
    return results;
  }

  return null;
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

  const presetOnly = presetOnlyResults(query || "Chile", countryCode, limit);
  if (presetOnly) {
    return NextResponse.json({
      ok: true,
      query,
      countryCode,
      limit,
      provider: "manual-presets",
      radioProxyBase: RADIO_PROXY_BASE || null,
      tracks: presetOnly,
    });
  }

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
    radioProxyBase: RADIO_PROXY_BASE || null,
    tracks: Array.from(map.values()).slice(0, limit),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
