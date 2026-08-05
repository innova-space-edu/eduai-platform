import { existsSync, readFileSync, writeFileSync } from "node:fs"

const PAGE = "app/repositorio/page.tsx"
const MARKER = "REPOSITORY_HOME_FOLDERS_V1"

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[repository-home] No se encontró ${label}`)
  }
  return source.replace(from, to)
}

if (!existsSync(PAGE)) {
  throw new Error(`[repository-home] No existe ${PAGE}`)
}

let source = readFileSync(PAGE, "utf8")

// Identidad visual y textos generales de la página.
source = source
  .replaceAll("Repositorio EduAI", "Nube EduAI")
  .replaceAll("Agregar al repositorio", "Agregar a Nube EduAI")
  .replaceAll("No se pudo cargar el repositorio.", "No se pudo cargar Nube EduAI.")
  .replaceAll("Inicio del repositorio", "Inicio de Nube EduAI")
  .replaceAll("bg-slate-950/45", "bg-slate-300/55")
  .replaceAll("bg-slate-950/35", "bg-slate-300/60")

if (!source.includes(MARKER)) {
  source = replaceRequired(
    source,
    "\nfunction fileIcon(item: RepositoryItem, size = 15) {",
    `
// ${MARKER}
function buildCollapsedPaths(items: RepositoryItem[]) {
  const paths = new Set<string>()
  for (const item of items) {
    const subjectPath = \`subject:\${item.subject}\`
    const levelPath = \`\${subjectPath}/level:\${item.educational_level}\`
    const yearPath = \`\${levelPath}/year:\${item.school_year}\`
    const typePath = \`\${yearPath}/type:\${item.material_type}\`
    paths.add(subjectPath)
    paths.add(levelPath)
    paths.add(yearPath)
    paths.add(typePath)
  }
  return paths
}

function itemFolderPaths(item: RepositoryItem) {
  const subjectPath = \`subject:\${item.subject}\`
  const levelPath = \`\${subjectPath}/level:\${item.educational_level}\`
  const yearPath = \`\${levelPath}/year:\${item.school_year}\`
  const typePath = \`\${yearPath}/type:\${item.material_type}\`
  return [subjectPath, levelPath, yearPath, typePath]
}

function fileIcon(item: RepositoryItem, size = 15) {`,
    "funciones de carpetas cerradas",
  )

  source = replaceRequired(
    source,
    `    const nextItems = (data || []) as RepositoryItem[]
    setItems(nextItems)
    setSelectedId((current) => current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id || null)`,
    `    const nextItems = (data || []) as RepositoryItem[]
    setItems(nextItems)
    setCollapsed(buildCollapsedPaths(nextItems))
    setSelectedId((current) => current && nextItems.some((item) => item.id === current) ? current : null)`,
    "carga inicial sin archivo seleccionado",
  )

  source = replaceRequired(
    source,
    `  const onCreated = (item: RepositoryItem) => {
    setItems((current) => [item, ...current])
    setSelectedId(item.id)
  }`,
    `  const onCreated = (item: RepositoryItem) => {
    setItems((current) => [item, ...current])
    setCollapsed((current) => {
      const next = new Set(current)
      for (const path of itemFolderPaths(item)) next.delete(path)
      return next
    })
    setSelectedId(item.id)
  }`,
    "expansión del material recién subido",
  )

  source = replaceRequired(
    source,
    `          <div className="flex-1 overflow-y-auto px-2 py-3">
            {loading ? (`,
    `          <div className="flex-1 overflow-y-auto px-2 py-3">
            <button
              type="button"
              onClick={() => { setSelectedId(null); setMobileSidebarOpen(false) }}
              className={\`mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition \${selectedId === null ? "border-blue-200 bg-blue-50 text-blue-700" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"}\`}
            >
              <HardDrive size={16} className="shrink-0" />
              <span className="flex-1">Inicio de Nube EduAI</span>
              <ChevronRight size={13} />
            </button>
            {loading ? (`,
    "acceso al inicio de Nube EduAI",
  )

  source = replaceRequired(
    source,
    `            <div className="min-h-0 flex-1 overflow-auto">
              <RepositoryPreview item={selectedItem} signedUrl={signedUrl} loadingUrl={loadingUrl} urlError={urlError} />
            </div>`,
    `            <div className="min-h-0 flex-1 overflow-auto">
              {selectedItem ? (
                <RepositoryPreview item={selectedItem} signedUrl={signedUrl} loadingUrl={loadingUrl} urlError={urlError} />
              ) : (
                <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50/80 to-violet-50/80 p-5 sm:p-8">
                  <div className="w-full max-w-4xl overflow-hidden rounded-[30px] border border-blue-100 bg-white/95 shadow-2xl shadow-blue-100/60 backdrop-blur">
                    <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="p-7 sm:p-10">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-xl shadow-blue-200/80">
                          <HardDrive size={30} />
                        </div>
                        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-blue-600">Tu nube educativa</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Bienvenido a Nube EduAI</h2>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                          Guarda en un solo lugar tus guías, pruebas, planificaciones, presentaciones, imágenes, videos y documentos de estudio. Nube EduAI los organiza por asignatura, curso, año y tipo de material para que puedas encontrarlos cuando los necesites.
                        </p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                          <button type="button" onClick={() => setUploadOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700">
                            <Upload size={18} /> Subir mi primer material
                          </button>
                          <button type="button" onClick={() => setMobileSidebarOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-blue-50 sm:hidden">
                            <Folder size={18} /> Ver carpetas
                          </button>
                        </div>
                        <p className="mt-5 text-xs leading-5 text-slate-500">Selecciona una carpeta del panel izquierdo para abrir o cerrar su contenido. Todas comienzan cerradas para mantener una vista limpia y ordenada.</p>
                      </div>

                      <div className="border-t border-blue-100 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-7 text-slate-900 lg:border-l lg:border-t-0 sm:p-9">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Tu colección actual</p>
                        <div className="mt-5 grid grid-cols-3 gap-3 lg:grid-cols-1">
                          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm shadow-blue-100/70">
                            <p className="text-2xl font-black text-slate-900">{items.length}</p>
                            <p className="mt-1 text-xs text-slate-500">materiales guardados</p>
                          </div>
                          <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm shadow-indigo-100/70">
                            <p className="text-2xl font-black text-slate-900">{counts.files}</p>
                            <p className="mt-1 text-xs text-slate-500">archivos y documentos</p>
                          </div>
                          <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-100/70">
                            <p className="text-2xl font-black text-slate-900">{counts.videos}</p>
                            <p className="mt-1 text-xs text-slate-500">videos enlazados</p>
                          </div>
                        </div>
                        <div className="mt-6 rounded-2xl border border-blue-200 bg-white/85 p-4 text-xs leading-6 text-slate-600 shadow-sm">
                          Sube material de estudio propio, recursos para tus clases o documentos que quieras conservar. Tu nube educativa crecerá contigo y estará disponible desde cualquier dispositivo con tu cuenta EduAI.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>`,
    "ventana de bienvenida",
  )
}

