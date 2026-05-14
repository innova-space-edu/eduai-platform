// lib/agents/music-agent.ts
// ─────────────────────────────────────────────────────────────────────────────
// MusicAgent — modo focus con música ambient para estudiar.
// Usa streams de YouTube/SoundCloud embebidos + Pollinations Audio (gratis).
// No requiere API key para el modo básico.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type MusicMood =
  | "focus"       // concentración profunda
  | "calm"        // relajación suave
  | "energetic"   // energía para estudiar
  | "nature"      // sonidos de naturaleza
  | "classical"   // música clásica

export type MusicActivity =
  | "studying"    // estudio general
  | "exam"        // durante evaluación
  | "reading"     // lectura
  | "creative"    // trabajo creativo
  | "break"       // descanso

export interface MusicTrack {
  id:          string
  title:       string
  mood:        MusicMood
  activity:    MusicActivity[]
  embedUrl?:   string       // URL para iframe embed
  streamUrl?:  string       // URL directa de audio
  duration?:   number       // minutos
  description: string
  tags:        string[]
}

export interface MusicSession {
  mood:      MusicMood
  activity:  MusicActivity
  tracks:    MusicTrack[]
  current:   number
  volume:    number          // 0-1
  isPlaying: boolean
}

export interface MusicRecommendation {
  mood:        MusicMood
  tracks:      MusicTrack[]
  reason:      string
  studyTips:   string[]
}

// ── Biblioteca de tracks (streams públicos gratuitos) ────────────────────────
// Usando YouTube embeds (legal para uso educativo) + URLs públicas lo-fi

export const MUSIC_LIBRARY: MusicTrack[] = [
  // ── Focus ───────────────────────────────────────────────────────────────
  {
    id:          "lofi-chill-1",
    title:       "Lo-Fi Chill Study Beats",
    mood:        "focus",
    activity:    ["studying", "exam", "reading"],
    embedUrl:    "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&loop=1",
    description: "Beats tranquilos para concentración profunda",
    tags:        ["lofi", "beats", "concentración"],
  },
  {
    id:          "lofi-study-2",
    title:       "Lofi Hip Hop — Study Session",
    mood:        "focus",
    activity:    ["studying", "reading"],
    embedUrl:    "https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&loop=1",
    description: "Música lo-fi clásica para sesiones de estudio largas",
    tags:        ["lofi", "hiphop", "estudio"],
  },
  {
    id:          "ambient-focus-1",
    title:       "Deep Focus — Ambient Soundscape",
    mood:        "focus",
    activity:    ["studying", "exam", "creative"],
    embedUrl:    "https://www.youtube.com/embed/n61ULEU7CO0?autoplay=1&loop=1",
    description: "Paisaje sonoro ambient para foco total",
    tags:        ["ambient", "foco", "profundo"],
  },

  // ── Calm ────────────────────────────────────────────────────────────────
  {
    id:          "calm-piano-1",
    title:       "Piano Suave — Relajación",
    mood:        "calm",
    activity:    ["studying", "reading", "break"],
    embedUrl:    "https://www.youtube.com/embed/77ZozI0rw7w?autoplay=1&loop=1",
    description: "Piano suave para estudiar sin estrés",
    tags:        ["piano", "calm", "relajación"],
  },
  {
    id:          "calm-nature-rain",
    title:       "Lluvia Suave — Concentración",
    mood:        "calm",
    activity:    ["studying", "reading", "exam"],
    embedUrl:    "https://www.youtube.com/embed/mPZkdNFkNps?autoplay=1&loop=1",
    description: "Sonido de lluvia para calmar la mente",
    tags:        ["lluvia", "naturaleza", "calm"],
  },

  // ── Energetic ───────────────────────────────────────────────────────────
  {
    id:          "energetic-study-1",
    title:       "Upbeat Study Music",
    mood:        "energetic",
    activity:    ["studying", "creative"],
    embedUrl:    "https://www.youtube.com/embed/36YnV9STBqc?autoplay=1&loop=1",
    description: "Música energética para mantener el ritmo de estudio",
    tags:        ["upbeat", "energía", "motivación"],
  },

  // ── Nature ──────────────────────────────────────────────────────────────
  {
    id:          "nature-forest",
    title:       "Bosque — Sonidos de Naturaleza",
    mood:        "nature",
    activity:    ["studying", "break", "reading"],
    embedUrl:    "https://www.youtube.com/embed/xNN7iTA57jM?autoplay=1&loop=1",
    description: "Sonidos del bosque para un ambiente relajado",
    tags:        ["bosque", "naturaleza", "pájaros"],
  },
  {
    id:          "nature-ocean",
    title:       "Océano — Olas y Brisa",
    mood:        "nature",
    activity:    ["studying", "break"],
    embedUrl:    "https://www.youtube.com/embed/bn9F19Hi1Lk?autoplay=1&loop=1",
    description: "Olas del océano para relajar y concentrar",
    tags:        ["océano", "olas", "naturaleza"],
  },

  // ── Classical ───────────────────────────────────────────────────────────
  {
    id:          "classical-mozart",
    title:       "Mozart para Estudiar",
    mood:        "classical",
    activity:    ["studying", "exam", "reading"],
    embedUrl:    "https://www.youtube.com/embed/Rb0UmrCXxVA?autoplay=1&loop=1",
    description: "Mozart y música clásica para potenciar el aprendizaje",
    tags:        ["mozart", "clásica", "aprendizaje"],
  },
  {
    id:          "classical-bach",
    title:       "Bach — Música para el Cerebro",
    mood:        "classical",
    activity:    ["studying", "creative"],
    embedUrl:    "https://www.youtube.com/embed/Y_frNJnMgJo?autoplay=1&loop=1",
    description: "Bach para activar el pensamiento analítico",
    tags:        ["bach", "clásica", "analítico"],
  },
]

