import Link from "next/link"
import { ArrowRight, FlaskConical, Sparkles } from "lucide-react"
import { CREATOR_HUB_LABS } from "@/components/creator-hub/catalog"

const GROUPS = [
  { title: "Audio y voces", description: "Narración, proyectos extensos y perfiles de locución.", ids: ["audio-lab", "audio-lab-large", "voice-profiles"] },
  { title: "Imagen y video", description: "Recursos visuales y audiovisuales para complementar materiales.", ids: ["image-studio", "video-studio", "gallery"] },
  { title: "Herramientas complementarias", description: "Accesos adicionales que siguen disponibles.", ids: ["music", "classic"] },
]

export default function CreatorHubLabsPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4">
          <div className="flex items-center gap-2 text-teal-600 text-xs font-bold tracking-widest uppercase"><FlaskConical size={14} /> Labs multimedia</div>
          <h1 className="text-main text-xl sm:text-2xl font-bold mt-2">Audio, voces, imagen, video y recursos</h1>
          <p className="text-muted2 text-sm mt-1">Todos los módulos existentes permanecen disponibles. Esta vista solo los ordena para encontrarlos más rápido.</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-7 py-7 sm:py-9 space-y-9">
        <section className="rounded-3xl border border-soft p-5 sm:p-6" style={{ background: "linear-gradient(135deg,rgba(13,148,136,0.08),rgba(37,99,235,0.06))" }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center text-2xl">🧪</div>
            <div>
              <h2 className="text-main font-bold">Complementa tus materiales sin salir del ecosistema EduAI</h2>
              <p className="text-muted2 text-sm mt-1 leading-relaxed">Genera primero una presentación, infografía o podcast y luego usa los labs para enriquecer el resultado con audio, voces, imágenes o video.</p>
            </div>
          </div>
        </section>

        {GROUPS.map((group) => {
          const tools = CREATOR_HUB_LABS.filter((tool) => group.ids.includes(tool.id))
          return (
            <section key={group.title}>
              <div className="mb-4">
                <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted2"><Sparkles size={12} className="inline mr-1" /> {group.title}</p>
                <h2 className="text-main text-lg font-bold mt-1">{group.description}</h2>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {tools.map((tool) => (
                  <Link key={tool.id} href={tool.href} className="group rounded-3xl border border-soft bg-card-theme hover:bg-card-soft-theme transition-all p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${tool.color}14`, border: `1px solid ${tool.color}24` }}>{tool.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><h3 className="text-main text-sm font-bold">{tool.label}</h3><ArrowRight size={15} style={{ color: tool.color }} className="group-hover:translate-x-1 transition-transform" /></div>
                        <p className="text-muted2 text-xs leading-relaxed mt-1.5">{tool.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-4">{tool.features.map((feature) => <span key={feature} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: `${tool.color}0d`, color: tool.color }}>{feature}</span>)}</div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
