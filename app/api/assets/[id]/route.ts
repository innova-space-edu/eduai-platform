import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })

  const { data: asset, error } = await supabase
    .from("eduai_assets")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !asset) return Response.json({ error: "Asset no encontrado" }, { status: 404 })

  let accessUrl = asset.external_url || null

  if (asset.source_module === "legacy-gallery" && asset.source_id) {
    const { data: legacy } = await supabase
      .from("generated_images")
      .select("image_url")
      .eq("id", asset.source_id)
      .eq("user_id", user.id)
      .maybeSingle()

    accessUrl = legacy?.image_url || accessUrl
  }

  if (asset.storage_bucket && asset.storage_path) {
    const { data } = await supabase.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 60 * 30)
    accessUrl = data?.signedUrl || accessUrl
  }

  const rootId = asset.root_asset_id || asset.id
  const { data: versions } = await supabase
    .from("eduai_assets")
    .select("id,title,asset_type,version,parent_asset_id,root_asset_id,created_at,updated_at")
    .eq("owner_id", user.id)
    .or(`id.eq.${rootId},root_asset_id.eq.${rootId}`)
    .is("deleted_at", null)
    .order("version", { ascending: false })

  return Response.json({ asset: { ...asset, access_url: accessUrl }, versions: versions || [] })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: "JSON inválido" }, { status: 400 }) }

  const allowed: Record<string, unknown> = {}
  if (typeof body.title === "string") allowed.title = body.title.trim().slice(0, 240) || null
  if (["private","workspace","shared","public"].includes(String(body.visibility))) allowed.visibility = body.visibility
  if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) allowed.metadata = body.metadata

  if (!Object.keys(allowed).length) return Response.json({ error: "No hay cambios válidos" }, { status: 400 })

  const { data, error } = await supabase
    .from("eduai_assets")
    .update(allowed)
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: "Asset no encontrado" }, { status: 404 })
  return Response.json({ asset: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })

  const { data, error } = await supabase
    .from("eduai_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: "Asset no encontrado" }, { status: 404 })
  return Response.json({ success: true })
}
