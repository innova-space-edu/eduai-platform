import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dashboardPath = path.join(root, "app", "dashboard", "page.tsx")
const proxyPath = path.join(root, "proxy.ts")

for (const target of [dashboardPath, proxyPath]) {
  if (!fs.existsSync(target)) throw new Error(`No se encontró ${target}`)
}

let dashboardSource = fs.readFileSync(dashboardPath, "utf8")
let dashboardChanged = false

if (!dashboardSource.includes("  HardDrive,")) {
  const importMarker = "  FolderKanban,\n  LibraryBig,"
  if (!dashboardSource.includes(importMarker)) {
    throw new Error("No se encontró el bloque de iconos del panel para agregar HardDrive")
  }
  dashboardSource = dashboardSource.replace(importMarker, "  FolderKanban,\n  HardDrive,\n  LibraryBig,")
  dashboardChanged = true
}

if (!dashboardSource.includes('href="/repositorio"')) {
  const libraryLinkPattern = /(\s+<Link\n\s+href="\/biblioteca"[\s\S]*?<\/Link>)/
  const match = dashboardSource.match(libraryLinkPattern)
  if (!match) throw new Error("No se encontró el botón Biblioteca del panel")

  const repositoryLink = `
              <Link
                href="/repositorio"
                className="group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.18)", color: "#1d4ed8" }}
              >
                <HardDrive size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Repositorio</span>
              </Link>`

  dashboardSource = dashboardSource.replace(match[0], `${match[0]}${repositoryLink}`)
  dashboardChanged = true
}

if (dashboardChanged) {
  fs.writeFileSync(dashboardPath, dashboardSource)
  console.log("[repositorio] navegación del panel actualizada")
} else {
  console.log("[repositorio] navegación del panel ya estaba actualizada")
}

let proxySource = fs.readFileSync(proxyPath, "utf8")
if (!proxySource.includes('"/repositorio"')) {
  const routeMarker = '  "/pizarra-interactiva",\n]'
  if (!proxySource.includes(routeMarker)) {
    throw new Error("No se encontró el bloque de rutas protegidas del proxy")
  }
  proxySource = proxySource.replace(routeMarker, '  "/pizarra-interactiva",\n  "/repositorio",\n]')
  fs.writeFileSync(proxyPath, proxySource)
  console.log("[repositorio] ruta protegida agregada al proxy")
} else {
  console.log("[repositorio] ruta del repositorio ya estaba protegida")
}
