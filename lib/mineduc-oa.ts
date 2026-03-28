import nt1Data from "@/data/mineduc/parvularia/nt1.json"
import nt2Data from "@/data/mineduc/parvularia/nt2.json"

import media1Matematica from "@/data/mineduc/media/1_medio/matematica.json"
import media1Lengua from "@/data/mineduc/media/1_medio/lengua_literatura.json"
import media1Tecnologia from "@/data/mineduc/media/1_medio/tecnologia.json"
import media1Biologia from "@/data/mineduc/media/1_medio/biologia.json"
import media1Quimica from "@/data/mineduc/media/1_medio/quimica.json"

import media2Matematica from "@/data/mineduc/media/2_medio/matematica.json"
import media2Lengua from "@/data/mineduc/media/2_medio/lengua_literatura.json"
import media2Tecnologia from "@/data/mineduc/media/2_medio/tecnologia.json"
import media2Biologia from "@/data/mineduc/media/2_medio/biologia.json"
import media2Quimica from "@/data/mineduc/media/2_medio/quimica.json"
import media2Fisica from "@/data/mineduc/media/2_medio/fisica.json"

import media3CienciasCiudadania from "@/data/mineduc/media/3_medio/ciencias_para_la_ciudadania.json"
import media3EducacionCiudadana from "@/data/mineduc/media/3_medio/educacion_ciudadana.json"

import media4Matematica from "@/data/mineduc/media/4_medio/matematica.json"
import media4CienciasCiudadania from "@/data/mineduc/media/4_medio/ciencias_para_la_ciudadania.json"
import media4EducacionCiudadana from "@/data/mineduc/media/4_medio/educacion_ciudadana.json"

import sharedCienciasCiudadaniaBase from "@/data/mineduc/shared/ciencias_para_la_ciudadania_3y4_base.json"

export type NivelKey = "parvularia" | "basica" | "media"
export type CursoKey = string
export type AsignaturaKey = string

export interface OA {
  id: string
  texto: string
  habilidades?: string[]
  ejes?: string[]
  codigoOficial?: string
  unidadId?: string
  unidadNombre?: string
  unidadNumero?: number | string
  ambito?: string
  nucleo?: string
  tipo?: "oa" | "oat"
  sourceFile?: string
}

interface RawOAItem {
  id: string
  codigo_oficial?: string
  descripcion: string
}

interface RawUnidad {
  numero?: number
  id?: string
  nombre: string
  oa: RawOAItem[]
}

interface RawModulo {
  id: string
  nombre: string
  descripcion_modulo?: string
  oa: RawOAItem[]
}

interface RawParvNucleo {
  nombre: string
  oa_transversales?: RawOAItem[]
  oa_contenido?: RawOAItem[]
}

interface RawParvAmbito {
  nombre: string
  nucleos: RawParvNucleo[]
}

interface StandardCurriculumFile {
  metadata?: Record<string, unknown>
  objetivos_habilidad?: unknown[]
  objetivos_actitud?: unknown[]
  unidades?: RawUnidad[]
  modulos?: RawModulo[]
  estructura_planificacion?: {
    tipo?: string
    modulos_disponibles?: string[]
    sugerencia_uso?: string
  }
  usa_base_compartida?: string
}

interface ParvulariaCurriculumFile {
  metadata?: Record<string, unknown>
  ambitos: RawParvAmbito[]
}

type CurriculumRaw = StandardCurriculumFile | ParvulariaCurriculumFile

export interface CurriculumRecord {
  nivel: NivelKey
  cursoKey: string
  cursoLabel: string
  asignatura: string
  asignaturaNormalizada: string
  kind: "standard" | "shared_modular" | "parvularia"
  raw: CurriculumRaw
  sourceFile: string
  sharedBaseKey?: string
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"'´`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function cursoToKey(curso: string): string {
  const c = normalizeText(curso)

  if (c.includes("nt1") || c.includes("pre kinder") || c.includes("prekinder")) return "NT1"
  if (c.includes("nt2") || c.includes("kinder")) return "NT2"

  const match = c.match(/(\d+)/)
  const num = match?.[1] || ""

  if (c.includes("basico")) return `${num}B`
  if (c.includes("medio")) return `${num}M`

  return num ? `${num}B` : ""
}

