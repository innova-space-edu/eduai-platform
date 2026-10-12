import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const [statsPath, adminApiPath, adminUiPath] = process.argv.slice(2)
if (!statsPath || !adminApiPath || !adminUiPath) throw Error("Missing test inputs")
const code = ts.transpileModule(readFileSync(statsPath,"utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true
}).outputText
const sandbox={exports:{},Date,Number}
runInNewContext(code,sandbox,{timeout:3000})
const summarize=sandbox.exports.summarizeFamilyResponses
assert.equal(typeof summarize,"function")
const purposes=[{key:"platform_access",title:"Ingreso"},{key:"public_showcase",title:"Publicación"}]
const rows=[
 {status:"invited",submitted_at:null,decisions:null},
 {status:"submitted",submitted_at:"2026-10-12T12:00:00Z",decisions:{platform_access:true,public_showcase:false}},
 {status:"submitted",submitted_at:"2026-10-12T12:10:00Z",decisions:{platform_access:false,public_showcase:false}},
 {status:"approved",submitted_at:"2026-10-12T12:20:00Z",decisions:{platform_access:true,public_showcase:true}},
 {status:"revoked",submitted_at:"2026-10-12T12:30:00Z",decisions:{platform_access:true,public_showcase:false}},
 {status:"rejected",submitted_at:null,decisions:null},
]
const out=summarize(rows,purposes)
assert.equal(out.totals.invitations,6)
assert.equal(out.totals.answered,4,"Only signed responses are counted")
assert.equal(out.totals.accessYes,3)
assert.equal(out.totals.accessNo,1)
assert.equal(out.totals.pendingReview,2)
assert.equal(out.totals.approved,1)
assert.equal(out.totals.awaitingResponse,1)
assert.equal(out.byPurpose[0].yes,3)
assert.equal(out.byPurpose[0].no,1)
assert.equal(out.byPurpose[1].yes,1)
assert.equal(out.byPurpose[1].no,3)
assert.match(readFileSync(adminApiPath,"utf8"),/record\.decisions\?\.platform_access !== true/,"An explicit No must never grant access")
assert.match(readFileSync(adminApiPath,"utf8"),/record\.signature_sha256/,"No approval without signed form")
assert.match(readFileSync(adminApiPath,"utf8"),/summarizeFamilyResponses/,"All-record statistics must be returned")
const ui=readFileSync(adminUiPath,"utf8")
assert.match(ui,/ReviewControls/,"Verification controls must be scoped per request")
assert.match(ui,/statistics\.byPurpose/,"Breakdown by consent purpose is required")
assert.match(ui,/Aprobar y habilitar acceso/)
for (const p of [statsPath, adminApiPath, adminUiPath]) {
  const source=readFileSync(p,"utf8")
  const compile=ts.transpileModule(source,{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX}})
  const errors=(compile.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
  assert.equal(errors.length,0,p+": "+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join(", "))
}
console.log("OK: estadísticas Sí/No y aprobación institucional segura")
