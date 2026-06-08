import Link from "next/link"
import { ArrowRight, BookOpenCheck, NotebookTabs, Sparkles } from "lucide-react"
import { CREATOR_HUB_NOTEBOOK_TOOLS } from "@/components/creator-hub/catalog"

export default function CreatorHubNotebookPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4">
          <div className="flex items-center gap-2 text-blue-600 text-xs font-bold tracking-widest uppercase"><NotebookTabs size={14} /> Cuaderno EduAI</div>
          <h1 className="text-main text-xl sm:text-2xl font-bold mt-2">Fuentes, documentos y creación conectada</h1>
          <p className="text-muted2 text-sm mt-1">Creator Hub reúne los accesos documentales sin alterar las páginas existentes.</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-7 py-7 sm:py-9 space-y-8">
        <section className="rounded-[28px] border border-soft overflow-hidden bg-card-theme">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold text-blue-600 bg-blue-500/10"><Sparkles size={13} /> FLUJO DOCUMENTAL</div>
              <h2 className="text-main text-2xl font-bold mt-4">Usa una sola fuente de información para crear varios materiales.</h2>
              <p className="text-muted2 text-sm leading-relaxed mt-3">Comienza en Notebook EduAI para subir documentos y conversar con evidencia. Usa Chat Paper cuando necesites análisis documental especializado o Investigador para reunir información antes de crear.</p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                <Link href="/notebooks" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">📓 Abrir Notebook EduAI <ArrowRight size={14} /></Link>
                <Link href="/creator-hub/materials" className="flex items-center gap-2 rounded-xl border border-soft px-4 py-2.5 text-xs font-bold text-sub hover:bg-card-soft-theme">✨ Crear material</Link>
              </div>
            </div>
            <div className="border-t lg:border-t-0 lg:border-l border-soft p-6 sm:p-8" style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.06))" }}>
              <div className="flex items-center gap-2 text-main font-bold"><BookOpenCheck size={18} className="text-blue-600" /> Flujo recomendado</div>
              <div className="space-y-3 mt-4">
                {["Sube o agrega tus fuentes", "Conversa con Notebook o Chat Paper", "Selecciona la información relevante", "Vuelve a Creator Hub y genera el material", "Complementa con audio, imágenes, video o QR"].map((item, index) => <div key={item} className="flex items-start gap-3"><span className="w-6 h-6 rounded-full flex items-center justify-center bg-white/80 text-blue-600 text-[11px] font-bold border border-blue-500/15">{index + 1}</span><span className="text-sub text-xs leading-relaxed pt-1">{item}</span></div>)}
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted2">Accesos conectados</p>
          <h2 className="text-main text-lg font-bold mt-1 mb-4">Elige el agente documental adecuado</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {CREATOR_HUB_NOTEBOOK_TOOLS.map((tool) => (
              <Link key={tool.id} href={tool.href} className="group rounded-3xl border border-soft bg-card-theme hover:bg-card-soft-theme transition-all p-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${tool.color}14`, border: `1px solid ${tool.color}24` }}>{tool.icon}</div>
                <div className="flex items-center justify-between gap-2 mt-4"><h3 className="text-main text-sm font-bold">{tool.label}</h3><ArrowRight size={15} style={{ color: tool.color }} className="group-hover:translate-x-1 transition-transform" /></div>
                <p className="text-muted2 text-xs leading-relaxed mt-1.5">{tool.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">{tool.features.map((feature) => <span key={feature} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${tool.color}0d`, color: tool.color }}>{feature}</span>)}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
