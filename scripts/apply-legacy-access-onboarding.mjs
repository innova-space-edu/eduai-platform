import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dashboardPath = path.join(root, "app", "dashboard", "page.tsx")
if (!fs.existsSync(dashboardPath)) throw new Error(`No se encontró ${dashboardPath}`)

let source = fs.readFileSync(dashboardPath, "utf8")
let changed = false

function replaceRequired(oldText, newText, label) {
  if (source.includes(newText)) return
  if (!source.includes(oldText)) throw new Error(`[legacy-access] No se encontró ${label}`)
  source = source.replace(oldText, newText)
  changed = true
}

const clawImport = 'import ClawStudyConsole from "@/components/dashboard/ClawStudyConsole"'
const legacyImport = 'import LegacyAccessOnboarding from "@/components/access/LegacyAccessOnboarding"'

{
  let seenLegacyImport = false
  const lines = source.split("\n")
  const deduped = lines.filter((line) => {
    if (line.trim() !== legacyImport) return true
    if (seenLegacyImport) {
      changed = true
      return false
    }
    seenLegacyImport = true
    return true
  })
  source = deduped.join("\n")

  if (!seenLegacyImport) {
    if (!source.includes(clawImport)) throw new Error("[legacy-access] No se encontró import de ClawStudyConsole")
    source = source.replace(clawImport, `${clawImport}\n${legacyImport}`)
    changed = true
  }
}

const legacyState = '  const [legacyAccessRequired, setLegacyAccessRequired] = useState(false)'
if (!source.includes(legacyState)) {
  const adminState = '  const [isAdmin, setIsAdmin] = useState(false)'
  if (!source.includes(adminState)) throw new Error("[legacy-access] No se encontró estado isAdmin del dashboard")
  source = source.replace(adminState, `${adminState}\n${legacyState}`)
  changed = true
}

const adminBlock = `      const { data: adminData } = await supabase
        .from("admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()
      setIsAdmin(Boolean(adminData))`

const adminWithAccess = `${adminBlock}

      const { data: accessProfile, error: accessProfileError } = await supabase
        .from("eduai_user_access")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!accessProfileError) setLegacyAccessRequired(!accessProfile)`
replaceRequired(adminBlock, adminWithAccess, "consulta de administrador")

const returnMarker = `  return (
    <div className="flex h-[100dvh] overflow-hidden bg-app [--sidebar-closed:56px] [--sidebar-open:184px] lg:[--sidebar-closed:68px] lg:[--sidebar-open:220px] min-[2048px]:[--sidebar-closed:84px] min-[2048px]:[--sidebar-open:280px]">`
const returnReplacement = `  return (
    <div className="flex h-[100dvh] overflow-hidden bg-app [--sidebar-closed:56px] [--sidebar-open:184px] lg:[--sidebar-closed:68px] lg:[--sidebar-open:220px] min-[2048px]:[--sidebar-closed:84px] min-[2048px]:[--sidebar-open:280px]">
      {user?.id && (
        <LegacyAccessOnboarding
          userId={user.id}
          open={legacyAccessRequired}
          onCompleted={() => setLegacyAccessRequired(false)}
        />
      )}`
replaceRequired(returnMarker, returnReplacement, "contenedor principal")

if (changed) {
  fs.writeFileSync(dashboardPath, source)
  console.log("[legacy-access] onboarding único conectado para cuentas antiguas")
} else {
  console.log("[legacy-access] onboarding de cuentas antiguas ya estaba conectado")
}
