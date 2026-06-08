import type { NivelKey } from "@/lib/mineduc-oa"

export type PlanningProfileId =
  | "auto"
  | "clase"
  | "proyecto_abp"
  | "feria_cientifica"
  | "evento_escolar"
  | "taller"
  | "campana"
  | "salida_pedagogica"
  | "experiencia_parvularia"

export interface PlanningProfile {
  id: Exclude<PlanningProfileId, "auto">
  label: string
  icon: string
  summary: string
  requiredSections: string[]
  directive: string
}

const PROFILES: Record<Exclude<PlanningProfileId, "auto">, PlanningProfile> = {
  clase: {
    id: "clase",
    label: "Clase curricular",
    icon: "📘",
    summary: "Secuencia de enseñanza con inicio, desarrollo, cierre y evaluación alineada al OA.",
    requiredSections: ["objetivo", "planificacion", "evaluacion", "recursos", "adaptaciones"],
    directive: `PERFIL DE PLANIFICACIÓN: CLASE CURRICULAR.
- Organiza una secuencia didáctica realista con inicio, desarrollo y cierre por sesión.
- Incluye activación de conocimientos previos, mediación docente, evidencia y ticket de salida.
- Mantén coherencia directa entre OA oficial, indicadores, actividades y evaluación.`,
  },
  proyecto_abp: {
    id: "proyecto_abp",
    label: "Proyecto ABP / STEAM",
    icon: "🧩",
    summary: "Proyecto de varias etapas con desafío, producto final, hitos y evaluación del proceso.",
    requiredSections: ["desafio", "producto", "etapas", "evaluacion", "cronograma", "oa"],
    directive: `PERFIL DE PLANIFICACIÓN: PROYECTO ABP / STEAM.
- Formula un desafío o pregunta guía conectada con una necesidad real del entorno escolar.
- Define producto final, público o beneficiarios, roles, hitos, evidencias parciales y cronograma.
- Distribuye etapas: activación, investigación, diseño, prototipo o elaboración, retroalimentación, mejora, presentación y reflexión.
- Evalúa contenido curricular, habilidades, colaboración y calidad del producto final.
- Usa los OA oficiales como respaldo curricular del proyecto, sin reducir el proyecto a una clase aislada.`,
  },
  feria_cientifica: {
    id: "feria_cientifica",
    label: "Feria científica",
    icon: "🔬",
    summary: "Plan integral de feria con investigación, experimentos, stands, seguridad y presentación pública.",
    requiredSections: ["feria", "etapas", "roles", "stands", "seguridad", "cronograma", "rubrica", "oa"],
    directive: `PERFIL DE PLANIFICACIÓN: FERIA CIENTÍFICA ESCOLAR.
- Diseña la feria como proyecto escolar integral, no como una clase genérica.
- Incluye propósito, pregunta o problema, organización de equipos, elección de temas, investigación, hipótesis cuando corresponda, diseño experimental o prototipo, bitácora, evidencias, ensayo y presentación pública.
- Agrega cronograma por etapas, roles del equipo, organización de stands, materiales, montaje, circulación de visitantes, seguridad, residuos, plan alternativo y desmontaje.
- Diferencia expectativas por nivel: parvularia, básica y media.
- Incluye una rúbrica específica para investigación, producto o experimento, comunicación, evidencia, creatividad, colaboración y seguridad.
- Vincula explícitamente los OA oficiales disponibles con cada etapa pertinente.`,
  },
  evento_escolar: {
    id: "evento_escolar",
    label: "Evento escolar",
    icon: "🎪",
    summary: "Organización pedagógica y logística de una actividad institucional o comunitaria.",
    requiredSections: ["proposito", "programa", "roles", "cronograma", "recursos", "seguridad", "evaluacion"],
    directive: `PERFIL DE PLANIFICACIÓN: EVENTO ESCOLAR.
- Diseña propósito pedagógico, destinatarios, programa, responsables, comisiones, tiempos, espacios y recursos.
- Incluye convocatoria, preparación, ejecución, registro de evidencias, cierre, evaluación y mejoras.
- Incorpora accesibilidad, seguridad, plan de contingencia y comunicación con familias cuando corresponda.
- Vincula OA oficiales solo cuando exista una relación pedagógica real.`,
  },
  taller: {
    id: "taller",
    label: "Taller práctico",
    icon: "🛠️",
    summary: "Experiencia práctica guiada con estaciones, modelamiento y producto verificable.",
    requiredSections: ["proposito", "pasos", "materiales", "seguridad", "evaluacion"],
    directive: `PERFIL DE PLANIFICACIÓN: TALLER PRÁCTICO.
- Organiza instrucciones claras, demostración o modelamiento, práctica guiada y práctica autónoma.
- Incluye materiales por estación, roles, seguridad, tiempos y producto verificable.
- Cierra con evaluación formativa y recomendaciones para repetir o ampliar la experiencia.`,
  },
  campana: {
    id: "campana",
    label: "Campaña escolar",
    icon: "📣",
    summary: "Campaña de sensibilización con diagnóstico, piezas comunicacionales e impacto observable.",
    requiredSections: ["diagnostico", "mensaje", "acciones", "cronograma", "impacto", "evaluacion"],
    directive: `PERFIL DE PLANIFICACIÓN: CAMPAÑA ESCOLAR.
- Define problema, diagnóstico inicial, audiencia, mensaje central y objetivo de cambio observable.
- Diseña piezas comunicacionales, acciones, responsables, calendario, difusión y medición de impacto.
- Incluye evidencias antes/durante/después y una reflexión final sobre el efecto de la campaña.`,
  },
  salida_pedagogica: {
    id: "salida_pedagogica",
    label: "Salida pedagógica",
    icon: "🚌",
    summary: "Salida con objetivos, ruta pedagógica, seguridad, evidencias y actividades previas y posteriores.",
    requiredSections: ["objetivo", "antes", "durante", "despues", "seguridad", "autorizacion", "evaluacion"],
    directive: `PERFIL DE PLANIFICACIÓN: SALIDA PEDAGÓGICA.
- Incluye propósito curricular, preparación previa, itinerario, actividades de observación o registro, cierre posterior y producto de aprendizaje.
- Agrega responsables, autorizaciones, seguridad, accesibilidad, contactos, traslado, materiales y plan de contingencia.
- Vincula OA oficiales con las evidencias recogidas durante la salida.`,
  },
  experiencia_parvularia: {
    id: "experiencia_parvularia",
    label: "Experiencia parvularia",
    icon: "🌸",
    summary: "Experiencia lúdica, sensorial y afectiva apropiada al subnivel.",
    requiredSections: ["ambiente", "mediacion", "exploracion", "evaluacion", "familia"],
    directive: `PERFIL DE PLANIFICACIÓN: EXPERIENCIA DE EDUCACIÓN PARVULARIA.
- Prioriza juego, vínculo, exploración sensorial, lenguaje emergente, autonomía y seguridad afectiva.
- Organiza ambiente, mediación del equipo, materiales seguros, participación familiar y registro cualitativo.
- Usa OA y OAT oficiales del subnivel sin escolarizar la experiencia.`,
  },
}

