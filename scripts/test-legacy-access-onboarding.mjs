import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dashboardPath = path.join(root, "app", "dashboard", "page.tsx")
const componentPath = path.join(root, "components", "access", "LegacyAccessOnboarding.tsx")

const dashboard = fs.readFileSync(dashboardPath, "utf8")
const component = fs.readFileSync(componentPath, "utf8")
const legacyImport = 'import LegacyAccessOnboarding from "@/components/access/LegacyAccessOnboarding"'

for (const [label, value] of [
  ["import onboarding", legacyImport],
  ["legacy state", "legacyAccessRequired"],
  ["access profile lookup", '.from("eduai_user_access")'],
  ["non-blocking lookup", "if (!accessProfileError) setLegacyAccessRequired(!accessProfile)"],
  ["dashboard modal", "<LegacyAccessOnboarding"],
]) {
  if (!dashboard.includes(value)) throw new Error(`[test-legacy-access] Falta ${label}: ${value}`)
}

const importCount = dashboard.split(legacyImport).length - 1
if (importCount !== 1) {
  throw new Error(`[test-legacy-access] LegacyAccessOnboarding debe importarse exactamente una vez; encontrados ${importCount}`)
}

const componentCount = dashboard.split("<LegacyAccessOnboarding").length - 1
if (componentCount !== 1) {
  throw new Error(`[test-legacy-access] LegacyAccessOnboarding debe renderizarse exactamente una vez; encontrados ${componentCount}`)
}

for (const [label, value] of [
  ["birth date", "birth_date: birthDate"],
  ["account type", "account_type: accountType"],
  ["restricted tier", 'access_tier: restricted ? "restricted" : "standard"'],
  ["privacy acceptance", 'privacy_version: "2026-08"'],
  ["self declared notice", "La edad se declara por el usuario"],
]) {
  if (!component.includes(value)) throw new Error(`[test-legacy-access] Falta ${label}: ${value}`)
}

console.log("[test-legacy-access] cuentas legacy completan edad/perfil una sola vez; import y modal idempotentes")
