import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EDU_MUSIC_TRACKS } from "@/lib/music/eduai-music-catalog";
import type { MediaAsset } from "@/lib/media-studio/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const items: MediaAsset[] = [];

  const { data: images } = await supabase
    .from("generated_images")
    .select("id,prompt,image_url,provider,style,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  for (const image of images || []) {
    const haystack = `${image.prompt || ""} ${image.style || ""}`.toLowerCase();
    if (q && !haystack.includes(q)) continue;
    items.push({
      id: `eduai-image-${image.id}`,
      type: "image",
      name: image.prompt || "Imagen EDUAI",
      url: image.image_url,
      thumbnailUrl: image.image_url,
      source: "generated",
      provider: image.provider || "Image Studio",
      license: "Contenido del usuario",
    });
  }

  try {
    const { data: stored } = await supabase
      .from("media_assets")
      .select("id,asset_type,name,source,provider,remote_url,thumbnail_url,duration_seconds,width,height,mime_type,license,attribution,external_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    for (const asset of stored || []) {
      if (!asset.remote_url) continue;
      const haystack = `${asset.name || ""} ${asset.provider || ""}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;
      items.push({
        id: `eduai-asset-${asset.id}`,
        type: asset.asset_type,
        name: asset.name,
        url: asset.remote_url,
        thumbnailUrl: asset.thumbnail_url || undefined,
        duration: asset.duration_seconds ? Number(asset.duration_seconds) : undefined,
        width: asset.width || undefined,
        height: asset.height || undefined,
        mimeType: asset.mime_type || undefined,
        source: "eduai",
        provider: asset.provider || "Media Studio",
        license: asset.license || undefined,
        attribution: asset.attribution || undefined,
        externalUrl: asset.external_url || undefined,
      } as MediaAsset);
    }
  } catch {
    // La biblioteca sigue funcionando aunque la migración Media Studio aún no esté aplicada.
  }

  for (const track of EDU_MUSIC_TRACKS) {
    const haystack = `${track.title} ${track.artist} ${track.album} ${(track.tags || []).join(" ")}`.toLowerCase();
    if (q && !haystack.includes(q)) continue;
    if (!track.src) continue;
    items.push({
      id: `eduai-music-${track.id}`,
      type: "music",
      name: `${track.title} — ${track.artist}`,
      url: track.src,
      thumbnailUrl: track.artworkUrl,
      duration: track.duration ? track.duration.split(":").reduce((acc, part) => acc * 60 + Number(part), 0) : undefined,
      source: "eduai",
      provider: track.source ? `EduAI Music · ${track.source}` : "EduAI Music",
      license: track.source === "eduai" ? "Catálogo EDUAI" : "Según proveedor",
      externalUrl: track.externalUrl,
    });
  }

  return NextResponse.json({ items: items.slice(0, 120) });
}
