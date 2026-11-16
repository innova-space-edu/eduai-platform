"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, BookOpen, Bot, Calculator, ChevronLeft, ChevronRight, Clock, Cloud, Clapperboard, FilePenLine, FileText, FolderOpen, Globe, GraduationCap, Image, LayoutGrid, Microscope, Mic, Music, Palette, Pause, Play, Presentation, Search, Sparkles, Star, Trophy, Wrench, X } from "lucide-react";

type AgentItem = {
  id: string;
  icon: string;
  name: string;
  description: string;
  color: string;
  glow: string;
  border: string;
  href: string;
  tag: string;
  status?: "active" | "maintenance";
  ctaLabel?: string;
};

const AGENTS: AgentItem[] = [
  {
    id: "educador",
    icon: "🏫",
    name: "Planificador",
    description: "Planificaciones MINEDUC para docentes chilenos",
    color: "from-emerald-500 to-teal-600",
    glow: "rgba(16,185,129,0.15)",
    border: "rgba(16,185,129,0.2)",
    href: "/educador",
    tag: "Docentes",
    status: "active",
  },
  {
    id: "investigador",
    icon: "🔬",
    name: "Investigador",
    description: "Busca y resume fuentes académicas y papers",
    color: "from-blue-500 to-indigo-600",
    glow: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.2)",
    href: "/investigador",
    tag: "Investigación",
    status: "active",
  },
  {
    id: "redactor",
    icon: "✍️",
    name: "Redactor",
    description: "Ensayos, informes, cartas y documentos formales",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.2)",
    href: "/redactor",
    tag: "Escritura",
    status: "active",
  },
  {
    id: "matematico",
    icon: "🧮",
    name: "Matemático",
    description: "Resolución paso a paso con notación LaTeX profesional",
    color: "from-orange-500 to-amber-600",
    glow: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.2)",
    href: "/matematico",
    tag: "Matemáticas",
    status: "active",
  },
  {
    id: "pizarra-interactiva",
    icon: "✍️",
    name: "Pizarra interactiva",
    description:
      "Cuaderno digital con dibujo libre, figuras y gráficos 2D/3D, cámara e imágenes o stickers con IA.",
    color: "from-sky-500 to-blue-600",
    glow: "rgba(14,165,233,0.15)",
    border: "rgba(14,165,233,0.24)",
    href: "/pizarra-interactiva",
    tag: "Cuaderno digital",
    status: "active",
    ctaLabel: "Abrir pizarra",
  },
  {
    id: "cuaderno-creativo",
    icon: "🖍️",
    name: "Cuaderno creativo",
    description:
      "Dibuja, pinta y crea cuadernos con plantillas para colorear subidas o generadas con IA.",
    color: "from-fuchsia-500 to-pink-600",
    glow: "rgba(217,70,239,0.15)",
    border: "rgba(217,70,239,0.24)",
    href: "/cuaderno-creativo",
    tag: "Creativo",
    status: "active",
    ctaLabel: "Abrir cuaderno",
  },
  {
    id: "traductor",
    icon: "🌐",
    name: "Traductor",
    description: "Traducción de textos, documentos y conversación de voz en vivo con MIRA",
    color: "from-cyan-500 to-sky-600",
    glow: "rgba(6,182,212,0.15)",
    border: "rgba(6,182,212,0.2)",
    href: "/traductor",
    tag: "Idiomas",
    status: "active",
  },
  {
    id: "paper",
    icon: "📄",
    name: "Chat Paper",
    description: "Sube un PDF y conversa profundamente sobre su contenido",
    color: "from-indigo-500 to-blue-700",
    glow: "rgba(99,102,241,0.15)",
    border: "rgba(99,102,241,0.2)",
    href: "/paper",
    tag: "PDF",
    status: "active",
  },
  {
    id: "examen",
    icon: "📝",
    name: "Examen",
    description: "Simulacro completo con timer, corrección IA y retroalimentación",
    color: "from-red-500 to-rose-600",
    glow: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.2)",
    href: "/examen",
    tag: "Evaluación",
    status: "active",
  },
  {
    id: "examen-docente",
    icon: "📋",
    name: "Exámenes Docente",
    description: "Crea pruebas con IA, comparte el link y recibe notas automáticas",
    color: "from-red-500 to-orange-600",
    glow: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.2)",
    href: "/examen/docente",
    tag: "Docentes",
    status: "active",
  },
  {
    id: "superagent-chat",
    icon: "🧭",
    name: "Open EDUAI Work",
    description:
      "Espacio robusto para investigar con fuentes, crear, colaborar y ejecutar con todos los agentes de EDUAI",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(37,99,235,0.16)",
    border: "rgba(37,99,235,0.24)",
    href: "/chat-global",
    tag: "General",
    status: "active",
    ctaLabel: "Abrir Open EDUAI Work",
  },
  {
    id: "music-focus",
    icon: "♫",
    name: "EduAI Music",
    description:
      "Reproductor tipo Spotify/OpenSpot con playlists, favoritos y reproducción persistente",
    color: "from-emerald-500 to-green-700",
    glow: "rgba(29,185,84,0.15)",
    border: "rgba(29,185,84,0.25)",
    href: "/music",
    tag: "Creativo",
    status: "active",
    ctaLabel: "Abrir EduAI Music",
  },
  {
    id: "creator-hub",
    icon: "🎨",
    name: "Creator Hub",
    description: "8 sub-agentes: infografías, PPT, podcast, mapas mentales, flashcards y más",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.2)",
    href: "/creator-hub",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "multimedia-studio",
    icon: "🎞️",
    name: "Editor Multimedia",
    description:
      "Edita audio, video e imágenes por capas, integra música y exporta proyectos multimedia desde EduAI.",
    color: "from-cyan-500 to-violet-600",
    glow: "rgba(34,211,238,0.15)",
    border: "rgba(139,92,246,0.24)",
    href: "/multimedia-studio",
    tag: "Creativo",
    status: "active",
    ctaLabel: "Abrir Editor Multimedia",
  },
  {
    id: "audio-lab",
    icon: "🎙️",
    name: "Audio Lab",
    description: "Transcribe audio y video con IA, edita y exporta en TXT, SRT y más",
    color: "from-purple-500 to-fuchsia-600",
    glow: "rgba(168,85,247,0.15)",
    border: "rgba(168,85,247,0.2)",
    href: "/audio-lab",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "image-studio",
    icon: "🖼️",
    name: "Image Studio",
    description:
      "Genera y reutiliza imágenes con Gemini 3.1 primero y proveedores alternativos; incluye Diseño Pro para composiciones avanzadas",
    color: "from-pink-500 to-rose-600",
    glow: "rgba(236,72,153,0.15)",
    border: "rgba(236,72,153,0.2)",
    href: "/image-studio",
    tag: "Creativo",
    status: "active",
    ctaLabel: "Abrir Image Studio",
  },
  {
    id: "video-studio",
    icon: "🎬",
    name: "Video Studio",
    description:
      "Generación de video aún no disponible. Sin generación de videos ni compras de créditos mientras está en mantenimiento.",
    color: "from-cyan-500 to-blue-600",
    glow: "rgba(34,211,238,0.14)",
    border: "rgba(34,211,238,0.24)",
    href: "/video-studio",
    tag: "Creativo",
    status: "maintenance",
    ctaLabel: "Temporalmente no disponible",
  },
  {
    id: "galeria",
    icon: "🖼️",
    name: "Galería",
    description: "Todas tus imágenes generadas, manuales y automáticas durante el estudio",
    color: "from-fuchsia-500 to-pink-600",
    glow: "rgba(217,70,239,0.15)",
    border: "rgba(217,70,239,0.2)",
    href: "/galeria",
    tag: "Creativo",
    status: "active",
  },
  {
    id: "ranking",
    icon: "🏆",
    name: "Ranking",
    description: "Tabla de posiciones global con podio, XP y racha de estudio",
    color: "from-amber-500 to-orange-600",
    glow: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.2)",
    href: "/ranking",
    tag: "Comunidad",
    status: "active",
  },
  {
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

// AGENT_LIBRARY_REPOSITORY_CARDS_V1
const TAGS = Array.from(new Set(AGENTS.map((agent) => agent.tag)));

const AGENT_ICONS = {
  educador: GraduationCap, investigador: Microscope, redactor: FilePenLine,
  matematico: Calculator, "pizarra-interactiva": Presentation, "cuaderno-creativo": Palette,
  traductor: Globe, paper: FileText, examen: FilePenLine, "examen-docente": FilePenLine,
  "superagent-chat": Bot, "music-focus": Music, "creator-hub": Sparkles,
  "multimedia-studio": Clapperboard, "audio-lab": Mic, "image-studio": Image,
  "video-studio": Clapperboard, galeria: Image, ranking: Trophy,
  workspace: FolderOpen, biblioteca: BookOpen, repositorio: Cloud,
} satisfies Record<string, typeof Bot>;

const FEATURED_IDS = ["educador", "investigador", "redactor", "matematico", "pizarra-interactiva", "cuaderno-creativo", "superagent-chat", "examen-docente", "creator-hub"];
const FEATURED = FEATURED_IDS.flatMap((id) => AGENTS.filter((agent) => agent.id === id && agent.status !== "maintenance"));
const PAGE_SIZE = 6;
const STORAGE_KEY = "eduai:agents:preferences:v1";
const STORAGE_EVENT = "eduai:agents:preferences";
const EMPTY_PREFS = '{"favorites":[],"recent":[]}';
type Preferences = { favorites: string[]; recent: string[] };
type View = "all" | "favorites" | "recent";
let memoryPreferences = EMPTY_PREFS;

function getPreferencesSnapshot() {
  try { return localStorage.getItem(STORAGE_KEY) ?? EMPTY_PREFS; }
  catch { return memoryPreferences; }
}

function subscribePreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function parsePreferences(raw: string): Preferences {
  try {
    const value = JSON.parse(raw);
    const valid = (items: unknown) => Array.isArray(items)
      ? [...new Set(items.filter((id): id is string => typeof id === "string" && AGENTS.some((agent) => agent.id === id)))]
      : [];
    return { favorites: valid(value?.favorites), recent: valid(value?.recent).slice(0, 12) };
  } catch { return { favorites: [], recent: [] }; }
}

function updatePreferences(update: (previous: Preferences) => Preferences) {
  const next = JSON.stringify(update(parsePreferences(getPreferencesSnapshot())));
  memoryPreferences = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Browser storage may be unavailable. */ }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const control = "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-medium bg-card-theme px-3.5 text-sm font-medium text-sub shadow-sm transition hover:border-violet-400 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:hover:text-violet-300";
const selected = "border-violet-600 bg-violet-600 text-white hover:bg-violet-700 hover:text-white dark:hover:text-white";

function AgentCard({ agent, favorite, onFavorite, onOpen, featured = false }: {
  agent: AgentItem; favorite: boolean; onFavorite: (id: string) => void;
  onOpen: (id: string) => void; featured?: boolean;
}) {
  const maintenance = agent.status === "maintenance";
  const AgentIcon = AGENT_ICONS[agent.id as keyof typeof AGENT_ICONS] ?? Bot;
  return (
    <article className={`group relative isolate flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border bg-card-theme p-4 shadow-sm transition duration-200 focus-within:ring-2 focus-within:ring-violet-400 motion-safe:hover:-translate-y-0.5 hover:shadow-lg ${featured ? "min-h-48 sm:p-5" : "min-h-40"} ${maintenance ? "opacity-80" : ""}`}
      style={{ borderColor: agent.border, backgroundImage: `linear-gradient(145deg, transparent 45%, ${agent.glow})` }}>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 h-32 w-40 rounded-full opacity-50 transition group-hover:scale-125 motion-reduce:transition-none" style={{ background: agent.glow }} />
      <button type="button" aria-label={favorite ? `Quitar ${agent.name} de favoritos` : `Añadir ${agent.name} a favoritos`} aria-pressed={favorite}
        onClick={() => onFavorite(agent.id)}
        className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-transparent bg-card-theme transition hover:border-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500 ${favorite ? "text-amber-500" : "text-muted2 hover:text-violet-600"}`}>
        <Star size={19} fill={favorite ? "currentColor" : "none"} />
      </button>
      <div className="relative flex flex-1 items-start gap-3.5 pr-8">
        <div aria-hidden="true" className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[1.25rem] bg-gradient-to-br ${agent.color} text-white shadow-md ring-1 ring-white/40 transition duration-300 motion-safe:group-hover:scale-105 ${featured ? "h-[4.5rem] w-[4.5rem]" : "h-14 w-14"}`}
          style={{ boxShadow: `0 8px 20px ${agent.glow}` }}>
          <div className="absolute -left-2 -top-5 h-14 w-16 rotate-[-25deg] rounded-full bg-white/20 blur-sm" />
          <AgentIcon size={featured ? 34 : 27} strokeWidth={1.8} className="relative drop-shadow-sm" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`font-bold leading-tight text-main ${featured ? "text-lg" : "text-base"}`}>{agent.name}</h3>
          <span className="mt-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-sub" style={{ borderColor: agent.border, background: agent.glow }}>{agent.tag}</span>
          <p className="mt-2 text-sm leading-snug text-muted2">{agent.description}</p>
        </div>
      </div>
      <div className="relative mt-3 flex items-center justify-end">
        {maintenance ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200"><Wrench size={13} />{agent.ctaLabel || "En mantención"}</span>
        ) : (
          <Link href={agent.href} prefetch={false} onClick={() => onOpen(agent.id)} aria-label={`Abrir ${agent.name}`}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${featured ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 hover:bg-violet-700" : "border border-violet-300/60 bg-card-theme text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900"}`}>
            {agent.ctaLabel || "Abrir agente"} <ChevronRight size={15} />
          </Link>
        )}
      </div>
    </article>
  );
}

