import type { PlanningProfile } from "@/lib/school-planning-profiles"

export interface PlanningQualityAudit {
  score: number
  missing: string[]
  passed: boolean
  evidence: Record<string, boolean>
}

const ALIASES: Record<string, string[]> = {
  objetivo: ["objetivo", "proposito"], planificacion: ["planificacion", "secuencia", "sesion"],
  evaluacion: ["evaluacion", "instrumento", "evidencia"], recursos: ["recursos", "materiales"],
  adaptaciones: ["adaptaciones", "diversidad", "nee", "adecuacion"], desafio: ["desafio", "pregunta guia"],
  producto: ["producto final", "prototipo", "entregable"], etapas: ["etapas", "fases", "hitos"],
  cronograma: ["cronograma", "calendario", "semana", "fecha"], oa: ["oa ", "objetivo de aprendizaje"],
  feria: ["feria", "expo ciencia", "muestra cientifica"], roles: ["roles", "responsables", "comisiones"],
  stands: ["stands", "stand", "puestos", "estaciones"], seguridad: ["seguridad", "riesgos", "contingencia"],
  rubrica: ["rubrica", "criterios de logro", "niveles de logro"], proposito: ["proposito", "objetivo"],
  programa: ["programa", "itinerario", "agenda"], pasos: ["pasos", "procedimiento", "instrucciones"],
  materiales: ["materiales", "recursos"], diagnostico: ["diagnostico", "problema inicial"],
  mensaje: ["mensaje", "audiencia", "publico objetivo"], acciones: ["acciones", "actividades", "difusion"],
  impacto: ["impacto", "medicion", "indicadores"], antes: ["antes de la salida", "preparacion previa"],
  durante: ["durante la salida", "itinerario", "recorrido"], despues: ["despues de la salida", "actividad posterior", "cierre posterior"],
  autorizacion: ["autorizacion", "permiso", "apoderados"], ambiente: ["ambiente", "espacio", "rincon"],
  mediacion: ["mediacion", "rol educadora", "acompanamiento"], exploracion: ["exploracion", "sensorial", "juego"],
  familia: ["familia", "hogar", "apoderados"],
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function evidenceFor(text: string, requirement: string) {
  const aliases = ALIASES[requirement] || [requirement]
  return aliases.some((alias) => {
    const at = text.indexOf(normalize(alias))
    if (at < 0) return false
    const sample = text.slice(Math.max(0, at - 60), at + 420)
    return sample.split("\n").filter((line) => line.trim().length >= 8).length >= 2
  })
}

export function auditPlanningOutput(text: string, profile: PlanningProfile): PlanningQualityAudit {
  const normalized = normalize(text)
  const evidence = Object.fromEntries(profile.requiredSections.map((key) => [key, evidenceFor(normalized, key)]))
  const missing = profile.requiredSections.filter((key) => !evidence[key])
  const headings = (text.match(/^#{1,4}\s+/gm) || []).length
  const bullets = (text.match(/^\s*[-*]\s+/gm) || []).length
  const tableRows = (text.match(/\|[^\n]+\|/g) || []).length
  const meaningfulLines = text.split("\n").filter((line) => line.trim().length >= 12).length
  const structureScore = (headings >= 3 ? 7 : 0) + (bullets >= 4 ? 5 : 0) + (tableRows >= 2 ? 4 : 0) + (meaningfulLines >= 16 ? 4 : 0)
  const requirementScore = ((profile.requiredSections.length - missing.length) / profile.requiredSections.length) * 80
  const score = Math.max(0, Math.round(requirementScore + structureScore))
  const allowedMissing = Math.max(1, Math.floor(profile.requiredSections.length * 0.15))
  return { score, missing, evidence, passed: missing.length <= allowedMissing && structureScore >= 12 && score >= 82 }
}

export function buildRepairInstruction(profile: PlanningProfile, audit: PlanningQualityAudit) {
  return `La primera versión quedó incompleta para el perfil ${profile.label}. Reescríbela completa y aplicable, conservando lo correcto e incorporando obligatoriamente: ${audit.missing.join(", ") || "mayor profundidad estructural"}. Usa encabezados claros, tablas cuando corresponda y evidencias observables. No expliques la corrección: entrega directamente la planificación final.`
}
