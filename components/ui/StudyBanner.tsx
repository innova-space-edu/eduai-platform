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
const levelColors = ["", "text-gray-400", "text-blue-400", "text-green-400", "text-purple-400", "text-amber-400", "text-red-400"]

export default function StudyBanner({ topic, subtopic, level, currentXP, onEvaluate, showEvaluate }: Props) {
  return (
    <div className="sticky top-[57px] z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-6 py-2">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
          <span>{topic}</span>
          {subtopic && subtopic !== topic && (
            <>
              <span>→</span>
              <span className="text-blue-400">{subtopic}</span>
            </>
          )}
        </div>

        {/* Stats + botón */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className={`font-medium ${levelColors[level]}`}>
              Nv.{level} {levelNames[level]}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-amber-400 font-medium">
              ⚡ {currentXP ?? "—"} XP
            </span>
          </div>

          {showEvaluate && onEvaluate && (
            <button
              onClick={onEvaluate}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
            >
              🎯 Evalúame
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
