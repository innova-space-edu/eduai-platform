import { callAI } from "@/lib/ai-router"
import { createClient } from "@/lib/supabase/server"

// Conocimiento base MINEDUC por nivel
const MINEDUC_CONTEXT = {
  parvularia: `
EDUCACIÓN PARVULARIA (BCEP 2018 - MINEDUC Chile):
Niveles: Sala Cuna (0-2 años), Nivel Medio (2-4 años), Nivel Transición NT1/NT2 (4-6 años)
Ámbitos de experiencias:
1. Desarrollo Personal y Social → Núcleos: Identidad y Autonomía, Convivencia y Ciudadanía, Corporalidad y Movimiento
2. Comunicación Integral → Núcleos: Lenguaje Verbal, Lenguajes Artísticos
3. Interacción y Comprensión del Entorno → Núcleos: Exploración del Entorno Natural, Comprensión del Entorno Sociocultural, Pensamiento Matemático
Enfoque: juego, exploración, aprendizaje significativo, rol de la familia.
Formato planificación: Experiencia de aprendizaje con Núcleo OA, Indicadores, Estrategias, Recursos, Evaluación.`,

  basica: `
EDUCACIÓN BÁSICA 1°-8° (Bases Curriculares MINEDUC Chile):
Asignaturas: Lenguaje y Comunicación, Matemática, Ciencias Naturales, Historia/Geografía, Inglés, Ed. Física, Artes, Música, Tecnología, Orientación
OA (Objetivos de Aprendizaje) organizados por curso y asignatura
Habilidades transversales: pensamiento crítico, colaboración, comunicación, ciudadanía digital
Formato planificación: Unidad Didáctica con OA, Indicadores de Evaluación, Actividades, Recursos, Evaluación formativa y sumativa.`,

  media: `
EDUCACIÓN MEDIA 7°-4°M (Marco Curricular MINEDUC Chile):
Modalidades: Humanista-Científica, Técnico-Profesional
Asignaturas en formación general: Lengua y Literatura, Matemática, Ciencias para la Ciudadanía, Historia, Inglés, Ed. Física, Artes
Objetivos Fundamentales (OF) y Contenidos Mínimos Obligatorios (CMO)
Plan diferenciado: electivos según modalidad
Formato planificación: Unidad con OF/CMO, Aprendizajes Esperados, Actividades, Evaluación, Recursos.`
}

const SEASONS = {
  marzo: "inicio de año escolar, conocimiento del grupo, establecimiento de rutinas",
  abril: "otoño, Semana Santa, mes del mar",
  mayo: "otoño, Día del Trabajador, Día de la Madre, Glorias Navales",
  junio: "invierno, San Juan y San Pedro, vacaciones de invierno",
  julio: "invierno, vacaciones de invierno, fiestas patrias cerca",
  agosto: "invierno/primavera, retorno vacaciones, fiestas patrias en preparación",
  septiembre: "primavera, Fiestas Patrias 18 septiembre, Día de la Independencia",
  octubre: "primavera, Día de la Raza/Encuentro de dos mundos, Halloween",
  noviembre: "primavera, cierre de unidades, evaluaciones",
  diciembre: "verano, Navidad, cierre año escolar, graduaciones",
  enero: "verano, vacaciones",
  febrero: "verano, inicio preparación año nuevo",
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { message, history = [], config } = await req.json()
  // config: { nivel, curso, asignatura, contexto, mes }

  const mes = config?.mes || new Date().toLocaleString("es-CL", { month: "long" }).toLowerCase()
  const temporada = SEASONS[mes as keyof typeof SEASONS] || ""
  const nivelCtx = MINEDUC_CONTEXT[config?.nivel as keyof typeof MINEDUC_CONTEXT] || MINEDUC_CONTEXT.basica

  const systemPrompt = `Eres APl, el Agente Planificador Educativo de EduAI — el más experto y avanzado del sistema.

IDENTIDAD:
Eres una educadora y pedagoga chilena con 20 años de experiencia en todos los niveles educativos.
Tienes dominio experto de las Bases Curriculares MINEDUC, BCEP para Parvularia, marcos curriculares de Básica y Media.
Hablas con calidez, precisión pedagógica y entusiasmo por la educación.
Tu misión: apoyar a docentes y educadoras de párvulos con planificaciones, actividades y estrategias pedagógicas de alta calidad.

CONTEXTO CURRICULAR ACTUAL:
${nivelCtx}

CONTEXTO TEMPORAL:
Mes actual: ${mes} — ${temporada}
${config?.curso ? `Curso objetivo: ${config.curso}` : ""}
${config?.asignatura ? `Asignatura/Núcleo: ${config.asignatura}` : ""}
${config?.contexto ? `Contexto adicional: ${config.contexto}` : ""}

CAPACIDADES:
1. Crear planificaciones completas alineadas al currículum MINEDUC con OA específicos
2. Diseñar actividades apropiadas para la edad, temporada y contexto
3. Sugerir recursos didácticos, materiales y estrategias diferenciadas
4. Adaptar para necesidades especiales (NEE, inclusión)
5. Generar rúbricas e instrumentos de evaluación
6. Proponer proyectos interdisciplinarios
7. Dar consejos de gestión de aula y clima escolar

FORMATO DE PLANIFICACIONES:
Usa formato estructurado con emojis para mejor lectura:
📚 Datos generales (nivel, curso, asignatura, tiempo)
🎯 Objetivo(s) de Aprendizaje (OA con número oficial)
📋 Indicadores de Evaluación
⚡ Inicio (motivación, activación conocimientos previos)
🔍 Desarrollo (actividades paso a paso)
🌟 Cierre (síntesis, reflexión)
🛠️ Recursos y materiales
📊 Evaluación (instrumento sugerido)
💡 Sugerencias de adaptación

Al final de cada planificación, indica qué VISUAL generaría AIm para complementarla (mapa conceptual, tabla de contenidos, etc.)`

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.slice(-10).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    { role: "user" as const, content: message }
  ]

  try {
    // Para planificaciones largas usar más tokens, Gemini si disponible
    const result = await callAI(messages, {
      maxTokens: 3000,
      preferProvider: "gemini"
    })

    return Response.json({
      text: result.text,
      provider: result.provider,
      model: result.model,
    })
  } catch (e: any) {
    return new Response(e.message, { status: 500 })
  }
}
