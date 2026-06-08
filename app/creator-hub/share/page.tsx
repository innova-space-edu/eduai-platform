import Link from "next/link"
import { ArrowRight, QrCode, Share2, Sparkles } from "lucide-react"

export default function CreatorHubSharePage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-soft bg-header-theme backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 sm:px-7 py-4">
          <div className="flex items-center gap-2 text-cyan-600 text-xs font-bold tracking-widest uppercase"><QrCode size={14} /> Compartir con QR</div>
          <h1 className="text-main text-xl sm:text-2xl font-bold mt-2">Conecta tus materiales con QR Studio</h1>
          <p className="text-muted2 text-sm mt-1">El generador QR existente sigue disponible y ahora tiene un acceso claro desde Creator Hub.</p>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-5 sm:px-7 py-8">
        <section className="rounded-[28px] border border-soft overflow-hidden bg-card-theme">
          <div className="grid lg:grid-cols-[1fr_0.8fr]">
            <div className="p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold text-cyan-700 bg-cyan-500/10"><Sparkles size={13} /> QR STUDIO</div>
              <h2 className="text-main text-2xl font-bold mt-4">Comparte enlaces, textos y recursos creados en EduAI.</h2>
              <p className="text-muted2 text-sm leading-relaxed mt-3">Crea códigos QR descargables para presentaciones, infografías, cuadernos, enlaces, formularios o materiales externos. QR Studio conserva sus funciones de PNG, vencimiento y contador.</p>
              <Link href="/qr-studio" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 transition-colors mt-5">Abrir QR Studio <ArrowRight size={14} /></Link>
            </div>
            <div className="border-t lg:border-t-0 lg:border-l border-soft p-6 sm:p-8" style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.10),rgba(37,99,235,0.06))" }}>
              <div className="w-16 h-16 rounded-3xl bg-white/75 flex items-center justify-center"><Share2 size={30} className="text-cyan-600" /></div>
              <h3 className="text-main font-bold mt-5">Usos recomendados</h3>
              <div className="space-y-2 mt-3">{["Compartir una presentación o infografía", "Abrir un cuaderno de fuentes", "Entregar instrucciones para una actividad", "Vincular formularios, videos o material complementario"].map((item) => <p key={item} className="text-sub text-xs leading-relaxed">✓ {item}</p>)}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
