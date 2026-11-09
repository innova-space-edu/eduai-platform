import { NextResponse, type NextRequest } from "next/server"
import { requireRepositoryAdmin } from "@/lib/repository/admin"
import { REPOSITORY_BUCKET } from "@/lib/repository/catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store, max-age=0" }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const { user, admin } = await requireRepositoryAdmin()
  if (!user || !admin) return NextResponse.json({ error: "Solo administradores pueden revisar los envíos." }, { status: 403 })

  const file = request.nextUrl.searchParams.get("file")
  if (file) {
    if (!uuid.test(file)) return NextResponse.json({ error: "Envío inválido." }, { status: 400 })
    const { data, error } = await admin.from("repository_public_submissions")
      .select("storage_path,material").eq("id", file).eq("status", "pending").maybeSingle()
    if (error) return NextResponse.json({ error: "No fue posible abrir el envío." }, { status: 500 })
    if (!data?.storage_path) return NextResponse.json({ error: "El archivo pendiente no está disponible." }, { status: 404 })

    const signed = await admin.storage.from(REPOSITORY_BUCKET).createSignedUrl(data.storage_path, 60, {
      download: data.material.original_file_name || true,
    })
    if (signed.error) return NextResponse.json({ error: "No fue posible preparar el archivo." }, { status: 500 })
    return NextResponse.redirect(signed.data.signedUrl, { headers: { ...noStore, "Referrer-Policy": "no-referrer" } })
  }

  const { data, error } = await admin.from("repository_public_submissions")
    .select("id,created_at,material").eq("status", "pending").order("created_at").order("id").limit(100)

  if (error) return NextResponse.json({ error: "No fue posible cargar los envíos pendientes." }, { status: 500 })
  return NextResponse.json({ submissions: data }, { headers: noStore })
}

export async function POST(request: NextRequest) {
  const { user, admin } = await requireRepositoryAdmin()
  if (!user || !admin) return NextResponse.json({ error: "Solo administradores pueden revisar los envíos." }, { status: 403 })
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Envía la decisión como JSON." }, { status: 415 })
  }
  const body = await request.json().catch(() => null)
  if (typeof body?.id !== "string" || !uuid.test(body.id) || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "La decisión no es válida." }, { status: 400 })
  }

  const { data, error } = await admin.rpc("review_repository_submission", {
    submission_id: body.id, reviewer_id: user.id, approve: body.action === "approve",
  })
  if (error) return NextResponse.json({ error: "No fue posible guardar la decisión." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "El envío no existe." }, { status: 404 })
  if (data === "missing_file") return NextResponse.json({ error: "El archivo ya no está disponible." }, { status: 409 })
  const expected = body.action === "approve" ? "approved" : "rejected"
  if (data !== expected) return NextResponse.json({ error: "Otro administrador ya revisó este envío." }, { status: 409 })
  return NextResponse.json({ status: data }, { headers: noStore })
}
