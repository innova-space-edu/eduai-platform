import Link from "next/link";

const shortcuts = [
  { href: "#proveedores", label: "Conexiones", description: "Revisa qué servicios están activos", tone: "emerald" },
  { href: "#imagenes", label: "Imágenes", description: "Crea imágenes con FLUX", tone: "violet" },
  { href: "#videos", label: "Videos", description: "Genera videos y sigue su progreso", tone: "cyan" },
  { href: "#historial", label: "Historial", description: "Consulta trabajos y resultados", tone: "blue" },
  { href: "#modelos", label: "Modelos IA", description: "Explora modelos disponibles", tone: "fuchsia" },
];

const toneClasses: Record<string, string> = {
  emerald: "border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15",
  violet: "border-violet-400/25 bg-violet-500/10 hover:bg-violet-500/15",
  cyan: "border-cyan-400/25 bg-cyan-500/10 hover:bg-cyan-500/15",
  blue: "border-blue-400/25 bg-blue-500/10 hover:bg-blue-500/15",
  fuchsia: "border-fuchsia-400/25 bg-fuchsia-500/10 hover:bg-fuchsia-500/15",
};

export default function AdminModelLabPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[32px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Laboratorio privado · Admin only</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Model Lab experimental</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Área segura para probar modelos online, generar contenido y revisar ejecuciones sin exponer herramientas experimentales a estudiantes ni docentes generales.
              </p>
            </div>
            <Link href="/admin" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10">← Volver a Admin</Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">MFA obligatorio</span>
            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1">Historial privado</span>
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1">Claves solo en servidor</span>
          </div>
        </header>

        <nav aria-label="Accesos rápidos del laboratorio" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {shortcuts.map((item) => (
            <a key={item.href} href={item.href} className={`rounded-2xl border p-4 transition ${toneClasses[item.tone]}`}>
              <p className="text-sm font-black text-white">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{item.description}</p>
            </a>
          ))}
        </nav>

        <section className="rounded-[24px] border border-amber-400/20 bg-amber-500/10 p-4">
          <details>
            <summary className="cursor-pointer text-sm font-black text-amber-200">Ver política y alcance del laboratorio</summary>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/80">
              El laboratorio está separado por rol, requiere MFA, conserva auditoría y permanece fuera de los chats públicos. Los modelos experimentales se usan para evaluación técnica interna, comparación de rendimiento y pruebas controladas.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
