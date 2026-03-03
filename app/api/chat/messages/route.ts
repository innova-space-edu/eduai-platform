import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get("conversationId")
  const action = searchParams.get("action")

  if (action === "conversations") {
    const { data } = await supabase.from("conversations")
      .select("*, user1:user1_id(id,name,avatar_url,is_online,last_seen,user_code), user2:user2_id(id,name,avatar_url,is_online,last_seen,user_code)")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false })
    return Response.json(data || [])
  }

  if (conversationId) {
    const { data } = await supabase.from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100)

    // Marcar como leídos
    await supabase.from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .is("read_at", null)

    return Response.json(data || [])
  }

  return Response.json([])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const { action, friendId, conversationId, content, fileUrl, fileName, fileType, messageId, emoji } = await req.json()

  // Crear o obtener conversación
  if (action === "getOrCreateConversation") {
    const [u1, u2] = [user.id, friendId].sort()
    let { data: conv } = await supabase.from("conversations")
      .select("*")
      .or(`and(user1_id.eq.${u1},user2_id.eq.${u2}),and(user1_id.eq.${u2},user2_id.eq.${u1})`)
      .single()

    if (!conv) {
      const { data: newConv } = await supabase.from("conversations")
        .insert({ user1_id: u1, user2_id: u2 })
        .select().single()
      conv = newConv
    }
    return Response.json(conv)
  }

  // Enviar mensaje
  if (action === "send") {
    const { data: msg } = await supabase.from("chat_messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, content, file_url: fileUrl, file_name: fileName, file_type: fileType })
      .select().single()

    await supabase.from("conversations")
      .update({ last_message: content || fileName || "Archivo", last_message_at: new Date().toISOString() })
      .eq("id", conversationId)

    return Response.json(msg)
  }

  // Reacción
  if (action === "react") {
    const { data: msg } = await supabase.from("chat_messages").select("reactions").eq("id", messageId).single()
    const reactions = (msg?.reactions as Record<string, string[]>) || {}
    if (!reactions[emoji]) reactions[emoji] = []
    const idx = reactions[emoji].indexOf(user.id)
    if (idx >= 0) reactions[emoji].splice(idx, 1)
    else reactions[emoji].push(user.id)
    if (reactions[emoji].length === 0) delete reactions[emoji]
    await supabase.from("chat_messages").update({ reactions }).eq("id", messageId)
    return Response.json({ ok: true })
  }

  return Response.json({ ok: false })
}
