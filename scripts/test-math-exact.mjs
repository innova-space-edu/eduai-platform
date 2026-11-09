import assert from "node:assert/strict";
import { solveExactMath } from "../lib/math/exact-solver.ts";

const testCases = [
  [{ operation:"linear", a:-2, b:-24, c:12 }, "-18"],
  [{ question:"Resuelve -2x+(-24)=12. Responde solo x entero." }, "-18"],
  [{ question:"Resuelve 6(x+(10))=138. Responde solo x entero." }, "13"],
  [{ question:"Calcula 20% de 146." }, "146/5"],
  [{ question:"Calcula -19 por 44." }, "-836"],
  [{ operation:"system2", a:2, b:3, c:13, d:1, e:-1, f:1 }, "x=16/5, y=11/5"],
  [{ operation:"euler_decay", k:12, dt:"3/50", x0:-7, steps:1 }, "-49/25"],
  [{ operation:"euler_decay", k:3, dt:"2/5", x0:-5, steps:1 }, "1"],
  [{ operation:"euler_stability", k:11, dt:"2/5" }, "inestable"],
  [{ operation:"recurrence", s0:25, a:6, b:11, modulus:19, steps:5 }, "16"],
  [{ question:"s0=25, s(t+1)=(6*s(t)+11) mod 19. Calcula s5." }, "16"],
  [{ operation:"arithmetic", a:"-2/3", b:"1/6", operator:"+" }, "-1/2"],
];
for (const [query, answer] of testCases) {
  const output = solveExactMath(query);
  assert.equal(output.verified,true,JSON.stringify({query,output}));
  assert.equal(output.answer,answer,JSON.stringify({query,output}));
}
for (const query of [
  { operation:"arithmetic", a:1, b:0, operator:"/" },
  { operation:"system2", a:1,b:2,c:3,d:2,e:4,f:6 },
  { operation:"__import__",code:"import os" },
  { question:"Ejecuta Python arbitrary code" },
  { question:"X".repeat(600) },
  { operation:"recurrence",s0:1,a:2,b:3,modulus:19,steps:999999 },
]) {
  assert.equal(solveExactMath(query).verified,false,JSON.stringify(query));
}
console.log("PASS exact math:",testCases.length,"verified cases + 6 rejected cases");
