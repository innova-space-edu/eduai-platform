import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CollabClient from "./CollabClient"

interface Props {
  params: Promise<{ code: string }>
}

export default async function CollabPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { code } = await params

  const { data: room } = await supabase
    .from("study_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .single()

  if (!room) redirect("/dashboard")

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single()

  return (
    <CollabClient
      room={room}
      userId={user.id}
      userName={profile?.name || "Estudiante"}
    />
  )
}
