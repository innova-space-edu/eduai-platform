"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AudioLines, FileAudio, ShieldCheck } from "lucide-react"

const ITEMS = [
  { href: "/audio-lab", label: "Transcribir y crear audio", icon: AudioLines },
  { href: "/audio-lab/large", label: "Archivos grandes", icon: FileAudio },
  { href: "/audio-lab/voices", label: "Mis voces", icon: ShieldCheck },
]

export default function AudioLabNav() {
  const pathname = usePathname()

  return (
    <div className="sticky top-0 z-30 border-b border-soft bg-app/90 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.href === "/audio-lab"
            ? pathname === "/audio-lab"
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all"
              style={{
                background: active ? "rgba(124,58,237,0.12)" : "var(--bg-card)",
                borderColor: active ? "rgba(124,58,237,0.35)" : "var(--border-soft)",
                color: active ? "#7c3aed" : "var(--text-secondary)",
              }}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
