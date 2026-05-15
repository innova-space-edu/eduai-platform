import Link from "next/link";
import { ADMIN_ONLY_EXPERIMENTAL_MODELS } from "@/lib/ai/admin-model-policy";

export default function AdminModelLabPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Admin only</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Model Lab experimental</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Zona preparada para evaluar modelos experimentales o sin censura sin exponerlos a estudiantes, docentes generales ni chats públicos. Por defecto queda apagado y requiere controles de auditoría.
            </p>
          </div>
          <Link href="/admin" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">← Admin</Link>
        </div>

        <section className="rounded-[28px] border border-amber-400/25 bg-amber-500/10 p-5">
          <h2 className="text-lg font-black text-amber-200">Política recomendada</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
            El acceso a modelos no alineados debe quedar separado por rol, sin endpoint público para estudiantes, con logs obligatorios, filtros de seguridad, revisión humana y apagado por defecto en producción.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {ADMIN_ONLY_EXPERIMENTAL_MODELS.map((model) => (
            <article key={model.id} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{model.access}</p>
                  <h3 className="mt-2 text-xl font-black">{model.label}</h3>
                </div>
                <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200">
                  {model.enabledByDefault ? "Activo" : "Apagado"}
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <p className="text-xs font-black text-emerald-200">Contextos permitidos</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-100/80">
                    {model.allowedContexts.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3">
                  <p className="text-xs font-black text-red-200">Bloqueado para</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-100/80">
                    {model.blockedContexts.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3">
                  <p className="text-xs font-black text-blue-200">Controles obligatorios</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-blue-100/80">
                    {model.requiredControls.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
