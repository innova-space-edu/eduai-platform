import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dashboardPath = path.join(root, "app", "dashboard", "page.tsx")

if (!fs.existsSync(dashboardPath)) {
  throw new Error(`No se encontró ${dashboardPath}`)
}

let source = fs.readFileSync(dashboardPath, "utf8")
let changed = false

if (!source.includes("  HardDrive,")) {
  const importMarker = "  FolderKanban,\n  LibraryBig,"
  if (!source.includes(importMarker)) {
    throw new Error("No se encontró el bloque de iconos del panel para agregar HardDrive")
  }
  source = source.replace(importMarker, "  FolderKanban,\n  HardDrive,\n  LibraryBig,")
  changed = true
}

if (!source.includes('href="/repositorio"')) {
  const libraryLinkPattern = /(\s+<Link\n\s+href="\/biblioteca"[\s\S]*?<\/Link>)/
  const match = source.match(libraryLinkPattern)
  if (!match) {
    throw new Error("No se encontró el botón Biblioteca del panel")
  }

  const repositoryLink = `
              <Link
                href="/repositorio"
                className="group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.18)", color: "#1d4ed8" }}
              >
                <HardDrive size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Repositorio</span>
              </Link>`

  source = source.replace(match[0], `${match[0]}${repositoryLink}`)
  changed = true
}

if (changed) {
  fs.writeFileSync(dashboardPath, source)
  console.log("[repositorio] navegación del panel actualizada")
} else {
  console.log("[repositorio] navegación del panel ya estaba actualizada")
}
