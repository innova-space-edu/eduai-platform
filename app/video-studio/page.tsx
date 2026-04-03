export const metadata = {
  title: "Video Studio | EduAI",
  description: "Generación de videos con IA desde texto o imagen",
}

export default function VideoStudioPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
        <div className="rounded-3xl border border-cyan-400/20 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/20">
          <div className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
            🛠️ Video Studio en mantención
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
            El agente de video ya fue integrado a la plataforma
          </h1>

          <p className="mt-4 max-w-3xl text-sm text-slate-300 md:text-base">
            Este módulo ya quedó conectado al nuevo sistema de generación de video,
            pero aún estamos terminando la integración del proveedor final,
            la selección de modelos y la lógica de producción.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Estado actual
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Por conectar / mantención
              </p>
              <p className="mt-2 text-sm text-slate-300">
                La interfaz final y el motor real de video aún se están ajustando.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Lo ya integrado
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Ruta y agente visibles
              </p>
              <p className="mt-2 text-sm text-slate-300">
                El agente ya aparece en la sección de Agentes y quedó preparado para su activación.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Próxima etapa
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Producción y modelos
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Falta cerrar proveedores, costos, planes y el flujo estable de generación.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
            <h2 className="text-lg font-semibold text-cyan-200">
              ¿Qué verá el usuario por ahora?
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Verá que el módulo de video existe dentro de EduAI, pero que aún está en
              mantención. Así evitamos errores, no rompemos el trabajo ya hecho y dejamos
              el sistema listo para activarlo cuando termine la integración del backend
              definitivo.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
