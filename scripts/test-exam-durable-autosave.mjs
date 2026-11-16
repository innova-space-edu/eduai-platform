import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {webcrypto} from "node:crypto"
import {runInNewContext} from "node:vm"
import ts from "typescript"
const code=readFileSync("lib/exam/attempt-checkpoint.ts","utf8")
const store=new Map()
const sandbox={exports:{},crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}}
runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox)
const {saveCheckpoint,recoverCheckpoint,clearCheckpoint}=sandbox.exports
const snapshot={baseSavedAt:"2026-11-15T21:00:00Z",saveId:"save-2",parentSaveId:"save-1",answers:{mcAnswers:{0:1},devAnswers:{1:"Respuesta privada"},tfJustifications:{2:"Justificación"},developmentArtifacts:{1:{pages:[{strokes:[{points:[{x:1,y:2}]}]}]}}},currentQuestionIndex:1,timeLeft:120}
assert.equal(await saveCheckpoint("exam","attempt","secret-A",snapshot),true)
assert.equal([...store.values()][0].includes("Respuesta privada"),false)
assert.equal([...store.values()][0].includes("secret-A"),false)
assert.equal((await recoverCheckpoint("exam","attempt","secret-A",snapshot.baseSavedAt,null)).answers.devAnswers[1],"Respuesta privada")
assert.equal(await recoverCheckpoint("exam","attempt","secret-B",snapshot.baseSavedAt,null),null)
assert.equal(await recoverCheckpoint("exam","other","secret-A",snapshot.baseSavedAt,null),null)
assert.equal(await recoverCheckpoint("exam","attempt","secret-A","newer","save-other"),null)
assert.equal((await recoverCheckpoint("exam","attempt","secret-A","newer","save-1")).currentQuestionIndex,1)
assert.equal(await recoverCheckpoint("exam","attempt","secret-A","newer","save-2"),null)
clearCheckpoint("exam","attempt")
assert.equal(await recoverCheckpoint("exam","attempt","secret-A",snapshot.baseSavedAt,null),null)
const page=readFileSync("app/examen/p/[code]/page.tsx","utf8")
const route=readFileSync("app/api/agents/examen-docente/route.ts","utf8")
const notebook=readFileSync("components/exam/ExamQuestionNotebook.tsx","utf8")
const development=readFileSync("app/api/examen/developments/route.ts","utf8")
assert.match(page,/saveTailRef\.current\.catch/)
assert.match(page,/recoverCheckpoint\(exam.id,nextAttemptId,credentialRef.current/)
assert.match(page,/action:"autosave_attempt"/)
assert.match(page,/keepalive:true/)
assert.match(page,/deadlineRef.current-Date.now\(\)/)
assert.match(page,/initialArtifact=\{developmentArtifacts\[curQ\]\}/)
assert.match(page,/setDevAnswers\(normalizeTextRecord\(savedAnswers.devAnswers\)\)/)
assert.match(route,/EXAM_SAVE_CONFLICT/)
assert.match(route,/write\.eq\("last_saved_at",existing.last_saved_at\)/)
assert.match(route,/durationSeconds: maxTimeLeft/)
assert.match(route,/hasAttemptCredential/)
assert.match(notebook,/initialArtifact\?\.pages/)
assert.match(development,/hasAttemptCredential\(examId,clientAttemptId,body.attemptCredential\)/)
console.log("OK: cifrado real, recuperación aislada, protección de revisiones, reloj y cuaderno")
