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

export class GoogleFileSearchHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "GoogleFileSearchHttpError"
    this.status = status
  }
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
    throw new GoogleFileSearchHttpError(
      `Google File Search no pudo borrar el recurso (${response.status}): ${body.slice(0, 500)}`,
      response.status,
    )
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

export type GoogleFileSearchRemoteDocument = {
  name: string
  displayName: string
  state: string
  customMetadata: Record<string, string | number | string[]>
  createTime: string | null
  updateTime: string | null
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

function normalizeMetadata(value: unknown) {
  const result: Record<string, string | number | string[]> = {}
  if (!Array.isArray(value)) return result
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, any>
    const key = typeof row.key === "string" ? row.key : ""
    if (!key) continue
    if (typeof row.stringValue === "string") result[key] = row.stringValue
    else if (typeof row.numericValue === "number") result[key] = row.numericValue
    else if (Array.isArray(row.stringListValue?.values)) {
      result[key] = row.stringListValue.values.map((entry: unknown) => String(entry))
    }
  }
  return result
}

function normalizeRemoteDocument(value: any): GoogleFileSearchRemoteDocument | null {
  const name = String(value?.name || "")
  if (!DOCUMENT_RESOURCE.test(name)) return null
  return {
    name,
    displayName: String(value?.displayName || name),
    state: String(value?.state || "STATE_UNSPECIFIED"),
    customMetadata: normalizeMetadata(value?.customMetadata),
    createTime: typeof value?.createTime === "string" ? value.createTime : null,
    updateTime: typeof value?.updateTime === "string" ? value.updateTime : null,
  }
}

export async function listGoogleFileSearchDocuments(storeName: string) {
  if (!STORE_RESOURCE.test(storeName)) throw new Error("File Search Store inválido")
  const documents: GoogleFileSearchRemoteDocument[] = []
  const pager = await client().fileSearchStores.documents.list({ parent: storeName })
  for await (const raw of pager) {
    const document = normalizeRemoteDocument(raw)
    if (document) documents.push(document)
    if (documents.length > 5_000) throw new Error("Google File Search excedió el límite de documentos de seguridad")
  }
  return documents
}

function remoteDocumentPriority(document: GoogleFileSearchRemoteDocument) {
  if (document.state === "STATE_ACTIVE") return 3
  if (document.state === "STATE_PENDING") return 2
  if (document.state === "STATE_FAILED") return 1
  return 0
}

function remoteDocumentTime(document: GoogleFileSearchRemoteDocument) {
  const parsed = Date.parse(document.updateTime || document.createTime || "")
  return Number.isFinite(parsed) ? parsed : 0
}

export async function findGoogleFileSearchDocument(input: {
  storeName: string
  sourceId: string
  contentHash?: string | null
}) {
  const documents = await listGoogleFileSearchDocuments(input.storeName)
  const matches = documents.filter((document) => {
    if (document.customMetadata.eduai_source_id !== input.sourceId) return false
    if (input.contentHash && document.customMetadata.eduai_content_hash !== input.contentHash) return false
    return true
  })
  matches.sort((a, b) => {
    const priority = remoteDocumentPriority(b) - remoteDocumentPriority(a)
    return priority || remoteDocumentTime(b) - remoteDocumentTime(a) || b.name.localeCompare(a.name)
  })
  return matches[0] || null
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
    throw new GoogleFileSearchHttpError(
      `Google File Search operation respondió HTTP ${response.status}`,
      response.status,
    )
  }
  return normalizeOperation(body)
}
