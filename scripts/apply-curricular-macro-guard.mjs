import { readFileSync, writeFileSync } from 'node:fs'
const f='app/api/agents/planificador-curricular/route.ts'
let s=readFileSync(f,'utf8')
if(!s.includes('const isMacroPlanningForSchool')){
  s=s.replace('function truncate(text: string, max = 2400) {','function isMacroPlanningForSchool(tiempo: TiempoPlanificacion, nivel: NivelKey) {\n  return nivel !== "parvularia" && (tiempo === "semanal" || tiempo === "mensual" || tiempo === "semestral" || tiempo === "anual")\n}\n\nfunction truncate(text: string, max = 2400) {')
  s=s.replace('const horizon = getPlanningHorizonConfig(tiempo)','const isMacro = isMacroPlanningForSchool(tiempo, nivel)\n  const horizon = getPlanningHorizonConfig(tiempo)')
  s=s.replace('const horizonText = buildPlanningHorizonText(tiempo, sesiones, duracionMinutos, periodoLabel)','const horizonText = buildPlanningHorizonText(tiempo, sesiones, isMacro ? "" : duracionMinutos, periodoLabel)')
  s=s.replace('5. Para planificación semestral/anual, no desarrolles cada clase completa; distribuye meses, semanas o tramos y deja puente para el agente diario.','5. Para planificación semanal, mensual, semestral o anual de básica y media, genera cronograma institucional por semanas o meses. No desarrolles una clase diaria. Parvularia conserva su enfoque actual por ámbitos, núcleos y experiencias.')
  s=s.replace('8. La respuesta debe quedar lista para copiar, guardar o exportar.','8. La respuesta debe quedar lista para copiar, guardar o exportar.\n9. Si el horizonte es semanal, mensual, semestral o anual y el nivel no es parvularia, NO uses minutos, NO uses inicio-desarrollo-cierre, NO escribas sesión de 45 minutos y NO conviertas marzo-junio en una sola clase. Usa tabla: Semana/Fecha | OA | Indicadores de evaluación | Objetivo de la clase / actividad general | Evaluación/evidencia | Recursos. Máximo 4 objetivos o actividades generales por semana.')
  s=s.replace('- Duración por sesión: ${duracionMinutos} minutos','- Duración por sesión: ${isMacro ? "No aplica en cronograma institucional" : `${duracionMinutos} minutos`}')
}
writeFileSync(f,s)
console.log('[macro-guard] applied')
