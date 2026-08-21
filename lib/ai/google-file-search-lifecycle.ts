import { createClient as createAdminClient } from "@supabase/supabase-js"
import {
  deleteGoogleFileSearchDocument,
  deleteGoogleFileSearchStore,
  findGoogleFileSearchDocument,
  getGoogleFileSearchOperation,
  GoogleFileSearchHttpError,
} from "@/lib/ai/providers/google-file-search"

const ORPHAN_GRACE_MS = 60 * 60 * 1000

type MappingRow = {
  id: string
  status: string
  document_name: string | null
  operation_name: string | null
  content_hash: string
  store_id: string
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown> | null
  error_message?: string | null
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export class GoogleFileSearchBusyError extends Error {
  status = 409
  constructor(message: string) {
    super(message)
    this.name = "GoogleFileSearchBusyError"
  }
}

function operationErrorMessage(error: Record<string, unknown> | null) {
  if (!error) return null
  try { return JSON.stringify(error).slice(0, 1200) } catch { return "Google File Search falló" }
}

async function updateMapping(mapping: MappingRow, updates: Record<string, unknown>) {
  const admin = adminClient()
  const { data, error } = await admin
    .from("eduai_google_file_search_documents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", mapping.id)
    .select("*")
    .single()
  if (error) throw new Error(`No se pudo reconciliar File Search: ${error.message}`)
  return data as MappingRow
}

export async function reconcileGoogleFileSearchSource(input: { ownerId: string; notebookId: string; sourceId: string }) {
  const admin = adminClient()
  const { data: rawMapping, error } = await admin
    .from("eduai_google_file_search_documents")
    .select("id,status,document_name,operation_name,content_hash,store_id,created_at,updated_at,metadata,error_message")
    .eq("owner_id", input.ownerId)
    .eq("notebook_id", input.notebookId)
    .eq("source_id", input.sourceId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo revisar File Search: ${error.message}`)
  if (!rawMapping) return null
  let mapping = rawMapping as MappingRow
  if (mapping.document_name) return mapping

  const { data: store, error: storeError } = await admin
    .from("eduai_google_file_search_stores")
    .select("store_name")
    .eq("id", mapping.store_id)
    .eq("owner_id", input.ownerId)
    .eq("notebook_id", input.notebookId)
    .maybeSingle()
  if (storeError) throw new Error(`No se pudo revisar File Search Store: ${storeError.message}`)
  if (!store?.store_name) return mapping

  let operationMissing = false
  let operationRunning = false
  let terminalError: string | null = null

  if (mapping.operation_name) {
    try {
      const operation = await getGoogleFileSearchOperation(mapping.operation_name)
      if (!operation.done) {
        operationRunning = true
      } else if (operation.documentName) {
        return updateMapping(mapping, {
          status: "ready",
          document_name: operation.documentName,
          error_message: null,
          indexed_at: new Date().toISOString(),
          metadata: { ...(mapping.metadata || {}), reconciled_from_operation: true },
        })
      } else {
        terminalError = operationErrorMessage(operation.error) || "Google File Search terminó sin documentName"
      }
    } catch (caught) {
      if (caught instanceof GoogleFileSearchHttpError && caught.status === 404) operationMissing = true
      else throw caught
    }
  }

  const remote = await findGoogleFileSearchDocument({
    storeName: String(store.store_name),
    sourceId: input.sourceId,
    contentHash: mapping.content_hash,
  })

  if (remote) {
    if (remote.state === "STATE_ACTIVE") {
      return updateMapping(mapping, {
        status: "ready",
        document_name: remote.name,
        error_message: null,
        indexed_at: new Date().toISOString(),
        metadata: { ...(mapping.metadata || {}), reconciled_from_store: true, remote_state: remote.state },
      })
    }
    if (remote.state === "STATE_FAILED") {
      return updateMapping(mapping, {
        status: "failed",
        document_name: remote.name,
        error_message: terminalError || "Google File Search reportó STATE_FAILED",
        metadata: { ...(mapping.metadata || {}), reconciled_from_store: true, remote_state: remote.state },
      })
    }
    return updateMapping(mapping, {
      status: "indexing",
      document_name: remote.name,
      metadata: { ...(mapping.metadata || {}), reconciled_from_store: true, remote_state: remote.state },
    })
  }

  if (terminalError) {
    return updateMapping(mapping, {
      status: "failed",
      error_message: terminalError,
      metadata: { ...(mapping.metadata || {}), reconciled_terminal_without_document: true },
    })
  }

  if (operationRunning) return mapping

  const timestamp = Date.parse(mapping.created_at || mapping.updated_at)
  const oldEnough = Number.isFinite(timestamp) && Date.now() - timestamp >= ORPHAN_GRACE_MS
  if ((operationMissing || !mapping.operation_name) && oldEnough) {
    return updateMapping(mapping, {
      status: "failed",
      error_message: operationMissing
        ? "La operación File Search ya no existe y no se encontró documento remoto"
        : "La indexación no registró operación ni documento remoto",
      metadata: { ...(mapping.metadata || {}), reconciled_orphan: true },
    })
  }

  return mapping
}

export async function cleanupGoogleFileSearchSource(input: { ownerId: string; notebookId: string; sourceId: string }) {
  const admin = adminClient()
  let mapping = await reconcileGoogleFileSearchSource(input)
  if (!mapping) return

  if (["queued", "indexing", "deleting"].includes(String(mapping.status)) && !mapping.document_name) {
    throw new GoogleFileSearchBusyError("La fuente todavía se está indexando en Google File Search. Reintenta la eliminación cuando termine.")
  }

  if (mapping.document_name) {
    mapping = await updateMapping(mapping, { status: "deleting" })
    await deleteGoogleFileSearchDocument(String(mapping.document_name))
  }

  const { error: deleteError } = await admin
    .from("eduai_google_file_search_documents")
    .delete()
    .eq("id", mapping.id)
    .eq("owner_id", input.ownerId)
  if (deleteError) throw new Error(`No se pudo limpiar la referencia File Search: ${deleteError.message}`)
}

export async function cleanupGoogleFileSearchNotebook(input: { ownerId: string; notebookId: string }) {
  const admin = adminClient()
  const { data: store, error } = await admin
    .from("eduai_google_file_search_stores")
    .select("id,store_name")
    .eq("owner_id", input.ownerId)
    .eq("notebook_id", input.notebookId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo revisar el File Search Store: ${error.message}`)
  if (!store) return

  await admin.from("eduai_google_file_search_stores").update({ status: "deleting", updated_at: new Date().toISOString() }).eq("id", store.id)
  await deleteGoogleFileSearchStore(String(store.store_name))

  const { error: deleteError } = await admin
    .from("eduai_google_file_search_stores")
    .delete()
    .eq("id", store.id)
    .eq("owner_id", input.ownerId)
  if (deleteError) throw new Error(`No se pudo limpiar el File Search Store local: ${deleteError.message}`)
}
