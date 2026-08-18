// Compatibility shim: the canonical implementation lives in exam-server-auth-gateway.
// Keep this entrypoint because predev/stage2 already invoke it, but never maintain a
// second auth implementation here.
await import("./apply-exam-server-auth-gateway.mjs")

console.log("[exam-admin-auth] delegated to canonical exam-server-auth gateway")
