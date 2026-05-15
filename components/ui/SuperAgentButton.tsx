"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };
type PanelTab = "tips" | "chat" | "music";
type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  mood: string;
  duration: string;
  src: string;
  cover: string;
};
type Suggestion = { label: string; href: string; emoji: string };
type Tip = {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; href: string };
};

const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "focus-01",
    title: "Deep Focus Flow",
    artist: "EduAI Focus",
    mood: "Lo-fi / estudio",
    duration: "∞",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: "linear-gradient(135deg,#1DB954,#0f172a)",
  },
  {
    id: "focus-02",
    title: "Math Calm Session",
    artist: "EduAI Focus",
    mood: "Clásica suave",
    duration: "∞",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: "linear-gradient(135deg,#22c55e,#2563eb)",
  },
  {
    id: "focus-03",
    title: "Science Ambient",
    artist: "EduAI Focus",
    mood: "Ambient / concentración",
    duration: "∞",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    cover: "linear-gradient(135deg,#14b8a6,#7c3aed)",
  },
];

// ── Context-aware tips per route ────────────────────────────────────────────
function getTipsForPath(path: string): Tip[] {
  if (path.startsWith("/examen/crear"))
    return [
      {
        icon: "✨",
        title: "Genera con IA",
        body: "Usa el botón 'Generar con IA' para crear preguntas automáticamente desde un tema.",
        action: { label: "Ir a crear examen", href: "/examen/crear" },
      },
      {
        icon: "🔗",
        title: "Comparte el link",
        body: "Tras crear el examen te aparece el link para compartir con estudiantes.",
      },
      {
        icon: "🔒",
        title: "Seguridad activa",
        body: "El examen bloquea pantalla completa y registra incidentes automáticamente.",
      },
    ];
  if (path.startsWith("/examen/docente"))
    return [
      {
        icon: "📊",
        title: "Ver resultados",
        body: "Haz clic en 'Ver resultados' en cada examen para revisar notas e incidentes.",
      },
      {
        icon: "🔗",
        title: "Copiar link",
        body: "El botón 'Link' copia la URL del examen al portapapeles con un clic.",
      },
      {
        icon: "🗑️",
        title: "Papelera",
        body: "Los exámenes eliminados van a la papelera y se pueden restaurar.",
      },
    ];
  if (path.startsWith("/examen/resultados"))
    return [
      {
        icon: "📝",
        title: "Revisión manual",
        body: "Puedes ajustar puntajes manualmente en preguntas de desarrollo.",
      },
      {
        icon: "📄",
        title: "Exportar PDF",
        body: "Descarga el informe completo del examen en PDF o Excel.",
      },
      {
        icon: "⚠️",
        title: "Incidentes",
        body: "Revisa el timeline de seguridad para ver si hubo intentos de copia.",
      },
    ];
  if (path.startsWith("/educador"))
    return [
      {
        icon: "📋",
        title: "OAs MINEDUC",
        body: "Los OAs se cargan desde curriculumnacional.mineduc.cl automáticamente.",
      },
      {
        icon: "💾",
        title: "Guardar planificación",
        body: "Guarda tu planificación para exportarla en PDF o Word después.",
        action: {
          label: "Mis planificaciones",
          href: "/educador/planificaciones",
        },
      },
      {
        icon: "🤖",
        title: "IA genera sesiones",
        body: "La IA crea bloques de sesiones completos incluyendo actividades e indicadores.",
      },
    ];
  if (path.startsWith("/study"))
    return [
      {
        icon: "🎯",
        title: "Evalúate",
        body: "Cuando termines de estudiar usa 'Evalúame' para un quiz del tema.",
      },
      {
        icon: "📊",
        title: "Diagnóstico",
        body: "El diagnóstico muestra tus áreas fuertes y débiles del tema estudiado.",
      },
      {
        icon: "⬇️",
        title: "Descarga resumen",
        body: "Puedes descargar un resumen del tema como PDF.",
      },
    ];
  if (path.startsWith("/investigador"))
    return [
      {
        icon: "🔍",
        title: "Fuentes académicas",
        body: "El agente busca en bases académicas y resume los papers más relevantes.",
      },
      {
        icon: "📄",
        title: "Exportar a Paper",
        body: "Puedes enviar los hallazgos directamente al agente de redacción de papers.",
        action: { label: "Ir a Paper", href: "/paper" },
      },
    ];
  if (path.startsWith("/matematico"))
    return [
      {
        icon: "📐",
        title: "LaTeX soportado",
        body: "Puedes escribir ecuaciones con $...$ para mostrarlas formateadas.",
      },
      {
        icon: "📷",
        title: "Fotografía un ejercicio",
        body: "Próximamente: sube una foto de un ejercicio y el agente lo resuelve.",
      },
    ];
  if (
    path.startsWith("/imagenes") ||
    path.startsWith("/image-studio") ||
    path.startsWith("/galeria")
  )
    return [
      {
        icon: "✏️",
        title: "Mejora tu prompt",
        body: "Sé específico: describe el estilo, colores, ambiente y sujeto principal.",
      },
      {
        icon: "🎨",
        title: "Múltiples proveedores",
        body: "Si un proveedor falla, prueba cambiar el modelo desde los ajustes.",
      },
    ];
  if (path.startsWith("/redactor"))
    return [
      {
        icon: "📝",
        title: "Define el tipo de texto",
        body: "Indica si es ensayo, carta formal, informe u otro para mejores resultados.",
      },
      {
        icon: "📏",
        title: "Ajusta la extensión",
        body: "Puedes pedir 'más breve' o 'más detallado' en el mismo chat.",
      },
    ];
  if (path.startsWith("/collab"))
    return [
      {
        icon: "🤝",
        title: "Sala colaborativa",
        body: "Comparte el código de sala con compañeros para estudiar juntos en tiempo real.",
      },
      {
        icon: "🧠",
        title: "Tutor IA",
        body: "Si haces preguntas, el tutor IA responde automáticamente en la sala.",
      },
    ];
  if (path.startsWith("/workspace"))
    return [
      {
        icon: "📁",
        title: "Organiza por proyectos",
        body: "Crea proyectos para agrupar tareas, notas y materiales relacionados.",
      },
      {
        icon: "➕",
        title: "Añadir items",
        body: "Haz clic en el botón verde '+' dentro de cada proyecto para agregar contenido.",
      },
    ];
  if (path.startsWith("/audio-lab"))
    return [
      {
        icon: "🎙️",
        title: "Transcripción automática",
        body: "Sube un archivo de audio y Whisper lo transcribe en segundos.",
      },
      {
        icon: "🌐",
        title: "Detecta idioma",
        body: "El sistema detecta el idioma automáticamente o puedes forzarlo manualmente.",
      },
    ];
  if (path === "/dashboard" || path === "/")
    return [
      {
        icon: "📚",
        title: "Empieza a estudiar",
        body: "Escribe un tema en el buscador del dashboard para iniciar una sesión de estudio.",
        action: { label: "Ir al dashboard", href: "/dashboard" },
      },
      {
        icon: "👨‍🏫",
        title: "¿Eres docente?",
        body: "Accede al planificador MINEDUC o crea exámenes para tus estudiantes.",
        action: { label: "Planificador", href: "/educador" },
      },
      {
        icon: "✦",
        title: "Soy Claw",
        body: "Puedo ayudarte con cualquier cosa — pregúntame lo que quieras aquí abajo.",
      },
    ];
  // Generic fallback
  return [
    {
      icon: "✦",
      title: "Hola, soy Claw",
      body: "Puedo ayudarte a usar cualquier herramienta de EduAI o simplemente conversar.",
    },
    {
      icon: "🗺️",
      title: "Ver todos los agentes",
      body: "EduAI tiene 15+ agentes especializados para distintas tareas.",
      action: { label: "Ver agentes", href: "/agentes" },
    },
  ];
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-200"}`}
    />
  );
}