const ASIGNATURA_SYNONYMS: Record<NivelKey, Record<string, string>> = {
  parvularia: {
    identidad_y_autonomia: "Identidad y Autonomía",
    convivencia_y_ciudadania: "Convivencia y Ciudadanía",
    corporalidad_y_movimiento: "Corporalidad y Movimiento",
    lenguaje_verbal: "Lenguaje Verbal",
    lenguajes_artisticos: "Lenguajes Artísticos",
    exploracion_del_entorno_natural: "Exploración del Entorno Natural",
    pensamiento_matematico: "Pensamiento Matemático",
    comprension_del_entorno_sociocultural: "Comprensión del Entorno Sociocultural",
    parvularia: "Parvularia",
  },
  basica: {
    lenguaje_y_comunicacion: "Lenguaje y Comunicación",
    matematica: "Matemática",
    ciencias_naturales: "Ciencias Naturales",
    historia_geografia_y_cs_sociales: "Historia, Geografía y Cs. Sociales",
    historia_geografia_y_ciencias_sociales: "Historia, Geografía y Cs. Sociales",
    tecnologia: "Tecnología",
    ingles: "Inglés",
  },
  media: {
    lengua_y_literatura: "Lengua y Literatura",
    matematica: "Matemática",
    tecnologia: "Tecnología",
    biologia: "Biología",
    quimica: "Química",
    fisica: "Física",
    educacion_ciudadana: "Educación Ciudadana",
    ciencias_para_la_ciudadania: "Ciencias para la Ciudadanía",
    historia_geografia_y_cs_sociales: "Historia, Geografía y Cs. Sociales",
    historia_geografia_y_ciencias_sociales: "Historia, Geografía y Cs. Sociales",
  },
}

export function normalizeAsignatura(asignatura: string, nivel: NivelKey): string {
  const slug = slugify(asignatura)
  return ASIGNATURA_SYNONYMS[nivel]?.[slug] || asignatura
}

function buildRegistryKey(nivel: NivelKey, cursoKey: string, asignaturaNormalizada: string) {
  return `${nivel}|${cursoKey}|${asignaturaNormalizada}`
}

const REGISTRY: Record<string, CurriculumRecord> = {}

function registerRecord(record: CurriculumRecord) {
  REGISTRY[buildRegistryKey(record.nivel, record.cursoKey, record.asignaturaNormalizada)] = record
}

function registerStandardFile(
  nivel: NivelKey,
  cursoLabel: string,
  asignatura: string,
  raw: StandardCurriculumFile,
  sourceFile: string
) {
  const cursoKey = cursoToKey(cursoLabel)
  const asignaturaNormalizada = normalizeAsignatura(asignatura, nivel)

  registerRecord({
    nivel,
    cursoKey,
    cursoLabel,
    asignatura,
    asignaturaNormalizada,
    kind: raw.modulos ? "shared_modular" : "standard",
    raw,
    sourceFile,
  })
}

function registerSharedPlanningFile(
  nivel: NivelKey,
  cursoLabel: string,
  asignatura: string,
  raw: StandardCurriculumFile,
  sourceFile: string,
  sharedBaseKey: string
) {
  const cursoKey = cursoToKey(cursoLabel)
  const asignaturaNormalizada = normalizeAsignatura(asignatura, nivel)

  registerRecord({
    nivel,
    cursoKey,
    cursoLabel,
    asignatura,
    asignaturaNormalizada,
    kind: "shared_modular",
    raw,
    sourceFile,
    sharedBaseKey,
  })
}

function registerParvulariaFile(
  cursoLabel: string,
  raw: ParvulariaCurriculumFile,
  sourceFile: string
) {
  const cursoKey = cursoToKey(cursoLabel)

  for (const ambito of raw.ambitos || []) {
    for (const nucleo of ambito.nucleos || []) {
      const asignatura = nucleo.nombre
      const asignaturaNormalizada = normalizeAsignatura(asignatura, "parvularia")

      registerRecord({
        nivel: "parvularia",
        cursoKey,
        cursoLabel,
        asignatura,
        asignaturaNormalizada,
        kind: "parvularia",
        raw,
        sourceFile,
      })
    }
  }
}

