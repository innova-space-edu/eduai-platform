export type EduMusicMood =
  | "focus"
  | "calm"
  | "classical"
  | "nature"
  | "energy"
  | "deep";

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

export const EDU_MUSIC_TRACKS: EduMusicTrack[] = [
  {
    id: "focus-flow-01",
    title: "Deep Focus Flow",
    artist: "EduAI Focus",
    album: "Study Beats",
    mood: "focus",
    duration: "6:12",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: "linear-gradient(135deg,#1DB954,#0f172a 70%)",
    tags: ["lofi", "estudio", "sin letra"],
  },
  {
    id: "math-calm-02",
    title: "Math Calm Session",
    artist: "EduAI Focus",
    album: "Cálculo tranquilo",
    mood: "classical",
    duration: "5:48",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: "linear-gradient(135deg,#22c55e,#2563eb 70%)",
    tags: ["matemática", "clásica", "análisis"],
  },
  {
    id: "science-ambient-03",
    title: "Science Ambient",
    artist: "EduAI Focus",
    album: "Laboratorio mental",
    mood: "deep",
    duration: "7:03",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    cover: "linear-gradient(135deg,#14b8a6,#7c3aed 70%)",
    tags: ["ciencias", "ambient", "profundo"],
  },
  {
    id: "reading-rain-04",
    title: "Reading Rain",
    artist: "EduAI Nature",
    album: "Lectura suave",
    mood: "nature",
    duration: "5:30",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    cover: "linear-gradient(135deg,#0ea5e9,#0f766e 70%)",
    tags: ["lectura", "lluvia", "relajo"],
  },
  {
    id: "exam-breath-05",
    title: "Exam Breath",
    artist: "EduAI Calm",
    album: "Ansiedad cero",
    mood: "calm",
    duration: "6:44",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    cover: "linear-gradient(135deg,#84cc16,#06b6d4 70%)",
    tags: ["examen", "calma", "respiración"],
  },
  {
    id: "creative-pulse-06",
    title: "Creative Pulse",
    artist: "EduAI Beats",
    album: "Ideas en movimiento",
    mood: "energy",
    duration: "5:58",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    cover: "linear-gradient(135deg,#f97316,#ec4899 70%)",
    tags: ["creatividad", "proyecto", "energía"],
  },
  {
    id: "history-timeline-07",
    title: "Timeline Walk",
    artist: "EduAI Focus",
    album: "Historia y memoria",
    mood: "focus",
    duration: "6:21",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    cover: "linear-gradient(135deg,#a855f7,#334155 70%)",
    tags: ["historia", "memoria", "lectura"],
  },
  {
    id: "biology-calm-08",
    title: "Cellular Calm",
    artist: "EduAI Science",
    album: "Biología focus",
    mood: "calm",
    duration: "7:19",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    cover: "linear-gradient(135deg,#10b981,#064e3b 70%)",
    tags: ["biología", "calma", "estudio"],
  },
  {
    id: "coding-night-09",
    title: "Coding Night",
    artist: "EduAI Lab",
    album: "Programación",
    mood: "deep",
    duration: "5:36",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
    cover: "linear-gradient(135deg,#38bdf8,#111827 70%)",
    tags: ["código", "deep work", "noche"],
  },
  {
    id: "classroom-soft-10",
    title: "Classroom Soft Start",
    artist: "EduAI Classroom",
    album: "Inicio de clase",
    mood: "calm",
    duration: "6:05",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    cover: "linear-gradient(135deg,#6366f1,#0f172a 70%)",
    tags: ["aula", "inicio", "suave"],
  },
];

export const SYSTEM_PLAYLISTS: EduMusicPlaylist[] = [
  {
    id: "pl-focus",
    name: "Focus profundo",
    description: "Para estudiar, resolver ejercicios o avanzar en informes.",
    mood: "focus",
    cover: "linear-gradient(135deg,#1DB954,#0f172a)",
    trackIds: [
      "focus-flow-01",
      "history-timeline-07",
      "science-ambient-03",
      "coding-night-09",
    ],
    system: true,
  },
  {
    id: "pl-exam",
    name: "Antes de una prueba",
    description: "Música tranquila para bajar ansiedad y mantener foco.",
    mood: "calm",
    cover: "linear-gradient(135deg,#84cc16,#06b6d4)",
    trackIds: ["exam-breath-05", "biology-calm-08", "classroom-soft-10"],
    system: true,
  },
  {
    id: "pl-stem",
    name: "STEM / Matemática",
    description: "Ideal para cálculo, física, programación y análisis.",
    mood: "classical",
    cover: "linear-gradient(135deg,#22c55e,#2563eb)",
    trackIds: ["math-calm-02", "coding-night-09", "science-ambient-03"],
    system: true,
  },
  {
    id: "pl-creative",
    name: "Crear proyectos",
    description: "Para diseñar, escribir, hacer afiches, PPT o videos.",
    mood: "energy",
    cover: "linear-gradient(135deg,#f97316,#ec4899)",
    trackIds: ["creative-pulse-06", "focus-flow-01", "classroom-soft-10"],
    system: true,
  },
];

export const MOOD_LABELS: Record<EduMusicMood | "mixed", string> = {
  focus: "Focus",
  calm: "Calma",
  classical: "STEM",
  nature: "Naturaleza",
  energy: "Energía",
  deep: "Deep work",
  mixed: "Mixta",
};

export function getTrackById(id: string) {
  return EDU_MUSIC_TRACKS.find((track) => track.id === id);
}

export function getTracksForPlaylist(playlist: EduMusicPlaylist) {
  return playlist.trackIds.map(getTrackById).filter(Boolean) as EduMusicTrack[];
}