// Compatibilidad con una copia de trabajo que ya hubiera recibido la versión anterior.
source = source
  .replaceAll("Bienvenido al Nube EduAI", "Bienvenido a Nube EduAI")
  .replaceAll("Bienvenido al Repositorio EduAI", "Bienvenido a Nube EduAI")
  .replaceAll("Inicio del repositorio", "Inicio de Nube EduAI")
  .replaceAll("bg-slate-950 p-7 text-white", "bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-7 text-slate-900")
  .replaceAll("text-blue-300", "text-indigo-600")
  .replaceAll("border-white/10 bg-white/5", "border-blue-100 bg-white shadow-sm shadow-blue-100/70")
  .replaceAll("text-slate-300", "text-slate-500")
  .replaceAll("border-blue-400/20 bg-blue-400/10 p-4 text-xs leading-6 text-blue-100", "border-blue-200 bg-white/85 p-4 text-xs leading-6 text-slate-600 shadow-sm")
  .replaceAll("Tu repositorio crecerá contigo", "Tu nube educativa crecerá contigo")

writeFileSync(PAGE, source)

const verified = readFileSync(PAGE, "utf8")
for (const required of [
  MARKER,
  "buildCollapsedPaths",
  "Inicio de Nube EduAI",
  "Bienvenido a Nube EduAI",
  "Subir mi primer material",
  "from-blue-50 via-indigo-50 to-violet-50",
]) {
  if (!verified.includes(required)) {
    throw new Error(`[repository-home] Falta ${required}`)
  }
}

if (verified.includes("Bienvenido al Repositorio EduAI") || verified.includes("bg-slate-950 p-7 text-white")) {
  throw new Error("[repository-home] La interfaz antigua u oscura sigue presente")
}

console.log("[repository-home] Nube EduAI clara y bienvenida inicial aplicadas")
