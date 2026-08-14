import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type AssetRow = {
  id: string
  owner_id: string
  asset_type: string
  title: string | null
  mime_type: string | null
  storage_bucket: string | null
  storage_path: string | null
  external_url: string | null
  text_content: string | null
  content_json: Record<string, unknown> | null
  source_module: string | null
  source_id: string | null
  fingerprint: string | null
  visibility: string
  parent_asset_id: string | null
  root_asset_id: string | null
  version: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

function clampLimit(value: string | null) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 50
  return Math.max(1, Math.min(100, Math.round(parsed)))
}

async function withAccessUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  asset: AssetRow
) {
  if (!asset.storage_bucket || !asset.storage_path) {
    return { ...asset, access_url: asset.external_url }
  }

  const { data, error } = await supabase.storage
    .from(asset.storage_bucket)
    .createSignedUrl(asset.storage_path, 60 * 30)

  return {
    ...asset,
    access_url: error ? asset.external_url : data?.signedUrl || asset.external_url,
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })

  const url = new URL(req.url)
  const type = url.searchParams.get("type")?.trim()
  const search = url.searchParams.get("q")?.trim()
  const sourceModule = url.searchParams.get("source_module")?.trim()
  const limit = clampLimit(url.searchParams.get("limit"))

  let query = supabase
    .from("eduai_assets")
    .select("id,owner_id,asset_type,title,mime_type,storage_bucket,storage_path,external_url,text_content,content_json,source_module,source_id,fingerprint,visibility,parent_asset_id,root_asset_id,version,metadata,created_at,updated_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (type) query = query.eq("asset_type", type)
  if (sourceModule) query = query.eq("source_module", sourceModule)
  if (search) query = query.ilike("title", `%${search.replace(/[%_]/g, "")}%`)

  const { data, error } = await query
  if (error) {
    if (error.code === "42P01" || /schema cache|does not exist/i.test(error.message)) {
      return Response.json({ assets: [], migrationRequired: true })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  const assets = await Promise.all((data || []).map((asset) => withAccessUrl(supabase, asset as AssetRow)))
  return Response.json({ assets })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const assetId = String(body.asset_id || "").trim()
  const targetType = String(body.target_type || "").trim()
  const targetId = String(body.target_id || "").trim()
  const relation = String(body.relation || "uses").trim()

  if (!assetId || !targetType || !targetId) {
    return Response.json({ error: "asset_id, target_type y target_id son obligatorios" }, { status: 400 })
  }

  const { data: asset, error: assetError } = await supabase
    .from("eduai_assets")
    .select("id,owner_id")
    .eq("id", assetId)
    .is("deleted_at", null)
    .maybeSingle()

  if (assetError || !asset) return Response.json({ error: "Asset no encontrado" }, { status: 404 })
  if (asset.owner_id !== user.id) return Response.json({ error: "No autorizado" }, { status: 403 })

  const { data, error } = await supabase
    .from("eduai_asset_links")
    .upsert({
      owner_id: user.id,
      asset_id: assetId,
      target_type: targetType,
      target_id: targetId,
      relation,
    }, { onConflict: "asset_id,target_type,target_id,relation" })
    .select("id,asset_id,target_type,target_id,relation")
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ link: data }, { status: 201 })
}
