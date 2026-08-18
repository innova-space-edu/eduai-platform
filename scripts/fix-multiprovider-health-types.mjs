import fs from "node:fs"
import path from "node:path"

const healthPath = path.join(process.cwd(), "app/api/admin/ai-core/health/route.ts")
let source = fs.readFileSync(healthPath, "utf8")
let changed = false

const replacements = [
  [
    '${provider.toUpperCase()}_KEY_MISSING',
    '${String(provider).toUpperCase()}_KEY_MISSING',
  ],
  [
    'configured: configured("OPENROUTER_API_KEY") || configured("OPENROUTER_API_KEY_1"),',
    'configured: configured("OPENROUTER_API_KEY") || configured("OPENROUTER_API_KEY_1") || configured("OPENROUTER_API_KEY_2") || configured("OPENROUTER_API_KEY_3"),',
  ],
  [
    'configured: configured("TOGETHER_API_KEY") || configured("TOGETHER_API_KEY_1"),',
    'configured: configured("TOGETHER_API_KEY") || configured("TOGETHER_API_KEY_1") || configured("TOGETHER_API_KEY_2") || configured("TOGETHER_API_KEY_3"),',
  ],
]

for (const [before, after] of replacements) {
  if (source.includes(after)) continue
  if (!source.includes(before)) throw new Error(`[multiprovider-health-types] marker not found: ${before}`)
  source = source.replace(before, after)
  changed = true
}

if (changed) {
  fs.writeFileSync(healthPath, source)
  console.log("[multiprovider-health-types] TypeScript narrowing y pool diagnostics corregidos")
} else {
  console.log("[multiprovider-health-types] already applied")
}
