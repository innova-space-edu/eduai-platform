import assert from "node:assert/strict";
import { solveExactMath } from "../lib/math/exact-solver.ts";

const testCases = [
  [{ operation:"linear", a:-2, b:-24, c:12 }, "-18"],
  [{ question:"Resuelve -2x+(-24)=12. Responde solo x entero." }, "-18"],
  [{ question:"s0=25, s(t+1)=(6*s(t)+11) mod 19. Calcula s5. Responde solo entero." }, "16"],
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
  { question:"Calcula 20% de 146 y luego duplica el resultado" },
  { question:"Resuelve -2x+(-24)=12 si x>0." },
  { question:"X".repeat(600) },
  { operation:"recurrence",s0:1,a:2,b:3,modulus:19,steps:999999 },
]) {
  assert.equal(solveExactMath(query).verified,false,JSON.stringify(query));
}

let entropy=0x2adef01d;
function rand(min,max) {
  entropy^=entropy<<13;entropy^=entropy>>>17;entropy^=entropy<<5;
  return min+(entropy>>>0)%(max-min+1);
}
function referenceRational(n,d=1n) {
  if(d<0n){n=-n;d=-d}
  let a=n<0n?-n:n,b=d;
  while(b!==0n){const t=a%b;a=b;b=t}
  const g=a||1n;n/=g;d/=g;
  return d===1n?String(n):String(n)+"/"+String(d);
}
for(let i=0;i<400;i++){
  const x=rand(-60,60), a=rand(1,40)*(rand(0,1)?-1:1), b=rand(-60,60);
  const solved=solveExactMath({operation:"linear",a,b,c:a*x+b});
  assert.equal(solved.answer,String(x),JSON.stringify({i,solved,a,b,x}));
  let A,B,D,E;
  do { A=rand(-12,12);B=rand(-12,12);D=rand(-12,12);E=rand(-12,12) }
  while(A*E===B*D);
  const y=rand(-60,60);
  const system=solveExactMath({operation:"system2",a:A,b:B,c:A*x+B*y,d:D,e:E,f:D*x+E*y});
  assert.equal(system.answer,"x="+x+", y="+y,JSON.stringify({i,system,x,y}));
  const start=rand(-100,100), mod=rand(2,97), mul=rand(-12,12), shift=rand(-30,30), steps=rand(0,10);
  let expected=start;
  for(let j=0;j<steps;j++)expected=((mul*expected+shift)%mod+mod)%mod;
  const rec=solveExactMath({operation:"recurrence",s0:start,a:mul,b:shift,modulus:mod,steps});
  assert.equal(rec.answer,String(expected),JSON.stringify({i,rec,start,steps}));
  const initial=rand(-20,20), k=rand(0,20), numer=rand(1,4), denom=rand(10,40), n=rand(0,3);
  let top=BigInt(initial),bottom=1n;
  for(let j=0;j<n;j++){top*=BigInt(denom-k*numer);bottom*=BigInt(denom)}
  const euler=solveExactMath({operation:"euler_decay",x0:initial,k,dt:numer+"/"+denom,steps:n});
  assert.equal(euler.answer,referenceRational(top,bottom),JSON.stringify({i,euler,numer,denom,n}));
}
console.log("PASS 1,600 deterministic arithmetic property cases");

console.log("PASS exact math:",testCases.length,"verified cases + 8 rejected cases");
