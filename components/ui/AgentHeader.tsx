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
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-gray-950/80 backdrop-blur-xl">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* Left: back + icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.1] transition-all flex-shrink-0"
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
            <h1 className="text-white font-semibold text-sm leading-tight truncate">{name}</h1>
            <p className="text-gray-500 text-xs truncate">{desc}</p>
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
