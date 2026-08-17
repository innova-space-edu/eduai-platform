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

console.log("[client-supabase-prerender] clientes browser se crean solo en efectos/acciones de usuario")
