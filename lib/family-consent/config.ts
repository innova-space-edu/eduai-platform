/** Shared authorization categories. Each platform deliberately has distinct consent scopes. */
export const FAMILY_CONSENT_VERSION = "family-2026-10-v1"

export const EDUAI_FAMILY_PURPOSES = [
  { key: "ai_text", title: "Asistentes IA y creación de material", description: "Generación y consulta pedagógica con proveedores de IA; no autoriza introducir datos sensibles ni expedientes nominativos." },
  { key: "ai_documents", title: "Documentos escolares en herramientas IA", description: "Procesar material educativo sin información personal innecesaria; no autoriza expedientes médicos o PIE/NEE." },
  { key: "ai_images", title: "Creación de imágenes mediante IA", description: "Enviar descripciones o material no identificable a proveedores externos para producir recursos." },
  { key: "voice_transcription", title: "Voz y transcripción", description: "Procesar audio del estudiante para dictado o transcripción; no incluye clonación de voz." },
  { key: "educational_projects", title: "Guardar proyectos y trabajos", description: "Conservación de recursos y documentos opcionales del estudiante, según instrucciones del establecimiento." },
  { key: "media_internal", title: "Uso interno de fotografías o grabaciones", description: "Solo acceso de docentes y usuarios autorizados; no implica divulgación pública." },
  { key: "media_public", title: "Publicación pública de imágenes y trabajos", description: "Publicar material identificable en espacios visibles fuera de la institución, tras revisión humana." },
  { key: "collaboration", title: "Colaboración mediante equipos y espacios compartidos", description: "Participación en espacios con otras personas autorizadas, según las reglas del establecimiento." },
  { key: "optional_analytics", title: "Métricas adicionales de aprendizaje y mejoras", description: "Estadísticas opcionales no necesarias para seguridad o para una obligación académica." },
  { key: "external_research", title: "Búsqueda de fuentes mediante proveedores externos", description: "Envío de términos de búsqueda no identificables para encontrar recursos o referencias educativas." },
  { key: "educational_messages", title: "Comunicaciones educativas opcionales", description: "Comunicaciones adicionales mediante correo o mensajería, distintas de avisos de seguridad o legales." },
] as const

export const SELLO_FAMILY_PURPOSES = [
  { key: "projects", title: "Participación y registro de proyectos", description: "Registrar proyectos y trabajos opcionales dentro de los espacios institucionales." },
  { key: "evidences", title: "Evidencias y archivos de aprendizaje", description: "Almacenar informes, imágenes, documentos y evidencias de actividades, con permisos restringidos." },
  { key: "images_internal", title: "Fotografías y videos internos", description: "Tomar o cargar imágenes en espacios limitados a docentes y equipo autorizado." },
  { key: "public_showcase", title: "Vitrina y comunidad pública", description: "Publicar trabajos identificables, fotografías o material audiovisual fuera del acceso institucional." },
  { key: "surveys", title: "Encuestas y autoevaluaciones opcionales", description: "Participación voluntaria en encuestas y reflexiones no indispensables para la obligación educativa." },
  { key: "collaboration", title: "Colaboración y mensajería", description: "Participar en mensajes y actividades colaborativas según permisos institucionales." },
  { key: "public_disclosure", title: "Divulgación de proyectos en redes", description: "Autorizar la difusión externa y potencial republicación en canales identificados por el colegio." },
  { key: "ai_assistance", title: "Asistencia IA en las actividades", description: "Uso opcional de asistentes que pueden enviar consultas generales a modelos externos; sin expedientes identificables." },
  { key: "optional_analytics", title: "Estadísticas voluntarias de mejora", description: "Medición opcional, distinta de los registros necesarios para seguridad y cumplimiento." },
  { key: "educational_messages", title: "Mensajes opcionales a la familia", description: "Comunicaciones adicionales distintas de avisos escolares o legales obligatorios." },
] as const

export type FamilyPlatform = "eduai" | "sello"
export function familyPurposes(platform: FamilyPlatform) {
  return platform === "eduai" ? EDUAI_FAMILY_PURPOSES : SELLO_FAMILY_PURPOSES
}
export function normalizeDecisions(platform: FamilyPlatform, input: unknown): Record<string, boolean> {
  const known: string[] = familyPurposes(platform).map(item => item.key)
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Debes completar las decisiones por finalidad.")
  const supplied = input as Record<string, unknown>
  if (Object.keys(supplied).some(key => !known.includes(key))) throw new Error("El formulario incluye finalidades desconocidas.")
  if (known.some(key => typeof supplied[key] !== "boolean")) throw new Error("Debes decidir sí o no para cada finalidad.")
  return Object.fromEntries(known.map(key => [key, supplied[key] === true]))
}
