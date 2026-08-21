import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pagePath = path.join(root, "app", "repositorio", "page.tsx")
if (!fs.existsSync(pagePath)) throw new Error(`No se encontró ${pagePath}`)

let source = fs.readFileSync(pagePath, "utf8")
let changed = false

function replaceRequired(oldText, newText, label) {
  if (source.includes(newText)) return
  if (!source.includes(oldText)) throw new Error(`[repository-ai-assets] No se encontró ${label}`)
  source = source.replace(oldText, newText)
  changed = true
}

replaceRequired(
  'import { createClient } from "@/lib/supabase/client"',
  'import { createClient } from "@/lib/supabase/client"\nimport AIAssetLibraryModal from "@/components/assets/AIAssetLibraryModal"',
  "import de Supabase",
)

replaceRequired(
  '  const [uploadOpen, setUploadOpen] = useState(false)\n  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)',
  '  const [uploadOpen, setUploadOpen] = useState(false)\n  const [aiAssetsOpen, setAiAssetsOpen] = useState(false)\n  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)',
  "estado de diálogos",
)

const headerMarker = '            <Link href="/biblioteca" className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 sm:flex"><LibraryBig size={16} /> Biblioteca</Link>\n            <button type="button" onClick={() => void loadItems()} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Actualizar"><RefreshCw size={17} /></button>'
const headerReplacement = '            <Link href="/biblioteca" className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 sm:flex"><LibraryBig size={16} /> Biblioteca</Link>\n            <button type="button" onClick={() => setAiAssetsOpen(true)} className="hidden items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 sm:flex" title="Recuperar recursos ya generados"><HardDrive size={16} /> Recursos IA</button>\n            <button type="button" onClick={() => void loadItems()} className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Actualizar"><RefreshCw size={17} /></button>'
replaceRequired(headerMarker, headerReplacement, "acciones del encabezado")

replaceRequired(
  '      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />',
  '      <AIAssetLibraryModal open={aiAssetsOpen} onClose={() => setAiAssetsOpen(false)} />\n      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onCreated={onCreated} userId={userId} />',
  "diálogo de carga",
)

if (changed) {
  fs.writeFileSync(pagePath, source)
  console.log("[repository-ai-assets] biblioteca privada de recursos IA conectada a Nube EduAI")
} else {
  console.log("[repository-ai-assets] biblioteca privada de recursos IA ya estaba conectada")
}
