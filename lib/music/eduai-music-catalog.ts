export type EduMusicMood =
  | "focus"
  | "calm"
  | "classical"
  | "nature"
  | "energy"
  | "deep"
  | "reading"
  | "creative";

export type EduMusicTrackSource = "eduai" | "itunes" | "external";

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
  provider: "YouTube" | "Spotify" | "Free Music Archive" | "Internet Archive";
  url: string;
  searchUrl?: string;
};

const SH = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

export const EDU_MUSIC_TRACKS: EduMusicTrack[] = [
  { id: "edu-focus-01", title: "Focus claro", artist: "EduAI Studio", album: "Aula tranquila", mood: "focus", duration: "6:12", src: SH(1), cover: "linear-gradient(135deg,#dbeafe,#93c5fd)", tags: ["estudio", "sin letra", "foco"], source: "eduai" },
  { id: "edu-calm-02", title: "Respira antes de la prueba", artist: "EduAI Calm", album: "Pausa activa", mood: "calm", duration: "5:48", src: SH(2), cover: "linear-gradient(135deg,#ecfdf5,#86efac)", tags: ["calma", "examen", "relajación"], source: "eduai" },
  { id: "edu-math-03", title: "Cálculo suave", artist: "EduAI STEM", album: "Matemática focus", mood: "classical", duration: "7:03", src: SH(3), cover: "linear-gradient(135deg,#eff6ff,#c4b5fd)", tags: ["matemática", "stem", "análisis"], source: "eduai" },
  { id: "edu-reading-04", title: "Lectura con lluvia", artist: "EduAI Nature", album: "Lectura lenta", mood: "reading", duration: "5:30", src: SH(4), cover: "linear-gradient(135deg,#f0fdfa,#67e8f9)", tags: ["lectura", "lluvia", "silencio"], source: "eduai" },
  { id: "edu-deep-05", title: "Deep work docente", artist: "EduAI Lab", album: "Planificación", mood: "deep", duration: "6:44", src: SH(5), cover: "linear-gradient(135deg,#f5f3ff,#a5b4fc)", tags: ["deep work", "planificación", "profesor"], source: "eduai" },
  { id: "edu-creative-06", title: "Ideas para proyectos", artist: "EduAI Creative", album: "Canva educativo", mood: "creative", duration: "5:58", src: SH(6), cover: "linear-gradient(135deg,#fff7ed,#fdba74)", tags: ["creatividad", "afiches", "ppt"], source: "eduai" },
  { id: "edu-history-07", title: "Línea de tiempo", artist: "EduAI Humanities", album: "Historia focus", mood: "focus", duration: "6:21", src: SH(7), cover: "linear-gradient(135deg,#fefce8,#fde68a)", tags: ["historia", "memoria", "lectura"], source: "eduai" },
  { id: "edu-biology-08", title: "Células en calma", artist: "EduAI Science", album: "Biología focus", mood: "calm", duration: "7:19", src: SH(8), cover: "linear-gradient(135deg,#ecfdf5,#6ee7b7)", tags: ["biología", "ciencias", "calma"], source: "eduai" },
  { id: "edu-coding-09", title: "Código limpio", artist: "EduAI Coding", album: "Programación", mood: "deep", duration: "5:36", src: SH(9), cover: "linear-gradient(135deg,#eef2ff,#93c5fd)", tags: ["código", "programación", "concentración"], source: "eduai" },
  { id: "edu-classroom-10", title: "Inicio de clase", artist: "EduAI Classroom", album: "Ambiente aula", mood: "calm", duration: "6:05", src: SH(10), cover: "linear-gradient(135deg,#f8fafc,#cbd5e1)", tags: ["aula", "inicio", "suave"], source: "eduai" },
  { id: "edu-lab-11", title: "Laboratorio mental", artist: "EduAI Science", album: "Ciencias", mood: "focus", duration: "6:35", src: SH(11), cover: "linear-gradient(135deg,#f0fdfa,#99f6e4)", tags: ["química", "física", "laboratorio"], source: "eduai" },
  { id: "edu-writing-12", title: "Escritura clara", artist: "EduAI Writer", album: "Redacción", mood: "reading", duration: "5:47", src: SH(12), cover: "linear-gradient(135deg,#fdf2f8,#fbcfe8)", tags: ["redacción", "ensayo", "lenguaje"], source: "eduai" },
  { id: "edu-geometry-13", title: "Geometría tranquila", artist: "EduAI STEM", album: "Formas", mood: "classical", duration: "6:58", src: SH(13), cover: "linear-gradient(135deg,#f0f9ff,#bae6fd)", tags: ["geometría", "matemática", "figuras"], source: "eduai" },
  { id: "edu-memory-14", title: "Memoria activa", artist: "EduAI Study", album: "Repaso", mood: "energy", duration: "6:02", src: SH(14), cover: "linear-gradient(135deg,#fef3c7,#fca5a5)", tags: ["repaso", "flashcards", "energía"], source: "eduai" },
  { id: "edu-ambient-15", title: "Ambiente biblioteca", artist: "EduAI Ambient", album: "Biblioteca", mood: "nature", duration: "7:12", src: SH(15), cover: "linear-gradient(135deg,#f1f5f9,#d9f99d)", tags: ["biblioteca", "lectura", "ambiente"], source: "eduai" },
  { id: "edu-focus-16", title: "Sesión 25 minutos", artist: "EduAI Pomodoro", album: "Focus timer", mood: "focus", duration: "6:28", src: SH(16), cover: "linear-gradient(135deg,#dbeafe,#bfdbfe)", tags: ["pomodoro", "focus", "estudio"], source: "eduai" },
];

