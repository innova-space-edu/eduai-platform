import { existsSync, readFileSync, writeFileSync } from "node:fs"

const CLIENT = "app/nube-publica/[token]/public-cloud-client.tsx"
const MARKER = "PUBLIC_CLOUD_DIRECT_UPLOAD_V1"

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`[public-cloud-upload] No se encontró ${label}`)
  return source.replace(from, to)
}

if (!existsSync(CLIENT)) throw new Error(`[public-cloud-upload] No existe ${CLIENT}`)

let source = readFileSync(CLIENT, "utf8")

if (!source.includes(MARKER)) {
  source = replaceRequired(
    source,
    `  MAX_REPOSITORY_FILE_SIZE,
  SUBJECT_SUGGESTIONS,`,
    `  MAX_REPOSITORY_FILE_SIZE,
  REPOSITORY_BUCKET,
  SUBJECT_SUGGESTIONS,`,
    "constante del bucket",
  )

  source = replaceRequired(
    source,
    `} from "@/lib/repository/catalog"

type PublicListItem`,
    `} from "@/lib/repository/catalog"
import { createClient } from "@/lib/supabase/client"

type PublicListItem`,
    "cliente Supabase",
  )

  source = replaceRequired(
    source,
    `export default function PublicCloudClient({ token }: { token: string }) {
  const endpoint`,
    `export default function PublicCloudClient({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), [])
  const endpoint`,
    "instancia Supabase",
  )

  source = replaceRequired(
    source,
    `  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    setUploadError("")
    if (!file) return setUploadError("Selecciona un archivo.")
    if (file.size > MAX_REPOSITORY_FILE_SIZE) return setUploadError("El archivo supera el máximo de 100 MB.")

    setUploading(true)
    const payload = new FormData()
    payload.set("file", file)
    payload.set("title", form.title)
    payload.set("subject", form.subject)
    payload.set("educationalLevel", form.educationalLevel)
    payload.set("year", form.year)
    payload.set("materialType", form.materialType)
    payload.set("questionCount", form.questionCount)

    try {
      const response = await fetch(endpoint, { method: "POST", body: payload })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "No fue posible subir el material.")
      const created = data.item as PublicListItem
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
      setUploadOpen(false)
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "No fue posible subir el material.")
    } finally {
      setUploading(false)
    }
  }`,
    `  const submitUpload = async (event: FormEvent) => {
    event.preventDefault()
    setUploadError("")
    if (!file) return setUploadError("Selecciona un archivo.")
    if (file.size > MAX_REPOSITORY_FILE_SIZE) return setUploadError("El archivo supera el máximo de 100 MB.")

    setUploading(true)
    let storagePath = ""
    try {
      const prepareResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          year: form.year,
        }),
      })
      const prepared = await prepareResponse.json().catch(() => null)
      if (!prepareResponse.ok) throw new Error(prepared?.error || "No fue posible preparar la carga.")

      storagePath = prepared.storagePath
      const { error: uploadError } = await supabase.storage
        .from(REPOSITORY_BUCKET)
        .uploadToSignedUrl(storagePath, prepared.uploadToken, file, {
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        })
      if (uploadError) throw uploadError

      const finalizeResponse = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          title: form.title,
          subject: form.subject,
          educationalLevel: form.educationalLevel,
          year: form.year,
          materialType: form.materialType,
          questionCount: form.questionCount,
        }),
      })
      const finalized = await finalizeResponse.json().catch(() => null)
      if (!finalizeResponse.ok) throw new Error(finalized?.error || "No fue posible registrar el material.")

      const created = finalized.item as PublicListItem
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setSelectedId(created.id)
      setUploadOpen(false)
    } catch (caught) {
      if (storagePath) {
        void fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        }).catch(() => undefined)
      }
      setUploadError(caught instanceof Error ? caught.message : "No fue posible subir el material.")
    } finally {
      setUploading(false)
    }
  }

  // ${MARKER}`,
    "carga directa firmada",
  )

  writeFileSync(CLIENT, source)
}

const verified = readFileSync(CLIENT, "utf8")
for (const required of [
  MARKER,
  "createClient",
  "REPOSITORY_BUCKET",
  "uploadToSignedUrl",
  'method: "PUT"',
  'method: "DELETE"',
]) {
  if (!verified.includes(required)) throw new Error(`[public-cloud-upload] Falta ${required}`)
}

console.log("[public-cloud-upload] archivos públicos cargados directamente a Supabase")
