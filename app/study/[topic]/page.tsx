import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"

interface Props {
  params: { topic: string }
  searchParams: { topic?: string }
}

export default async function StudyPage({ params, searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const topic = decodeURIComponent(params.topic) || searchParams.topic || ""

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-700">|</span>
          <h1 className="text-white font-semibold">{topic}</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12">
          <p className="text-5xl mb-6">🧠</p>
          <h2 className="text-2xl font-bold text-white mb-3">
            Preparando tu sesión sobre
          </h2>
          <h3 className="text-3xl font-bold text-blue-400 mb-6">
            {topic}
          </h3>
          <p className="text-gray-500 text-sm">
            Aquí aparecerá el contenido generado por la IA.
            <br />
            Próximo paso: conectar el backend con los agentes.
          </p>
        </div>
      </div>

    </main>
  )
}
