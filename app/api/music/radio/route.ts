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

const API_BASE = "https://de1.api.radio-browser.info";
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

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

function moodFromRadio(text: string): NormalizedRadioTrack["mood"] {
  const s = text.toLowerCase();
  if (/(news|noticias|talk|deportes|informaci[oó]n|actualidad)/.test(s)) return "reading";
  if (/(classical|cl[aá]sica|orchestra|piano|jazz)/.test(s)) return "classical";
  if (/(relax|ambient|chill|calm|suave|meditation)/.test(s)) return "calm";
  if (/(dance|pop|rock|hit|top|reggaeton|urbana|party)/.test(s)) return "energy";
  return "focus";
}

function normalizeStation(station: RadioBrowserStation): NormalizedRadioTrack | null {
  const src = (station.url_resolved || station.url || "").replace(/^http:/, "https:");
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

  const primary = await searchRadio(query || "Chile", countryCode, limit).catch(() => []);
  const fallback = primary.length ? [] : await searchRadio(query || "", "", limit).catch(() => []);
  const map = new Map<string, NormalizedRadioTrack>();
  [...primary, ...fallback].forEach((track) => map.set(track.id, track));

  return NextResponse.json({
    ok: true,
    query,
    countryCode,
    limit,
    provider: "radio-browser",
    tracks: Array.from(map.values()).slice(0, limit),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
