import Link from "next/link"
import { Cpu } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Link
        href="/admin/model-lab"
        aria-label="Abrir Model Lab de IA"
        className="fixed bottom-5 right-5 z-[100] inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-slate-950/95 px-4 py-3 text-sm font-black text-cyan-100 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900"
      >
        <Cpu className="h-4 w-4 text-cyan-300" />
        <span>AI Model Lab</span>
      </Link>
    </>
  )
}
