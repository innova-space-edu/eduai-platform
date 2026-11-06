import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { registerHooks, stripTypeScriptTypes } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { resolve } from "node:path"

// Run the real TS registry/planner on Node 22.15+ without installing the web app.
const root = fileURLToPath(new URL("../", import.meta.url))
registerHooks({
  resolve(specifier, context, next) {
    let target = specifier.startsWith("@/") ? pathToFileURL(resolve(root, specifier.slice(2))).href : specifier
    if (target.startsWith(".") || target.startsWith("file:")) {
      const url = new URL(target, context.parentURL || import.meta.url)
      if (existsSync(fileURLToPath(url) + ".ts")) target = url.href + ".ts"
    }
    return next(target, context)
  },
  load(url, context, next) {
    if (!url.endsWith(".ts")) return next(url, context)
    let source = stripTypeScriptTypes(readFileSync(new URL(url), "utf8"))
    source = source.replace(/(import\s+\w+\s+from\s+["'][^"']+\.json["'])/g, '$1 with { type: "json" }')
    return { format: "module", source, shortCircuit: true }
  },
})

const { getOAs, getOA, getAvailableAsignaturas, getCurriculumRecord, normalizeAsignatura } = await import("../lib/mineduc-oa.ts")
const { getPlannerOAOptions, getPlannerUnits, buildSelectedOAContext } = await import("../lib/planificador-curriculum.ts")
const json = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"))
const manifest = json("data/mineduc/references/media-2026-manifest.json")
const originals = json("data/mineduc/references/media-before-20261106.json")
let objectives = 0
for (const row of manifest) {
  const curso = `${row.curso}° Medio`
  const state = { nivel: "media", curso, asignatura: row.asignatura }
  const oas = getPlannerOAOptions(state)
  assert.equal(oas.length, row.expected_count, `${curso}: ${row.asignatura}`)
  assert.equal(new Set(oas.map((o) => o.id)).size, oas.length, "duplicate IDs")
  assert.equal(new Set(oas.map((o) => o.codigoOficial)).size, oas.length, "duplicate codes")
  for (const oa of oas) {
    assert.equal(oa.verificationStatus, "verificado_oficial")
    assert.ok(oa.sourceUrl?.startsWith("https://"))
    assert.ok(!/Unidad de Currículum|Teléfono:|Ayuda Mineduc|Facebook|Twitter|Youtube|Instagram|Políticas de Privacidad|Ver actividades|##|Referencias bibliográficas/.test(oa.texto), `${oa.id}: navigation contamination`)
    assert.ok(!oa.texto.trim().endsWith(":"), `${oa.id}: missing subitems`)
    assert.ok(oa.texto.length > 20)
  }
  assert.deepEqual(getPlannerUnits(state).flatMap((u) => getPlannerOAOptions(state, u.id).map((o) => o.id)).sort(), oas.map((o) => o.id).sort())
  const context = buildSelectedOAContext(state, [oas[0].id])
  assert.ok(context.includes(oas[0].texto))
  assert.equal(getCurriculumRecord("media", curso, row.asignatura.toUpperCase())?.sourceFile, `data/mineduc/${row.path}`)
  const raw = json(`data/mineduc/${row.path}`)
  const old = originals[`data/mineduc/${row.path}`]
  const oldItems = [...(old?.unidades || []), ...(old?.modulos || [])].flatMap((u) => u.oa)
  for (const item of oldItems) assert.equal(oas.find((o) => o.codigoOficial === item.codigo_oficial)?.id, item.id, "saved planning IDs must remain stable")
  if (row.plan !== "formacion_general" && row.curso >= 3) {
    const other = getOAs("media", `${row.curso === 3 ? 4 : 3}° Medio`, row.asignatura)
    assert.deepEqual(oas.map((o) => [o.codigoOficial, o.texto]), other.map((o) => [o.codigoOficial, o.texto]))
  }
  assert.equal(raw.metadata.fecha_consulta, "2026-11-06")
  objectives += oas.length
}
for (const [course, count] of [[1, 13], [2, 13], [3, 41], [4, 41]]) {
  const subjects = getAvailableAsignaturas("media", `${course}° Medio`)
  assert.equal(subjects.length, count)
  const rows = manifest.filter((m) => m.curso === course)
  if (course >= 3) {
    assert.equal(rows.filter((r) => r.plan === "formacion_diferenciada_hc").length, 27)
    assert.equal(rows.filter((r) => r.plan === "formacion_general_electiva").length, 8)
  } else {
    const all = getOAs("media", `${course}° Medio`, "Ciencias Naturales")
    const axes = ["Biología", "Física", "Química"].flatMap((name) => getOAs("media", `${course}° Medio`, name))
    assert.deepEqual(all.map((o) => [o.codigoOficial, o.texto]), axes.map((o) => [o.codigoOficial, o.texto]))
  }
}
assert.equal(getOA("media", "3° Medio", "Matemática", 4)?.codigoOficial, "FG-MATE-3M-OAC-04")
assert.equal(getOA("media", "1° Medio", "Matemática", 6)?.codigoOficial, "MA1M OA 06")
assert.equal(getOA("media", "3° Medio", "Ciencias para la Ciudadanía", 1), null, "CPC needs a module, not an ambiguous OA number")
assert.equal(normalizeAsignatura("LÍMITES, DERIVADAS E INTEGRALES", "media"), "Límites, derivadas e integrales")
assert.equal(getOAs("basica", "1° Básico", "Matemática").length, 20)
console.log(`Media: ${manifest.length} course/subject selections; ${objectives} OA occurrences; 27 HC electives and 8 FG elective options in both courses. All checks passed.`)