// ── Lógica de recomendación ───────────────────────────────────────────────────

const MOOD_FOR_ACTIVITY: Record<MusicActivity, MusicMood> = {
  studying:  "focus",
  exam:      "calm",
  reading:   "calm",
  creative:  "energetic",
  break:     "nature",
}

const STUDY_TIPS: Record<MusicMood, string[]> = {
  focus: [
    "Técnica Pomodoro: 25 min estudio, 5 min descanso",
    "Mantén el volumen bajo (40-50%) para no distraerte",
    "Evita escuchar letras si estudias textos",
  ],
  calm: [
    "Respira profundo 3 veces antes de comenzar",
    "Esta música reduce el cortisol (hormona del estrés)",
    "Ideal para repasos y lectura comprensiva",
  ],
  energetic: [
    "Úsala para tareas mecánicas o memorización",
    "Toma agua cada 30 minutos",
    "Alterna con música más calmada cada hora",
  ],
  nature: [
    "Los sonidos de naturaleza reducen la ansiedad hasta 37%",
    "Ideal para descansos activos de 5-10 minutos",
    "Sal al exterior si puedes durante el break",
  ],
  classical: [
    "El 'efecto Mozart' potencia el razonamiento espacial",
    "Bach activa el pensamiento analítico",
    "Ideal para matemáticas y ciencias exactas",
  ],
}

/**
 * recommendMusic — recomienda música según actividad y contexto.
 */
export function recommendMusic(
  activity: MusicActivity,
  subject?: string,
  pieMode?: boolean
): MusicRecommendation {
  // Para exámenes PIE, siempre recomendar calm
  let mood: MusicMood = MOOD_FOR_ACTIVITY[activity]

  if (pieMode && activity === "exam") mood = "calm"

  // Para matemática/física en estudio, classical es mejor
  if (activity === "studying" && subject) {
    const s = subject.toLowerCase()
    if (s.includes("matemát") || s.includes("físic") || s.includes("química")) {
      mood = "classical"
    }
  }

  const tracks = MUSIC_LIBRARY.filter(
    t => t.mood === mood && t.activity.includes(activity)
  )

  const reason =
    mood === "calm"      ? "Música calmante para mantener la concentración sin estrés." :
    mood === "focus"     ? "Beats lo-fi para foco profundo sin distracciones." :
    mood === "classical" ? "Música clásica para potenciar el razonamiento analítico." :
    mood === "nature"    ? "Sonidos de naturaleza para reducir la ansiedad." :
    "Música energética para mantener el ritmo."

  return {
    mood,
    tracks,
    reason,
    studyTips: STUDY_TIPS[mood] ?? [],
  }
}

/**
 * getTrackById — obtiene un track específico.
 */
export function getTrackById(id: string): MusicTrack | undefined {
  return MUSIC_LIBRARY.find(t => t.id === id)
}

/**
 * getTracksByMood — filtra tracks por estado de ánimo.
 */
export function getTracksByMood(mood: MusicMood): MusicTrack[] {
  return MUSIC_LIBRARY.filter(t => t.mood === mood)
}

/**
 * createMusicSession — crea una sesión de música con estado inicial.
 */
export function createMusicSession(
  activity: MusicActivity,
  subject?: string,
  pieMode?: boolean
): MusicSession {
  const rec = recommendMusic(activity, subject, pieMode)
  return {
    mood:      rec.mood,
    activity,
    tracks:    rec.tracks,
    current:   0,
    volume:    0.4,
    isPlaying: false,
  }
}