registerParvulariaFile("NT1", nt1Data as ParvulariaCurriculumFile, "data/mineduc/parvularia/nt1.json")
registerParvulariaFile("NT2", nt2Data as ParvulariaCurriculumFile, "data/mineduc/parvularia/nt2.json")

registerStandardFile("media", "1° Medio", "Matemática", media1Matematica as StandardCurriculumFile, "data/mineduc/media/1_medio/matematica.json")
registerStandardFile("media", "1° Medio", "Lengua y Literatura", media1Lengua as StandardCurriculumFile, "data/mineduc/media/1_medio/lengua_literatura.json")
registerStandardFile("media", "1° Medio", "Tecnología", media1Tecnologia as StandardCurriculumFile, "data/mineduc/media/1_medio/tecnologia.json")
registerStandardFile("media", "1° Medio", "Biología", media1Biologia as StandardCurriculumFile, "data/mineduc/media/1_medio/biologia.json")
registerStandardFile("media", "1° Medio", "Química", media1Quimica as StandardCurriculumFile, "data/mineduc/media/1_medio/quimica.json")

registerStandardFile("media", "2° Medio", "Matemática", media2Matematica as StandardCurriculumFile, "data/mineduc/media/2_medio/matematica.json")
registerStandardFile("media", "2° Medio", "Lengua y Literatura", media2Lengua as StandardCurriculumFile, "data/mineduc/media/2_medio/lengua_literatura.json")
registerStandardFile("media", "2° Medio", "Tecnología", media2Tecnologia as StandardCurriculumFile, "data/mineduc/media/2_medio/tecnologia.json")
registerStandardFile("media", "2° Medio", "Biología", media2Biologia as StandardCurriculumFile, "data/mineduc/media/2_medio/biologia.json")
registerStandardFile("media", "2° Medio", "Química", media2Quimica as StandardCurriculumFile, "data/mineduc/media/2_medio/quimica.json")
registerStandardFile("media", "2° Medio", "Física", media2Fisica as StandardCurriculumFile, "data/mineduc/media/2_medio/fisica.json")

registerSharedPlanningFile(
  "media",
  "3° Medio",
  "Ciencias para la Ciudadanía",
  media3CienciasCiudadania as StandardCurriculumFile,
  "data/mineduc/media/3_medio/ciencias_para_la_ciudadania.json",
  "data/mineduc/shared/ciencias_para_la_ciudadania_3y4_base.json"
)

registerSharedPlanningFile(
  "media",
  "4° Medio",
  "Ciencias para la Ciudadanía",
  media4CienciasCiudadania as StandardCurriculumFile,
  "data/mineduc/media/4_medio/ciencias_para_la_ciudadania.json",
  "data/mineduc/shared/ciencias_para_la_ciudadania_3y4_base.json"
)

registerStandardFile("media", "3° Medio", "Educación Ciudadana", media3EducacionCiudadana as StandardCurriculumFile, "data/mineduc/media/3_medio/educacion_ciudadana.json")
registerStandardFile("media", "4° Medio", "Matemática", media4Matematica as StandardCurriculumFile, "data/mineduc/media/4_medio/matematica.json")
registerStandardFile("media", "4° Medio", "Educación Ciudadana", media4EducacionCiudadana as StandardCurriculumFile, "data/mineduc/media/4_medio/educacion_ciudadana.json")

function getSharedCienciasBase(): StandardCurriculumFile {
  return sharedCienciasCiudadaniaBase as StandardCurriculumFile
}

export function getCurriculumRecord(
  nivel: NivelKey,
  curso: string,
  asignatura: string
): CurriculumRecord | null {
  const cursoKey = cursoToKey(curso)
  const asignaturaNormalizada = normalizeAsignatura(asignatura, nivel)
  return REGISTRY[buildRegistryKey(nivel, cursoKey, asignaturaNormalizada)] || null
}

function flattenStandardUnits(raw: StandardCurriculumFile, sourceFile: string): OA[] {
  const result: OA[] = []

  for (const unidad of raw.unidades || []) {
    for (const oa of unidad.oa || []) {
      result.push({
        id: oa.id,
        texto: oa.descripcion,
        codigoOficial: oa.codigo_oficial,
        unidadId: unidad.id || `u${String(unidad.numero ?? "").trim()}`,
        unidadNombre: unidad.nombre,
        unidadNumero: unidad.numero,
        ejes: unidad.nombre ? [unidad.nombre] : [],
        tipo: "oa",
        sourceFile,
      })
    }
  }

  return result
}

