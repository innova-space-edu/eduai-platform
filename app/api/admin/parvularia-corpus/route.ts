import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { unzipSync } from "fflate"
import mammoth from "mammoth"
import * as cheerio from "cheerio"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

type ParsedSource = {
  sourceHash: string
  fileName: string
  category: string
  level: string
  topic: string
  rawText: string
  parseStatus: "parsed" | "legacy_doc_metadata_only" | "unsupported"
  tables: string[][][]
}

type ActivitySeed = {
  activityKey: string
  sourceHash: string
  level: string
  topic: string
  sequenceLabel: string
  dayLabel: string
  ambitoNucleo: string
  oaText: string
  oatText: string
  skillText: string
  experienceText: string
  inicio: string
  desarrollo: string
  cierre: string
  evaluation: string
  resources: string
  searchText: string
  qualityScore: number
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Falta configurar Supabase URL o SUPABASE_SERVICE_ROLE_KEY")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: "No autenticado" }

  const { data } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle()

  return data ? { user, error: null } : { user: null, error: "Acceso denegado" }
}

function compact(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
}

function normalize(value: string) {
  return compact(value)
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

function inferLevel(fileName: string) {
  const value = normalize(fileName)
  if (value.includes("sc menor") || value.includes("sala cuna menor")) return "Sala Cuna Menor (0 a 1 año)"
  if (value.includes("sc mayor") || value.includes("sala cuna mayor")) return "Sala Cuna Mayor (1 a 2 años)"
  if (value.includes("pre kinder") || value.includes("prekinder")) return "NT1 - Pre Kinder (4-5 años)"
  if (value.includes("kinder")) return "NT2 - Kinder (5-6 años)"
  return "Sala Cuna"
}

function inferCategory(fileName: string) {
  const value = normalize(fileName)
  if (value.includes("periodo de adaptacion")) return "periodo_adaptacion"
  if (value.includes("plan de trabajo anual") || value.includes("plan anual")) return "plan_anual"
  if (value.includes("red de contenidos")) return "curriculum_red"
  if (value.includes("estructura de habilidades")) return "habilidades"
  if (value.includes("evaluacion diagnostica")) return "evaluacion_diagnostica"
  if (value.includes("pauta evaluacion")) return "pauta_evaluacion"
  if (value.includes("informe hogar")) return "informe_hogar"
  if (value.includes("clase a clase")) return "planificacion_clase_a_clase"
  if (value.includes("planificacion") || value.includes("planificaciones")) return "planificacion_semanal"
  return "otro"
}

function inferTopic(fileName: string) {
  return compact(
    fileName
      .replace(/\.(docx?|DOCX?)$/i, "")
      .replace(/_/g, " ")
      .replace(/planificaciones?/gi, " ")
      .replace(/sala\s*cuna\s*(menor|mayor)/gi, " ")
      .replace(/sc\s*(menor|mayor)/gi, " ")
      .replace(/sin\s+enviar\s+a\s+adriana/gi, " ")
      .replace(/sin\s+hacer/gi, " ")
  ) || "Sin tema explícito"
}

function parseExperienceParts(value: string) {
  const text = compact(value)
  const labels = [...text.matchAll(/\b(Inicio|Desarrollo|Cierre|Finalizaci[oó]n)\s*:/gi)]
  if (!labels.length) return { inicio: "", desarrollo: text, cierre: "" }

  const parts: Record<string, string> = {}
  labels.forEach((match, index) => {
    const label = normalize(match[1])
    const end = labels[index + 1]?.index ?? text.length
    const start = (match.index || 0) + match[0].length
    parts[label] = compact(text.slice(start, end))
  })

  return {
    inicio: parts.inicio || "",
    desarrollo: parts.desarrollo || "",
    cierre: parts.cierre || parts.finalizacion || "",
  }
}

function findRow(table: string[][], matcher: (normalized: string) => boolean) {
  return table.findIndex((row) => matcher(normalize(row[0] || "")))
}

function qualityScore(activity: Omit<ActivitySeed, "qualityScore" | "activityKey" | "sourceHash">) {
  let score = 0
  if (activity.inicio.length >= 80) score += 2
  if (activity.desarrollo.length >= 220) score += 4
  if (activity.cierre.length >= 60) score += 2
  if (activity.resources.length >= 40) score += 1
  if (activity.evaluation.length >= 60) score += 1
  return score
}

function extractActivities(source: ParsedSource): ActivitySeed[] {
  const rows: ActivitySeed[] = []

  source.tables.forEach((table, tableIndex) => {
    const experienceRow = findRow(table, (value) => value === "experiencia" || value.startsWith("experiencia "))
    if (experienceRow < 0 || !table[0]) return

    const scopeRow = findRow(table, (value) => value.includes("ambito nucleo"))
    const oaRow = findRow(table, (value) => value.includes("objetivo de aprendizaje central"))
    const oatRow = findRow(table, (value) => value.includes("nucleo objetivo de aprendizaje transversal"))
    const skillRow = findRow(table, (value) => value.includes("habilidades"))
    const evaluationRow = findRow(table, (value) => value === "evaluacion")
    const resourcesRow = findRow(table, (value) => value === "recursos")
    const header = table[0]
    const columns = Math.max(...table.map((row) => row.length))

    const cell = (rowIndex: number, columnIndex: number) =>
      rowIndex >= 0 ? compact(table[rowIndex]?.[columnIndex] || "") : ""

    for (let column = 1; column < columns; column += 1) {
      const experienceText = cell(experienceRow, column)
      if (experienceText.length < 100) continue

      const parts = parseExperienceParts(experienceText)
      const draft = {
        level: source.level,
        topic: source.topic,
        sequenceLabel: compact(header[0] || `Experiencia ${tableIndex + 1}`),
        dayLabel: compact(header[column] || ""),
        ambitoNucleo: cell(scopeRow, column),
        oaText: cell(oaRow, column),
        oatText: cell(oatRow, column),
        skillText: cell(skillRow, column),
        experienceText,
        inicio: parts.inicio,
        desarrollo: parts.desarrollo,
        cierre: parts.cierre,
        evaluation: cell(evaluationRow, column),
        resources: cell(resourcesRow, column),
        searchText: compact([
          source.level, source.topic, cell(scopeRow, column), cell(oaRow, column),
          cell(oatRow, column), cell(skillRow, column), experienceText,
          cell(evaluationRow, column), cell(resourcesRow, column),
        ].join(" ")),
      }

      rows.push({
        ...draft,
        sourceHash: source.sourceHash,
        activityKey: sha256(`${source.sourceHash}|${tableIndex}|${column}|${experienceText.slice(0, 180)}`),
        qualityScore: qualityScore(draft),
      })
    }
  })

  return rows
}

async function parseDocx(fileName: string, bytes: Uint8Array): Promise<ParsedSource> {
  const buffer = Buffer.from(bytes)
  const [{ value: raw }, { value: html }] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ])

  const $ = cheerio.load(html)
  const tables: string[][][] = []
  $("table").each((_index, tableNode) => {
    const rows: string[][] = []
    $(tableNode).find("tr").each((_rowIndex, rowNode) => {
      const cells = $(rowNode).find("th,td").map((_cellIndex, cellNode) => compact($(cellNode).text())).get()
      if (cells.some(Boolean)) rows.push(cells)
    })
    if (rows.length) tables.push(rows)
  })

  const rawText = compact(raw)
  return {
    sourceHash: sha256(bytes),
    fileName,
    category: inferCategory(fileName),
    level: inferLevel(fileName),
    topic: inferTopic(fileName),
    rawText,
    parseStatus: "parsed",
    tables,
  }
}

