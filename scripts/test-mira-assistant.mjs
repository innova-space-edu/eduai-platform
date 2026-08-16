import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const route = fs.readFileSync(path.join(root, "app", "api", "agents", "mira", "route.ts"), "utf8")
const page = fs.readFileSync(path.join(root, "app", "mira", "page.tsx"), "utf8")
const client = fs.readFileSync(path.join(root, "components", "mira", "MiraAssistant.tsx"), "utf8")
const voice = fs.readFileSync(path.join(root, "app", "api", "agents", "traductor", "voice", "route.ts"), "utf8")
const agents = fs.readFileSync(path.join(root, "app", "agentes", "page.tsx"), "utf8")

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`[test-mira] Falta ${label}: ${text}`)
}

for (const [label, text] of [
  ["server Supabase auth", 'createClient()'],
  ["authenticated user", 'supabase.auth.getUser()'],
  ["age policy", 'assertAICapabilityAllowed({'],
  ["text capability", 'capability: "text"'],
  ["AI Gateway", 'runAIText({'],
  ["private user context", 'userId: user.id'],
  ["MIRA module", 'module: "mira-assistant"'],
  ["private reuse", 'reusePolicy: "exact_private"'],
  ["private visibility", 'visibility: "private"'],
]) requireText(route, text, label)

for (const [label, text] of [
  ["page auth", 'supabase.auth.getUser()'],
  ["login redirect", 'redirect("/login")'],
  ["MIRA client", '<MiraAssistant />'],
]) requireText(page, text, label)

for (const [label, text] of [
  ["MIRA endpoint", 'fetch("/api/agents/mira"'],
  ["browser speech", 'window.speechSynthesis'],
  ["speech utterance", 'new SpeechSynthesisUtterance'],
  ["live voice link", 'href="/traductor"'],
  ["no fake action copy", 'MIRA no finge ejecutar acciones'],
]) requireText(client, text, label)

for (const [label, text] of [
  ["voice authenticated", 'supabase.auth.getUser()'],
  ["voice gateway", 'runAIText({'],
  ["voice MIRA context", 'module: "mira-voice"'],
]) requireText(voice, text, label)

for (const [label, text] of [
  ["MIRA agent card", 'id: "mira"'],
  ["MIRA route", 'href: "/mira"'],
  ["MIRA active", 'ctaLabel: "Hablar con MIRA"'],
]) requireText(agents, text, label)

const clientAndPage = `${client}\n${page}`
if (/NEXT_PUBLIC_(GEMINI|GOOGLE|GROQ|OPENROUTER|SUPABASE_SERVICE_ROLE)/i.test(clientAndPage)) {
  throw new Error("[test-mira] El cliente MIRA no debe referenciar secretos NEXT_PUBLIC")
}
if (/new\s+(GoogleGenAI|Groq)\s*\(/.test(client)) {
  throw new Error("[test-mira] El navegador no debe instanciar proveedores IA directamente")
}
if (route.includes("GEMINI_API_KEY") || route.includes("GROQ_API_KEY")) {
  throw new Error("[test-mira] La ruta MIRA debe delegar proveedor/modelo al AI Gateway")
}

console.log("[test-mira] MIRA general autenticada, age-aware, AI Gateway y voz reutilizada OK")
