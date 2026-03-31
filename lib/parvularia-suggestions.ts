import { getAvailableAsignaturas, type NivelKey } from "@/lib/mineduc-oa"
import {
  getPlannerOAOptions,
  getParvulariaAmbito,
  getParvulariaOAT,
  type PlannerOption,
} from "@/lib/planificador-curriculum"

type OAHit = {
  id: string
  label: string
  texto: string
  asignatura: string
  ambito?: string
  nucleo?: string
  score: number
  reason: string
}

type OATHit = {
  id: string
  label: string
  description?: string
  asignatura: string
  score: number
  reason: string
}

type AmbitoHit = {
  ambito: string
  score: number
}

type NucleoHit = {
  nucleo: string
  score: number
}

export type ParvulariaSuggestionContext = {
  temaUsuario: string
  curso: string
  tokens: string[]
  oaSugeridos: OAHit[]
  oatSugeridos: OATHit[]
  ambitosSugeridos: AmbitoHit[]
  nucleosSugeridos: NucleoHit[]
  resumenCurricular: string
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(text: string): string[] {
  const stop = new Set([
    "para", "como", "con", "una", "unos", "unas", "del", "las", "los", "que",
    "quiero", "hacer", "actividad", "trabajar", "sobre", "pero", "porque",
    "desde", "este", "esta", "estos", "estas", "seria", "podria", "puedo",
    "ninos", "ninas", "parvulos", "parvulas", "tema",
  ])

  return normalize(text)
    .split(" ")
    .filter(Boolean)
    .filter((w) => w.length >= 3 && !stop.has(w))
}

function countTokenMatches(target: string, tokens: string[]): number {
  const base = normalize(target)
  let score = 0

  for (const token of tokens) {
    if (base.includes(token)) {
      score += token.length >= 7 ? 4 : 2
    }
  }

  return score
}

function buildReason(what: string, temaUsuario: string, score: number) {
  if (score >= 10) return `${what} muy relacionado con el tema "${temaUsuario}".`
  if (score >= 6) return `${what} relacionado de forma clara con el tema "${temaUsuario}".`
  return `${what} con relacion parcial al tema "${temaUsuario}".`
}

function dedupeById<T extends { id: string; score: number }>(items: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    const prev = map.get(item.id)
    if (!prev || item.score > prev.score) {
      map.set(item.id, item)
    }
  }
  return [...map.values()]
}

function dedupeByKey<T extends { score: number }>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    const key = getKey(item)
    const prev = map.get(key)
    if (!prev || item.score > prev.score) {
      map.set(key, item)
    }
  }
  return [...map.values()]
}

