import Link from "next/link"
import { Clapperboard, Construction, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "Video Studio en mantenimiento | EDUAI",
  description: "El servicio de generación de videos todavía no está disponible.",
}

export default function VideoStudioPage() {
  return (
    <main className="min-h-screen bg-app text-main px-4 py-14" data-video-routing="maintenance">
      <section className="mx-auto max-w-xl rounded-3xl border border-soft bg-card-soft-theme px-6 py-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <Construction size={30} aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-700">En mantenimiento</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Video Studio aún no está disponible</h1>
        <p className="mt-4 text-sm leading-7 text-sub">
          Estamos preparando la generación de videos de EDUAI. Por ahora no es posible generar videos,
          iniciar nuevos trabajos ni comprar créditos para esta función.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-soft bg-app px-3 py-3 text-xs text-sub">
          <ShieldCheck size={16} aria-hidden="true" />
          Los registros existentes se conservan; no se realizan nuevos cargos desde este módulo.
        </div>
        <Link href="/agentes" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          <Clapperboard size={16} aria-hidden="true" />
          Volver a los agentes de EDUAI
        </Link>
      </section>
    </main>
  )
}
