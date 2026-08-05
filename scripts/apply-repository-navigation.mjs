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
                style={{ background: "rgba(224,242,254,0.92)", borderColor: "rgba(125,211,252,0.65)", color: "#2563eb" }}
              >
                <HardDrive size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Nube EduAI</span>
              </Link>`

  dashboardSource = dashboardSource.replace(match[0], `${match[0]}${repositoryLink}`)
  dashboardChanged = true
}

const renamedDashboard = dashboardSource
  .replace('<span className="hidden sm:inline">Repositorio</span>', '<span className="hidden sm:inline">Nube EduAI</span>')
  .replace('style={{ background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.18)", color: "#1d4ed8" }}', 'style={{ background: "rgba(224,242,254,0.92)", borderColor: "rgba(125,211,252,0.65)", color: "#2563eb" }}')

if (renamedDashboard !== dashboardSource) {
  dashboardSource = renamedDashboard
  dashboardChanged = true
}

if (dashboardChanged) {
  fs.writeFileSync(dashboardPath, dashboardSource)
  console.log("[nube-eduai] navegación del panel actualizada")
} else {
  console.log("[nube-eduai] navegación del panel ya estaba actualizada")
}

let proxySource = fs.readFileSync(proxyPath, "utf8")
if (!proxySource.includes('"/repositorio"')) {
  const routeMarker = '  "/pizarra-interactiva",\n]'
  if (!proxySource.includes(routeMarker)) {
    throw new Error("No se encontró el bloque de rutas protegidas del proxy")
  }
  proxySource = proxySource.replace(routeMarker, '  "/pizarra-interactiva",\n  "/repositorio",\n]')
  fs.writeFileSync(proxyPath, proxySource)
  console.log("[nube-eduai] ruta protegida agregada al proxy")
} else {
  console.log("[nube-eduai] ruta de Nube EduAI ya estaba protegida")
}
