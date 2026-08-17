// Ordena las migraciones de Video Studio antes del hardening final.
// Premium Personal debe existir en el cliente antes de propagar imageAssetId.
await import("./apply-video-personal-marketplace.mjs")
await import("./apply-video-personal-recovery.mjs")
await import("./apply-production-hardening.mjs")
await import("./test-user-access-function-security.mjs")

console.log("[production-hardening-stage2] marketplace, recovery, hardening y seguridad de acceso verificados")
