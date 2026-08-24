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
const shortLinkMigration = read("supabase/migrations/20260824030000_repository_public_short_links.sql")
const navigation = read("scripts/apply-repository-navigation.mjs")
const homePatch = read("scripts/apply-repository-home-folders.mjs")
const sharingPatch = read("scripts/apply-repository-sharing.mjs")
const publicAccessPatch = read("scripts/apply-repository-public-access.mjs")
const directUploadPatch = read("scripts/apply-public-cloud-direct-upload.mjs")
const agentCardsPatch = read("scripts/apply-agent-library-repository-cards.mjs")
const courseSubjectPatch = read("scripts/apply-repository-course-subject-selects.mjs")
const shareToken = read("lib/repository/public-share.ts")
const publicAccessResolver = read("lib/repository/public-access.ts")
const shareCreateRoute = read("app/api/repository/share/route.ts")
const sharePublicRoute = read("app/api/repository/public/[token]/route.ts")
const sharePublicPage = read("app/nube/[token]/page.tsx")
const sharePublicViewer = read("app/nube/[token]/shared-material-viewer.tsx")
const publicAccessAdminRoute = read("app/api/repository/public-access/admin-link/route.ts")
const publicAccessItemsRoute = read("app/api/repository/public-access/[token]/items/route.ts")
const publicAccessItemRoute = read("app/api/repository/public-access/[token]/items/[itemId]/route.ts")
const publicAccessPage = read("app/nube-publica/[token]/page.tsx")
const publicAccessClient = read("app/nube-publica/[token]/public-cloud-client.tsx")
const proxy = read("proxy.ts")
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
  ["Compartir a público", "botón administrativo de acceso público"],
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

for (const [value, label] of [
  ["create table if not exists public.repository_public_links", "tabla de alias públicos cortos"],
  ["slug text not null unique", "slug único"],
  ["owner_id uuid not null references auth.users", "propietario del alias"],
  ["where active = true", "un alias activo por administrador"],
  ["revoke all on public.repository_public_links from anon", "alias no visibles para visitantes"],
  ["grant all on public.repository_public_links to service_role", "resolución server-side"],
]) requireText(shortLinkMigration, value, label)

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
requireText(publicAccessPatch, "Solo administrador", "botón exclusivo del administrador")
requireText(publicAccessPatch, "sin crear una cuenta", "ingreso público sin registro")
requireText(publicAccessPatch, "consultar, subir, descargar y compartir", "permisos del acceso público")
requireText(publicAccessPatch, "/api/repository/public-access/admin-link", "API administrativa del enlace público")
requireText(directUploadPatch, "uploadToSignedUrl", "carga directa del navegador a Supabase")
requireText(directUploadPatch, 'method: "PUT"', "registro posterior de la carga pública")
requireText(directUploadPatch, 'method: "DELETE"', "limpieza de carga incompleta")
requireText(shareToken, "createHmac", "firma criptográfica del enlace")
requireText(shareToken, "timingSafeEqual", "verificación segura de la firma")
requireText(shareToken, "createRepositoryPublicAccessToken", "compatibilidad con el acceso público largo")
requireText(shareToken, "createRepositoryPublicAccessSlug", "generador de alias corto")
requireText(publicAccessResolver, "parseRepositoryPublicAccessToken", "compatibilidad con enlace largo")
requireText(publicAccessResolver, '.from("repository_public_links")', "resolución del alias corto")
requireText(publicAccessResolver, "validateRepositoryPublicAccess", "validación centralizada del acceso público")
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
requireText(publicAccessAdminRoute, '.from("admin_emails")', "validación del administrador")
requireText(publicAccessAdminRoute, "createRepositoryPublicAccessSlug", "creación del enlace corto")
requireText(publicAccessAdminRoute, '.from("repository_public_links")', "persistencia del enlace corto")
requireText(publicAccessAdminRoute, '`/nube-publica/${encodeURIComponent(slug)}`', "URL pública corta")
requireText(publicAccessItemsRoute, "validateRepositoryPublicAccess", "validación de alias corto o enlace legado")
requireText(publicAccessItemsRoute, "checkUploadRateLimit", "límite de cargas públicas")
requireText(publicAccessItemsRoute, "BLOCKED_FILE_EXTENSION", "bloqueo de archivos peligrosos")
requireText(publicAccessItemsRoute, "createSignedUploadUrl", "URL firmada de carga pública")
requireText(publicAccessItemsRoute, 'export async function PUT', "registro del material cargado")
requireText(publicAccessItemsRoute, 'export async function DELETE', "limpieza del archivo incompleto")
requireText(publicAccessItemsRoute, 'sourceType === "youtube"', "YouTube desde la nube pública")
requireText(publicAccessItemsRoute, "sharedGlobally: true", "catálogo público global")
requireText(publicAccessItemsRoute, '.from("repository_items")', "mismo catálogo que Nube EduAI interna")
requireText(publicAccessItemRoute, "validateRepositoryPublicAccess", "detalle compatible con alias corto")
requireText(publicAccessItemRoute, "createSignedUrl", "descarga pública mediante URL temporal")
requireText(publicAccessItemRoute, "createRepositoryShareToken", "compartir material desde acceso público")
requireText(publicAccessPage, "PublicCloudClient", "página de ingreso público")
requireText(publicAccessClient, "buildTree(filteredItems)", "misma jerarquía visual del panel interno")
requireText(publicAccessClient, "Inicio de Nube EduAI", "inicio equivalente al panel interno")
requireText(publicAccessClient, "asignatura, curso, año, tipo de material y archivo", "orden de carpetas documentado")
requireText(publicAccessClient, "Material compartido con todos", "aviso de publicación global")
requireText(publicAccessClient, "Publicar para todos", "acción de carga pública")
requireText(publicAccessClient, "uploadToSignedUrl", "carga directa desde la nueva interfaz")
requireText(publicAccessClient, "YouTube", "carga de videos enlazados")
requireText(publicAccessClient, "Descargar", "descarga desde la nube pública")
requireText(publicAccessClient, "Compartir", "compartir desde la nube pública")
requireText(publicAccessClient, "Generado por EduAI - Innova Space Education 2026", "autoría en la nube pública")
forbidText(proxy, '"/nube-publica"', "protección por inicio de sesión de la nube pública")
requireText(packageJson.scripts.dev, "apply-repository-public-access.mjs", "acceso público en desarrollo")
requireText(packageJson.scripts.build, "apply-repository-public-access.mjs", "acceso público en compilación")
requireText(packageJson.scripts["test:repository"], "apply-repository-public-access.mjs", "acceso público en prueba de Nube EduAI")
requireText(packageJson.scripts.dev, "apply-public-cloud-direct-upload.mjs", "carga directa en desarrollo")
requireText(packageJson.scripts.build, "apply-public-cloud-direct-upload.mjs", "carga directa en compilación")
requireText(packageJson.scripts["test:repository"], "apply-public-cloud-direct-upload.mjs", "carga directa en prueba")

if (packageJson.devDependencies?.pptxgenjs !== "^4.0.1") {
  throw new Error("pptxgenjs debe permanecer en devDependencies ^4.0.1 para las exportaciones PPTX del cliente")
}
if (packageJson.dependencies?.pptxgenjs) {
  throw new Error("pptxgenjs no debe volver a dependencies: su uso es de exportación cliente y no debe contaminar el árbol runtime del servidor")
}

console.log("Nube EduAI: interfaz pública equivalente, catálogo global, alias corto, carga directa, descarga y uso compartido correctos")