export const PLANNING_PROFILE_OPTIONS: Array<{ id: PlanningProfileId; label: string; icon: string; summary: string }> = [
  { id: "auto", label: "Detección automática", icon: "✨", summary: "El agente identifica el formato más adecuado según tu solicitud." },
  ...Object.values(PROFILES).map(({ id, label, icon, summary }) => ({ id, label, icon, summary })),
]

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function isPlanningProfileId(value: unknown): value is PlanningProfileId {
  return typeof value === "string" && PLANNING_PROFILE_OPTIONS.some((item) => item.id === value)
}

export function inferPlanningProfile(
  text: string,
  nivel: NivelKey,
  requested: PlanningProfileId = "auto"
): PlanningProfile {
  if (requested !== "auto") return PROFILES[requested]

  const value = normalize(text)
  if (/(feria cientifica|expo ciencia|muestra cientifica|semana de la ciencia|stand cientifico)/.test(value)) return PROFILES.feria_cientifica
  if (/(salida pedagogica|visita educativa|visita guiada|terreno|museo|observatorio|excursion)/.test(value)) return PROFILES.salida_pedagogica
  if (/(campana|concientizacion|sensibilizacion|difusion|afiche|intervencion comunicacional)/.test(value)) return PROFILES.campana
  if (/(acto|evento|celebracion|aniversario|jornada|encuentro|festival|muestra|exposicion|ceremonia)/.test(value)) return PROFILES.evento_escolar
  if (/(taller|laboratorio|estaciones de trabajo|manualidad|capacitacion)/.test(value)) return PROFILES.taller
  if (/(abp|steam|proyecto|prototipo|maqueta|investigacion grupal|interdisciplin)/.test(value)) return PROFILES.proyecto_abp
  if (nivel === "parvularia") return PROFILES.experiencia_parvularia
  return PROFILES.clase
}

export function buildPlanningProfilePrompt(profile: PlanningProfile) {
  return `\n\n═══════════════════════════════════════════════\n${profile.directive}\n═══════════════════════════════════════════════\n`
}

export interface PlanningQualityAudit {
  score: number
  missing: string[]
  passed: boolean
}

export function auditPlanningOutput(text: string, profile: PlanningProfile): PlanningQualityAudit {
  const normalized = normalize(text)
  const missing = profile.requiredSections.filter((word) => !normalized.includes(normalize(word)))
  const score = Math.max(0, Math.round(((profile.requiredSections.length - missing.length) / profile.requiredSections.length) * 100))
  return { score, missing, passed: missing.length <= Math.max(1, Math.floor(profile.requiredSections.length * 0.2)) }
}

export function buildRepairInstruction(profile: PlanningProfile, audit: PlanningQualityAudit) {
  return `La primera versión quedó incompleta para el perfil ${profile.label}. Reescríbela completa y utilizable, conservando lo correcto e incorporando obligatoriamente estos componentes faltantes: ${audit.missing.join(", ")}. No expliques la corrección: entrega directamente la planificación final.`
}
