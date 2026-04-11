import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import StudyClient from "./StudyClient"

interface Props {
  params: Promise<{ topic: string }>
  searchParams: Promise<{ subtopic?: string }>
}

export default async function StudyPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const resolvedParams = await params
  const resolvedSearch = await searchParams
  const topic = decodeURIComponent(resolvedParams.topic)
  const subtopic = resolvedSearch.subtopic ? decodeURIComponent(resolvedSearch.subtopic) : null

  const { data: profile } = await supabase
    .from("profiles")
    .select("level, xp, name")
    .eq("id", user.id)
    .single()

  return (
    <main className="min-h-screen bg-app text-main">
      <nav className="border-b border-soft bg-card-theme backdrop-blur px-4 sm:px-6 py-3 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-muted2 hover:text-main transition-colors text-sm shrink-0">
              ← Inicio
            </a>
            <span className="text-muted2">|</span>
            <h1 className="text-main font-semibold truncate text-sm sm:text-base">
              {subtopic || topic}
            </h1>
          </div>
        </div>
      </nav>

      <StudyClient
        topic={topic}
        subtopic={subtopic}
        level={profile?.level || 1}
        initialXP={profile?.xp || 0}
      />
    </main>
  )
}