/** Deterministic *reference* (never passed off as a Nano/Lite completion).
 * Supports only narrow, unambiguous arithmetic; never executes model output.
 */
export type LabExactReference = {
  supported: boolean;
  verified: boolean;
  answer?: string;
  steps?: string[];
  family?: "linear" | "percentage" | "arithmetic";
  reason?: string;
};
type Rational = { n: bigint; d: bigint };
const MAX = 10n ** 22n;
function abs(n: bigint): bigint { return n < 0n ? -n : n; }
function gcd(a: bigint,b: bigint): bigint { a=abs(a);b=abs(b);while(b){const x=a%b;a=b;b=x}return a||1n }
function make(n: bigint,d=1n): Rational {
  if (d===0n) throw Error("DIVISION_BY_ZERO");
  if (d<0n){n=-n;d=-d}
  const g=gcd(n,d);n/=g;d/=g;
  if(abs(n)>MAX||d>MAX) throw Error("LIMIT_EXCEEDED");
  return {n,d};
}
function parse(s: string): Rational {
  if(!/^[+-]?\d{1,15}(?:\.\d{1,5})?$/.test(s)) throw Error("INVALID_NUMBER");
  const sign=s.startsWith("-")?-1n:1n;
  const clean=s.replace(/^[+-]/,"");
  const [head,frac]=clean.split(".");
  return frac?make(sign*(BigInt(head)*10n**BigInt(frac.length)+BigInt(frac)),10n**BigInt(frac.length)):make(BigInt(s));
}
const add=(a:Rational,b:Rational)=>make(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a:Rational,b:Rational)=>make(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a:Rational,b:Rational)=>make(a.n*b.n,a.d*b.d);
const div=(a:Rational,b:Rational)=>make(a.n*b.d,a.d*b.n);
const fmt=(a:Rational)=>a.d===1n?String(a.n):a.n+"/"+a.d;
const unsupported=(reason:string): LabExactReference=>({supported:false,verified:false,reason});
function result(family: "linear"|"percentage"|"arithmetic", value: Rational, steps: string[]): LabExactReference {
  return {supported:true,verified:true,family,answer:fmt(value),steps};
}
export function referenceExactMath(input: string): LabExactReference {
  try {
    const q=input.trim().replace(/\u2212/g,"-");
    if(!q||q.length>1200) return unsupported("INPUT_UNSUPPORTED");
    // Do not silently ignore additional equations or constraints.
    const equalityCount=(q.match(/=/g)||[]).length;
    const linear=q.match(/([+-]?\d{1,12})\s*x\s*([+-]\s*\d{1,12})?\s*=\s*([+-]?\d{1,12})(?![\d])/i);
    const outputOnly=(tail:string)=>/^[\s.!?;,]*(?:y\s+explica\s+el\s+procedimiento[\s.!?;,]*)?$/i.test(tail);
    if(linear&&equalityCount===1&&outputOnly(q.slice(linear.index!+linear[0].length))&&(q.match(/\bx\b|(?<=\d)x/gi)||[]).length<=1) {
      const a=parse(linear[1]);const b=parse((linear[2]||"0").replace(/\s/g,""));const c=parse(linear[3]);
      if(a.n===0n) return unsupported("DEGENERATE_EQUATION");
      const x=div(sub(c,b),a);
      if(fmt(add(mul(a,x),b))!==fmt(c))throw Error("VERIFICATION_FAILED");
      return result("linear",x,[
        "Ecuación: "+fmt(a)+"x + ("+fmt(b)+") = "+fmt(c),
        "Restar el término constante: "+fmt(a)+"x = "+fmt(sub(c,b)),
        "Dividir por "+fmt(a)+": x = "+fmt(x),
        "Comprobación por sustitución exacta: "+fmt(add(mul(a,x),b))+" = "+fmt(c)
      ]);
    }
    if(equalityCount>0) return unsupported("COMPLEX_EQUATION");
    const pct=q.match(/(?:calcula\s+)?([+-]?\d{1,12}(?:\.\d{1,4})?)\s*%\s+de\s+([+-]?\d{1,12}(?:\.\d{1,4})?)/i);
    if(pct&&outputOnly(q.slice(pct.index!+pct[0].length))){
      const a=parse(pct[1]),b=parse(pct[2]),v=div(mul(a,b),make(100n));
      return result("percentage",v,[fmt(a)+" % de "+fmt(b)+" = "+fmt(a)+" × "+fmt(b)+" / 100 = "+fmt(v)]);
    }
    const arithmetic=q.match(/^\s*calcula\s+\(?([+-]?\d{1,12}(?:\.\d{1,5})?)\)?\s*([+*\/-]|por|entre)\s*\(?([+-]?\d{1,12}(?:\.\d{1,5})?)\)?\s*[.!?]?\s*$/i);
    if(arithmetic){
      const a=parse(arithmetic[1]),b=parse(arithmetic[3]),op=arithmetic[2].toLowerCase();
      const value=op==="+"?add(a,b):op==="-"?sub(a,b):op==="*"||op==="por"?mul(a,b):div(a,b);
      return result("arithmetic",value,[fmt(a)+" "+op+" "+fmt(b)+" = "+fmt(value)]);
    }
    return unsupported("NOT_RECOGNIZED");
  }catch(e){
    return unsupported(e instanceof Error?e.message:"ERROR");
  }
}
