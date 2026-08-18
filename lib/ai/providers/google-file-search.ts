import { GoogleGenAI } from "@google/genai"

const DEFAULT_EMBEDDING_MODEL = "models/gemini-embedding-2"
const OPERATION_PREFIX = /^fileSearchStores\/[a-z0-9-]+\/upload\/operations\/[a-zA-Z0-9._-]+$/
const STORE_RESOURCE = /^fileSearchStores\/[a-z0-9-]+$/
const DOCUMENT_RESOURCE = /^fileSearchStores\/[a-z0-9-]+\/documents\/[a-z0-9-]+$/

function apiKey() {
  const value = process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!value) throw new Error("Gemini API no está configurada para File Search")
  return value
}

function client() {
  return new GoogleGenAI({ apiKey: apiKey() })
}

export function hasGoogleFileSearch() {
  return Boolean(process.env.GEMINI_API_KEY_TEXT || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
}

export function googleFileSearchEmbeddingModel() {
  const configured = process.env.GOOGLE_FILE_SEARCH_EMBEDDING_MODEL?.trim()
  return configured?.startsWith("models/") ? configured : DEFAULT_EMBEDDING_MODEL
}

export async function createGoogleFileSearchStore(displayName: string) {
  const store = await client().fileSearchStores.create({
    config: {
      displayName: displayName.slice(0, 512),
      embeddingModel: googleFileSearchEmbeddingModel(),
    },
  })
  if (!store.name || !STORE_RESOURCE.test(store.name)) throw new Error("Google File Search no devolvió un store válido")
  return {
    name: store.name,
    displayName: store.displayName || displayName,
    embeddingModel: store.embeddingModel || googleFileSearchEmbeddingModel(),
  }
}

async function deleteResource(resourceName: string) {
  const valid = STORE_RESOURCE.test(resourceName) || DOCUMENT_RESOURCE.test(resourceName)
  if (!valid) throw new Error("Recurso File Search inválido")
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${resourceName}?key=${encodeURIComponent(apiKey())}&force=true`,
    { method: "DELETE", signal: AbortSignal.timeout(30_000), cache: "no-store" },
  )
  if (response.status === 404) return
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Google File Search no pudo borrar el recurso (${response.status}): ${body.slice(0, 500)}`)
  }
}

export async function deleteGoogleFileSearchStore(storeName: string) {
  await deleteResource(storeName)
}

export async function deleteGoogleFileSearchDocument(documentName: string) {
  await deleteResource(documentName)
}

export type GoogleFileSearchOperation = {
  name: string
  done: boolean
  error: Record<string, unknown> | null
  documentName: string | null
  raw: Record<string, unknown>
}

function normalizeOperation(operation: any): GoogleFileSearchOperation {
  const name = String(operation?.name || "")
  if (!name || !OPERATION_PREFIX.test(name)) throw new Error("Google File Search no devolvió una operación válida")
  const response = operation?.response && typeof operation.response === "object" ? operation.response : null
  return {
    name,
    done: operation?.done === true,
    error: operation?.error && typeof operation.error === "object" ? operation.error : null,
    documentName: typeof response?.documentName === "string" ? response.documentName : null,
    raw: operation && typeof operation === "object" ? operation as Record<string, unknown> : {},
  }
}

export async function startGoogleFileSearchUpload(input: {
  storeName: string
  sourceId: string
  notebookId: string
  contentHash: string
  displayName: string
  text: string
}) {
  if (!STORE_RESOURCE.test(input.storeName)) throw new Error("File Search Store inválido")
  const blob = new Blob([input.text], { type: "text/plain" })
  const operation = await client().fileSearchStores.uploadToFileSearchStore({
    file: blob,
    fileSearchStoreName: input.storeName,
    config: {
      displayName: input.displayName.slice(0, 512),
      mimeType: "text/plain",
      customMetadata: [
        { key: "eduai_source_id", stringValue: input.sourceId },
        { key: "eduai_notebook_id", stringValue: input.notebookId },
        { key: "eduai_content_hash", stringValue: input.contentHash },
      ],
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 800,
          maxOverlapTokens: 120,
        },
      },
    },
  })
  return normalizeOperation(operation)
}

export async function getGoogleFileSearchOperation(operationName: string) {
  if (!OPERATION_PREFIX.test(operationName)) throw new Error("Operación File Search inválida")
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${encodeURIComponent(apiKey())}`,
    { signal: AbortSignal.timeout(20_000), cache: "no-store" },
  )
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Google File Search operation respondió HTTP ${response.status}`)
  }
  return normalizeOperation(body)
}
