import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) return new Response("No file", { status: 400 })

  const ext = file.name.split(".").pop()
  const path = `${user.id}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from("chat-files")
    .upload(path, file, { contentType: file.type })

  if (error) return new Response(error.message, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from("chat-files").getPublicUrl(path)

  return Response.json({ url: publicUrl, name: file.name, type: file.type })
}
