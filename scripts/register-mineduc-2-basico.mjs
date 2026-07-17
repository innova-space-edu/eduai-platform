import { readFileSync, writeFileSync } from "node:fs"

const sourcesPath = "data/mineduc/sources.json"
const sources = JSON.parse(readFileSync(sourcesPath, "utf8"))
sources.revision = "fase_5_2_basico_completo_verificado"
sources.fecha_actualizacion = "2026-07-17"
sources.politica.estados_permitidos = ["verificado_oficial", "verificado_propuesta_oficial", "pendiente_verificacion", "incompleto", "no_utilizar"]

Object.assign(sources.asignaturas_verificadas, {
  "basica/2_basico/matematica": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/matematica/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["MA02 OA 01", "MA02 OA 22"], cantidad_oa_contenido: 22 },
  "basica/2_basico/lenguaje": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/lenguaje-comunicacion/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["LE02 OA 01", "LE02 OA 30"], cantidad_oa_contenido: 30 },
  "basica/2_basico/ciencias_naturales": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/ciencias-naturales/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["CN02 OA 01", "CN02 OA 14"], cantidad_oa_contenido: 14 },
  "basica/2_basico/historia_geografia_y_cs_sociales": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/historia-geografia-ciencias-sociales/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["HI02 OA 01", "HI02 OA 16"], cantidad_oa_contenido: 16 },
  "basica/2_basico/artes_visuales": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/artes-visuales/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["AR02 OA 01", "AR02 OA 05"], cantidad_oa_contenido: 5 },
  "basica/2_basico/educacion_fisica_y_salud": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/educacion-fisica-salud/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["EF02 OA 01", "EF02 OA 11"], cantidad_oa_contenido: 11 },
  "basica/2_basico/musica": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/musica/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["MU02 OA 01", "MU02 OA 07"], cantidad_oa_contenido: 7 },
  "basica/2_basico/orientacion": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/orientacion/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["OR02 OA 01", "OR02 OA 08"], cantidad_oa_contenido: 8 },
  "basica/2_basico/tecnologia": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/tecnologia/2-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["TE02 OA 01", "TE02 OA 07"], cantidad_oa_contenido: 7 },
})

sources.propuestas_oficiales_verificadas ||= {}
sources.propuestas_oficiales_verificadas["basica/2_basico/ingles"] = {
  url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/ingles-propuesta/2-basico",
  fecha_consulta: "2026-07-17",
  alcance: ["EN02 OA 01", "EN02 OA 14"],
  cantidad_oa_contenido: 14,
  caracter: "propuesta_curricular_no_obligatoria",
}

writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8")

const progressPath = "data/mineduc/meta/verification-progress.json"
const progress = {
  fecha_actualizacion: "2026-07-17",
  fase: "2_basico_completo",
  archivos_curriculares_totales: 105,
  asignaturas_verificadas_oficialmente: 38,
  propuestas_oficiales_verificadas: 2,
  archivos_pendientes: 65,
  oa_contenido_verificados: 520,
  cursos_completos: ["1_basico", "2_basico", "7_basico", "8_basico"],
  siguiente_bloque: "3_basico",
  ultima_validacion: "pendiente",
  nota: "Contabiliza OA cotejados con páginas oficiales específicas. Inglés de 1° y 2° básico se registra como propuesta curricular oficial, no como base obligatoria.",
}
writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`, "utf8")
