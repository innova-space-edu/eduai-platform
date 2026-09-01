import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 25;

type EditableVideo = {
  id: string;
  title: string;
  author: string;
  duration: number;
  src: string;
  downloadUrl: string;
  thumbnail: string;
  externalUrl: string;
  source: "pexels" | "pixabay";
  width: number;
  height: number;
};

type PexelsVideoFile = {
  file_type?: string;
  quality?: string;
  width?: number;
  height?: number;
  link?: string;
};

type PexelsVideo = {
  id?: number;
  duration?: number;
  url?: string;
  image?: string;
  user?: { name?: string };
  video_files?: PexelsVideoFile[];
};

type PixabayVideoVariant = {
  url?: string;
  width?: number;
  height?: number;
  thumbnail?: string;
  size?: number;
};

type PixabayVideo = {
  id?: number;
  pageURL?: string;
  duration?: number;
  user?: string;
  tags?: string;
  videos?: {
    large?: PixabayVideoVariant;
    medium?: PixabayVideoVariant;
    small?: PixabayVideoVariant;
    tiny?: PixabayVideoVariant;
  };
};

function clampLimit(value: string | null) {
  const parsed = Number(value || 18);
  return Math.max(1, Math.min(30, Number.isFinite(parsed) ? Math.round(parsed) : 18));
}

function choosePexelsFile(files: PexelsVideoFile[] = []) {
  const mp4 = files.filter((file) => file.link && (!file.file_type || file.file_type.includes("mp4")));
  if (!mp4.length) return undefined;
  const preferred = mp4
    .filter((file) => (file.width || 0) >= 960 && (file.width || 0) <= 1920)
    .sort((a, b) => Math.abs((a.width || 1280) - 1280) - Math.abs((b.width || 1280) - 1280));
  return preferred[0] || mp4.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
}

async function searchPexels(query: string, limit: number): Promise<EditableVideo[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ query, per_page: String(limit), orientation: "landscape" });
  const response = await fetch(`https://api.pexels.com/v1/videos/search?${params.toString()}`, {
    headers: { Authorization: key, "User-Agent": "EduAI-Multimedia/2.1" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Pexels API ${response.status}`);
  const data = await response.json();
  return ((data.videos || []) as PexelsVideo[]).flatMap((video) => {
    const file = choosePexelsFile(video.video_files);
    if (!video.id || !file?.link) return [];
    return [{
      id: `pexels-${video.id}`,
      title: `Video ${video.id}`,
      author: video.user?.name || "Pexels",
      duration: Math.max(1, Number(video.duration || 10)),
      src: file.link,
      downloadUrl: file.link,
      thumbnail: video.image || "",
      externalUrl: video.url || `https://www.pexels.com/video/${video.id}/`,
      source: "pexels" as const,
      width: Number(file.width || 1280),
      height: Number(file.height || 720),
    }];
  });
}

function choosePixabayVariant(video: PixabayVideo) {
  return video.videos?.medium || video.videos?.small || video.videos?.large || video.videos?.tiny;
}

async function searchPixabay(query: string, limit: number): Promise<EditableVideo[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    q: query,
    per_page: String(Math.max(3, limit)),
    safesearch: "true",
    video_type: "all",
    lang: "es",
  });
  const response = await fetch(`https://pixabay.com/api/videos/?${params.toString()}`, {
    headers: { "User-Agent": "EduAI-Multimedia/2.1" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`Pixabay API ${response.status}`);
  const data = await response.json();
  return ((data.hits || []) as PixabayVideo[]).flatMap((video) => {
    const file = choosePixabayVariant(video);
    if (!video.id || !file?.url) return [];
    const downloadUrl = `${file.url}${file.url.includes("?") ? "&" : "?"}download=1`;
    return [{
      id: `pixabay-${video.id}`,
      title: video.tags?.split(",")[0]?.trim() || `Video ${video.id}`,
      author: video.user || "Pixabay",
      duration: Math.max(1, Number(video.duration || 10)),
      src: file.url,
      downloadUrl,
      thumbnail: file.thumbnail || "",
      externalUrl: video.pageURL || `https://pixabay.com/videos/id-${video.id}/`,
      source: "pixabay" as const,
      width: Number(file.width || 1280),
      height: Number(file.height || 720),
    }];
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() || request.nextUrl.searchParams.get("q")?.trim() || "music";
  const limit = clampLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const [pexels, pixabay] = await Promise.allSettled([
      searchPexels(query, limit),
      searchPixabay(query, limit),
    ]);
    const merged = [
      ...(pexels.status === "fulfilled" ? pexels.value : []),
      ...(pixabay.status === "fulfilled" ? pixabay.value : []),
    ];
    const unique = Array.from(new Map(merged.map((video) => [video.id, video])).values()).slice(0, limit);
    const configured = {
      pexels: Boolean(process.env.PEXELS_API_KEY),
      pixabay: Boolean(process.env.PIXABAY_API_KEY),
    };
    return NextResponse.json({
      ok: true,
      videos: unique,
      configured,
      attribution: unique.some((video) => video.source === "pexels")
        ? "Videos provided by Pexels / Pixabay"
        : "Videos provided by Pixabay",
      message: unique.length
        ? undefined
        : configured.pexels || configured.pixabay
          ? "No se encontraron videos editables para esta búsqueda."
          : "Configura PEXELS_API_KEY o PIXABAY_API_KEY para habilitar la biblioteca de videos editables.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudieron buscar videos." }, { status: 500 });
  }
}
