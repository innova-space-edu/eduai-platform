import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: topUsers } = await supabase
    .from("profiles")
    .select("id, name, xp, level, streak_days")
    .order("xp", { ascending: false })
    .limit(20)

  const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]
  const levelColors = ["", "text-sub", "text-blue-400", "text-green-400", "text-purple-400", "text-amber-400", "text-red-400"]

  const myRank = topUsers?.findIndex(u => u.id === user.id) ?? -1

  const medalEmoji = (i: number) => {
    if (i === 0) return "🥇"
    if (i === 1) return "🥈"
    if (i === 2) return "🥉"
    return `#${i + 1}`
  }

  return (
    <main className="min-h-screen bg-app text-main">
      <nav className="border-b border-soft bg-card-theme backdrop-blur px-4 sm:px-6 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-muted2 hover:text-main text-sm transition-colors">
              ← Dashboard
            </Link>
            <span className="text-muted2">|</span>
            <h1 className="text-main font-semibold">🏆 Ranking</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Top 3 */}
        {topUsers && topUsers.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-8">
            {/* 2do lugar */}
            <div className="text-center">
              <div className="w-14 h-14 bg-card-soft-theme rounded-full flex items-center justify-center text-xl font-bold text-main mx-auto mb-2">
                {topUsers[1]?.name?.charAt(0)?.toUpperCase()}
              </div>
              <p className="text-2xl">🥈</p>
              <p className="text-main text-sm font-medium truncate max-w-[80px]">{topUsers[1]?.name}</p>
              <p className="text-sub text-xs">{topUsers[1]?.xp} XP</p>
            </div>

            {/* 1er lugar */}
            <div className="text-center -mb-4">
              <div className="w-18 h-18 w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center text-2xl font-bold text-main mx-auto mb-2">
                {topUsers[0]?.name?.charAt(0)?.toUpperCase()}
              </div>
              <p className="text-3xl">🥇</p>
              <p className="text-main font-bold truncate max-w-[80px]">{topUsers[0]?.name}</p>
              <p className="text-amber-400 text-xs font-medium">{topUsers[0]?.xp} XP</p>
            </div>

            {/* 3er lugar */}
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-800 rounded-full flex items-center justify-center text-xl font-bold text-main mx-auto mb-2">
                {topUsers[2]?.name?.charAt(0)?.toUpperCase()}
              </div>
              <p className="text-2xl">🥉</p>
              <p className="text-main text-sm font-medium truncate max-w-[80px]">{topUsers[2]?.name}</p>
              <p className="text-sub text-xs">{topUsers[2]?.xp} XP</p>
            </div>
          </div>
        )}

        {/* Lista completa */}
        <div className="space-y-2">
          {topUsers?.map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center gap-4 border rounded-xl px-4 py-3 transition-all ${
                u.id === user.id
                  ? "bg-blue-500/10 border-blue-500/30"
                  : "bg-card-theme border-soft"
              }`}
            >
              <span className={`text-lg font-bold w-8 text-center ${
                i === 0 ? "text-amber-400" : i === 1 ? "text-sub" : i === 2 ? "text-amber-700" : "text-muted2"
              }`}>
                {medalEmoji(i)}
              </span>

              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                u.id === user.id ? "bg-blue-500" : "bg-card-soft-theme"
              }`}>
                {u.name?.charAt(0)?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${u.id === user.id ? "text-blue-700" : "text-main"}`}>
                  {u.name} {u.id === user.id && <span className="text-xs text-muted2">(tú)</span>}
                </p>
                <p className={`text-xs ${levelColors[u.level || 1]}`}>
                  {levelNames[u.level || 1]} · 🔥 {u.streak_days || 0} días
                </p>
              </div>

              <div className="text-right">
                <p className="text-amber-400 font-bold text-sm">⚡ {u.xp || 0}</p>
                <p className="text-muted2 text-xs">XP</p>
              </div>
            </div>
          ))}
        </div>

        {myRank === -1 && (
          <p className="text-center text-muted2 text-sm mt-6">
            Completa sesiones para aparecer en el ranking
          </p>
        )}
      </div>
    </main>
  )
}
