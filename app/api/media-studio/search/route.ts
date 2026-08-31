import { NextRequest, NextResponse } from "next/server";
import type { MediaAsset } from "@/lib/media-studio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeId = (provider: string, id: string | number) => `${provider}-${String(id)}`;

async function pexels(query: string): Promise<MediaAsset[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const headers = { Authorization: key };
  const [photoRes, videoRes] = await Promise.all([
    fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8`, { headers, next: { revalidate: 3600 } }),
    fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=6`, { headers, next: { revalidate: 3600 } }),
  ]);
  const items: MediaAsset[] = [];
  if (photoRes.ok) {
    const data = await photoRes.json();
    for (const photo of data.photos || []) items.push({
      id: safeId("pexels", photo.id), type: "image", name: photo.alt || `Pexels ${photo.id}`,
      url: photo.src?.large2x || photo.src?.large || photo.src?.original,
      thumbnailUrl: photo.src?.medium, source: "pexels", provider: "Pexels", license: "Pexels License",
      attribution: photo.photographer ? `Foto: ${photo.photographer} / Pexels` : "Pexels", externalUrl: photo.url,
      width: photo.width, height: photo.height,
    });
  }
  if (videoRes.ok) {
    const data = await videoRes.json();
    for (const video of data.videos || []) {
      const files = (video.video_files || []).filter((file: any) => file.link).sort((a: any, b: any) => Math.abs((a.width || 1280) - 1280) - Math.abs((b.width || 1280) - 1280));
      const file = files[0]; if (!file) continue;
      items.push({ id: safeId("pexels-video", video.id), type: "video", name: video.user?.name ? `Video de ${video.user.name}` : `Pexels video ${video.id}`, url: file.link, thumbnailUrl: video.image, duration: video.duration, width: file.width, height: file.height, source: "pexels", provider: "Pexels", license: "Pexels License", attribution: video.user?.name ? `Video: ${video.user.name} / Pexels` : "Pexels", externalUrl: video.url });
    }
  }
  return items;
}

async function pixabay(query: string): Promise<MediaAsset[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const [imageRes, videoRes] = await Promise.all([
    fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&per_page=8&safesearch=true`, { next: { revalidate: 3600 } }),
    fetch(`https://pixabay.com/api/videos/?key=${key}&q=${encodeURIComponent(query)}&per_page=6&safesearch=true`, { next: { revalidate: 3600 } }),
  ]);
  const items: MediaAsset[] = [];
  if (imageRes.ok) {
    const data = await imageRes.json();
    for (const image of data.hits || []) items.push({ id: safeId("pixabay", image.id), type: "image", name: image.tags || `Pixabay ${image.id}`, url: image.largeImageURL || image.webformatURL, thumbnailUrl: image.previewURL, width: image.imageWidth, height: image.imageHeight, source: "pixabay", provider: "Pixabay", license: "Pixabay Content License", attribution: image.user ? `${image.user} / Pixabay` : "Pixabay", externalUrl: image.pageURL });
  }
  if (videoRes.ok) {
    const data = await videoRes.json();
    for (const video of data.hits || []) {
      const file = video.videos?.medium || video.videos?.small || video.videos?.large;
      if (!file?.url) continue;
      items.push({ id: safeId("pixabay-video", video.id), type: "video", name: video.tags || `Pixabay video ${video.id}`, url: file.url, thumbnailUrl: video.videos?.tiny?.thumbnail || undefined, duration: video.duration, width: file.width, height: file.height, source: "pixabay", provider: "Pixabay", license: "Pixabay Content License", attribution: video.user ? `${video.user} / Pixabay` : "Pixabay", externalUrl: video.pageURL });
    }
  }
  return items;
}

async function freesound(query: string): Promise<MediaAsset[]> {
  const token = process.env.FREESOUND_API_KEY;
  if (!token) return [];
  const fields = "id,name,duration,previews,license,url,username";
  const res = await fetch(`https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&page_size=12&fields=${encodeURIComponent(fields)}&token=${encodeURIComponent(token)}`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((sound: any) => ({
    id: safeId("freesound", sound.id), type: "sfx" as const, name: sound.name,
    url: sound.previews?.["preview-hq-mp3"] || sound.previews?.["preview-lq-mp3"],
    duration: sound.duration, source: "freesound" as const, provider: "Freesound", license: sound.license,
    attribution: sound.username ? `${sound.username} / Freesound` : "Freesound", externalUrl: sound.url,
  })).filter((item: MediaAsset) => Boolean(item.url));
}

async function jamendo(query: string): Promise<MediaAsset[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=12&search=${encodeURIComponent(query)}&audioformat=mp31&include=musicinfo`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((track: any) => ({
    id: safeId("jamendo", track.id), type: "music" as const, name: `${track.name}${track.artist_name ? ` — ${track.artist_name}` : ""}`,
    url: track.audio, thumbnailUrl: track.image || track.album_image, duration: Number(track.duration) || undefined,
    source: "jamendo" as const, provider: "Jamendo", license: track.license_ccurl ? "Creative Commons" : "Jamendo",
    attribution: track.artist_name ? `${track.artist_name} / Jamendo` : "Jamendo", externalUrl: track.shareurl,
  })).filter((item: MediaAsset) => Boolean(item.url));
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const provider = request.nextUrl.searchParams.get("provider") || "all";
  if (!q) return NextResponse.json({ items: [], configured: {} });

  const configured = {
    pexels: Boolean(process.env.PEXELS_API_KEY),
    pixabay: Boolean(process.env.PIXABAY_API_KEY),
    freesound: Boolean(process.env.FREESOUND_API_KEY),
    jamendo: Boolean(process.env.JAMENDO_CLIENT_ID),
  };

  const jobs: Promise<MediaAsset[]>[] = [];
  if (provider === "all" || provider === "pexels") jobs.push(pexels(q));
  if (provider === "all" || provider === "pixabay") jobs.push(pixabay(q));
  if (provider === "all" || provider === "freesound") jobs.push(freesound(q));
  if (provider === "all" || provider === "jamendo") jobs.push(jamendo(q));
  const settled = await Promise.allSettled(jobs);
  const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).slice(0, 36);
  return NextResponse.json({ items, configured });
}
