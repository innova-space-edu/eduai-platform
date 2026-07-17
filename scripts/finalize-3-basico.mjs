import { readFileSync, writeFileSync } from "node:fs"

const sourcesPath = "data/mineduc/sources.json"
const sources = JSON.parse(readFileSync(sourcesPath, "utf8"))
sources.revision = "fase_6_3_basico_completo_verificado"
sources.fecha_actualizacion = "2026-07-17"
sources.politica.estados_permitidos = ["verificado_oficial", "verificado_propuesta_oficial", "pendiente_verificacion", "incompleto", "no_utilizar"]

Object.assign(sources.asignaturas_verificadas, {
  "basica/3_basico/matematica": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/matematica/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["MA03 OA 01", "MA03 OA 26"], cantidad_oa_contenido: 26 },
  "basica/3_basico/lenguaje": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/lenguaje-comunicacion/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["LE03 OA 01", "LE03 OA 31"], cantidad_oa_contenido: 31 },
  "basica/3_basico/ciencias_naturales": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/ciencias-naturales/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["CN03 OA 01", "CN03 OA 13"], cantidad_oa_contenido: 13 },
  "basica/3_basico/historia_geografia_y_cs_sociales": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/historia-geografia-ciencias-sociales/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["HI03 OA 01", "HI03 OA 16"], cantidad_oa_contenido: 16 },
  "basica/3_basico/artes_visuales": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/artes-visuales/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["AR03 OA 01", "AR03 OA 05"], cantidad_oa_contenido: 5 },
  "basica/3_basico/educacion_fisica_y_salud": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/educacion-fisica-salud/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["EF03 OA 01", "EF03 OA 11"], cantidad_oa_contenido: 11 },
  "basica/3_basico/musica": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/musica/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["MU03 OA 01", "MU03 OA 08"], cantidad_oa_contenido: 8 },
  "basica/3_basico/orientacion": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/orientacion/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["OR03 OA 01", "OR03 OA 08"], cantidad_oa_contenido: 8 },
  "basica/3_basico/tecnologia": { url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/tecnologia/3-basico", base_curricular_id: "basica-1-6", fecha_consulta: "2026-07-17", alcance: ["TE03 OA 01", "TE03 OA 07"], cantidad_oa_contenido: 7 },
})

sources.propuestas_oficiales_verificadas ||= {}
sources.propuestas_oficiales_verificadas["basica/3_basico/ingles"] = {
  url: "https://www.curriculumnacional.cl/curriculum/1o-6o-basico/ingles-propuesta/3-basico",
  fecha_consulta: "2026-07-17",
  alcance: ["EN03 OA 01", "EN03 OA 14"],
  cantidad_oa_contenido: 14,
  caracter: "propuesta_curricular_no_obligatoria",
}

writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8")

const progressPath = "data/mineduc/meta/verification-progress.json"
const progress = {
  fecha_actualizacion: "2026-07-17",
  fase: "3_basico_completo",
  archivos_curriculares_totales: 105,
  asignaturas_verificadas_oficialmente: 47,
  propuestas_oficiales_verificadas: 3,
  archivos_pendientes: 55,
  oa_contenido_verificados: 659,
  cursos_completos: ["1_basico", "2_basico", "3_basico", "7_basico", "8_basico"],
  siguiente_bloque: "4_basico",
  ultima_validacion: "pendiente",
  nota: "Contabiliza OA cotejados con páginas oficiales específicas. Inglés de 1°, 2° y 3° básico se registra como propuesta curricular oficial, no como base obligatoria.",
}
writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`, "utf8")
