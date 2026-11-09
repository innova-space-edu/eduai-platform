import { readFileSync } from "node:fs"

const CLIENT = "app/nube-publica/[token]/public-cloud-client.tsx"
const MARKER = "PUBLIC_CLOUD_DIRECT_UPLOAD_V1"

const verified = readFileSync(CLIENT, "utf8")
for (const required of [
  MARKER,
  "createClient",
  "REPOSITORY_BUCKET",
  "uploadToSignedUrl",
  'method: "PUT"',
  'Enviar a revisión',
]) {
  if (!verified.includes(required)) throw new Error(`[public-cloud-upload] Falta ${required}`)
}

console.log("[public-cloud-upload] archivos públicos cargados directamente a Supabase")
