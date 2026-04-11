"use client"

interface Props {
  topic: string
  subtopic?: string
  level: number
  currentXP: number | null
  onEvaluate?: () => void
  showEvaluate?: boolean
}

const levelNames = ["", "Explorador", "Aprendiz", "Practicante", "Analista", "Experto", "Maestro"]

const levelGradients = [
  "",
  "from-slate-200 to-slate-300",
  "from-blue-400 to-blue-500",
  "from-green-400 to-emerald-500",
  "from-purple-400 to-violet-500",
  "from-amber-400 to-orange-500",
  "from-red-400 to-rose-500",
]

export default function StudyBanner({
  topic,
  subtopic,
  level,
  currentXP,
  onEvaluate,
  showEvaluate,
}: Props) {
  const levelName = levelNames[level] || "Explorador"
  const gradient  = levelGradients[level] || levelGradients[1]

  return (
    <div className="sticky top-[57px] z-10 border-b border-soft bg-app backdrop-blur-xl">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted2 min-w-0">
          <span className="truncate max-w-[120px] sm:max-w-none text-sub">{topic}</span>
          {subtopic && subtopic !== topic && (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted2 flex-shrink-0">
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-blue-400 truncate max-w-[140px]">{subtopic}</span>
            </>
          )}
        </div>

        {/* Right side: level + xp + button */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Level badge */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${gradient}`} />
            <span className="text-xs text-sub font-medium">
              Nv.{level} {levelName}
            </span>
          </div>

          {/* XP */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/8 border border-amber-500/15">
            <span className="text-amber-400 text-xs">⚡</span>
            <span className="text-amber-400 text-xs font-bold tabular-nums">
              {currentXP ?? "—"}
            </span>
          </div>

          {/* Evaluate button */}
          {showEvaluate && onEvaluate && (
            <button
              onClick={onEvaluate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
              }}
            >
              <span>🎯</span>
              <span>Evalúame</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
