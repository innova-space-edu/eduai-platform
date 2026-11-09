// Exact arithmetic kernel for EDUAI. No eval(), Function(), or untrusted CAS parsing.
// The recognizer intentionally rejects ambiguous natural-language problems.
export type ExactResult = {
  supported: boolean;
  verified: boolean;
  operation?: string;
  answer?: string;
  steps?: string[];
  reason?: string;
  engine?: "rational-typescript" | "sympy";
};
export type ExactInput = { question?: string; operation?: string; [key: string]: unknown };

const LIMIT = 1000000000000000000000000n;
function bounded(n: bigint): bigint {
  if (n > LIMIT || n < -LIMIT) throw new Error("NUMBER_TOO_LARGE");
  return n;
}
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1n;
}
class Q {
  readonly n: bigint; readonly d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error("DIVISION_BY_ZERO");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = bounded(n / g); this.d = bounded(d / g);
  }
  add(x: Q) { return new Q(this.n * x.d + x.n * this.d, this.d * x.d); }
  sub(x: Q) { return new Q(this.n * x.d - x.n * this.d, this.d * x.d); }
  mul(x: Q) { return new Q(this.n * x.n, this.d * x.d); }
  div(x: Q) { return new Q(this.n * x.d, this.d * x.n); }
  abs() { return new Q(this.n < 0n ? -this.n : this.n, this.d); }
  toString() { return this.d === 1n ? String(this.n) : String(this.n) + "/" + String(this.d); }
}
const ZERO = new Q(0n), ONE = new Q(1n);
function q(raw: unknown): Q {
  if (typeof raw !== "string" && typeof raw !== "number") throw new Error("INVALID_NUMBER");
  const s = String(raw).trim().replace(/\u2212/g, "-");
  if (s.length > 60 || !/^[+-]?\d+(?:\.\d{1,8})?(?:\/[+-]?\d{1,18})?$/.test(s)) throw new Error("INVALID_RATIONAL");
  if (s.includes("/")) {
    const [a, b] = s.split("/");
    if (a.includes(".")) throw new Error("INVALID_RATIONAL");
    return new Q(BigInt(a), BigInt(b));
  }
  if (s.includes(".")) {
    const [whole, decimal] = s.split(".");
    const sign = whole.startsWith("-") ? -1n : 1n;
    return new Q(BigInt(whole) * (10n ** BigInt(decimal.length)) + sign * BigInt(decimal), 10n ** BigInt(decimal.length));
  }
  return new Q(BigInt(s));
}
function integer(raw: unknown, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error("OUT_OF_RANGE");
  return n;
}
function success(operation: string, answer: Q | string, steps: string[]): ExactResult {
  return { supported: true, verified: true, operation, answer: String(answer), steps, engine: "rational-typescript" };
}
function fail(reason: string): ExactResult {
  return { supported: false, verified: false, reason };
}
function mod(a: bigint, m: bigint): bigint { return ((a % m) + m) % m; }
function structured(input: ExactInput): ExactResult {
  const op = String(input.operation || "");
  if (op === "arithmetic") {
    const a = q(input.a), b = q(input.b);
    const operator = String(input.operator || "");
    const v = operator === "+" ? a.add(b) : operator === "-" ? a.sub(b)
      : operator === "*" ? a.mul(b) : operator === "/" ? a.div(b) : null;
    if (!v) return fail("UNSUPPORTED_OPERATOR");
    return success(op, v, [a + " " + operator + " " + b + " = " + v]);
  }
  if (op === "percentage") {
    const p = q(input.percent), amount = q(input.amount);
    const v = p.mul(amount).div(new Q(100n));
    return success(op, v, [String(p) + "% de " + amount + " = (" + p + " * " + amount + ")/100 = " + v]);
  }
  if (op === "linear") {
    const a = q(input.a), b = q(input.b), c = q(input.c);
    if (a.n === 0n) return fail(b.n * c.d === c.n * b.d ? "INFINITE_SOLUTIONS" : "NO_SOLUTION");
    const x = c.sub(b).div(a);
    if (a.mul(x).add(b).sub(c).n !== 0n) throw new Error("VERIFICATION_FAILED");
    return success(op, x, ["a*x + b = c", "x = (c - b)/a = (" + c + " - (" + b + "))/(" + a + ")", "Comprobación: " + a + "*(" + x + ") + (" + b + ") = " + c]);
  }
  if (op === "system2") {
    const a=q(input.a), b=q(input.b), c=q(input.c), d=q(input.d), e=q(input.e), f=q(input.f);
    const det=a.mul(e).sub(b.mul(d));
    if (det.n === 0n) return fail("SINGULAR_SYSTEM");
    const x=c.mul(e).sub(b.mul(f)).div(det);
    const y=a.mul(f).sub(c.mul(d)).div(det);
    if (a.mul(x).add(b.mul(y)).sub(c).n !== 0n || d.mul(x).add(e.mul(y)).sub(f).n !== 0n) throw new Error("VERIFICATION_FAILED");
    return success(op, "x=" + x + ", y=" + y, ["Determinante = " + det, "x = " + x + "; y = " + y, "Ambas ecuaciones verificadas por sustitución exacta"]);
  }
  if (op === "recurrence") {
    const s0=q(input.s0), a=q(input.a), b=q(input.b);
    const m=integer(input.modulus, 2, 1000000), n=integer(input.steps, 0, 32);
    if (s0.d !== 1n || a.d !== 1n || b.d !== 1n) return fail("INTEGER_ONLY");
    let s=mod(s0.n,BigInt(m));
    const steps=["s0 = " + s0 + "; módulo = " + m];
    for(let i=1;i<=n;i++){s=mod(a.n*s+b.n,BigInt(m));steps.push("s" + i + " = (" + a + "*s" + (i-1) + " + " + b + ") mod " + m + " = " + s);}
    return success(op, String(s), steps);
  }
  if (op === "euler_decay") {
    const x0=q(input.x0), k=q(input.k), dt=q(input.dt), n=integer(input.steps, 0, 16);
    const factor=ONE.sub(k.mul(dt));
    let x=x0;
    const steps=["dx/dt = -k*x; Euler: x(n+1) = x(n)*(1-k*dt)", "1-k*dt = " + factor, "x0 = " + x];
    for(let i=1;i<=n;i++){x=x.mul(factor);steps.push("x" + i + " = " + x);}
    return success(op, x, steps);
  }
  if (op === "euler_stability") {
    const factor=ONE.sub(q(input.k).mul(q(input.dt)));
    return success(op, factor.abs().n < factor.abs().d ? "estable" : "inestable",
      ["Factor = 1 - k*dt = " + factor, "Asintóticamente estable solamente si |factor| < 1"]);
  }
  return fail("UNSUPPORTED_OPERATION");
}
function recognized(question: string): ExactInput | null {
  const s=question.replace(/\u2212/g,"-").replace(/\s+/g," ").trim();
  let m: RegExpMatchArray | null;
  m=s.match(/^(?:calcula(?: el)?\s+)?([+-]?\d+)% de ([+-]?\d+)(?:\b|[.!?])/i);
  if(m) return {operation:"percentage",percent:m[1],amount:m[2]};
  m=s.match(/^(?:resuelve(?: sistema)?\s+)([+-]?\d+)x\+\(([+-]?\d+)\)y=([+-]?\d+);\s*([+-]?\d+)x\+\(([+-]?\d+)\)y=([+-]?\d+)/i);
  if(m) return {operation:"system2",a:m[1],b:m[2],c:m[3],d:m[4],e:m[5],f:m[6]};
  m=s.match(/^resuelve\s+([+-]?\d+)\(x\+\(([+-]?\d+)\)\)=([+-]?\d+)/i);
  if(m) return {operation:"linear",a:m[1],b:q(m[1]).mul(q(m[2])).toString(),c:m[3]};
  m=s.match(/^resuelve\s+([+-]?\d+)x\+\(([+-]?\d+)\)=([+-]?\d+)/i);
  if(m) return {operation:"linear",a:m[1],b:m[2],c:m[3]};
  m=s.match(/s0=([+-]?\d+)[;,]?\s*s\(t\+1\)=\(([+-]?\d+)\*s\(t\)\+([+-]?\d+)\) mod (\d+).*?calcula s(\d+)/i);
  if(m) return {operation:"recurrence",s0:m[1],a:m[2],b:m[3],modulus:m[4],steps:m[5]};
  m=s.match(/(?:euler|Euler)[^.;\n]*?dx\/dt=-([0-9]+)x[^.;\n]*?x0=([+-]?\d+),?\s*dt=([0-9]+(?:\/\d+)?).*?calcula x(\d+)/i);
  if(m) return {operation:"euler_decay",k:m[1],x0:m[2],dt:m[3],steps:m[4]};
  m=s.match(/(?:euler|Euler)[^.;\n]*?dx\/dt=-([0-9]+)x[^.;\n]*?dt=([0-9]+(?:\/\d+)?).*?estable/i);
  if(m) return {operation:"euler_stability",k:m[1],dt:m[2]};
  m=s.match(/^calcula\s+([+-]?\d+(?:\/\d+)?)\s*(?:por|\*|x)\s*\(?([+-]?\d+(?:\/\d+)?)\)?[.!]?$/i);
  if(m) return {operation:"arithmetic",a:m[1],b:m[2],operator:"*"};
  m=s.match(/^calcula\s+\(?([+-]?\d+(?:\/\d+)?)\)?\s*([+*/-])\s*\(?([+-]?\d+(?:\/\d+)?)\)?[.!]?$/i);
  if(m) return {operation:"arithmetic",a:m[1],b:m[3],operator:m[2]};
  return null;
}
export function solveExactMath(input: ExactInput): ExactResult {
  try {
    if(!input || typeof input!=="object") return fail("INVALID_INPUT");
    if(typeof input.question==="string"){
      if(input.question.length>500) return fail("QUESTION_TOO_LONG");
      const parsed=recognized(input.question);
      return parsed?structured(parsed):fail("NOT_RECOGNIZED");
    }
    return structured(input);
  } catch(e) {
    return fail(e instanceof Error ? e.message : "MATH_ENGINE_ERROR");
  }
}
export function formatExactMath(result: ExactResult): string {
  if(!result.verified || !result.answer) return "No se pudo verificar matemáticamente este problema.";
  return "## Resultado exacto\n\n**" + result.answer + "**\n\n## Procedimiento verificado\n\n" +
    (result.steps||[]).map((s,i)=>String(i+1)+". "+s).join("\n") +
    "\n\n*Cálculo determinista; precisión racional exacta para esta familia de problemas.*";
}
