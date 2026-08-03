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

const page = read("app/repositorio/page.tsx")
const catalog = read("lib/repository/catalog.ts")
const migration = read("supabase/migrations/202608030001_repository_documents.sql")
const navigation = read("scripts/apply-repository-navigation.mjs")
const courseSubjectPatch = read("scripts/apply-repository-course-subject-selects.mjs")
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

requireText(navigation, 'href="/repositorio"', "botón del repositorio")
requireText(navigation, '"/repositorio"', "ruta protegida del repositorio")
requireText(courseSubjectPatch, "updateEducationalLevel", "reinicio de asignatura al cambiar curso")
requireText(packageJson.scripts.dev, "apply-repository-course-subject-selects.mjs", "selectores en desarrollo")
requireText(packageJson.scripts.build, "apply-repository-course-subject-selects.mjs", "selectores en compilación")
requireText(packageJson.scripts.test:repository, "apply-repository-course-subject-selects.mjs", "selectores en prueba del repositorio")
requireText(packageJson.scripts.dev, "apply-repository-navigation.mjs", "parche en desarrollo")
requireText(packageJson.scripts.build, "apply-repository-navigation.mjs", "parche en compilación")

console.log("Repositorio EduAI: verificación estructural correcta")
