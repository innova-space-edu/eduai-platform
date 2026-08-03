import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pagePath = path.join(root, "app", "repositorio", "page.tsx")

if (!fs.existsSync(pagePath)) {
  throw new Error(`No se encontró ${pagePath}`)
}

let source = fs.readFileSync(pagePath, "utf8")
let changed = false

if (source.includes("  LEVEL_SUGGESTIONS,")) {
  source = source.replace("  LEVEL_SUGGESTIONS,", "  COURSE_OPTIONS,")
  changed = true
}

if (source.includes("  SUBJECT_SUGGESTIONS,")) {
  source = source.replace("  SUBJECT_SUGGESTIONS,", "  subjectGroupsForCourse,")
  changed = true
}

const subjectGroupsMarker = '  const [error, setError] = useState("")\n'
if (!source.includes("const subjectGroups = useMemo(")) {
  if (!source.includes(subjectGroupsMarker)) {
    throw new Error("No se encontró el estado de error del formulario del repositorio")
  }

  source = source.replace(
    subjectGroupsMarker,
    `${subjectGroupsMarker}  const subjectGroups = useMemo(\n    () => subjectGroupsForCourse(form.educationalLevel),\n    [form.educationalLevel],\n  )\n`,
  )
  changed = true
}

const updateFormMarker = `  const updateForm = <K extends keyof RepositoryFormValues>(key: K, value: RepositoryFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }
`

if (!source.includes("const updateEducationalLevel =")) {
  if (!source.includes(updateFormMarker)) {
    throw new Error("No se encontró la función updateForm del repositorio")
  }

  source = source.replace(
    updateFormMarker,
    `${updateFormMarker}
  const updateEducationalLevel = (educationalLevel: string) => {
    setForm((current) => ({
      ...current,
      educationalLevel,
      subject: "",
    }))
  }
`,
  )
  changed = true
}

if (!source.includes('placeholder="Selecciona primero un curso"')) {
  const subjectStartMarker = `            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Asignatura</span>`
  const yearStartMarker = `            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Año</span>`

  const subjectStart = source.indexOf(subjectStartMarker)
  const yearStart = source.indexOf(yearStartMarker, subjectStart)

  if (subjectStart < 0 || yearStart < 0) {
    throw new Error("No se encontraron los campos de asignatura y nivel educativo")
  }

  const replacement = `            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Curso</span>
              <select
                required
                value={form.educationalLevel}
                onChange={(event) => updateEducationalLevel(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="" disabled>Selecciona un curso</option>
                {COURSE_OPTIONS.map((course) => <option key={course} value={course}>{course}</option>)}
              </select>
              <span className="mt-1.5 block text-[11px] text-slate-500">Desde 1° básico hasta 4° medio.</span>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Asignatura</span>
              <select
                required
                disabled={!form.educationalLevel}
                value={form.subject}
                onChange={(event) => updateForm("subject", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="" disabled>
                  {form.educationalLevel ? "Selecciona una asignatura" : "Selecciona primero un curso"}
                </option>
                {subjectGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </optgroup>
                ))}
              </select>
              <span className="mt-1.5 block text-[11px] text-slate-500">
                {form.educationalLevel
                  ? "Asignaturas organizadas en formación general, complementarias y electivos."
                  : "La lista se habilitará después de seleccionar el curso."}
              </span>
            </label>

`

  source = `${source.slice(0, subjectStart)}${replacement}${source.slice(yearStart)}`
  changed = true
}

if (source.includes('list="repository-subjects"') || source.includes('list="repository-levels"')) {
  throw new Error("Los campos antiguos con datalist siguen presentes")
}

if (changed) {
  fs.writeFileSync(pagePath, source)
  console.log("[repositorio] selectores de curso y asignatura aplicados")
} else {
  console.log("[repositorio] selectores de curso y asignatura ya estaban aplicados")
}