function flattenSharedModules(raw: StandardCurriculumFile, sourceFile: string): OA[] {
  const modules = raw.modulos || []
  const result: OA[] = []

  for (const modulo of modules) {
    for (const oa of modulo.oa || []) {
      result.push({
        id: oa.id,
        texto: oa.descripcion,
        codigoOficial: oa.codigo_oficial,
        unidadId: modulo.id,
        unidadNombre: modulo.nombre,
        unidadNumero: modulo.id,
        ejes: modulo.nombre ? [modulo.nombre] : [],
        tipo: "oa",
        sourceFile,
      })
    }
  }

  return result
}

function flattenParvulariaNucleo(
  raw: ParvulariaCurriculumFile,
  asignatura: string,
  sourceFile: string
): OA[] {
  const normalized = normalizeAsignatura(asignatura, "parvularia")
  const result: OA[] = []

  for (const ambito of raw.ambitos || []) {
    for (const nucleo of ambito.nucleos || []) {
      if (normalizeAsignatura(nucleo.nombre, "parvularia") !== normalized) continue

      for (const oa of nucleo.oa_contenido || []) {
        result.push({
          id: oa.id,
          texto: oa.descripcion,
          codigoOficial: oa.codigo_oficial,
          ambito: ambito.nombre,
          nucleo: nucleo.nombre,
          ejes: [ambito.nombre, nucleo.nombre],
          tipo: "oa",
          sourceFile,
        })
      }
    }
  }

  return result
}

export function getOAs(nivel: NivelKey, curso: string, asignatura: string): OA[] {
  const record = getCurriculumRecord(nivel, curso, asignatura)
  if (!record) return []

  if (record.kind === "parvularia") {
    return flattenParvulariaNucleo(
      record.raw as ParvulariaCurriculumFile,
      record.asignaturaNormalizada,
      record.sourceFile
    )
  }

  if (record.sharedBaseKey) {
    return flattenSharedModules(getSharedCienciasBase(), record.sharedBaseKey)
  }

  const raw = record.raw as StandardCurriculumFile
  if (raw.modulos?.length) return flattenSharedModules(raw, record.sourceFile)
  return flattenStandardUnits(raw, record.sourceFile)
}

export function getOA(
  nivel: NivelKey,
  curso: string,
  asignatura: string,
  numero: number
): OA | null {
  const oas = getOAs(nivel, curso, asignatura)
  const suffix = String(numero)
  return (
    oas.find(oa => oa.id === `OA${numero}`) ||
    oas.find(oa => oa.id.endsWith(`-${suffix}`)) ||
    oas.find(oa => oa.codigoOficial?.match(new RegExp(`\\bOA\\s*0*${suffix}\\b`, "i"))) ||
    null
  )
}

export function buildOAContext(
  nivel: NivelKey,
  curso: string,
  asignatura: string,
  oaNumero?: number
): string {
  const oas = getOAs(nivel, curso, asignatura)
  if (!oas.length) return ""

  const filtered = oaNumero ? (getOA(nivel, curso, asignatura, oaNumero) ? [getOA(nivel, curso, asignatura, oaNumero)!] : []) : oas
  if (!filtered.length) return ""

  const header = `\nOBJETIVOS DE APRENDIZAJE OFICIALES MINEDUC — ${asignatura} ${curso}:\n`

  return (
    header +
    filtered
      .map(oa => {
        const pieces = [
          oa.codigoOficial || oa.id,
          oa.texto,
          oa.unidadNombre ? `(Unidad/Módulo: ${oa.unidadNombre})` : "",
          oa.ambito ? `(Ámbito: ${oa.ambito})` : "",
          oa.nucleo ? `(Núcleo: ${oa.nucleo})` : "",
        ].filter(Boolean)

        return pieces.join(" ")
      })
      .join("\n")
  )
}

export function getAvailableAsignaturas(nivel: NivelKey, curso: string): string[] {
  const cursoKey = cursoToKey(curso)

  return Object.values(REGISTRY)
    .filter(item => item.nivel === nivel && item.cursoKey === cursoKey)
    .map(item => item.asignaturaNormalizada)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b, "es"))
}

export const OA_DATABASE = REGISTRY
