import assert from "node:assert/strict";
import { referenceExactMath } from "../lib/ai/model-lab/exact-reference.ts";
import { LAB_MODELS, selectLabModels } from "../lib/ai/model-lab/catalog.ts";

const a=referenceExactMath("Resuelve 3x + 7 = 22 y explica el procedimiento.");
assert.equal(a.verified,true);assert.equal(a.answer,"5");
assert.deepEqual(selectLabModels("compare","r2"),["nano-r2","lite-r2"]);
assert.equal(LAB_MODELS.filter(m=>m.version==="R2").length,2);
assert.equal(referenceExactMath("Calcula 20% de 146.").answer,"146/5");
assert.equal(referenceExactMath("Calcula 10 / 2.").answer,"5");
assert.equal(referenceExactMath("Calcula 3 + 4.").answer,"7");
assert.equal(referenceExactMath("Resuelve 3x + 0 = 10").answer,"10/3");
assert.equal(referenceExactMath("Resuelve 0x + 2 = 2").verified,false);
assert.equal(referenceExactMath("Resuelve sistemas no lineales de orden 4").supported,false);
assert.equal(referenceExactMath("Calcula 3 / 0").supported,false);
assert.equal(referenceExactMath("Resuelve 3x + 7 = 22 y x + 2 = 4").supported,false);
assert.equal(referenceExactMath("Calcula 20% de 146 y luego suma 10").supported,false);
assert.equal(referenceExactMath("Resuelve 3x + 7 = 22 pero además x>0").supported,false);
for(const choice of ["nano","lite","compare"]){
  assert.throws(()=>selectLabModels(choice,"r5"),/R5_NOT_APPROVED/);
}
assert.throws(()=>selectLabModels("invalid","r2"),/INVALID_MODEL_SELECTION/);
console.log("PASS: admin Model Lab catalog, exact math references and R5 quality gate");

const {parseExactVerification}=await import("../lib/ai/model-lab/exact-verification.ts");
const exact={supported:true,verified:true,engine:"python-integer-subtraction-v1",answer:"4",
  steps:["Comprobación: (74) + (35) = 109."],candidate:"74",candidateCorrect:false};
assert.equal(parseExactVerification(exact).candidateCorrect,false);
assert.equal(parseExactVerification({...exact,candidate:null,candidateCorrect:null}).answer,"4");
assert.equal(parseExactVerification({supported:false,verified:false,engine:exact.engine,reason:"Fuera de alcance"}).verified,false);
assert.throws(()=>parseExactVerification({...exact,candidateCorrect:null}));
assert.throws(()=>parseExactVerification({...exact,answer:4}));
assert.throws(()=>parseExactVerification({...exact,verified:false}));
assert.throws(()=>parseExactVerification({...exact,engine:"llm"}));
console.log("PASS: independent Python exact verifier response contract");
