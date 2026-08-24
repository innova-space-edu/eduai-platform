import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

function load(relative) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) throw new Error(`[client-supabase-prerender] No existe ${relative}`)
  return { file, source: fs.readFileSync(file, "utf8") }
}

function save(file, relative, source, changed) {
  if (changed) {
    fs.writeFileSync(file, source)
    console.log(`[client-supabase-prerender] cliente diferido aplicado en ${relative}`)
  } else {
    console.log(`[client-supabase-prerender] ${relative} ya estaba corregido`)
  }
}

{
  const relative = "lib/supabase/client.ts"
  const { file, source } = load(relative)
  const marker = "SUPABASE_PRERENDER_GUARD_V1"
  if (!source.includes(marker)) {
    fs.writeFileSync(file, `import { createBrowserClient } from "@supabase/ssr"\nimport type { SupabaseClient } from "@supabase/supabase-js"\n\n// ${marker}\nfunction createPrerenderGuard(): SupabaseClient {\n  return new Proxy({} as SupabaseClient, {\n    get(_target, property) {\n      throw new Error(\n        \`[supabase-client] No se puede usar \${String(property)} durante prerender sin NEXT_PUBLIC_SUPABASE_URL y una key pública.\`,\n      )\n    },\n  })\n}\n\nexport function createClient(): SupabaseClient {\n  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""\n  const key =\n    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||\n    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||\n    ""\n\n  if (!url || !key) {\n    if (typeof window === "undefined") return createPrerenderGuard()\n    throw new Error(\n      "Supabase no está configurado en el navegador: faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",\n    )\n  }\n\n  return createBrowserClient(url, key)\n}\n`)
    console.log(`[client-supabase-prerender] guard compartido aplicado en ${relative}`)
  } else {
    console.log(`[client-supabase-prerender] guard compartido ya presente en ${relative}`)
  }
}

{
  const relative = "app/admin/exam-access/page.tsx"
  const { file } = load(relative)
  let { source } = load(relative)
  let changed = false

  const renderClient = `export default function ExamAccessPage() {\n  const supabase = createClient()\n  const [loading, setLoading] = useState(true)`
  const safeRender = `export default function ExamAccessPage() {\n  const [loading, setLoading] = useState(true)`
  if (source.includes(renderClient)) {
    source = source.replace(renderClient, safeRender)
    changed = true
  }

  const sessionLookup = `        setLoading(true)\n        const { data } = await supabase.auth.getSession()`
  const safeSessionLookup = `        setLoading(true)\n        const supabase = createClient()\n        const { data } = await supabase.auth.getSession()`
  if (!source.includes(safeSessionLookup)) {
    if (!source.includes(sessionLookup)) throw new Error(`[client-supabase-prerender] marcador de sesión no encontrado en ${relative}`)
    source = source.replace(sessionLookup, safeSessionLookup)
    changed = true
  }

  save(file, relative, source, changed)
}

{
  const relative = "app/creator-hub/layout.tsx"
  const { file } = load(relative)
  let { source } = load(relative)
  let changed = false

  const oldImport = `import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react"`
  const newImport = `import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react"`
  if (source.includes(oldImport)) {
    source = source.replace(oldImport, newImport)
    changed = true
  }

  const renderClient = `  const supabase = useMemo(() => createClient(), [])\n`
  if (source.includes(renderClient)) {
    source = source.replace(renderClient, "")
    changed = true
  }

  const authLookup = `  useEffect(() => {\n    supabase.auth.getUser().then(({ data: { user } }) => {`
  const safeAuthLookup = `  useEffect(() => {\n    const supabase = createClient()\n    supabase.auth.getUser().then(({ data: { user } }) => {`
  if (!source.includes(safeAuthLookup)) {
    if (!source.includes(authLookup)) throw new Error(`[client-supabase-prerender] marcador auth no encontrado en ${relative}`)
    source = source.replace(authLookup, safeAuthLookup)
    changed = true
  }

  if (source.includes(`  }, [router, supabase])`)) {
    source = source.replace(`  }, [router, supabase])`, `  }, [router])`)
    changed = true
  }

  save(file, relative, source, changed)
}