function MsgContent({ text }: { text: string }) {
  const parts = text.split(
    /(!\[[^\]]*\]\((?:data:image\/[^)]+|https?:\/\/[^)]+)\)|\[[^\]]+\]\([^)]+\)|<audio controls src="data:audio\/mpeg;base64,[^"]+"><\/audio>)/g,
  );
  return (
    <span className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) => {
        const img = p.match(
          /^!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)$/,
        );
        if (img)
          return (
            <img
              key={i}
              src={img[2]}
              alt={img[1] || "Imagen generada"}
              className="my-2 max-h-56 w-full rounded-xl border border-soft object-contain bg-white"
            />
          );

        const audio = p.match(
          /^<audio controls src="(data:audio\/mpeg;base64,[^"]+)"><\/audio>$/,
        );
        if (audio)
          return (
            <audio key={i} controls src={audio[1]} className="mt-2 w-full" />
          );

        const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m)
          return (
            <Link
              key={i}
              href={m[2]}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 font-medium text-xs transition mx-0.5"
            >
              {m[1]} →
            </Link>
          );
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

export default function SuperAgentButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>("tips");
  const [isOnline, setIsOnline] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [hasNewTip, setHasNewTip] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevPath = useRef(pathname);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.65);
  const track = MUSIC_TRACKS[currentTrack];

  const tips = getTipsForPath(pathname || "/");

  // Show badge when page changes
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname || "/";
      setHasNewTip(true);
    }
  }, [pathname]);

  useEffect(() => {
    fetch("/api/superagent", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIsOnline(d.ok))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (musicPlaying) {
      el.play().catch(() => setMusicPlaying(false));
    } else {
      el.pause();
    }
  }, [musicPlaying, currentTrack]);

  const toggleMusic = useCallback(() => {
    setMusicPlaying((v) => !v);
  }, []);

  const nextTrack = useCallback(() => {
    setCurrentTrack((i) => (i + 1) % MUSIC_TRACKS.length);
    setMusicPlaying(true);
  }, []);

  const selectTrack = useCallback((idx: number) => {
    setCurrentTrack(idx);
    setMusicPlaying(true);
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "¡Hola! Soy Claw 👋 Tu asistente en EduAI. Puedo ayudarte como chat global tipo ChatGPT: dudas, clases, exámenes, imágenes, video, música, código y cualquier agente de EduAI. ¿En qué andas hoy?",
        },
      ]);
    }
    if (open) setHasNewTip(false);
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open && tab === "chat")
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, tab]);

  const send = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;
      setInput("");
      setSuggestions([]);
      const newMsgs: Msg[] = [...messages, { role: "user", content: msg }];
      setMessages(newMsgs);
      setLoading(true);
      try {
        const res = await fetch("/api/agents/claw-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, history: newMsgs.slice(-10) }),
        });
        const data = await res.json();
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
          if (data.suggestions?.length) setSuggestions(data.suggestions);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Ups, algo falló 🔁" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Hide completely on exam taking page
  if (pathname?.startsWith("/examen/p/")) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      <audio
        ref={audioRef}
        src={track.src}
        loop
        preload="none"
        onEnded={nextTrack}
      />

      {musicPlaying && (!open || tab !== "music") && (
        <div className="w-[300px] rounded-2xl border border-emerald-400/20 bg-[#0b1510]/95 text-white shadow-2xl shadow-emerald-900/20 px-3 py-2 flex items-center gap-3 backdrop-blur-xl">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner"
            style={{ background: track.cover }}
          >
            ♫
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{track.title}</p>
            <p className="text-[10px] text-emerald-200 truncate">
              {track.mood}
            </p>
          </div>
          <button
            onClick={toggleMusic}
            className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition"
          >
            Ⅱ
          </button>
        </div>
      )}

      {open && (
        <div
          className="w-[350px] sm:w-[410px] rounded-3xl border border-soft bg-app shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(580px, 82vh)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-soft bg-gradient-to-r from-violet-500/8 via-cyan-500/6 to-transparent flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              C
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-main leading-none">
                Claw
              </p>
              <p className="text-[11px] text-muted2 mt-0.5 flex items-center gap-1">
                <StatusDot online={isOnline} />
                {isOnline ? "activo" : "pausado"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-muted2 hover:text-main hover:bg-card-soft-theme transition text-lg"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-soft flex-shrink-0">
            <button
              onClick={() => setTab("tips")}
              className={`flex-1 py-2 text-[11px] font-semibold transition ${tab === "tips" ? "text-violet-700 border-b-2 border-violet-500 bg-violet-50" : "text-muted2 hover:text-sub"}`}
            >
              💡 Sugerencias
            </button>
            <button
              onClick={() => setTab("chat")}
              className={`flex-1 py-2 text-[11px] font-semibold transition ${tab === "chat" ? "text-blue-700 border-b-2 border-blue-500 bg-blue-50" : "text-muted2 hover:text-sub"}`}
            >
              ✦ Chat global
            </button>
            <button
              onClick={() => setTab("music")}
              className={`flex-1 py-2 text-[11px] font-semibold transition ${tab === "music" ? "text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50" : "text-muted2 hover:text-sub"}`}
            >
              ♫ Música
            </button>
          </div>

          {/* TIPS TAB */}
          {tab === "tips" && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              <p className="text-[11px] text-muted2 uppercase tracking-wide mb-1">
                En esta página — {pathname}
              </p>
              {tips.map((tip, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-soft bg-card-soft-theme p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{tip.icon}</span>
                    <p className="text-sm font-semibold text-main">
                      {tip.title}
                    </p>
                  </div>
                  <p className="text-xs text-sub leading-relaxed pl-6">
                    {tip.body}
                  </p>
                  {tip.action && (
                    <div className="pl-6 pt-1">
                      <Link
                        href={tip.action.href}
                        onClick={() => setOpen(false)}
                        className="text-xs text-violet-700 font-medium hover:underline"
                      >
                        {tip.action.label} →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setTab("chat")}
                className="w-full mt-1 py-2.5 rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition"
              >
                ✦ Preguntarle a Claw →
              </button>
            </div>
          )}

          {/* MUSIC TAB */}
          {tab === "music" && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-emerald-500/[0.06] to-transparent">
              <div className="rounded-3xl border border-emerald-400/20 bg-[#07130d] text-white p-4 shadow-inner">
                <div className="flex items-center gap-4">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl shadow-lg"
                    style={{ background: track.cover }}
                  >
                    ♫
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300 font-bold">
                      EduAI Music
                    </p>
                    <h3 className="text-lg font-black leading-tight truncate">
                      {track.title}
                    </h3>
                    <p className="text-xs text-emerald-100/80 truncate">
                      {track.artist} · {track.mood}
                    </p>
                    <p className="text-[10px] text-emerald-200/70 mt-1">
                      Inspirado en experiencia tipo Spotify/OpenSpot. Sigue
                      sonando al navegar.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() =>
                      selectTrack(
                        (currentTrack + MUSIC_TRACKS.length - 1) %
                          MUSIC_TRACKS.length,
                      )
                    }
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 transition"
                  >
                    ‹
                  </button>
                  <button
                    onClick={toggleMusic}
                    className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg shadow-lg shadow-emerald-500/20 transition"
                  >
                    {musicPlaying ? "Ⅱ" : "▶"}
                  </button>
                  <button
                    onClick={nextTrack}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 transition"
                  >
                    ›
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-emerald-100/70 mb-1">
                    <span>Volumen</span>
                    <span>{Math.round(musicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-main">
                    Biblioteca focus
                  </p>
                  <Link
                    href="/exam-focus"
                    onClick={() => setOpen(false)}
                    className="text-[11px] text-emerald-700 font-semibold hover:underline"
                  >
                    Abrir Exam Focus →
                  </Link>
                </div>
                {MUSIC_TRACKS.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => selectTrack(i)}
                    className={`w-full rounded-2xl border px-3 py-2.5 flex items-center gap-3 text-left transition ${i === currentTrack ? "border-emerald-400 bg-emerald-50" : "border-soft bg-card-soft-theme hover:border-emerald-300"}`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ background: t.cover }}
                    >
                      {i === currentTrack && musicPlaying ? "▶" : "♫"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-main truncate">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted2 truncate">
                        {t.mood} · {t.duration}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHAT TAB */}
          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {m.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold mt-0.5">
                        C
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2.5 ${m.role === "user" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-card-soft-theme text-main rounded-tl-sm"}`}
                    >
                      {m.role === "assistant" ? (
                        <MsgContent text={m.content} />
                      ) : (
                        <span className="text-sm">{m.content}</span>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
                      C
                    </div>
                    <div className="bg-card-soft-theme rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                      {[0, 120, 240].map((d) => (
                        <span
                          key={d}
                          className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {suggestions.length > 0 && !loading && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {suggestions.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition"
                      >
                        {s.emoji} {s.label} →
                      </Link>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="flex-shrink-0 px-3 py-3 border-t border-soft bg-app">
                <div className="flex items-end gap-2 bg-card-soft-theme rounded-2xl px-3 py-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    rows={1}
                    disabled={loading}
                    placeholder="Pregunta de todo o pide usar un agente..."
                    className="flex-1 bg-transparent text-sm text-main outline-none resize-none placeholder-gray-400 disabled:opacity-40 max-h-28"
                  />
                  <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center transition"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-muted2">
                    Enter envía · Shift+Enter nueva línea
                  </p>
                  <button
                    onClick={() => setMessages([])}
                    className="text-[10px] text-muted2 hover:text-sub transition"
                  >
                    ↺ limpiar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
      >
        {open ? (
          <span className="text-white text-xl font-bold">×</span>
        ) : (
          <span className="text-2xl">✦</span>
        )}
        {/* Online dot */}
        <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center">
          <StatusDot online={isOnline} />
        </span>
        {/* New tip badge */}
        {!open && hasNewTip && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">
            {tips.length}
          </span>
        )}
      </button>
    </div>
  );
}
