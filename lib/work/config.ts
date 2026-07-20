import {
  Bot,
  FlaskConical,
  Hammer,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { WorkMode } from "@/lib/work/types"

export type WorkModeDefinition = {
  id: WorkMode
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
  accent: string
  prompts: string[]
}

export const WORK_MODES: WorkModeDefinition[] = [
  {
    id: "ask",
    label: "Preguntar",
    shortLabel: "Chat",
    description: "Explica, analiza y resuelve usando el motor completo de EDUAI.",
    icon: Bot,
    accent: "#2563eb",
    prompts: [
      "Explícame este tema paso a paso",
      "Compara estas dos ideas",
      "Ayúdame a organizar lo que necesito hacer",
    ],
  },
  {
    id: "research",
    label: "Investigar",
    shortLabel: "Investigar",
    description: "Consulta fuentes del trabajo, la web o ambas con referencias verificables.",
    icon: Search,
    accent: "#7c3aed",
    prompts: [
      "Investiga este tema y muestra las fuentes",
      "Compara las fuentes e identifica contradicciones",
      "¿Qué información falta para concluir con seguridad?",
    ],
  },
  {
    id: "create",
    label: "Crear",
    shortLabel: "Crear",
    description: "Genera materiales, evaluaciones, imágenes, audio, video y código.",
    icon: FlaskConical,
    accent: "#db2777",
    prompts: [
      "Crea una guía lista para imprimir",
      "Crea una infografía educativa horizontal",
      "Transforma este contenido en una presentación",
    ],
  },
  {
    id: "collaborate",
    label: "Colaborar",
    shortLabel: "Equipo",
    description: "Organiza aportes, roles y sesiones compartidas con moderación de ACo.",
    icon: Users,
    accent: "#0f766e",
    prompts: [
      "Divide este proyecto en roles para cuatro personas",
      "Crea una pauta para revisar el trabajo del equipo",
      "Resume acuerdos y tareas pendientes",
    ],
  },
  {
    id: "execute",
    label: "Ejecutar",
    shortLabel: "Ejecutar",
    description: "Convierte ideas en acciones, rutas y productos utilizables dentro de EDUAI.",
    icon: Hammer,
    accent: "#ea580c",
    prompts: [
      "Crea una evaluación con rúbrica",
      "Planifica tres clases alineadas a MINEDUC",
      "Adapta este material para PIE y TDAH",
    ],
  },
]

export function getWorkMode(mode: WorkMode) {
  return WORK_MODES.find((item) => item.id === mode) ?? WORK_MODES[0]
}
