import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { assertAICapabilityAllowed } from "@/lib/ai/access-policy"
import {
  createGoogleFileSearchStore,
  deleteGoogleFileSearchStore,
  getGoogleFileSearchOperation,
  googleFileSearchEmbeddingModel,
  hasGoogleFileSearch,
  startGoogleFileSearchUpload,
  type GoogleFileSearchOperation,
} from "@/lib/ai/providers/google-file-search"
import { cleanupGoogleFileSearchSource } from "@/lib/ai/google-file-search-lifecycle"

export const runtime = "nodejs"
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

type StoreRow = {
  id: string
  owner_id: string
  notebook_id: string
  store_name: string
  display_name: string
  embedding_model: string
  status: string
}

type DocumentRow = {
  id: string
  owner_id: string
  notebook_id: string
  source_id: string
  store_id: string
  content_hash: string
  document_name: string | null
  operation_name: string | null
  display_name: string
  status: string
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  indexed_at: string | null
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server credentials no configuradas")
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function ownedNotebook(supabase: Awaited<ReturnType<typeof createClient>>, notebookId: string, userId: string) {
  const { data } = await supabase
    .from("notebooks")
    .select("id,title")
    .eq("id", notebookId)
    .eq("user_id", userId)
    .maybeSingle()
  return data
}

async function ensureStore(input: { ownerId: string; notebookId: string; notebookTitle: string }) {
  const admin = adminClient()
  const existing = await admin
    .from("eduai_google_file_search_stores")
    .select("id,owner_id,notebook_id,store_name,display_name,embedding_model,status")
    .eq("owner_id", input.ownerId)
    .eq("notebook_id", input.notebookId)
    .maybeSingle()
  if (existing.error) throw new Error(`No se pudo consultar File Search: ${existing.error.message}`)
  if (existing.data) return existing.data as StoreRow

  const created = await createGoogleFileSearchStore(`EduAI · ${input.notebookTitle || "Notebook"}`)
  const inserted = await admin
    .from("eduai_google_file_search_stores")
    .insert({
      owner_id: input.ownerId,
      notebook_id: input.notebookId,
      store_name: created.name,
      display_name: created.displayName,
      embedding_model: created.embeddingModel,
      status: "active",
      metadata: { provider: "google", created_by: "eduai-file-search" },
    })
    .select("id,owner_id,notebook_id,store_name,display_name,embedding_model,status")
    .single()
  if (!inserted.error && inserted.data) return inserted.data as StoreRow

  const race = await admin
    .from("eduai_google_file_search_stores")
    .select("id,owner_id,notebook_id,store_name,display_name,embedding_model,status")
    .eq("owner_id", input.ownerId)
    .eq("notebook_id", input.notebookId)
    .maybeSingle()
  await deleteGoogleFileSearchStore(created.name).catch(() => undefined)
  if (race.data) return race.data as StoreRow
  throw new Error(`No se pudo registrar File Search: ${inserted.error?.message || "sin store"}`)
}

function operationError(operation: GoogleFileSearchOperation) {
  if (!operation.error) return null
  try { return JSON.stringify(operation.error).slice(0, 1200) } catch { return "Google File Search falló" }
}

async function applyOperationResult(mapping: DocumentRow, operation: GoogleFileSearchOperation) {
  const admin = adminClient()
  if (!operation.done) return mapping

  const now = new Date().toISOString()
  const errorMessage = operationError(operation)
  if (errorMessage) {
    const { data } = await admin
      .from("eduai_google_file_search_documents")
      .update({ status: "failed", error_message: errorMessage, updated_at: now, metadata: { ...(mapping.metadata || {}), operation_done: true } })
      .eq("id", mapping.id)
      .select("*")
      .single()
    return (data || { ...mapping, status: "failed", error_message: errorMessage }) as DocumentRow
  }

  if (!operation.documentName) {
    const terminalError = "Google File Search completó la indexación sin devolver documentName"
    const { data } = await admin
      .from("eduai_google_file_search_documents")
      .update({
        status: "failed",
        error_message: terminalError,
        updated_at: now,
        metadata: { ...(mapping.metadata || {}), operation_done: true, invalid_terminal_response: true },
      })
      .eq("id", mapping.id)
      .select("*")
      .single()
    return (data || { ...mapping, status: "failed", error_message: terminalError }) as DocumentRow
  }

  const { data } = await admin
    .from("eduai_google_file_search_documents")
    .update({
      status: "ready",
      document_name: operation.documentName,
      error_message: null,
      updated_at: now,
      indexed_at: now,
      metadata: { ...(mapping.metadata || {}), operation_done: true },
    })
    .eq("id", mapping.id)
    .select("*")
    .single()
  return (data || { ...mapping, status: "ready", document_name: operation.documentName, indexed_at: now }) as DocumentRow
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: notebookId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    await assertAICapabilityAllowed({ supabase, userId: user.id, capability: "retrieval", provider: "google" })
    if (!hasGoogleFileSearch()) return NextResponse.json({ error: "Google File Search no está configurado" }, { status: 503 })

    const notebook = await ownedNotebook(supabase, notebookId, user.id)
    if (!notebook) return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    const sourceId = String(body?.sourceId || "").trim()
    if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })

    const { data: source } = await supabase
      .from("notebook_sources")
      .select("id,title,type,content_hash,extracted_text,raw_text,status,is_active")
      .eq("id", sourceId)
      .eq("notebook_id", notebookId)
      .eq("status", "ready")
      .eq("is_active", true)
      .maybeSingle()
    if (!source) return NextResponse.json({ error: "Fuente no disponible para indexar" }, { status: 404 })

    const text = String(source.extracted_text || source.raw_text || "").trim()
    if (text.length < 40) return NextResponse.json({ error: "La fuente no tiene suficiente texto extraído" }, { status: 422 })
    const contentHash = String(source.content_hash || "").trim() || createHash("sha256").update(text).digest("hex")
    const admin = adminClient()
    if (!source.content_hash) {
      await admin.from("notebook_sources").update({ content_hash: contentHash }).eq("id", sourceId).eq("notebook_id", notebookId)
    }

    const existing = await admin
      .from("eduai_google_file_search_documents")
      .select("*")
      .eq("owner_id", user.id)
      .eq("source_id", sourceId)
      .maybeSingle()
    if (existing.error) throw new Error(existing.error.message)
    if (existing.data?.content_hash === contentHash && existing.data.status === "ready") {
      return NextResponse.json({ document: existing.data, reused: true, generationAvoided: true })
    }
    if (existing.data && ["queued", "indexing", "deleting"].includes(String(existing.data.status))) {
      return NextResponse.json({ error: "Esta fuente ya tiene una indexación en curso", document: existing.data }, { status: 409 })
    }
    if (existing.data) {
      await cleanupGoogleFileSearchSource({ ownerId: user.id, notebookId, sourceId })
    }

    const store = await ensureStore({ ownerId: user.id, notebookId, notebookTitle: String(notebook.title || "Notebook") })
    const displayName = String(source.title || `${source.type || "fuente"}-${sourceId}`).slice(0, 512)
    const queued = await admin
      .from("eduai_google_file_search_documents")
      .insert({
        owner_id: user.id,
        notebook_id: notebookId,
        source_id: sourceId,
        store_id: store.id,
        content_hash: contentHash,
        display_name: displayName,
        status: "queued",
        metadata: { source_type: source.type || null, embedding_model: googleFileSearchEmbeddingModel() },
      })
      .select("*")
      .single()
    if (queued.error || !queued.data) throw new Error(`No se pudo registrar la indexación: ${queued.error?.message || "sin fila"}`)

    try {
      const operation = await startGoogleFileSearchUpload({
        storeName: store.store_name,
        sourceId,
        notebookId,
        contentHash,
        displayName,
        text,
      })
      const updated = await admin
        .from("eduai_google_file_search_documents")
        .update({ status: "indexing", operation_name: operation.name, updated_at: new Date().toISOString() })
        .eq("id", queued.data.id)
        .select("*")
        .single()
      let mapping = (updated.data || queued.data) as DocumentRow
      if (operation.done) mapping = await applyOperationResult(mapping, operation)
      return NextResponse.json({ document: mapping, reused: false, generationAvoided: false }, { status: mapping.status === "ready" ? 200 : 202 })
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError)
      await admin.from("eduai_google_file_search_documents").update({ status: "failed", error_message: message.slice(0, 1200), updated_at: new Date().toISOString() }).eq("id", queued.data.id)
      throw uploadError
    }
  } catch (error) {
    const typed = error as Error & { status?: number }
    return NextResponse.json({ error: typed.message || "No se pudo sincronizar File Search" }, { status: typed.status || 500 })
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: notebookId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const notebook = await ownedNotebook(supabase, notebookId, user.id)
    if (!notebook) return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })

    const sourceId = request.nextUrl.searchParams.get("sourceId")?.trim()
    const { data: store } = await supabase
      .from("eduai_google_file_search_stores")
      .select("id,store_name,display_name,embedding_model,status,updated_at")
      .eq("notebook_id", notebookId)
      .maybeSingle()

    if (!sourceId) {
      const { data: documents, error } = await supabase
        .from("eduai_google_file_search_documents")
        .select("id,source_id,content_hash,document_name,operation_name,display_name,status,error_message,created_at,updated_at,indexed_at")
        .eq("notebook_id", notebookId)
        .order("updated_at", { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ store: store || null, documents: documents || [] })
    }

    const { data: rawMapping, error } = await supabase
      .from("eduai_google_file_search_documents")
      .select("*")
      .eq("notebook_id", notebookId)
      .eq("source_id", sourceId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!rawMapping) return NextResponse.json({ document: null, store: store || null })
    let mapping = rawMapping as DocumentRow

    if (mapping.status === "indexing" && mapping.operation_name) {
      const operation = await getGoogleFileSearchOperation(mapping.operation_name)
      mapping = await applyOperationResult(mapping, operation)
    }

    return NextResponse.json({ document: mapping, store: store || null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar File Search" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: notebookId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const notebook = await ownedNotebook(supabase, notebookId, user.id)
    if (!notebook) return NextResponse.json({ error: "Notebook no encontrado" }, { status: 404 })
    const sourceId = request.nextUrl.searchParams.get("sourceId")?.trim()
    if (!sourceId) return NextResponse.json({ error: "sourceId requerido" }, { status: 400 })
    await cleanupGoogleFileSearchSource({ ownerId: user.id, notebookId, sourceId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const typed = error as Error & { status?: number }
    return NextResponse.json({ error: typed.message || "No se pudo eliminar el índice" }, { status: typed.status || 500 })
  }
}