{
  const relative = "app/audio-lab-large/page.tsx"
  const { file } = load(relative)
  let { source } = load(relative)
  let changed = false

  if (source.includes(`import { useMemo, useState } from "react"`)) {
    source = source.replace(`import { useMemo, useState } from "react"`, `import { useState } from "react"`)
    changed = true
  }

  const renderClient = `  const supabase = useMemo(() => createClient(), [])\n`
  if (source.includes(renderClient)) {
    source = source.replace(renderClient, "")
    changed = true
  }

  const uploadMarker = `      setStage("uploading")\n      await uploadAudioResumable({`
  const safeUploadMarker = `      setStage("uploading")\n      const supabase = createClient()\n      await uploadAudioResumable({`
  if (!source.includes(safeUploadMarker)) {
    if (!source.includes(uploadMarker)) throw new Error(`[client-supabase-prerender] marcador upload no encontrado en ${relative}`)
    source = source.replace(uploadMarker, safeUploadMarker)
    changed = true
  }

  save(file, relative, source, changed)
}

{
  const relative = "app/(auth)/register/page.tsx"
  const { file } = load(relative)
  let { source } = load(relative)
  let changed = false

  const renderClient = `  const router   = useRouter()\n  const supabase = createClient()\n`
  const safeRender = `  const router   = useRouter()\n`
  if (source.includes(renderClient)) {
    source = source.replace(renderClient, safeRender)
    changed = true
  }

  const capacityMarker = `    async function checkCapacity() {\n      const { data } = await supabase`
  const safeCapacityMarker = `    async function checkCapacity() {\n      const supabase = createClient()\n      const { data } = await supabase`
  if (!source.includes(safeCapacityMarker)) {
    if (!source.includes(capacityMarker)) throw new Error(`[client-supabase-prerender] marcador capacity no encontrado en ${relative}`)
    source = source.replace(capacityMarker, safeCapacityMarker)
    changed = true
  }

  const signupMarker = `    if (!acceptedTerms) { setError("Debes aceptar los términos y la política de privacidad"); setLoading(false); return }\n\n    const { data: signUpData, error } = await supabase.auth.signUp({`
  const safeSignupMarker = `    if (!acceptedTerms) { setError("Debes aceptar los términos y la política de privacidad"); setLoading(false); return }\n\n    const supabase = createClient()\n    const { data: signUpData, error } = await supabase.auth.signUp({`
  if (!source.includes(safeSignupMarker)) {
    if (!source.includes(signupMarker)) throw new Error(`[client-supabase-prerender] marcador signup no encontrado en ${relative}`)
    source = source.replace(signupMarker, safeSignupMarker)
    changed = true
  }

  save(file, relative, source, changed)
}

{
  const relative = "app/audio-lab/page.tsx"
  const { file } = load(relative)
  let { source } = load(relative)
  let changed = false

  const renderClient = `export default function AudioLabPage() {\n  const supabase = createClient()\n  const fileInputRef = useRef<HTMLInputElement>(null)`
  const safeRender = `export default function AudioLabPage() {\n  const fileInputRef = useRef<HTMLInputElement>(null)`
  if (source.includes(renderClient)) {
    source = source.replace(renderClient, safeRender)
    changed = true
  }

  const historyMarker = `  async function loadHistory() {\n    setHistoryLoading(true)\n\n    const { data } = await supabase`
  const safeHistoryMarker = `  async function loadHistory() {\n    setHistoryLoading(true)\n\n    const supabase = createClient()\n    const { data } = await supabase`
  if (!source.includes(safeHistoryMarker)) {
    if (!source.includes(historyMarker)) throw new Error(`[client-supabase-prerender] marcador history no encontrado en ${relative}`)
    source = source.replace(historyMarker, safeHistoryMarker)
    changed = true
  }

  save(file, relative, source, changed)
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) files.push(full)
  }
  return files
}

const appDir = path.join(root, "app")
const renderTimeClients = []
for (const file of walk(appDir)) {
  const source = fs.readFileSync(file, "utf8")
  if (!source.includes(`@/lib/supabase/client`)) continue
  if (!source.includes(`"use client"`) && !source.includes(`'use client'`)) continue

  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (/^  const\s+\w+\s*=\s*createClient\(\)\s*$/.test(line) || /^  const\s+\w+\s*=\s*useMemo\(\(\)\s*=>\s*createClient\(\),\s*\[\]\)\s*$/.test(line)) {
      renderTimeClients.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`)
    }
  })
}

if (renderTimeClients.length > 0) {
  console.log(
    `[client-supabase-prerender] ${renderTimeClients.length} inicialización(es) de cliente permanecen en render, protegidas durante prerender por el guard compartido.`,
  )
}

const guardedHelper = fs.readFileSync(path.join(root, "lib/supabase/client.ts"), "utf8")
if (!guardedHelper.includes("SUPABASE_PRERENDER_GUARD_V1") || !guardedHelper.includes(`typeof window === "undefined"`)) {
  throw new Error("[client-supabase-prerender] el helper compartido no quedó protegido")
}

console.log("[client-supabase-prerender] guard común activo; navegador real sigue exigiendo configuración Supabase")