export function suggestParvulariaFromTopic(curso: string, temaUsuario: string): ParvulariaSuggestionContext {
  const nivel: NivelKey = "parvularia"
  const tokens = tokenize(temaUsuario)
  const asignaturas = getAvailableAsignaturas(nivel, curso)

  const oaHits: OAHit[] = []
  const oatHits: OATHit[] = []
  const ambitoHits: AmbitoHit[] = []
  const nucleoHits: NucleoHit[] = []

  for (const asignatura of asignaturas) {
    const oaOptions = getPlannerOAOptions({ nivel, curso, asignatura })

    for (const oa of oaOptions) {
      const textBase = [
        oa.texto,
        oa.codigoOficial || "",
        oa.ambito || "",
        oa.nucleo || "",
        asignatura,
      ].join(" ")

      const score = countTokenMatches(textBase, tokens)
      if (score <= 0) continue

      oaHits.push({
        id: oa.id,
        label: oa.codigoOficial ? `${oa.codigoOficial} — ${oa.texto}` : `${oa.id} — ${oa.texto}`,
        texto: oa.texto,
        asignatura,
        ambito: oa.ambito,
        nucleo: oa.nucleo,
        score,
        reason: buildReason("OA", temaUsuario, score),
      })

      if (oa.ambito) {
        ambitoHits.push({
          ambito: oa.ambito,
          score,
        })
      }

      if (oa.nucleo) {
        nucleoHits.push({
          nucleo: oa.nucleo,
          score,
        })
      }
    }

    const oats = getParvulariaOAT(curso, asignatura)
    for (const oat of oats) {
      const textBase = [oat.id, oat.label, oat.description || "", asignatura].join(" ")
      const score = countTokenMatches(textBase, tokens)
      if (score <= 0) continue

      oatHits.push({
        id: oat.id,
        label: oat.label,
        description: oat.description,
        asignatura,
        score,
        reason: buildReason("OAT", temaUsuario, score),
      })
    }

    const ambito = getParvulariaAmbito(curso, asignatura)
    if (ambito) {
      const score = countTokenMatches(`${ambito} ${asignatura}`, tokens)
      if (score > 0) {
        ambitoHits.push({ ambito, score })
      }
    }
  }

  const uniqueOA = dedupeById(oaHits)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const uniqueOAT = dedupeById(oatHits)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const uniqueAmbitos = dedupeByKey(ambitoHits, (item) => item.ambito)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const uniqueNucleos = dedupeByKey(nucleoHits, (item) => item.nucleo)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  const resumenCurricular = [
    `Curso/Subnivel: ${curso}`,
    `Tema del docente: ${temaUsuario}`,
    tokens.length ? `Palabras clave detectadas: ${tokens.join(", ")}` : "Palabras clave detectadas: sin coincidencias fuertes",
    uniqueAmbitos.length
      ? `Ámbitos sugeridos: ${uniqueAmbitos.map((x) => x.ambito).join(" | ")}`
      : "Ámbitos sugeridos: sin coincidencias claras",
    uniqueNucleos.length
      ? `Núcleos sugeridos: ${uniqueNucleos.map((x) => x.nucleo).join(" | ")}`
      : "Núcleos sugeridos: sin coincidencias claras",
    uniqueOA.length
      ? `OA sugeridos: ${uniqueOA.map((x) => x.id).join(", ")}`
      : "OA sugeridos: sin coincidencias claras",
    uniqueOAT.length
      ? `OAT sugeridos: ${uniqueOAT.map((x) => x.id).join(", ")}`
      : "OAT sugeridos: sin coincidencias claras",
  ].join("\n")

  return {
    temaUsuario,
    curso,
    tokens,
    oaSugeridos: uniqueOA,
    oatSugeridos: uniqueOAT,
    ambitosSugeridos: uniqueAmbitos,
    nucleosSugeridos: uniqueNucleos,
    resumenCurricular,
  }
}

export function buildParvulariaSuggestionJsonPrompt(ctx: ParvulariaSuggestionContext) {
  return `
CURSO/SUBNIVEL:
${ctx.curso}

TEMA DEL DOCENTE:
${ctx.temaUsuario}

RESUMEN CURRICULAR LOCAL:
${ctx.resumenCurricular}

OA SUGERIDOS:
${JSON.stringify(ctx.oaSugeridos, null, 2)}

OAT SUGERIDOS:
${JSON.stringify(ctx.oatSugeridos, null, 2)}

Debes responder SOLO JSON válido con esta estructura:
{
  "ambitosSugeridos": [
    { "ambito": "string", "score": 0 }
  ],
  "nucleosSugeridos": [
    { "nucleo": "string", "score": 0 }
  ],
  "oaSugeridos": [
    {
      "id": "string",
      "label": "string",
      "asignatura": "string",
      "ambito": "string",
      "nucleo": "string",
      "score": 0,
      "reason": "string"
    }
  ],
  "oatSugeridos": [
    {
      "id": "string",
      "label": "string",
      "asignatura": "string",
      "score": 0,
      "reason": "string"
    }
  ],
  "actividades": [
    {
      "titulo": "string",
      "objetivoBreve": "string",
      "inicio": "string",
      "desarrollo": "string",
      "cierre": "string",
      "materiales": ["string"],
      "evaluacion": "string",
      "adaptaciones": ["string"]
    }
  ],
  "sugerenciaDocente": "string"
}
`.trim()
}