function FeaturedCarousel({ favorites, onFavorite, onOpen }: {
  favorites: string[]; onFavorite: (id: string) => void; onOpen: (id: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [lastIndex, setLastIndex] = useState(FEATURED.length - 1);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => false);
  const step = useCallback(() => {
    const el = track.current;
    if (!el || el.children.length < 2) return 1;
    return (el.children[1] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft || 1;
  }, []);
  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const distance = Math.max(0, el.scrollWidth - el.clientWidth);
    const size = step();
    const end = Math.max(0, Math.round(distance / size));
    setLastIndex(end);
    setIndex(Math.min(end, Math.max(0, Math.round(el.scrollLeft / size))));
  }, [step]);
  const go = useCallback((next: number) => {
    const el = track.current;
    if (!el) return;
    const end = Math.max(0, Math.round((el.scrollWidth - el.clientWidth) / step()));
    const target = next < 0 ? end : next > end ? 0 : next;
    el.scrollTo({ left: target * step(), behavior: reduce ? "auto" : "smooth" });
  }, [reduce, step]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);
  useEffect(() => {
    if (!playing || hovered || focused || reduce || lastIndex === 0) return;
    const timer = window.setInterval(() => {
      const el = track.current;
      if (el && !document.hidden) go(Math.round(el.scrollLeft / step()) + 1);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [playing, hovered, focused, reduce, lastIndex, go, step]);

  return (
    <section aria-label="Agentes destacados" aria-roledescription="carrusel"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      className="rounded-[1.75rem] border border-medium bg-card-theme p-4 shadow-sm sm:p-5"
      style={{ backgroundImage: "linear-gradient(110deg, rgba(96,165,250,.09), rgba(167,139,250,.13), rgba(45,212,191,.07))" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-main"><Sparkles className="text-violet-500" size={21} /> Agentes destacados</h2>
        <div className="flex items-center gap-1.5">
          {!reduce && <button type="button" aria-label={playing ? "Pausar rotación automática" : "Reanudar rotación automática"} onClick={() => setPlaying(!playing)} className={control + " !px-3"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>}
          <button type="button" aria-label="Agente anterior" onClick={() => go(index - 1)} disabled={lastIndex === 0} className={control + " !px-3 disabled:opacity-40"}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Siguiente agente" onClick={() => go(index + 1)} disabled={lastIndex === 0} className={control + " !px-3 disabled:opacity-40"}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div ref={track} onScroll={sync} className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FEATURED.map((agent) => (
          <div key={agent.id} className="w-[calc(100%-0.25rem)] shrink-0 snap-start sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]">
            <AgentCard agent={agent} favorite={favorites.includes(agent.id)} onFavorite={onFavorite} onOpen={onOpen} featured />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1" aria-label="Posiciones del carrusel">
        {Array.from({ length: lastIndex + 1 }, (_, i) => (
          <button key={i} type="button" aria-label={`Ir a posición ${i + 1}`} aria-current={i === index ? "true" : undefined}
            onClick={() => go(i)} className="grid h-7 min-w-7 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-violet-500">
            <span className={`h-2 rounded-full transition-all ${i === index ? "w-5 bg-violet-600" : "w-2 bg-violet-300 dark:bg-violet-800"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}

export default function AgentesPage() {
  const [category, setCategory] = useState("Todos");
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const raw = useSyncExternalStore(subscribePreferences, getPreferencesSnapshot, () => EMPTY_PREFS);
  const { favorites, recent } = useMemo(() => parsePreferences(raw), [raw]);
  const toggleFavorite = (id: string) => updatePreferences((prev) => ({
    ...prev, favorites: prev.favorites.includes(id) ? prev.favorites.filter((item) => item !== id) : [...prev.favorites, id],
  }));
  const openAgent = (id: string) => updatePreferences((prev) => ({
    ...prev, recent: [id, ...prev.recent.filter((item) => item !== id)].slice(0, 12),
  }));
  const changeView = (next: View) => { setView(next); setPage(1); };
  const reset = () => { setView("all"); setCategory("Todos"); setQuery(""); setPage(1); };
  const matches = normalize(query);
  const filtered = AGENTS.filter((agent) =>
    (category === "Todos" || agent.tag === category) &&
    (view === "all" || (view === "favorites" ? favorites : recent).includes(agent.id)) &&
    (!matches || normalize(`${agent.name} ${agent.description} ${agent.tag}`).includes(matches))
  );
  if (view === "recent") filtered.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const visible = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const showFeatured = view === "all" && category === "Todos" && !matches;
  return (
    <div className="min-h-screen bg-app text-main" style={{ backgroundImage: "radial-gradient(ellipse at 12% 0%, rgba(167,139,250,.13), transparent 43%), radial-gradient(ellipse at 90% 12%, rgba(56,189,248,.10), transparent 48%)" }}>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="relative overflow-hidden rounded-[1.75rem] border border-medium bg-card-theme p-4 shadow-sm sm:p-6"
          style={{ backgroundImage: "linear-gradient(115deg, rgba(167,139,250,.15), rgba(96,165,250,.08), rgba(45,212,191,.08))" }}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full border border-violet-400/20 ring-[22px] ring-violet-300/10" />
          <div className="relative flex items-center gap-3">
            <Link href="/dashboard" aria-label="Volver al inicio" className={control + " !px-3"}><ArrowLeft size={18} /></Link>
            <div aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-violet-500/20"><Bot size={27} /></div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Agentes de IA</h1>
              <p className="text-xs text-muted2 sm:text-sm">{AGENTS.length} agentes especializados para aprender, enseñar y crear.</p>
            </div>
          </div>
          <div className="relative mt-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative flex min-w-0 flex-1 items-center rounded-full border border-medium bg-card-theme shadow-sm focus-within:ring-2 focus-within:ring-violet-400">
              <Search size={19} className="ml-4 shrink-0 text-muted2" />
              <input aria-label="Buscar agentes" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por nombre, tema o tarea..." className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:text-muted2 [&::-webkit-search-cancel-button]:hidden" />
              {query && <button type="button" aria-label="Borrar búsqueda" onClick={() => { setQuery(""); setPage(1); }} className="mr-2 grid h-9 w-9 place-items-center rounded-full text-muted2 hover:bg-overlay-theme focus-visible:outline-2 focus-visible:outline-violet-500"><X size={17} /></button>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={view === "favorites"} onClick={() => changeView(view === "favorites" ? "all" : "favorites")} className={control + (view === "favorites" ? " " + selected : "")}><Star size={17} /> Favoritos <span className="text-xs opacity-75">{favorites.length}</span></button>
              <button type="button" aria-pressed={view === "recent"} onClick={() => changeView(view === "recent" ? "all" : "recent")} className={control + (view === "recent" ? " " + selected : "")}><Clock size={17} /> Recientes</button>
            </div>
          </div>
        </header>

        <nav aria-label="Categorías de agentes" className="flex gap-2 overflow-x-auto rounded-2xl border border-medium bg-card-theme p-2 shadow-sm [scrollbar-width:thin]">
          {["Todos", ...TAGS].map((tag) => (
            <button key={tag} type="button" aria-pressed={category === tag} onClick={() => { setCategory(tag); setPage(1); }} className={control + " whitespace-nowrap " + (category === tag ? selected : "")}>
              {tag === "Todos" && <LayoutGrid size={15} />}
              {tag} <span className="text-xs opacity-75">{tag === "Todos" ? AGENTS.length : AGENTS.filter((agent) => agent.tag === tag).length}</span>
            </button>
          ))}
        </nav>

        {showFeatured && <FeaturedCarousel favorites={favorites} onFavorite={toggleFavorite} onOpen={openAgent} />}

        <section aria-labelledby="agent-catalog-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="agent-catalog-heading" className="text-lg font-bold">{view === "favorites" ? "Tus favoritos" : view === "recent" ? "Utilizados recientemente" : category === "Todos" ? "Explorar herramientas" : category}</h2>
              <p aria-live="polite" className="text-xs text-muted2">{filtered.length} {filtered.length === 1 ? "agente" : "agentes"}{filtered.length > PAGE_SIZE ? ` · Página ${activePage} de ${totalPages}` : ""}</p>
            </div>
            {!showFeatured && <button type="button" onClick={reset} className={control}>Ver todos <X size={14} /></button>}
          </div>
          {visible.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((agent) => <AgentCard key={agent.id} agent={agent} favorite={favorites.includes(agent.id)} onFavorite={toggleFavorite} onOpen={openAgent} />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-medium bg-card-theme p-8 text-center">
              <Search size={28} className="mx-auto mb-3 text-violet-500" />
              <p className="font-semibold">No hay agentes en esta vista</p>
              <p className="mt-1 text-sm text-muted2">Prueba otra búsqueda, categoría o añade tus herramientas a favoritos.</p>
              <button type="button" onClick={reset} className={control + " mt-4"}>Explorar todos</button>
            </div>
          )}
          {totalPages > 1 && (
            <nav aria-label="Páginas del catálogo" className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button type="button" aria-label="Página anterior" disabled={activePage === 1} onClick={() => setPage(activePage - 1)} className={control + " disabled:cursor-not-allowed disabled:opacity-40"}><ChevronLeft size={17} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => <button key={number} type="button" aria-label={`Página ${number}`} aria-current={number === activePage ? "page" : undefined} onClick={() => setPage(number)} className={control + (number === activePage ? " " + selected : "")}>{number}</button>)}
              <button type="button" aria-label="Página siguiente" disabled={activePage === totalPages} onClick={() => setPage(activePage + 1)} className={control + " disabled:cursor-not-allowed disabled:opacity-40"}><ChevronRight size={17} /></button>
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}
