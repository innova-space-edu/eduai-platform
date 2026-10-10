export const MAX_QR_COLLECTION_LINKS = 25

export type QrCollectionLink = {
  id: string
  title: string
  url: string
  description: string
}

export type QrLinkPreview = {
  provider: string
  thumbnail: string | null
  videoId: string | null
  kind: "youtube" | "spotify" | "drive" | "music" | "link"
}

export function validateCollectionLinks(value: unknown): { links: QrCollectionLink[]; error: string | null } {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_QR_COLLECTION_LINKS) {
    return { links: [], error: "La colección debe tener entre 1 y 25 enlaces." }
  }
  const links: QrCollectionLink[] = []
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { links: [], error: "Formato de enlace no válido." }
    }
    const candidate = item as Record<string, unknown>
    const url = typeof candidate.url === "string" ? candidate.url.trim() : ""
    const title = typeof candidate.title === "string" ? candidate.title.trim() : ""
    const description = typeof candidate.description === "string" ? candidate.description.trim() : ""
    if (!url || url.length > 4096 || !title || title.length > 160 || description.length > 600) {
      return { links: [], error: "Cada enlace necesita título y URL (máximo 160 y 4096 caracteres)." }
    }
    try {
      const parsed = new URL(url)
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error("URL no permitida")
      }
    } catch {
      return { links: [], error: "Enlace " + (index + 1) + ": debe ser una URL http o https válida." }
    }
    const rawId = typeof candidate.id === "string" ? candidate.id : ""
    links.push({ id: /^[a-zA-Z0-9_-]{1,70}$/.test(rawId) ? rawId : "link-" + index, title, url, description })
  }
  return { links, error: null }
}

export function getQrLinkPreview(value: string): QrLinkPreview {
  const fallback: QrLinkPreview = { provider: "Sitio web", thumbnail: null, videoId: null, kind: "link" }
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      let id = host === "youtu.be" ? url.pathname.split("/")[1] : url.searchParams.get("v")
      if (!id) {
        const segments = url.pathname.split("/").filter(Boolean)
        if (["shorts", "live", "embed"].includes(segments[0])) id = segments[1]
      }
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return { provider: host === "music.youtube.com" ? "YouTube Music" : "YouTube", kind: "youtube", videoId: id, thumbnail: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" }
      }
      return { ...fallback, provider: host === "music.youtube.com" ? "YouTube Music" : "YouTube", kind: "youtube" }
    }
    if (host === "spotify.com" || host === "open.spotify.com") return { ...fallback, provider: "Spotify", kind: "spotify" }
    if (host === "drive.google.com" || host === "docs.google.com") return { ...fallback, provider: "Google Drive", kind: "drive" }
    if (host === "soundcloud.com" || host === "music.youtube.com" || host === "music.apple.com") {
      return { ...fallback, provider: host === "music.youtube.com" ? "YouTube Music" : host === "soundcloud.com" ? "SoundCloud" : "Apple Music", kind: "music" }
    }
    return { ...fallback, provider: host.slice(0, 70) }
  } catch {
    return fallback
  }
}
