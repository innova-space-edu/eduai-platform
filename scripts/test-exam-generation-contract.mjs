import test from "node:test";
import assert from "node:assert/strict";
import { planExamBatches, normalizeStem, examContractIssues } from "../lib/exam/generation-contract.mjs";
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
