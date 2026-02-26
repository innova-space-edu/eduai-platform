"use client"

interface Gap {
  concept: string
  severity: "alta" | "media" | "baja"
  explanation: string
  emoji: string
}

interface Diagnosis {
  hasGaps: boolean
  message?: string
  gaps: Gap[]
  recommendations: string[]
  summary?: string
}

interface Props {
  diagnosis: Diagnosis | null
  loading: boolean
}

const severityColor = {
  alta: "border-red-500/30 bg-red-500/5 text-red-400",
  media: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  baja: "border-blue-500/30 bg-blue-500/5 text-blue-400",
}

const severityLabel = {
  alta: "Laguna importante",
  media: "Necesita repaso",
  baja: "Concepto débil",
}

export default function DiagnosisReport({ diagnosis, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">ADL analizando tu desempeño...</span>
        </div>
      </div>
    )
  }

  if (!diagnosis) return null

  if (!diagnosis.hasGaps) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 mt-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-green-400 font-semibold">Sin lagunas detectadas</p>
            <p className="text-gray-400 text-sm">{diagnosis.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mt-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
          <span className="text-purple-400 text-xs font-medium">ADL — Diagnóstico de Lagunas</span>
        </div>
      </div>

      {/* Resumen */}
      {diagnosis.summary && (
        <p className="text-gray-300 text-sm">{diagnosis.summary}</p>
      )}

      {/* Lagunas */}
      <div>
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Conceptos a reforzar</p>
        <div className="space-y-2">
          {diagnosis.gaps.map((gap, i) => (
            <div key={i} className={`border rounded-xl p-4 ${severityColor[gap.severity]}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{gap.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{gap.concept}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColor[gap.severity]}`}>
                      {severityLabel[gap.severity]}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs">{gap.explanation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recomendaciones */}
      {diagnosis.recommendations.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Recomendaciones</p>
          <ul className="space-y-2">
            {diagnosis.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-blue-400 mt-0.5">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
