import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "lib", "content-processor.ts")
if (!fs.existsSync(target)) throw new Error(`No se encontró ${target}`)

let source = fs.readFileSync(target, "utf8")
let changed = false

const importMarker = 'import { buildDesignPromptDirective, getDesignTemplateSummary } from "@/lib/design-templates/registry"'
const gatewayImport = 'import { runAIStructured } from "@/lib/ai/gateway"'
const googleStructuredImport = 'import { generateGoogleStructured } from "@/lib/ai/providers/google"'

if (source.includes(googleStructuredImport)) {
  source = source.replace(googleStructuredImport, gatewayImport)
  changed = true
} else if (!source.includes(gatewayImport)) {
  if (!source.includes(importMarker)) throw new Error("[content-ai-core] no se encontró import base")
  source = source.replace(importMarker, `${importMarker}\n${gatewayImport}`)
  changed = true
}

const functionStart = source.indexOf('export async function structureWithAI(')
const sectionEnd = source.indexOf('// ============================================================\n// 6. PIPELINE PRINCIPAL', functionStart)
if (functionStart < 0 || sectionEnd < 0) throw new Error("[content-ai-core] no se encontró structureWithAI")

const currentFunction = source.slice(functionStart, sectionEnd)
if (!currentFunction.includes('runAIStructured')) {
  const replacement = `export async function structureWithAI(
  extractedContent: ExtractedContent,
  outputFormat: OutputFormat,
  _apiKey: string,
  designTemplateId?: string
) {
  const systemPrompt = \`Eres un experto en educación, diseño instruccional y comunicación pedagógica.
Tu tarea es estructurar contenido educativo en formatos visuales de alta calidad.
REGLAS CRÍTICAS:
1. Responde ÚNICAMENTE con JSON válido — sin texto extra, sin backticks, sin markdown
2. Si el contenido es solo un tema (sin texto de referencia), genera contenido educativo exhaustivo y de calidad sobre ese tema
3. El contenido debe ser RICO, PROFUNDO y ESPECÍFICO — no superficial ni genérico
4. Usa datos concretos, ejemplos reales y cifras del material de referencia; si el material no aporta una cifra, no la inventes
5. Todo el contenido debe estar en español (excepto términos técnicos internacionales)
6. Razona internamente sobre el contenido antes de estructurarlo para maximizar su valor pedagógico\`

  const baseUserPrompt = getFormatPrompt(
    outputFormat,
    extractedContent.title || "Sin título",
    extractedContent.rawText || ""
  )
  const userPrompt = \`\${baseUserPrompt}\${buildDesignPromptDirective(designTemplateId, outputFormat)}\`
  const schema = SCHEMAS[outputFormat] as Record<string, unknown>

  try {
    const result = await runAIStructured<Record<string, unknown>>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema,
      maxOutputTokens: 8192,
    })
    console.log(\`[Creator] AI Gateway \${result.provider}/\${result.model} OK para \${outputFormat}\`)
    return {
      success: true,
      data: result.data,
      format: outputFormat,
      provider: result.provider,
      model: result.model,
    }
  } catch (gatewayError: any) {
    return {
      success: false,
      error: \`EduAI AI Gateway no pudo estructurar el material: \${gatewayError?.message || gatewayError}\`,
    }
  }
}

`
  source = source.slice(0, functionStart) + replacement + source.slice(sectionEnd)
  changed = true
}

source = source.replace(
  '// v3 — Gemini 2.5 Flash + responseSchema + prompts potenciados + contexto extendido 12K',
  '// v5 — EduAI AI Gateway multiproveedor + prompts potenciados + contexto extendido 12K',
)
source = source.replace(
  '// v4 — Google structured API actual + Groq fallback + prompts potenciados + contexto extendido 12K',
  '// v5 — EduAI AI Gateway multiproveedor + prompts potenciados + contexto extendido 12K',
)
source = source.replace(
  '// Paso 2: Estructurar con IA (Gemini 2.5 Flash + cascada de fallbacks)',
  '// Paso 2: Estructurar mediante EduAI AI Gateway multiproveedor',
)
source = source.replace(
  '// Paso 2: Estructurar con Google structured output + fallback Groq',
  '// Paso 2: Estructurar mediante EduAI AI Gateway multiproveedor',
)

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[content-ai-core] Creator Hub usa EduAI AI Gateway multiproveedor")
} else {
  console.log("[content-ai-core] Creator Hub ya usa EduAI AI Gateway multiproveedor")
}

