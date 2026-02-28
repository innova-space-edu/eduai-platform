"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
    <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all text-sm"
            title="Volver"
          >
            ←
          </button>
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg`}>
            {icon}
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">{name}</h1>
            <p className="text-gray-500 text-xs">{desc}</p>
          </div>
        </div>
        {extra}
      </div>
    </div>
  )
}
