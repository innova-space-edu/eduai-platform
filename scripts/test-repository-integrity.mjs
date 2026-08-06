import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function read(relativePath) {
  const target = path.join(root, relativePath)
  if (!fs.existsSync(target)) throw new Error(`Falta ${relativePath}`)
  return fs.readFileSync(target, "utf8")
}

function requireText(source, value, label) {
  if (!source.includes(value)) throw new Error(`Falta ${label}: ${value}`)
}

function forbidText(source, value, label) {
  if (source.includes(value)) throw new Error(`No debe existir ${label}: ${value}`)
}

const page = read("app/repositorio/page.tsx")
const catalog = read("lib/repository/catalog.ts")
const migration = read("supabase/migrations/202608030001_repository_documents.sql")
const navigation = read("scripts/apply-repository-navigation.mjs")
const homePatch = read("scripts/apply-repository-home-folders.mjs")
const sharingPatch = read("scripts/apply-repository-sharing.mjs")
const agentCardsPatch = read("scripts/apply-agent-library-repository-cards.mjs")
const courseSubjectPatch = read("scripts/apply-repository-course-subject-selects.mjs")
const shareToken = read("lib/repository/public-share.ts")
const shareCreateRoute = read("app/api/repository/share/route.ts")
const sharePublicRoute = read("app/api/repository/public/[token]/route.ts")
const sharePublicPage = read("app/nube/[token]/page.tsx")
const sharePublicViewer = read("app/nube/[token]/shared-material-viewer.tsx")
const packageJson = JSON.parse(read("package.json"))

for (const [value, label] of [
  ['from("repository_items")', "lectura de registros"],
  [`.from(REPOSITORY_BUCKET)`, "acceso al bucket"],
  ["createSignedUrl", "URL temporal para visualizar"],
  ["youtube-nocookie.com/embed", "visor de YouTube"],
  ["view.officeapps.live.com", "visor de archivos Office"],
  ["buildTree(filteredItems)", "árbol de carpetas"],
  ["MAX_REPOSITORY_FILE_SIZE", "límite de carga"],
  ["COURSE_OPTIONS.map", "selector de cursos"],
  ["subjectGroupsForCourse", "asignaturas dependientes del curso"],
  ["<optgroup", "asignaturas agrupadas"],
  ["Selecciona primero un curso", "bloqueo de asignatura sin curso"],
  ["createShareLink", "creación del enlace compartido"],
  ["Compartir documento", "botón y diálogo para compartir"],
]) requireText(page, value, label)

for (const value of ["guia", "prueba", "rubrica", "presentacion", "planificacion", "actividad", "ejercicio", "imagen", "otro"]) {
  requireText(catalog, `value: "${value}"`, `tipo ${value}`)
}

for (const course of [
  "1° básico",
  "2° básico",
  "3° básico",
  "4° básico",
  "5° básico",
  "6° básico",
  "7° básico",
  "8° básico",
  "1° medio",
  "2° medio",
  "3° medio",
  "4° medio",
]) {
  requireText(catalog, `"${course}"`, `curso ${course}`)
}

for (const [value, label] of [
  ["Física", "asignatura Física"],
  ["Química", "asignatura Química"],
  ["Ciencias para la Ciudadanía", "Ciencias para la Ciudadanía"],
  ["Límites, Derivadas e Integrales", "electivo de Matemática"],
  ["Lectura y Escritura Especializadas", "electivo de Lengua"],
  ["Ciencias del Ejercicio Físico y Deportivo", "electivo de Educación Física"],
  ["Formación técnico-profesional y especialidades", "grupo técnico-profesional"],
]) requireText(catalog, value, label)

for (const [value, label] of [
  ["create table if not exists public.repository_items", "tabla repository_items"],
  ["alter table public.repository_items enable row level security", "RLS"],
  ["repository_items_read_authenticated", "lectura para usuarios autenticados"],
  ["repository_files_read_authenticated", "descarga para usuarios autenticados"],
  ["repository_files_insert_own_folder", "carga por carpeta del usuario"],
  ["'eduai-repository'", "bucket"],
  ["false,\n  104857600", "bucket privado y límite de 100 MB"],
  ["revoke all on public.repository_items from anon", "bloqueo de visitantes anónimos"],
  ["metadata jsonb", "respaldo JSON"],
]) requireText(migration, value, label)

requireText(navigation, 'href="/repositorio"', "botón de Nube EduAI")
requireText(navigation, "Nube EduAI", "nombre en navegación")
requireText(navigation, '"/repositorio"', "ruta protegida de Nube EduAI")
requireText(homePatch, "Bienvenido a Nube EduAI", "bienvenida de Nube EduAI")
requireText(homePatch, "from-blue-50 via-indigo-50 to-violet-50", "panel de colección claro")
requireText(agentCardsPatch, 'name: "Nube EduAI"', "tarjeta Nube EduAI en Agentes")
requireText(courseSubjectPatch, "updateEducationalLevel", "reinicio de asignatura al cambiar curso")
requireText(sharingPatch, "Cualquier usuario de EduAI puede generar y compartir este enlace", "permiso de compartir para todos")
requireText(sharingPatch, "descargarlo", "descarga desde el enlace compartido")
requireText(sharingPatch, "El enlace no tiene fecha de vencimiento", "aviso de enlace permanente")
requireText(sharingPatch, "/api/repository/share", "API de creación de enlace")
requireText(shareToken, "createHmac", "firma criptográfica del enlace")
requireText(shareToken, "timingSafeEqual", "verificación segura de la firma")
requireText(shareCreateRoute, "createRepositoryShareToken", "generador de enlace")
requireText(shareCreateRoute, '.eq("visibility", "public")', "validación de material compartible")
forbidText(shareCreateRoute, "item.created_by !== user.id", "restricción al propietario en la API")
forbidText(page, "selectedItem.created_by === userId", "restricción al propietario en la interfaz generada")
requireText(sharePublicRoute, "parseRepositoryShareToken", "validación del enlace público")
requireText(sharePublicRoute, "SUPABASE_SERVICE_ROLE_KEY", "lectura pública segura")
requireText(sharePublicRoute, "createSignedUrl", "URL temporal interna por visita")
requireText(sharePublicPage, "SharedMaterialViewer", "página pública")
requireText(sharePublicViewer, "Descargar archivo", "descarga desde la página pública")
requireText(sharePublicViewer, "Generado por EduAI - Innova Space Education 2026", "autoría en el pie de página")
requireText(packageJson.scripts.dev, "apply-repository-sharing.mjs", "compartir en desarrollo")
requireText(packageJson.scripts.build, "apply-repository-sharing.mjs", "compartir en compilación")
requireText(packageJson.scripts["test:repository"], "apply-repository-sharing.mjs", "compartir en prueba de Nube EduAI")

console.log("Nube EduAI: cualquier usuario autenticado puede compartir y el público puede descargar")
