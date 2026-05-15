import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type JamendoPlaylist = {
  id?: string;
  name?: string;
  user_name?: string;
  creationdate?: string;
  zip?: string;
  shorturl?: string;
  shareurl?: string;
  image?: string;
  tracks_count?: number;
};

type JamendoTrack = {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
  audio?: string;
  image?: string;
  album_image?: string;
  shareurl?: string;
  shorturl?: string;
};

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:30";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "JAMENDO_CLIENT_ID no está configurado." },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const playlistId = url.searchParams.get("playlistId");
  const query = url.searchParams.get("q") || "study focus";
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 12)));

  try {
    if (playlistId) {
      const params = new URLSearchParams({
        client_id: clientId,
        format: "json",
        id: playlistId,
        limit: String(limit),
        imagesize: "200",
        audioformat: "mp32",
      });
      const res = await fetch(
        `https://api.jamendo.com/v3.0/playlists/tracks/?${params.toString()}`,
        { cache: "no-store", headers: { "User-Agent": "EduAI-Music/1.6" } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: `Jamendo HTTP ${res.status}` }, { status: 502 });
      }
      const tracks = ((data.results?.[0]?.tracks || []) as JamendoTrack[]).map((track) => ({
        id: `jamendo-${track.id}`,
        title: track.name || "Canción Jamendo",
        artist: track.artist_name || "Artista Jamendo",
        album: track.album_name || "Jamendo playlist",
        duration: formatDuration(track.duration),
        src: track.audio || "",
        cover: track.album_image || track.image || "linear-gradient(135deg,#34d399,#10b981)",
        artworkUrl: track.album_image || track.image,
        externalUrl: track.shareurl || track.shorturl,
        source: "jamendo",
        mood: "focus",
        tags: ["jamendo", "playlist"],
      }));
      return NextResponse.json({ ok: true, provider: "jamendo", playlistId, tracks });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      format: "json",
      limit: String(limit),
      namesearch: query,
      order: "popularity_total",
    });
    const res = await fetch(
      `https://api.jamendo.com/v3.0/playlists/?${params.toString()}`,
      { cache: "no-store", headers: { "User-Agent": "EduAI-Music/1.6" } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Jamendo HTTP ${res.status}` }, { status: 502 });
    }

    const playlists = ((data.results || []) as JamendoPlaylist[]).map((playlist) => ({
      id: playlist.id,
      title: playlist.name || "Playlist Jamendo",
      creator: playlist.user_name || "Jamendo",
      tracksCount: playlist.tracks_count || 0,
      image: playlist.image,
      externalUrl: playlist.shareurl || playlist.shorturl,
      zipUrl: playlist.zip,
      provider: "jamendo",
    }));

    return NextResponse.json({ ok: true, provider: "jamendo", playlists });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Jamendo playlists error" },
      { status: 500 },
    );
  }
}