export const SYSTEM_PLAYLISTS: EduMusicPlaylist[] = [
  { id: "pl-all", name: "Todas las canciones", description: "Biblioteca completa de EduAI Music para estudiar y trabajar.", mood: "mixed", cover: "linear-gradient(135deg,#dbeafe,#93c5fd)", trackIds: EDU_MUSIC_TRACKS.map((track) => track.id), system: true },
  { id: "pl-focus", name: "Focus profundo", description: "Para estudiar, resolver ejercicios o avanzar en informes.", mood: "focus", cover: "linear-gradient(135deg,#dbeafe,#bfdbfe)", trackIds: ["edu-focus-01", "edu-history-07", "edu-lab-11", "edu-focus-16"], system: true },
  { id: "pl-exam", name: "Antes de una prueba", description: "Música tranquila para bajar ansiedad y mantener foco.", mood: "calm", cover: "linear-gradient(135deg,#ecfdf5,#86efac)", trackIds: ["edu-calm-02", "edu-biology-08", "edu-classroom-10"], system: true },
  { id: "pl-stem", name: "STEM / Matemática", description: "Ideal para cálculo, física, programación y análisis.", mood: "classical", cover: "linear-gradient(135deg,#eff6ff,#c4b5fd)", trackIds: ["edu-math-03", "edu-coding-09", "edu-geometry-13", "edu-lab-11"], system: true },
  { id: "pl-reading", name: "Lectura y redacción", description: "Ambiente suave para leer, escribir y preparar informes.", mood: "reading", cover: "linear-gradient(135deg,#fdf2f8,#fbcfe8)", trackIds: ["edu-reading-04", "edu-writing-12", "edu-ambient-15"], system: true },
  { id: "pl-creative", name: "Crear proyectos", description: "Para diseñar, escribir, hacer afiches, PPT o videos.", mood: "creative", cover: "linear-gradient(135deg,#fff7ed,#fdba74)", trackIds: ["edu-creative-06", "edu-memory-14", "edu-classroom-10"], system: true },
];

export const EXTERNAL_MUSIC_COLLECTIONS: ExternalMusicCollection[] = [
  { id: "yt-focus", name: "YouTube — focus music", provider: "YouTube", description: "Búsqueda externa de música de concentración. Se abre en una nueva pestaña.", url: "https://www.youtube.com/results?search_query=focus+music+for+studying+no+lyrics", searchUrl: "https://www.youtube.com/results?search_query=" },
  { id: "yt-lofi", name: "YouTube — lofi study", provider: "YouTube", description: "Listas lofi para estudiar y trabajar.", url: "https://www.youtube.com/results?search_query=lofi+study+playlist", searchUrl: "https://www.youtube.com/results?search_query=" },
  { id: "spotify-focus", name: "Spotify — focus playlists", provider: "Spotify", description: "Listas externas de Spotify. El control directo requiere cuenta compatible.", url: "https://open.spotify.com/search/focus%20study%20playlist" },
  { id: "fma", name: "Free Music Archive", provider: "Free Music Archive", description: "Música abierta/independiente para explorar y descargar según licencia.", url: "https://freemusicarchive.org/search/?quicksearch=study" },
  { id: "archive", name: "Internet Archive Audio", provider: "Internet Archive", description: "Archivo público de audio. Revisa licencia antes de usar en materiales.", url: "https://archive.org/details/audio?query=ambient+study" },
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

export function getTracksForPlaylist(playlist: EduMusicPlaylist, tracks = EDU_MUSIC_TRACKS) {
  return playlist.trackIds
    .map((id) => tracks.find((track) => track.id === id))
    .filter(Boolean) as EduMusicTrack[];
}
