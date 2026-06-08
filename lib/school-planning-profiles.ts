import type { NivelKey } from "@/lib/mineduc-oa"
export { auditPlanningOutput, buildRepairInstruction, type PlanningQualityAudit } from "@/lib/planning-quality-audit"

export type PlanningProfileId = "auto" | "clase" | "proyecto_abp" | "feria_cientifica" | "evento_escolar" | "taller" | "campana" | "salida_pedagogica" | "experiencia_parvularia"
export interface PlanningProfile { id: Exclude<PlanningProfileId, "auto">; label: string; icon: string; summary: string; requiredSections: string[]; directive: string }

const PROFILES: Record<Exclude<PlanningProfileId, "auto">, PlanningProfile> = {
  clase: { id: "clase", label: "Clase curricular", icon: "📘", summary: "Secuencia con inicio, desarrollo, cierre y evaluación alineada al OA.", requiredSections: ["objetivo", "planificacion", "evaluacion", "recursos", "adaptaciones"], directive: `PERFIL: CLASE CURRICULAR. Organiza inicio, desarrollo y cierre por sesión. Incluye conocimientos previos, mediación, evidencia, ticket de salida, OA e indicadores.` },
  proyecto_abp: { id: "proyecto_abp", label: "Proyecto ABP / STEAM", icon: "🧩", summary: "Proyecto con desafío, producto final, hitos y evaluación del proceso.", requiredSections: ["desafio", "producto", "etapas", "evaluacion", "cronograma", "oa"], directive: `PERFIL: PROYECTO ABP / STEAM. Formula desafío real, producto final, beneficiarios, roles, hitos, evidencias y cronograma. Distribuye investigación, diseño, prototipo, mejora, presentación y reflexión.` },
  feria_cientifica: { id: "feria_cientifica", label: "Feria científica", icon: "🔬", summary: "Feria integral con investigación, experimentos, stands, seguridad y presentación pública.", requiredSections: ["feria", "etapas", "roles", "stands", "seguridad", "cronograma", "rubrica", "oa"], directive: `PERFIL: FERIA CIENTÍFICA ESCOLAR. Diseña un proyecto integral: propósito, equipos, investigación, hipótesis cuando corresponda, experimento o prototipo, bitácora, cronograma, roles, stands, montaje, circulación, residuos, seguridad, contingencia, presentación pública y rúbrica específica. Diferencia expectativas por nivel y vincula OA con etapas.` },
  evento_escolar: { id: "evento_escolar", label: "Evento escolar", icon: "🎪", summary: "Organización pedagógica y logística institucional o comunitaria.", requiredSections: ["proposito", "programa", "roles", "cronograma", "recursos", "seguridad", "evaluacion"], directive: `PERFIL: EVENTO ESCOLAR. Incluye propósito, destinatarios, programa, comisiones, tiempos, espacios, recursos, accesibilidad, seguridad, contingencia, comunicación, evidencias y evaluación.` },
  taller: { id: "taller", label: "Taller práctico", icon: "🛠️", summary: "Experiencia práctica guiada con estaciones y producto verificable.", requiredSections: ["proposito", "pasos", "materiales", "seguridad", "evaluacion"], directive: `PERFIL: TALLER PRÁCTICO. Organiza demostración, práctica guiada y autónoma, materiales por estación, roles, seguridad, tiempos, producto y evaluación formativa.` },
  campana: { id: "campana", label: "Campaña escolar", icon: "📣", summary: "Sensibilización con diagnóstico, comunicación e impacto observable.", requiredSections: ["diagnostico", "mensaje", "acciones", "cronograma", "impacto", "evaluacion"], directive: `PERFIL: CAMPAÑA ESCOLAR. Define problema, diagnóstico, audiencia, mensaje, acciones, responsables, calendario, difusión, evidencias antes-durante-después y medición de impacto.` },
  salida_pedagogica: { id: "salida_pedagogica", label: "Salida pedagógica", icon: "🚌", summary: "Salida con objetivos, ruta, seguridad, evidencias y actividades asociadas.", requiredSections: ["objetivo", "antes", "durante", "despues", "seguridad", "autorizacion", "evaluacion"], directive: `PERFIL: SALIDA PEDAGÓGICA. Incluye preparación previa, itinerario, observación o registro, cierre posterior, producto, responsables, autorizaciones, traslado, accesibilidad, seguridad y contingencia.` },
  experiencia_parvularia: { id: "experiencia_parvularia", label: "Experiencia parvularia", icon: "🌸", summary: "Experiencia lúdica, sensorial y afectiva apropiada al subnivel.", requiredSections: ["ambiente", "mediacion", "exploracion", "evaluacion", "familia"], directive: `PERFIL: EXPERIENCIA PARVULARIA. Prioriza juego, vínculo, exploración sensorial, lenguaje emergente, autonomía, ambiente, mediación, materiales seguros, familia y registro cualitativo. Usa OA y OAT sin escolarizar.` },
}

export const PLANNING_PROFILE_OPTIONS = [{ id: "auto" as const, label: "Detección automática", icon: "✨", summary: "El agente identifica el formato más adecuado según tu solicitud." }, ...Object.values(PROFILES).map(({ id, label, icon, summary }) => ({ id, label, icon, summary }))]
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
export function isPlanningProfileId(value: unknown): value is PlanningProfileId { return typeof value === "string" && PLANNING_PROFILE_OPTIONS.some((item) => item.id === value) }
export function inferPlanningProfile(text: string, nivel: NivelKey, requested: PlanningProfileId = "auto"): PlanningProfile {
  if (requested !== "auto") return PROFILES[requested]
  const value = normalize(text)
  if (/(feria cientifica|expo ciencia|muestra cientifica|semana de la ciencia|stand cientifico)/.test(value)) return PROFILES.feria_cientifica
  if (/(salida pedagogica|visita educativa|visita guiada|terreno|museo|observatorio|excursion)/.test(value)) return PROFILES.salida_pedagogica
  if (/(campana|concientizacion|sensibilizacion|difusion|afiche|intervencion comunicacional)/.test(value)) return PROFILES.campana
  if (/(acto|evento|celebracion|aniversario|jornada|encuentro|festival|muestra|exposicion|ceremonia)/.test(value)) return PROFILES.evento_escolar
  if (/(taller|laboratorio|estaciones de trabajo|manualidad|capacitacion)/.test(value)) return PROFILES.taller
  if (/(abp|steam|proyecto|prototipo|maqueta|investigacion grupal|interdisciplin)/.test(value)) return PROFILES.proyecto_abp
  return nivel === "parvularia" ? PROFILES.experiencia_parvularia : PROFILES.clase
}
export function buildPlanningProfilePrompt(profile: PlanningProfile) { return `\n\n═══════════════════════════════════════════════\n${profile.directive}\n═══════════════════════════════════════════════\n` }
