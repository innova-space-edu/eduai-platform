import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)

  const code = searchParams.get("code")
  const q = searchParams.get("q")
  const id = searchParams.get("id")
  const action = searchParams.get("action")

  // Buscar usuario por id/código/nombre:
  // - ?id=<uuid> (exacto)
  // - ?code=<USER_CODE> (exacto)
  // - ?q=<texto> (nombre o código parcial, devuelve lista)
  if (id || code || q) {
    const base = supabase
      .from("profiles")
      .select("id, name, user_code, avatar_url, is_online, last_seen")
      .neq("id", user.id)

    if (id) {
      const { data } = await base.eq("id", id).maybeSingle()
      return Response.json(data || null)
    }

    if (code) {
      const { data } = await base.eq("user_code", code.toUpperCase()).maybeSingle()
      return Response.json(data || null)
    }

    const term = (q || "").trim()
    if (!term) return Response.json([])
    const { data } = await base
      .or(`name.ilike.%${term}%,user_code.ilike.%${term}%`)
      .limit(20)
    return Response.json(data || [])
  }

  // Listar amigos
  if (action === "list") {
    const { data: friendships } = await supabase.from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted")

    if (!friendships || friendships.length === 0) return Response.json([])

    const ids = friendships.map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    const { data: profiles } = await supabase.from("profiles")
      .select("id, name, user_code, avatar_url, is_online, last_seen")
      .in("id", ids)

    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))
    const result = friendships.map((f: any) => ({
      ...f,
      requester: profileMap[f.requester_id] || { id: f.requester_id, name: "Usuario" },
      addressee: profileMap[f.addressee_id] || { id: f.addressee_id, name: "Usuario" },
    }))

    return Response.json(result)
  }

  // Listar solicitudes pendientes
  if (action === "requests") {
    const { data: reqs, error } = await supabase.from("friendships")
      .select("id, requester_id, status, created_at")
      .eq("addressee_id", user.id)
      .eq("status", "pending")

    if (!reqs || reqs.length === 0) return Response.json([])

    // Obtener perfiles de los solicitantes
    const ids = reqs.map((r: any) => r.requester_id)
    const { data: profiles } = await supabase.from("profiles")
      .select("id, name, user_code, avatar_url")
      .in("id", ids)

    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))
    const result = reqs.map((r: any) => ({
      ...r,
      requester: profileMap[r.requester_id] || { id: r.requester_id, name: "Usuario", user_code: "?" }
    }))

    return Response.json(result)
  }

  return Response.json([])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { action, addresseeId, friendshipId } = await req.json()

  if (action === "send") {
    // Verificar que no exista ya una solicitud
    const { data: existing } = await supabase.from("friendships")
      .select("id, status")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
      .maybeSingle()

    if (existing) {
      return Response.json({ ok: false, error: `Ya existe: ${existing.status}` })
    }

    const { data, error } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: "pending",
    }).select().single()

    console.log("Friendship insert:", { data, error, userId: user.id, addresseeId })
    return Response.json({ ok: !error, error: error?.message, data })
  }

  if (action === "accept") {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId)
    return Response.json({ ok: true })
  }

  if (action === "reject") {
    await supabase.from("friendships").delete().eq("id", friendshipId)
    return Response.json({ ok: true })
  }

  return Response.json({ ok: false })
}