const routeTarget = path.join(root, "app", "api", "process-content", "route.ts")
if (!fs.existsSync(routeTarget)) throw new Error(`No se encontró ${routeTarget}`)
let routeSource = fs.readFileSync(routeTarget, "utf8")
let routeChanged = false

if (routeSource.includes('import { safeRemoteFetch } from "@/lib/safe-remote-url"')) {
  routeSource = routeSource.replace(
    'import { safeRemoteFetch } from "@/lib/safe-remote-url"',
    'import { fetchSafeRemoteBytes } from "@/lib/safe-remote-url"',
  )
  routeChanged = true
}

const extractStart = routeSource.indexOf('async function extractSafeUrl(url: string) {')
const extractEnd = routeSource.indexOf('\nasync function getCustomTemplate(', extractStart)
if (extractStart < 0 || extractEnd < 0) throw new Error("[content-ai-core] no se encontró extractSafeUrl")
const currentExtract = routeSource.slice(extractStart, extractEnd)
if (!currentExtract.includes('fetchSafeRemoteBytes')) {
  const extractReplacement = `async function extractSafeUrl(url: string) {
  const { buffer, mimeType } = await fetchSafeRemoteBytes({
    url,
    maxBytes: 2_000_000,
    timeoutMs: 15_000,
    maxRedirects: 5,
    userAgent: "EduAI-Creator/1.0",
    headers: { Accept: "text/html,application/xhtml+xml" },
  })
  if (mimeType !== "text/html" && mimeType !== "application/xhtml+xml") {
    throw new Error("La URL debe apuntar a una página HTML")
  }
  const html = buffer.toString("utf8")
  const cheerio = await import("cheerio")
  const $ = cheerio.load(html)
  $("script, style, nav, footer, header, aside, iframe, noscript, .ad, .advertisement").remove()
  const title = $("h1").first().text().trim() || $("title").text().trim() || "Fuente web"
  const raw = ($("article").first().text() || $("main").first().text() || $("body").text())
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 12_000)
  if (!raw) throw new Error("No se encontró contenido legible en la página")
  return extractFromText(\`Fuente: \${title}\\nURL: \${url}\\n\\n\${raw}\`, false)
}
`
  routeSource = routeSource.slice(0, extractStart) + extractReplacement + routeSource.slice(extractEnd)
  routeChanged = true
}

const oldProviderGate = `    const geminiKey = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY
    if (!geminiKey) return NextResponse.json({ success: false, error: "El motor de generación no está configurado." }, { status: 503, headers })`
const interimProviderGate = `    const geminiKey = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || ""
    const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim())
    if (!geminiKey && !groqConfigured) {
      return NextResponse.json({ success: false, error: "No hay un proveedor de generación configurado (Google o Groq)." }, { status: 503, headers })
    }`
const gatewayProviderCompatibility = `    const geminiKey = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || ""`
if (routeSource.includes(oldProviderGate)) {
  routeSource = routeSource.replace(oldProviderGate, gatewayProviderCompatibility)
  routeChanged = true
} else if (routeSource.includes(interimProviderGate)) {
  routeSource = routeSource.replace(interimProviderGate, gatewayProviderCompatibility)
  routeChanged = true
}

if (!routeSource.includes(gatewayProviderCompatibility)) {
  throw new Error("[content-ai-core] no se pudo dejar process-content compatible con el Gateway")
}
if (!routeSource.includes('fetchSafeRemoteBytes({')) {
  throw new Error("[content-ai-core] process-content no quedó con descarga web limitada")
}

if (routeChanged) {
  fs.writeFileSync(routeTarget, routeSource)
  console.log("[content-ai-core] process-content delega disponibilidad al Gateway y limita fuentes web")
} else {
  console.log("[content-ai-core] process-content ya delega al Gateway y descarga web endurecida")
}
