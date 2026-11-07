/**
 * Boundaries for two similarly named but independent research artifacts.
 *
 * This file is a dated, source-grounded snapshot, NOT a live Kaggle query.
 * Never treat public MaleCNS connectome statistics as metrics of our model.
 */
export type MaleCNSSource = "internal" | "external" | "comparison" | null

function clean(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function classifyMaleCNSSource(query: string): MaleCNSSource {
  const text = clean(query)
  const own = /(^|[^a-z])malecns([^a-z]|$)|male[\s-]?cns[\s-]?(?:ai|cognitive|principal)|scientificbrain[\s-]?malecns/.test(text)
  const external = /\bjanelia\b|\bflyem\b|\bmale[\s-]?cns[\s-]?(?:connectome|v1\.0)\b|\bmale drosophila cns\b|(?:connectoma|conectoma)[^\n.!?]{0,90}drosophila|drosophila[^\n.!?]{0,90}(?:connectoma|conectoma)/.test(text)
  const explicitlyOurs = /\b(nuestro|nuestra|propio|propia|desarrollamos|creamos|cognitive|principal|c0\.\d+|v6[0-9]|checkpoint|kaggle|entrenamiento)\b/.test(text)
  const wantsComparison = /\b(compar|diferenc|versus|vs\.?|mezcl|separ|confund|dos proyectos|ambos)\w*/.test(text)
  if (own && external && (explicitlyOurs || wantsComparison)) return "comparison"
  if (external && !explicitlyOurs && !wantsComparison) return "external"
  if (own) return "internal"
  if (external) return "external"
  return null
}

const EXTERNAL = [
  "[FUENTE EXTERNA / INVESTIGACIÓN PUBLICADA — JANELIA]",
  "Male CNS (Male Drosophila Central Nervous System) es un conectoma biológico de Drosophila melanogaster producido por equipos científicos externos; NO es el modelo de IA entrenado por Innova Space Education.",
  "Fuente: https://male-cns.janelia.org/ y artículo en Cell (2026-09-03; DOI 10.1016/j.cell.2026.08.015). Release MaleCNS v1.0: 2026-06-08.",
  "El artículo describe aproximadamente 166.700 neuronas anotadas; 124,2 millones de contactos sinápticos y unos 25,6 millones de enlaces (edges) del grafo. Neuronas, contactos sinápticos y enlaces son medidas diferentes.",
  "Son cifras del conectoma completo externo, NO neuronas activas ni conexiones entrenadas del prototipo de Innova. No atribuir a Janelia los resultados de Kaggle.",
].join("\n")

const INTERNAL_PUBLIC = [
  "[PROYECTO PROPIO — INNOVA / MALECNS AI]",
  "MaleCNS AI es un proyecto experimental independiente que explora aprendizaje, plasticidad, memoria, consolidación y tareas cognitivas con código y checkpoints propios; puede utilizar la topología pública de Drosophila como referencia estructural.",
  "Hay dos líneas experimentales que deben permanecer separadas: MaleCNS Principal (memoria, plasticidad y consolidación) y MaleCNS-Cognitive (lenguaje, símbolos, matemáticas, lógica y generalización).",
  "ScientificBrain es también una plataforma de investigación y orquestación científica, no otro nombre del conectoma Janelia ni una demostración de que MaleCNS ya razona como un LLM.",
  "Los hitos históricos V20–V29 y el protocolo V45C NO describen por sí solos el estado más reciente del proyecto. No extrapolar métricas entre ramas ni afirmar éxito científico sin pruebas.",
].join("\n")

const INTERNAL_ADMIN = [
  "[EVIDENCIA TÉCNICA INTERNA — HISTÓRICO CONSULTADO EN DELL]",
  "Inventario archivado 2026-11-03: 58 notebooks con código y resultados y 2 datasets respaldados. Distribución registrada: 3 notebooks de la rama Principal y 55 de Cognitive. Integridad de respaldo no demuestra validación de los experimentos, restauración funcional ni que esta sea la ejecución más reciente.",
  "Informe de MaleCNS-Cognitive C0.13 OneEpoch-NewOnly, código de estado DEV_COMPLETE, promovido=false, merge_to_principal=false; evaluación holdout n=192: 46,875% antes y 48,4375% después. La media macro de cohortes históricas disminuyó de 69,809% a 66,105%. Aunque hubo 87.331 parámetros theta modificados, NO se demostró generalización robusta ni mejora sostenida.",
  "La arquitectura experimental emplea sinapsis/pesos y reglas de aprendizaje propias; esto NO equivale a ejecutar las 166.700 neuronas públicas ni los 124,2 millones de contactos sinápticos como neuronas entrenadas. Un estado de 8.192 neuronas activas pertenece a experimentos históricos; no etiquetarlo automáticamente como última versión validada.",
  "Procedencia: respaldo privado Dell, reporte C013_READ_ONLY_AUDIT/MaleCNS_C013_OneNewEpoch_7403/report.json (SHA256 f8fd8a287123098e2385e943ee74d5b13521d12089fa95687d054b641586bd76) e inventario archive generado 2026-11-03. No hay aquí consulta en tiempo real a Kaggle.",
].join("\n")

const POLICY = [
  "[REGLAS EPISTÉMICAS — OBLIGATORIAS PARA CLAW]",
  "1. Distingue explícitamente fuente externa, proyecto propio y rama experimental. No presentes los números o publicaciones de Janelia como resultados de nuestro entrenamiento.",
  "2. Distingue: evidencia archivada, resultado de entrenamiento, validación independiente y trabajo planeado. Nunca conviertas DEV_COMPLETE en validado o desplegado.",
  "3. En preguntas generales sobre 'MaleCNS' de nuestro trabajo, empieza explicando nuestro proyecto. La fuente externa es solo el origen del connectoma y debe ir en una frase separada.",
  "4. Los V29/V45C son antecedentes históricos, NO 'última versión'. Si se pide el estado actual, explica la fecha límite del respaldo y no inventes avances posteriores.",
  "5. Si una respuesta anterior del chat contradice estas fuentes verificadas, corrígela en vez de repetirla. No mezcles las ramas Principal y Cognitive.",
  "6. Prioriza contestar la pregunta concreta del usuario. Evita enumeraciones de versiones y métricas no solicitadas.",
  "7. No simules haber leído GitHub, Dell, Kaggle o la web en vivo. Solo cita fuentes que realmente figuren en este contexto; reconoce si falta evidencia de última ejecución.",
].join("\n")

export function getMaleCNSVerifiedContext(
  query: string,
  allowInternalResearch = false,
): string | null {
  const source = classifyMaleCNSSource(query)
  if (!source) return null
  const internal = allowInternalResearch ? [INTERNAL_PUBLIC, INTERNAL_ADMIN].join("\n") : INTERNAL_PUBLIC
  const sections = source === "external"
    ? [EXTERNAL]
    : source === "internal"
      ? [internal, "Referente estructural externo, sin mezclar métricas: " + EXTERNAL]
      : [internal, EXTERNAL]
  return ["CONTEXTO DE FUENTES DISTINTAS · snapshot de referencia, no consulta live", ...sections, POLICY].join("\n\n")
}