function legacySource(fileName: string, bytes: Uint8Array): ParsedSource {
  return {
    sourceHash: sha256(bytes),
    fileName,
    category: inferCategory(fileName),
    level: inferLevel(fileName),
    topic: inferTopic(fileName),
    rawText: "",
    parseStatus: "legacy_doc_metadata_only",
    tables: [],
  }
}

async function importSources(corpusKey: string, files: Array<{ fileName: string; bytes: Uint8Array }>) {
  const admin = getAdminClient()
  const parsed: ParsedSource[] = []

  for (const file of files) {
    if (/\.docx$/i.test(file.fileName)) {
      try {
        parsed.push(await parseDocx(file.fileName, file.bytes))
      } catch {
        parsed.push({
          ...legacySource(file.fileName, file.bytes),
          parseStatus: "unsupported",
        })
      }
    } else if (/\.doc$/i.test(file.fileName)) {
      parsed.push(legacySource(file.fileName, file.bytes))
    }
  }

  const sourceRows = parsed.map((source) => ({
    corpus_key: corpusKey,
    source_hash: source.sourceHash,
    file_name: source.fileName,
    source_type: "document",
    category: source.category,
    level: source.level,
    topic: source.topic,
    raw_text: source.rawText,
    metadata: {
      parse_status: source.parseStatus,
      table_count: source.tables.length,
      char_count: source.rawText.length,
    },
    active: true,
    updated_at: new Date().toISOString(),
  }))

  const { data: sourceData, error: sourceError } = await admin
    .from("parvularia_corpus_sources")
    .upsert(sourceRows, { onConflict: "source_hash" })
    .select("id,source_hash")

  if (sourceError) throw new Error(`No se pudo importar fuentes: ${sourceError.message}`)

  const sourceIdByHash = new Map((sourceData || []).map((row) => [row.source_hash, row.id]))
  const activities = parsed.flatMap(extractActivities)
  const activityRows = activities.map((activity) => ({
    source_id: sourceIdByHash.get(activity.sourceHash) || null,
    activity_key: activity.activityKey,
    level: activity.level,
    topic: activity.topic,
    sequence_label: activity.sequenceLabel,
    day_label: activity.dayLabel,
    ambito_nucleo: activity.ambitoNucleo,
    oa_text: activity.oaText,
    oat_text: activity.oatText,
    skill_text: activity.skillText,
    experience_text: activity.experienceText,
    inicio: activity.inicio,
    desarrollo: activity.desarrollo,
    cierre: activity.cierre,
    evaluation: activity.evaluation,
    resources: activity.resources,
    tags: [],
    quality_score: activity.qualityScore,
    search_text: activity.searchText,
    metadata: { source_hash: activity.sourceHash },
    active: true,
    updated_at: new Date().toISOString(),
  }))

  for (let index = 0; index < activityRows.length; index += 100) {
    const batch = activityRows.slice(index, index + 100)
    const { error } = await admin
      .from("parvularia_activity_bank")
      .upsert(batch, { onConflict: "activity_key" })
    if (error) throw new Error(`No se pudo importar banco de actividades: ${error.message}`)
  }

  return {
    documents: parsed.length,
    parsedDocuments: parsed.filter((item) => item.parseStatus === "parsed").length,
    legacyDocuments: parsed.filter((item) => item.parseStatus === "legacy_doc_metadata_only").length,
    unsupportedDocuments: parsed.filter((item) => item.parseStatus === "unsupported").length,
    activities: activities.length,
    levels: [...new Set(parsed.map((item) => item.level))],
    categories: [...new Set(parsed.map((item) => item.category))],
  }
}

