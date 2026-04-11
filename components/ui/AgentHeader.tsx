"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

interface Props {
  icon: string
  name: string
  desc: string
  gradient: string
  extra?: React.ReactNode
}

export default function AgentHeader({ icon, name, desc, gradient, extra }: Props) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}>
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* Left: back + icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all flex-shrink-0 text-sub hover:text-main" style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}
            aria-label="Volver"
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>

          {/* Icon pill */}
          <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shadow-md flex-shrink-0`}>
            {icon}
          </div>

          {/* Title */}
          <div className="min-w-0">
            <h1 className="text-main font-semibold text-sm leading-tight truncate">{name}</h1>
            <p className="text-muted2 text-xs truncate">{desc}</p>
          </div>
        </div>

        {/* Right: extra actions */}
        {extra && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {extra}
          </div>
        )}
      </div>
    </header>
  )
}
