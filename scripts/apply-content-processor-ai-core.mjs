import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const target = path.join(root, "lib", "content-processor.ts")
if (!fs.existsSync(target)) throw new Error(`No se encontró ${target}`)

let source = fs.readFileSync(target, "utf8")
let changed = false

const importMarker = 'import { buildDesignPromptDirective, getDesignTemplateSummary } from "@/lib/design-templates/registry"'
const newImport = `${importMarker}\nimport { generateGoogleStructured } from "@/lib/ai/providers/google"`
if (!source.includes('import { generateGoogleStructured } from "@/lib/ai/providers/google"')) {
  if (!source.includes(importMarker)) throw new Error("[content-ai-core] no se encontró import base")
  source = source.replace(importMarker, newImport)
  changed = true
}

const functionStart = source.indexOf('export async function structureWithAI(')
const sectionEnd = source.indexOf('// ============================================================\n// 6. PIPELINE PRINCIPAL', functionStart)
if (functionStart < 0 || sectionEnd < 0) throw new Error("[content-ai-core] no se encontró structureWithAI")

const currentFunction = source.slice(functionStart, sectionEnd)
if (!currentFunction.includes('generateGoogleStructured')) {
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
    const result = await generateGoogleStructured<Record<string, unknown>>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      schema,
      maxOutputTokens: 8192,
    })
    console.log(\`[Creator] Google \${result.model} OK para \${outputFormat}\`)
    return {
      success: true,
      data: result.data,
      format: outputFormat,
      provider: result.model,
    }
  } catch (googleError: any) {
    console.warn(\`[Creator] Google estructurado falló (\${googleError?.message || googleError}), intentando Groq...\`)
    try {
      const data = await callGroqFallback(systemPrompt, userPrompt)
      console.log(\`[Creator] Groq OK para \${outputFormat}\`)
      return { success: true, data, format: outputFormat, provider: "groq" }
    } catch (groqError: any) {
      return {
        success: false,
        error: \`Todos los proveedores activos fallaron. Google: \${googleError?.message || googleError} | Groq: \${groqError?.message || groqError}\`,
      }
    }
  }
}

`
  source = source.slice(0, functionStart) + replacement + source.slice(sectionEnd)
  changed = true
}

// Los helpers REST antiguos pueden seguir físicamente durante la transición para
// minimizar el diff, pero structureWithAI ya no los invoca.
source = source.replace(
  '// v3 — Gemini 2.5 Flash + responseSchema + prompts potenciados + contexto extendido 12K',
  '// v4 — Google structured API actual + Groq fallback + prompts potenciados + contexto extendido 12K',
)
source = source.replace(
  '// Paso 2: Estructurar con IA (Gemini 2.5 Flash + cascada de fallbacks)',
  '// Paso 2: Estructurar con Google structured output + fallback Groq',
)

if (changed) {
  fs.writeFileSync(target, source)
  console.log("[content-ai-core] Creator Hub usa Google structured API actual + fallback Groq")
} else {
  console.log("[content-ai-core] Creator Hub ya usa Google structured API actual")
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
const newProviderGate = `    const geminiKey = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || ""
    const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim())
    if (!geminiKey && !groqConfigured) {
      return NextResponse.json({ success: false, error: "No hay un proveedor de generación configurado (Google o Groq)." }, { status: 503, headers })
    }`
if (routeSource.includes(oldProviderGate)) {
  routeSource = routeSource.replace(oldProviderGate, newProviderGate)
  routeChanged = true
}

if (!routeSource.includes('const groqConfigured = Boolean(process.env.GROQ_API_KEY?.trim())')) {
  throw new Error("[content-ai-core] no se pudo aplicar el gate Google/Groq en process-content")
}
if (!routeSource.includes('fetchSafeRemoteBytes({')) {
  throw new Error("[content-ai-core] process-content no quedó con descarga web limitada")
}

if (routeChanged) {
  fs.writeFileSync(routeTarget, routeSource)
  console.log("[content-ai-core] process-content permite Google/Groq y limita fuentes web antes de buffer")
} else {
  console.log("[content-ai-core] process-content ya tiene fallback y descarga web endurecida")
}
