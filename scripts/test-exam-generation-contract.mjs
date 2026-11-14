import test from "node:test";
import assert from "node:assert/strict";
import { planExamBatches, normalizeStem, examContractIssues, planAdaptiveExamBatches, remainingExamCounts, extractExamQuestions, constructedContractIssues } from "../lib/exam/generation-contract.mjs";
test("all 4 types retain exact requested counts and sequence", () => {
 const counts={mc:5,mixed:2,tf:3,dev:4}; const plans=planExamBatches(counts,3);
 for(const k of Object.keys(counts))assert.equal(plans.reduce((n,b)=>n+b[k],0),counts[k]);
 assert.ok(plans.every(b=>b.total<=3));
 assert.deepEqual(planExamBatches({mc:0,mixed:4,tf:0,dev:0},3).map(b=>b.mixed),[3,1]);
 assert.equal(planExamBatches({mc:1,mixed:0,tf:0,dev:0},0).length,1);
});
const q={"type":"multiple_choice","question":"¿Cuál es la probabilidad?","options":["a","b","c","d"],"correctAnswer":2,"oaCodes":["OA 12"],"pedagogicalMode":"aplicacion"};
const curriculum={"requireOA":true,"oaCodes":["OA 12"],"modeIds":["aplicacion"]};
test("OA and answer contract rejects invalid and duplicate questions", () => {
 assert.deepEqual(examContractIssues(q,curriculum,new Set()),[]);
 for(const bad of [{...q,correctAnswer:null},{...q,correctAnswer:4},{...q,oaCodes:[]},{...q,oaCodes:["FAKE"]},{...q,pedagogicalMode:"creacion"}]) assert.ok(examContractIssues(bad,curriculum,new Set()).length);
 assert.ok(examContractIssues(q,curriculum,new Set([normalizeStem(q.question)])).length);
 assert.deepEqual(examContractIssues({...q,oaCodes:[]},{...curriculum,requireOA:false},new Set()),[]);
});

test("math operations are not false duplicate matches", () => {
 assert.notEqual(normalizeStem("Calcula 2+3"), normalizeStem("Calcula 2-3"));
 assert.equal(normalizeStem("¿Cuál es la probabilidad?"), normalizeStem("Cual es la probabilidad"));
});

test("five difficult development questions use five independent requests; resume by actual type counts",()=>{
 const counts={mc:0,mixed:0,tf:0,dev:5};
 assert.deepEqual(planAdaptiveExamBatches(counts).map(b=>b.dev),[1,1,1,1,1]);
 assert.deepEqual(planAdaptiveExamBatches(remainingExamCounts(counts,[{type:"development"},{type:"development"}])).map(b=>b.dev),[1,1,1]);
});
test("model aliases preserve actual stem and rubric without fabricating data",()=>{
 const [q]=extractExamQuestions({preguntas:[{type:"desarrollo",enunciado:"Calcula x usando Tales",respuestaModelo:"x=6",response_mode:"math_steps",rubrica:[{criterio:"Proporción correcta",puntos:2}]}]});
 assert.equal(q.question,"Calcula x usando Tales");assert.equal(q.modelAnswer,"x=6");assert.deepEqual(q.rubric,[{criteria:"Proporción correcta",points:2}]);
 assert.deepEqual(constructedContractIssues(q,["math_steps"]),[]);
 assert.ok(constructedContractIssues({...q,rubric:[]},["math_steps"]).length);
 assert.ok(constructedContractIssues({...q,rubric:[{criteria:"",points:0}]},["math_steps"]).length);
 assert.ok(constructedContractIssues(q,["long_text"]).length);
 assert.ok(examContractIssues({...q,question:""},null,new Set()).length);
});

import { examAnswerConsistencyIssues } from "../lib/exam/answer-consistency.mjs";
test("Tales: incorrect answer conflicts with deterministic calculation",()=>{
const q={question:"En el triángulo ABC, AB = 20 cm, BC = 25 cm. En AB se marca D tal que AD = 8 cm. La recta paralela a AC corta BC en E. Determina BE mediante Tales.",modelAnswer:"BE = 10 cm",solutionSteps:["BE = 15 cm"]};
assert.ok(examAnswerConsistencyIssues(q).some(s=>s.includes("15 cm")));
assert.deepEqual(examAnswerConsistencyIssues({...q,modelAnswer:"BE = 15 cm"}),[]);
assert.ok(examAnswerConsistencyIssues({...q,modelAnswer:"BE = 15 cm",explanation:"El triángulo ADE es similar a ABC."}).some(s=>s.includes("ADE")));
assert.ok(examAnswerConsistencyIssues({...q,modelAnswer:"BE = 15 cm",solutionSteps:["Revisión del cálculo anterior en el borrador mental"]}).length);
});

import { correctionSignature, needsCorrectionConfirmation, correctionPublicationIssue } from "../lib/exam/correction-review.mjs";
test("correction confirmation is required and invalidated by any edited answer",()=>{
 const q={type:"development",question:"Calcula",modelAnswer:"15",correctionReview:{required:true}};
 assert.ok(needsCorrectionConfirmation(q));
 const confirmed={...q,correctionReview:{required:true,confirmedSignature:correctionSignature(q)}};
 assert.equal(needsCorrectionConfirmation(confirmed),false);
 assert.ok(needsCorrectionConfirmation({...confirmed,modelAnswer:"10"}));
 assert.ok(correctionPublicationIssue([q],()=>[]));
 assert.ok(correctionPublicationIssue([confirmed],()=>["error"]));
 assert.equal(correctionPublicationIssue([confirmed],()=>[]),"");
});
