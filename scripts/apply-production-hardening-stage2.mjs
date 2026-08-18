// Ordena las migraciones de Video Studio antes del hardening final.
// Premium Personal debe existir en el cliente antes de propagar imageAssetId.
await import("./apply-video-personal-marketplace.mjs")
await import("./apply-video-personal-recovery.mjs")
await import("./apply-production-hardening.mjs")
await import("./apply-image-private-assets.mjs")
await import("./test-image-private-assets.mjs")
await import("./test-user-access-function-security.mjs")
await import("./test-provider-health-events.mjs")
await import("./test-asset-import-ssrf.mjs")
await import("./test-notebook-remote-pdf-cap.mjs")
await import("./test-production-hardening.mjs")

console.log("[production-hardening-stage2] marketplace, recovery, private image assets, access, provider health, SSRF, Notebook remote PDF y gates verificados")
