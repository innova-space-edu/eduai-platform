export type EduMusicMood =
  | "focus"
  | "calm"
  | "classical"
  | "nature"
  | "energy"
  | "deep"
  | "reading"
  | "creative";

export type EduMusicTrackSource =
  | "eduai"
  | "itunes"
  | "jamendo"
  | "audius"
  | "youtube"
  | "radio"
  | "external";

export type EduMusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  mood: EduMusicMood;
  duration: string;
  src: string;
  cover: string;
  tags: string[];
  source?: EduMusicTrackSource;
  externalUrl?: string;
  artworkUrl?: string;
  youtubeVideoId?: string;
  videoEmbedUrl?: string;
  videoThumbnail?: string;
};

export type EduMusicPlaylist = {
  id: string;
  name: string;
  description: string;
  mood: EduMusicMood | "mixed";
  cover: string;
  trackIds: string[];
  system?: boolean;
};

export type ExternalMusicCollection = {
  id: string;
  name: string;
  description: string;
  provider:
    | "YouTube"
    | "Spotify"
    | "Jamendo"
    | "Audius"
    | "Free Music Archive"
    | "Internet Archive";
  url: string;
  searchUrl?: string;
};

const SH = (n: number) =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${((n - 1) % 16) + 1}.mp3`;

const covers = {
  blue: "linear-gradient(135deg,#38bdf8,#2563eb)",
  mint: "linear-gradient(135deg,#6ee7b7,#10b981)",
  violet: "linear-gradient(135deg,#c4b5fd,#7c3aed)",
  amber: "linear-gradient(135deg,#fde68a,#f97316)",
  rose: "linear-gradient(135deg,#fbcfe8,#ec4899)",
  sky: "linear-gradient(135deg,#bae6fd,#0ea5e9)",
  slate: "linear-gradient(135deg,#cbd5e1,#64748b)",
  green: "linear-gradient(135deg,#bbf7d0,#22c55e)",
  indigo: "linear-gradient(135deg,#bfdbfe,#4f46e5)",
  cyan: "linear-gradient(135deg,#a5f3fc,#0891b2)",
};

export const EDU_MUSIC_TRACKS: EduMusicTrack[] = [
  {
    id: "edu-focus-01",
    title: "Focus claro",
    artist: "EduAI Studio",
    album: "Aula tranquila",
    mood: "focus",
    duration: "6:12",
    src: SH(1),
    cover: covers.blue,
    tags: ["estudio", "sin letra", "foco"],
    source: "eduai",
  },
  {
    id: "edu-calm-02",
    title: "Respira antes de la prueba",
    artist: "EduAI Calm",
    album: "Pausa activa",
    mood: "calm",
    duration: "5:48",
    src: SH(2),
    cover: covers.mint,
    tags: ["calma", "examen", "relajación"],
    source: "eduai",
  },
  {
    id: "edu-math-03",
    title: "Cálculo suave",
    artist: "EduAI STEM",
    album: "Matemática focus",
    mood: "classical",
    duration: "7:03",
    src: SH(3),
    cover: covers.violet,
    tags: ["matemática", "stem", "análisis"],
    source: "eduai",
  },
  {
    id: "edu-reading-04",
    title: "Lectura con lluvia",
    artist: "EduAI Nature",
    album: "Lectura lenta",
    mood: "reading",
    duration: "5:30",
    src: SH(4),
    cover: covers.cyan,
    tags: ["lectura", "lluvia", "silencio"],
    source: "eduai",
  },
  {
    id: "edu-deep-05",
    title: "Deep work docente",
    artist: "EduAI Lab",
    album: "Planificación",
    mood: "deep",
    duration: "6:44",
    src: SH(5),
    cover: covers.indigo,
    tags: ["deep work", "planificación", "profesor"],
    source: "eduai",
  },
  {
    id: "edu-creative-06",
    title: "Ideas para proyectos",
    artist: "EduAI Creative",
    album: "Canva educativo",
    mood: "creative",
    duration: "5:58",
    src: SH(6),
    cover: covers.amber,
    tags: ["creatividad", "afiches", "ppt"],
    source: "eduai",
  },
  {
    id: "edu-history-07",
    title: "Línea de tiempo",
    artist: "EduAI Humanities",
    album: "Historia focus",
    mood: "focus",
    duration: "6:21",
    src: SH(7),
    cover: covers.amber,
    tags: ["historia", "memoria", "lectura"],
    source: "eduai",
  },
  {
    id: "edu-biology-08",
    title: "Células en calma",
    artist: "EduAI Science",
    album: "Biología focus",
    mood: "calm",
    duration: "7:19",
    src: SH(8),
    cover: covers.green,
    tags: ["biología", "ciencias", "calma"],
    source: "eduai",
  },
  {
    id: "edu-coding-09",
    title: "Código limpio",
    artist: "EduAI Coding",
    album: "Programación",
    mood: "deep",
    duration: "5:36",
    src: SH(9),
    cover: covers.sky,
    tags: ["código", "programación", "concentración"],
    source: "eduai",
  },
  {
    id: "edu-classroom-10",
    title: "Inicio de clase",
    artist: "EduAI Classroom",
    album: "Ambiente aula",
    mood: "calm",
    duration: "6:05",
    src: SH(10),
    cover: covers.slate,
    tags: ["aula", "inicio", "suave"],
    source: "eduai",
  },
  {
    id: "edu-lab-11",
    title: "Laboratorio mental",
    artist: "EduAI Science",
    album: "Ciencias",
    mood: "focus",
    duration: "6:35",
    src: SH(11),
    cover: covers.mint,
    tags: ["química", "física", "laboratorio"],
    source: "eduai",
  },
  {
    id: "edu-writing-12",
    title: "Escritura clara",
    artist: "EduAI Writer",
    album: "Redacción",
    mood: "reading",
    duration: "5:47",
    src: SH(12),
    cover: covers.rose,
    tags: ["redacción", "ensayo", "lenguaje"],
    source: "eduai",
  },
  {
    id: "edu-geometry-13",
    title: "Geometría tranquila",
    artist: "EduAI STEM",
    album: "Formas",
    mood: "classical",
    duration: "6:58",
    src: SH(13),
    cover: covers.sky,
    tags: ["geometría", "matemática", "figuras"],
    source: "eduai",
  },
  {
    id: "edu-memory-14",
    title: "Memoria activa",
    artist: "EduAI Study",
    album: "Repaso",
    mood: "energy",
    duration: "6:02",
    src: SH(14),
    cover: covers.amber,
    tags: ["repaso", "flashcards", "energía"],
    source: "eduai",
  },
  {
    id: "edu-ambient-15",
    title: "Ambiente biblioteca",
    artist: "EduAI Ambient",
    album: "Biblioteca",
    mood: "nature",
    duration: "7:12",
    src: SH(15),
    cover: covers.green,
    tags: ["biblioteca", "lectura", "ambiente"],
    source: "eduai",
  },
  {
    id: "edu-focus-16",
    title: "Sesión 25 minutos",
    artist: "EduAI Pomodoro",
    album: "Focus timer",
    mood: "focus",
    duration: "6:28",
    src: SH(16),
    cover: covers.blue,
    tags: ["pomodoro", "focus", "estudio"],
    source: "eduai",
  },
  {
    id: "edu-piano-17",
    title: "Piano para resolver",
    artist: "EduAI Piano",
    album: "Estudio sin letra",
    mood: "classical",
    duration: "6:17",
    src: SH(1),
    cover: covers.violet,
    tags: ["piano", "ecuaciones", "sin letra"],
    source: "eduai",
  },
  {
    id: "edu-soft-18",
    title: "Tarde de estudio",
    artist: "EduAI Soft",
    album: "Después de clases",
    mood: "calm",
    duration: "5:54",
    src: SH(2),
    cover: covers.mint,
    tags: ["tarde", "suave", "relax"],
    source: "eduai",
  },
  {
    id: "edu-lofi-19",
    title: "Lofi de laboratorio",
    artist: "EduAI Beats",
    album: "Science beats",
    mood: "focus",
    duration: "6:39",
    src: SH(3),
    cover: covers.cyan,
    tags: ["lofi", "ciencias", "foco"],
    source: "eduai",
  },
  {
    id: "edu-literature-20",
    title: "Lectura profunda",
    artist: "EduAI Letters",
    album: "Lenguaje",
    mood: "reading",
    duration: "6:11",
    src: SH(4),
    cover: covers.rose,
    tags: ["libro", "comprensión", "lectura"],
    source: "eduai",
  },
  {
    id: "edu-project-21",
    title: "Diseñar afiches",
    artist: "EduAI Creative",
    album: "Diseño escolar",
    mood: "creative",
    duration: "5:49",
    src: SH(5),
    cover: covers.amber,
    tags: ["diseño", "canva", "afiche"],
    source: "eduai",
  },
  {
    id: "edu-exam-22",
    title: "Preparación final",
    artist: "EduAI Calm",
    album: "Antes de rendir",
    mood: "calm",
    duration: "6:03",
    src: SH(6),
    cover: covers.green,
    tags: ["prueba", "ansiedad", "calma"],
    source: "eduai",
  },
  {
    id: "edu-stem-23",
    title: "Vectores suaves",
    artist: "EduAI STEM",
    album: "Física tranquila",
    mood: "classical",
    duration: "7:01",
    src: SH(7),
    cover: covers.indigo,
    tags: ["física", "vectores", "stem"],
    source: "eduai",
  },
  {
    id: "edu-rain-24",
    title: "Lluvia en biblioteca",
    artist: "EduAI Nature",
    album: "Ambientes",
    mood: "nature",
    duration: "6:56",
    src: SH(8),
    cover: covers.green,
    tags: ["lluvia", "biblioteca", "ambiente"],
    source: "eduai",
  },
  {
    id: "edu-dashboard-25",
    title: "Plan de clases",
    artist: "EduAI Teacher",
    album: "Docente",
    mood: "deep",
    duration: "6:42",
    src: SH(9),
    cover: covers.slate,
    tags: ["docente", "planificación", "trabajo"],
    source: "eduai",
  },
  {
    id: "edu-softpop-26",
    title: "Energía suave",
    artist: "EduAI Energy",
    album: "Activación",
    mood: "energy",
    duration: "5:41",
    src: SH(10),
    cover: covers.amber,
    tags: ["energía", "inicio", "dinámica"],
    source: "eduai",
  },
  {
    id: "edu-chem-27",
    title: "Reacciones en calma",
    artist: "EduAI Science",
    album: "Química",
    mood: "focus",
    duration: "6:22",
    src: SH(11),
    cover: covers.mint,
    tags: ["química", "reacciones", "laboratorio"],
    source: "eduai",
  },
  {
    id: "edu-stat-28",
    title: "Estadística tranquila",
    artist: "EduAI Math",
    album: "Datos",
    mood: "classical",
    duration: "6:57",
    src: SH(12),
    cover: covers.violet,
    tags: ["estadística", "datos", "gráficos"],
    source: "eduai",
  },
  {
    id: "edu-ai-29",
    title: "IA para estudiar",
    artist: "EduAI Future",
    album: "Tecnología",
    mood: "deep",
    duration: "5:59",
    src: SH(13),
    cover: covers.sky,
    tags: ["ia", "tecnología", "proyecto"],
    source: "eduai",
  },
  {
    id: "edu-calm-30",
    title: "Respiración 4-4",
    artist: "EduAI Calm",
    album: "Pausa breve",
    mood: "calm",
    duration: "5:35",
    src: SH(14),
    cover: covers.green,
    tags: ["respirar", "pausa", "calma"],
    source: "eduai",
  },
  {
    id: "edu-focus-31",
    title: "Modo silencio",
    artist: "EduAI Studio",
    album: "Concentración",
    mood: "focus",
    duration: "6:46",
    src: SH(15),
    cover: covers.blue,
    tags: ["silencio", "focus", "sin letra"],
    source: "eduai",
  },
  {
    id: "edu-creative-32",
    title: "Storyboard educativo",
    artist: "EduAI Creative",
    album: "Video ideas",
    mood: "creative",
    duration: "6:13",
    src: SH(16),
    cover: covers.rose,
    tags: ["video", "storyboard", "creatividad"],
    source: "eduai",
  },
  {
    id: "edu-read-33",
    title: "Ensayo con calma",
    artist: "EduAI Writer",
    album: "Escritura",
    mood: "reading",
    duration: "6:08",
    src: SH(1),
    cover: covers.rose,
    tags: ["ensayo", "redacción", "lectura"],
    source: "eduai",
  },
  {
    id: "edu-nature-34",
    title: "Bosque para leer",
    artist: "EduAI Nature",
    album: "Ambiente natural",
    mood: "nature",
    duration: "7:05",
    src: SH(2),
    cover: covers.green,
    tags: ["bosque", "naturaleza", "lectura"],
    source: "eduai",
  },
  {
    id: "edu-energy-35",
    title: "Activación de curso",
    artist: "EduAI Energy",
    album: "Inicio dinámico",
    mood: "energy",
    duration: "5:44",
    src: SH(3),
    cover: covers.amber,
    tags: ["curso", "energía", "inicio"],
    source: "eduai",
  },
  {
    id: "edu-deep-36",
    title: "Corrección de pruebas",
    artist: "EduAI Teacher",
    album: "Trabajo docente",
    mood: "deep",
    duration: "6:51",
    src: SH(4),
    cover: covers.slate,
    tags: ["corrección", "docente", "evaluación"],
    source: "eduai",
  },
  {
    id: "edu-math-37",
    title: "Álgebra sin presión",
    artist: "EduAI Math",
    album: "Ecuaciones",
    mood: "classical",
    duration: "6:32",
    src: SH(5),
    cover: covers.indigo,
    tags: ["álgebra", "ecuaciones", "matemática"],
    source: "eduai",
  },
  {
    id: "edu-focus-38",
    title: "Bloque de concentración",
    artist: "EduAI Pomodoro",
    album: "Trabajo guiado",
    mood: "focus",
    duration: "6:25",
    src: SH(6),
    cover: covers.blue,
    tags: ["bloque", "concentración", "pomodoro"],
    source: "eduai",
  },
  {
    id: "edu-calm-39",
    title: "Entrada serena",
    artist: "EduAI Classroom",
    album: "Aula amable",
    mood: "calm",
    duration: "5:57",
    src: SH(7),
    cover: covers.mint,
    tags: ["aula", "sereno", "calma"],
    source: "eduai",
  },
  {
    id: "edu-tech-40",
    title: "Tecnología y sociedad",
    artist: "EduAI Future",
    album: "Ciencias ciudadanía",
    mood: "deep",
    duration: "6:37",
    src: SH(8),
    cover: covers.sky,
    tags: ["tecnología", "sociedad", "investigación"],
    source: "eduai",
  },
];

export const SYSTEM_PLAYLISTS: EduMusicPlaylist[] = [
  {
    id: "pl-all",
    name: "Todas las canciones",
    description: "Biblioteca completa de EduAI Music para estudiar y trabajar.",
    mood: "mixed",
    cover: covers.blue,
    trackIds: EDU_MUSIC_TRACKS.map((track) => track.id),
    system: true,
  },
  {
    id: "pl-focus",
    name: "Focus profundo",
    description: "Para estudiar, resolver ejercicios o avanzar en informes.",
    mood: "focus",
    cover: covers.blue,
    trackIds: [
      "edu-focus-01",
      "edu-history-07",
      "edu-lab-11",
      "edu-focus-16",
      "edu-lofi-19",
      "edu-focus-31",
      "edu-focus-38",
    ],
    system: true,
  },
  {
    id: "pl-exam",
    name: "Antes de una prueba",
    description: "Música tranquila para bajar ansiedad y mantener foco.",
    mood: "calm",
    cover: covers.mint,
    trackIds: [
      "edu-calm-02",
      "edu-biology-08",
      "edu-classroom-10",
      "edu-exam-22",
      "edu-calm-30",
      "edu-calm-39",
    ],
    system: true,
  },
  {
    id: "pl-stem",
    name: "STEM / Matemática",
    description: "Ideal para cálculo, física, programación y análisis.",
    mood: "classical",
    cover: covers.violet,
    trackIds: [
      "edu-math-03",
      "edu-coding-09",
      "edu-geometry-13",
      "edu-lab-11",
      "edu-stem-23",
      "edu-stat-28",
      "edu-math-37",
    ],
    system: true,
  },
  {
    id: "pl-reading",
    name: "Lectura y redacción",
    description: "Ambiente suave para leer, escribir y preparar informes.",
    mood: "reading",
    cover: covers.rose,
    trackIds: [
      "edu-reading-04",
      "edu-writing-12",
      "edu-ambient-15",
      "edu-literature-20",
      "edu-read-33",
      "edu-nature-34",
    ],
    system: true,
  },
  {
    id: "pl-creative",
    name: "Crear proyectos",
    description: "Para diseñar, escribir, hacer afiches, PPT o videos.",
    mood: "creative",
    cover: covers.amber,
    trackIds: [
      "edu-creative-06",
      "edu-memory-14",
      "edu-classroom-10",
      "edu-project-21",
      "edu-creative-32",
    ],
    system: true,
  },
  {
    id: "pl-teacher",
    name: "Trabajo docente",
    description: "Planificación, corrección, informes y diseño de materiales.",
    mood: "deep",
    cover: covers.slate,
    trackIds: [
      "edu-deep-05",
      "edu-dashboard-25",
      "edu-deep-36",
      "edu-tech-40",
      "edu-ai-29",
    ],
    system: true,
  },
];

export const EXTERNAL_MUSIC_COLLECTIONS: ExternalMusicCollection[] = [
  {
    id: "jamendo",
    name: "Jamendo — música independiente",
    provider: "Jamendo",
    description:
      "Catálogo de música independiente. Ideal si configuras JAMENDO_CLIENT_ID.",
    url: "https://www.jamendo.com/search?qs=q=study",
    searchUrl: "https://www.jamendo.com/search?qs=q=",
  },
  {
    id: "audius",
    name: "Audius — música abierta",
    provider: "Audius",
    description: "Red musical con API para tracks, usuarios y playlists.",
    url: "https://audius.co/search/tracks/study",
    searchUrl: "https://audius.co/search/tracks/",
  },
  {
    id: "yt-focus",
    name: "YouTube — focus music",
    provider: "YouTube",
    description:
      "Búsqueda externa de música de concentración. Se abre en una nueva pestaña.",
    url: "https://www.youtube.com/results?search_query=focus+music+for+studying+no+lyrics",
    searchUrl: "https://www.youtube.com/results?search_query=",
  },
  {
    id: "yt-lofi",
    name: "YouTube — lofi study",
    provider: "YouTube",
    description: "Listas lofi para estudiar y trabajar.",
    url: "https://www.youtube.com/results?search_query=lofi+study+playlist",
    searchUrl: "https://www.youtube.com/results?search_query=",
  },
  {
    id: "spotify-focus",
    name: "Spotify — focus playlists",
    provider: "Spotify",
    description:
      "Listas externas de Spotify. El control directo requiere cuenta compatible.",
    url: "https://open.spotify.com/search/focus%20study%20playlist",
  },
  {
    id: "fma",
    name: "Free Music Archive",
    provider: "Free Music Archive",
    description: "Música abierta/independiente para explorar según licencia.",
    url: "https://freemusicarchive.org/search/?quicksearch=study",
  },
  {
    id: "archive",
    name: "Internet Archive Audio",
    provider: "Internet Archive",
    description:
      "Archivo público de audio. Revisa licencia antes de usar en materiales.",
    url: "https://archive.org/details/audio?query=ambient+study",
  },
];

export const MOOD_LABELS: Record<EduMusicMood | "mixed", string> = {
  focus: "Focus",
  calm: "Calma",
  classical: "STEM",
  nature: "Naturaleza",
  energy: "Energía",
  deep: "Deep work",
  reading: "Lectura",
  creative: "Creatividad",
  mixed: "Mixta",
};

export function getTrackById(id: string) {
  return EDU_MUSIC_TRACKS.find((track) => track.id === id);
}

export function getTracksForPlaylist(
  playlist: EduMusicPlaylist,
  tracks = EDU_MUSIC_TRACKS,
) {
  return playlist.trackIds
    .map((id) => tracks.find((track) => track.id === id))
    .filter(Boolean) as EduMusicTrack[];
}
