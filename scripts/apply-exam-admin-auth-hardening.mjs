// Compatibility shim: keep one entrypoint for exam security in predev/stage2.
// The canonical teacher auth implementation remains exam-server-auth-gateway;
// development artifacts add their own attempt/ownership hardening here without
// duplicating the teacher action allowlist.
await import("./apply-exam-server-auth-gateway.mjs")
await import("./apply-exam-development-security.mjs")

console.log("[exam-admin-auth] canonical teacher auth + development artifact security applied")
