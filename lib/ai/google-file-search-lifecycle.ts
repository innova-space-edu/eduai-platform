import { createClient as createAdminClient } from "@supabase/supabase-js"
import { deleteGoogleFileSearchDocument, deleteGoogleFileSearchStore } from "@/lib/ai/providers/google-file-search"

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

export async function cleanupGoogleFileSearchSource(input: { ownerId: string; notebookId: string; sourceId: string }) {
  const admin = adminClient()
  const { data: mapping, error } = await admin
    .from("eduai_google_file_search_documents")
    .select("id,status,document_name")
    .eq("owner_id", input.ownerId)
    .eq("notebook_id", input.notebookId)
    .eq("source_id", input.sourceId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo revisar File Search: ${error.message}`)
  if (!mapping) return

  if (["queued", "indexing", "deleting"].includes(String(mapping.status)) && !mapping.document_name) {
    throw new GoogleFileSearchBusyError("La fuente todavía se está indexando en Google File Search. Reintenta la eliminación cuando termine.")
  }

  if (mapping.document_name) {
    await admin.from("eduai_google_file_search_documents").update({ status: "deleting", updated_at: new Date().toISOString() }).eq("id", mapping.id)
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
