import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/agentes/page.tsx"
const MARKER = "AGENT_LIBRARY_REPOSITORY_CARDS_V1"

if (!existsSync(PAGE)) {
  throw new Error(`[agent-cards] No existe ${PAGE}`)
}

let source = readFileSync(PAGE, "utf8")

if (!source.includes(MARKER)) {
  const alreadyCanonical = source.includes('id: "biblioteca"') && source.includes('id: "repositorio"')

  if (alreadyCanonical) {
    const canonicalMarkerAnchor = "];\n\nconst TAGS ="
    if (!source.includes(canonicalMarkerAnchor)) {
      throw new Error("[agent-cards] No se encontró cierre canónico del arreglo AGENTS")
    }
    source = source.replace(canonicalMarkerAnchor, `];\n\n// ${MARKER}\n\nconst TAGS =`)
  } else {
    const anchor = `  {
    id: "workspace",
    icon: "📁",
    name: "Workspace",
    description: "Organiza imágenes, transcripciones, presentaciones y más en proyectos",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(67,56,202,0.15)",
    border: "rgba(67,56,202,0.2)",
    href: "/workspace",
    tag: "Organización",
    status: "active",
  },
];`

    const replacement = `  {
    id: "workspace",
    icon: "📁",
    name: "Workspace",
    description: "Organiza imágenes, transcripciones, presentaciones y más en proyectos",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(67,56,202,0.15)",
    border: "rgba(67,56,202,0.2)",
    href: "/workspace",
    tag: "Organización",
    status: "active",
  },
  {
    id: "biblioteca",
    icon: "📚",
    name: "Biblioteca",
    description: "Explora libros, colecciones y lecturas digitales desde el catálogo de EduAI.",
    color: "from-amber-500 to-orange-600",
    glow: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.22)",
    href: "/biblioteca",
    tag: "Organización",
    status: "active",
    ctaLabel: "Abrir biblioteca",
  },
  {
    id: "repositorio",
    icon: "☁️",
    name: "Nube EduAI",
    description: "Guarda, ordena y consulta tus materiales educativos por curso y asignatura.",
    color: "from-sky-400 to-indigo-500",
    glow: "rgba(56,189,248,0.16)",
    border: "rgba(99,102,241,0.20)",
    href: "/repositorio",
    tag: "Organización",
    status: "active",
    ctaLabel: "Abrir Nube EduAI",
  },
];

// ${MARKER}`

    if (!source.includes(anchor)) {
      throw new Error("[agent-cards] No se encontró el bloque final de Workspace")
    }

    source = source.replace(anchor, replacement)
  }
}

source = source
  .replace('name: "Repositorio"', 'name: "Nube EduAI"')
  .replace('ctaLabel: "Abrir repositorio"', 'ctaLabel: "Abrir Nube EduAI"')
  .replace('icon: "🗂️",\n    name: "Nube EduAI"', 'icon: "☁️",\n    name: "Nube EduAI"')
  .replace('color: "from-teal-500 to-emerald-700",\n    glow: "rgba(20,184,166,0.15)",\n    border: "rgba(20,184,166,0.22)",\n    href: "/repositorio"', 'color: "from-sky-400 to-indigo-500",\n    glow: "rgba(56,189,248,0.16)",\n    border: "rgba(99,102,241,0.20)",\n    href: "/repositorio"')
  .replace(
    'description: "Genera imágenes con FLUX y SD, galería unificada con filtros y fullscreen"',
    'description: "Genera y reutiliza imágenes con Gemini 3.1 primero y proveedores alternativos como respaldo automático"',
  )
  .replace(
    '      "Genera videos educativos desde texto o imagen con cola de trabajos, límites por plan y seguimiento de estado."',
    '      "Genera y reutiliza videos desde texto o imagen. EduAI prioriza ahorro y permite Premium Personal con la cuenta del usuario."',
  )
  .replace(
    '    tag: "Creativo",\n    status: "maintenance",\n    ctaLabel: "Temporalmente no disponible",\n  },\n  {\n    id: "galeria"',
    '    tag: "Creativo",\n    status: "active",\n    ctaLabel: "Abrir Video Studio",\n  },\n  {\n    id: "galeria"',
  )

if (!source.includes('id: "media-studio"')) {
  const galleryAnchor = `  {
    id: "galeria",
    icon: "🖼️",`
  const mediaCard = `  {
    id: "media-studio",
    icon: "🎞️",
    name: "Media Studio",
    description: "Editor profesional de video y audio por capas con biblioteca multimedia, timeline y asistencia IA.",
    color: "from-cyan-500 to-violet-600",
    glow: "rgba(34,211,238,0.14)",
    border: "rgba(139,92,246,0.24)",
    href: "/media-studio",
    tag: "Creativo",
    status: "active",
    ctaLabel: "Abrir editor",
  },
  {
    id: "galeria",
    icon: "🖼️",`
  if (!source.includes(galleryAnchor)) {
    throw new Error("[agent-cards] No se encontró Galería para insertar Media Studio")
  }
  source = source.replace(galleryAnchor, mediaCard)
}

writeFileSync(PAGE, source)

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  MARKER,
  'id: "biblioteca"',
  'id: "repositorio"',
  'name: "Nube EduAI"',
  'ctaLabel: "Abrir Nube EduAI"',
  'href: "/biblioteca"',
  'href: "/repositorio"',
  'id: "image-studio"',
  'Gemini 3.1 primero',
  'id: "video-studio"',
  'ctaLabel: "Abrir Video Studio"',
  'Premium Personal',
  'id: "media-studio"',
  'href: "/media-studio"',
  'ctaLabel: "Abrir editor"',
]) {
  if (!verified.includes(required)) {
    throw new Error(`[agent-cards] Falta ${required}`)
  }
}

