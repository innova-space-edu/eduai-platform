import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const page=readFileSync("app/examen/editar/[id]/page.tsx","utf8")
const polish=readFileSync("components/exam/ExamUiPolish.tsx","utf8")
for(const field of ["q.question","q.modelAnswer","q.expectedLatex","q.explanation","item.criteria","opt","instructions"]){
 assert.ok(page.includes("value={"+field+"}")||page.includes("value={"+field+'||""}'),"Campo visual faltante: "+field)
}
assert.match(page,/import ExamVisualEditor/)
assert.match(page,/min-h-44/)
assert.match(page,/Pauta ampliada · editar explicación y procedimiento/)
assert.match(page,/value=\{\(q\.solutionSteps\|\|\[\]\)\.join\("\\n"\)\}/)
assert.match(page,/Agregar criterio/)
assert.match(page,/Verificar todas con Python/)
assert.match(page,/attempted\.current\[q\.id!\]!==correctionSignature\(q\)/)
assert.match(page,/const candidates=snapshot\.filter\(needsPython\)/)
assert.match(page,/correctionReview:\{required:true,confirmedSignature:/)
assert.match(page,/function enrichEditable/)
assert.doesNotMatch(page,/Vista previa LaTeX:|Resultado final LaTeX|Pauta separada para corrección|<textarea/)
assert.doesNotMatch(polish,/void enhanceEditInstructionsTextarea\(\)/)
assert.match(page,/Guardar cursos sin modificar preguntas/)
console.log("OK: editor visual de evaluaciones publicadas, pauta editable, Python y campos amplios")
