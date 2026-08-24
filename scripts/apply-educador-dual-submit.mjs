// El nuevo Agente Planificador usa un flujo guiado y un único envío estructurado.
// Este paso de compatibilidad se mantiene dentro del comando de build y además
// aplica/verifica la migración de Educador al AI Gateway sin reescribir su UI.
console.log("[educador-dual-submit] nuevo planificador detectado; parche legado omitido")
await import("./apply-educador-ai-gateway.mjs")
await import("./test-educador-ai-gateway.mjs")