export async function GET() {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  const admin = getAdminClient()
  const [sources, activities] = await Promise.all([
    admin.from("parvularia_corpus_sources").select("*", { count: "exact", head: true }),
    admin.from("parvularia_activity_bank").select("*", { count: "exact", head: true }),
  ])

  if (sources.error || activities.error) {
    return NextResponse.json({
      error: "La base Parvularia todavía no está disponible. Ejecuta la migración 202609230001_parvularia_knowledge_base.sql.",
      detail: sources.error?.message || activities.error?.message,
    }, { status: 503 })
  }

  return NextResponse.json({
    documents: sources.count || 0,
    activities: activities.count || 0,
  })
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 })

  try {
    const form = await req.formData()
    const upload = form.get("file")
    const corpusKey = compact(String(form.get("corpusKey") || "parvularia-manual"))

    if (!(upload instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar un archivo ZIP o DOCX." }, { status: 400 })
    }

    if (upload.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 413 })
    }

    const bytes = new Uint8Array(await upload.arrayBuffer())
    const files: Array<{ fileName: string; bytes: Uint8Array }> = []

    if (/\.zip$/i.test(upload.name)) {
      const archive = unzipSync(bytes)
      for (const [path, content] of Object.entries(archive)) {
        if (!/\.docx?$/i.test(path) || path.startsWith("__MACOSX/")) continue
        const fileName = path.split("/").filter(Boolean).pop() || path
        files.push({ fileName, bytes: content })
      }
    } else if (/\.docx?$/i.test(upload.name)) {
      files.push({ fileName: upload.name, bytes })
    } else {
      return NextResponse.json({ error: "Formato no compatible. Usa ZIP, DOCX o DOC." }, { status: 400 })
    }

    if (!files.length) {
      return NextResponse.json({ error: "No se encontraron documentos Word dentro del archivo." }, { status: 400 })
    }

    const summary = await importSources(corpusKey, files)
    return NextResponse.json({ success: true, corpusKey, ...summary })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No fue posible importar el corpus Parvularia.",
    }, { status: 500 })
  }
}
