import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 20;

const DEFAULT_LIMIT = 18;
const MAX_LIMIT = 30;
const FREESOUND_HOSTS = new Set(["freesound.org", "www.freesound.org", "cdn.freesound.org"]);

type FreesoundItem = {
  id?: number;
  name?: string;
  username?: string;
  license?: string;
  duration?: number;
  url?: string;
  tags?: string[];
  previews?: Record<string, string | undefined>;
};

function clampLimit(value: string | null) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(parsed)));
}

function previewUrl(item: FreesoundItem) {
  const previews = item.previews || {};
  return (
    previews["preview-hq-mp3"] ||
    previews["preview-lq-mp3"] ||
    previews["preview-hq-ogg"] ||
    previews["preview-lq-ogg"] ||
    ""
  );
}

function isAllowedPreviewUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && FREESOUND_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function proxyPreview(request: NextRequest, rawUrl: string) {
  if (!isAllowedPreviewUrl(rawUrl)) {
    return NextResponse.json({ ok: false, error: "Vista previa de Freesound no válida." }, { status: 400 });
  }

  const response = await fetch(rawUrl, {
    headers: { "User-Agent": "EduAI-Multimedia/1.0" },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ ok: false, error: `Freesound preview ${response.status}` }, { status: 502 });
  }

  const body = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const filename = (request.nextUrl.searchParams.get("name") || "freesound-preview.mp3")
    .replace(/[\r\n"]/g, "")
    .slice(0, 120);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function GET(request: NextRequest) {
  const preview = request.nextUrl.searchParams.get("preview");
  if (preview) return proxyPreview(request, preview);

  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  if (!query) {
    return NextResponse.json({ ok: false, error: "Escribe una búsqueda." }, { status: 400 });
  }

  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "Falta configurar FREESOUND_API_KEY en el servidor.",
      },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    query,
    page_size: String(clampLimit(request.nextUrl.searchParams.get("limit"))),
    fields: "id,name,username,license,duration,previews,url,tags",
  });

  try {
    const response = await fetch(`https://freesound.org/apiv2/search/?${params.toString()}`, {
      headers: {
        Authorization: `Token ${apiKey}`,
        "User-Agent": "EduAI-Multimedia/1.0",
      },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Freesound API ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }

    const data = await response.json();
    const sounds = ((data.results || []) as FreesoundItem[])
      .map((item) => ({
        id: String(item.id || ""),
        name: item.name || "Sonido",
        creator: item.username || "Freesound",
        duration: Math.max(0, Number(item.duration || 0)),
        license: item.license || "",
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
        previewUrl: previewUrl(item),
        externalUrl: item.url || (item.id ? `https://freesound.org/s/${item.id}/` : "https://freesound.org"),
        source: "freesound" as const,
      }))
      .filter((item) => item.id && item.previewUrl);

    return NextResponse.json({
      ok: true,
      configured: true,
      sounds,
      count: Number(data.count || sounds.length),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo consultar Freesound." },
      { status: 502 },
    );
  }
}