const videoStart = verified.indexOf('id: "video-studio"')
const videoEnd = verified.indexOf('id: "media-studio"', videoStart)
const videoBlock = verified.slice(videoStart, videoEnd)
if (!videoBlock.includes('status: "active"') || videoBlock.includes('status: "maintenance"')) {
  throw new Error("[agent-cards] Video Studio continúa bloqueado en Agentes")
}

console.log("[agent-cards] Biblioteca, Nube EduAI, Image Studio, Video Studio y Media Studio disponibles en Agentes")

// Media Studio Pro V2: aplica el motor temporal y nuevas acciones del agente sin duplicar la UI base.
const MEDIA_CLIENT = "components/media-studio/MediaStudioClient.tsx"
if (existsSync(MEDIA_CLIENT)) {
  let media = readFileSync(MEDIA_CLIENT, "utf8")
  const previewImport = 'import { MediaAudioLayer, MediaVisualLayer } from "@/components/media-studio/MediaPreviewLayers";'
  if (!media.includes(previewImport)) {
    media = media.replace(
      'import { useMediaStudioStore } from "@/lib/media-studio/store";',
      `import { useMediaStudioStore } from "@/lib/media-studio/store";\n${previewImport}`,
    )
  }

  media = media.replace(
    'import type { AspectRatio, MediaAIPlan, MediaAsset, MediaAssetType, TimelineClip } from "@/lib/media-studio/types";',
    'import type { AspectRatio, KeyframeEasing, MediaAIPlan, MediaAsset, MediaAssetType, TimelineClip, TransitionKind } from "@/lib/media-studio/types";',
  )

  const visualStart = '{activeVisuals.map(({ clip }) => clip.type === "video" ? <SyncedVideo'
  if (media.includes(visualStart)) {
    const visualEnd = '>{clip.text}</div>)}'
    const start = media.indexOf(visualStart)
    const end = media.indexOf(visualEnd, start)
    if (end < 0) throw new Error("[media-studio-v2] No se encontró fin del bloque visual")
    media = media.slice(0, start) + '{activeVisuals.map(({ clip }) => <MediaVisualLayer key={clip.id} clip={clip} playhead={playhead} playing={playing} />)}' + media.slice(end + visualEnd.length)
  }

  media = media.replace(
    '{activeAudios.map(({ clip, track }) => <SyncedAudio key={clip.id} clip={clip} playhead={playhead} playing={playing} trackMuted={track.muted} />)}',
    '{activeAudios.map(({ clip, track }) => <MediaAudioLayer key={clip.id} clip={clip} playhead={playhead} playing={playing} trackMuted={track.muted} />)}',
  )

  const ratioHandler = '        if (command.action === "set_aspect_ratio" && typeof command.value === "string" && ["16:9", "9:16", "1:1", "4:5"].includes(command.value)) setAspectRatio(command.value as AspectRatio);'
  if (!media.includes('command.action === "add_keyframe"')) {
    if (!media.includes(ratioHandler)) throw new Error("[media-studio-v2] No se encontró handler de aspecto para extender Media AI")
    const proHandlers = `${ratioHandler}
        if (command.action === "add_keyframe" && command.clipId && command.value && typeof command.value === "object") {
          const target = project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === command.clipId);
          if (target) {
            const raw = command.value as Record<string, number | string | boolean>;
            const easingValue = typeof raw.easing === "string" && ["linear", "ease-in", "ease-out", "ease-in-out"].includes(raw.easing) ? raw.easing as KeyframeEasing : "ease-in-out";
            const numericEntries = Object.entries(raw).filter(([key, value]) => key !== "easing" && typeof value === "number" && Number.isFinite(value));
            const values = Object.fromEntries(numericEntries) as import("@/lib/media-studio/types").ClipKeyframeValues;
            const localTime = Math.max(0, Math.min(target.duration, (command.at ?? playhead) - target.start));
            const keyframes = [...(target.keyframes || []).filter((item) => Math.abs(item.time - localTime) > 0.03), { id: \`kf-\${crypto.randomUUID()}\`, time: localTime, easing: easingValue, values }].sort((a, b) => a.time - b.time);
            updateClip(target.id, { keyframes });
          }
        }
        if (command.action === "set_transition" && command.clipId && command.value && typeof command.value === "object") {
          const raw = command.value as Record<string, number | string | boolean>;
          const side = raw.side === "out" ? "out" : "in";
          const allowedKinds: TransitionKind[] = ["none", "fade", "dissolve", "slide-left", "slide-right", "zoom"];
          const kind = typeof raw.kind === "string" && allowedKinds.includes(raw.kind as TransitionKind) ? raw.kind as TransitionKind : "fade";
          const duration = typeof raw.duration === "number" && Number.isFinite(raw.duration) ? Math.max(0, Math.min(4, raw.duration)) : 0.6;
          const transition = { kind, duration: kind === "none" ? 0 : duration };
          updateClip(command.clipId, side === "out" ? { transitionOut: transition } : { transitionIn: transition });
        }`
    media = media.replace(ratioHandler, proHandlers)
  }

  writeFileSync(MEDIA_CLIENT, media)
  const mediaVerified = readFileSync(MEDIA_CLIENT, "utf8")
  for (const required of ["<MediaVisualLayer", "<MediaAudioLayer", 'command.action === "add_keyframe"', 'command.action === "set_transition"']) {
    if (!mediaVerified.includes(required)) throw new Error(`[media-studio-v2] Falta ${required}`)
  }
  console.log("[media-studio-v2] Keyframes, transiciones y Media AI Pro conectados al preview")
}
