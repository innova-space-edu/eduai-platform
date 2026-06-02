import Link from "next/link";
import { ArrowLeft, Beaker, ShieldCheck } from "lucide-react";
import { ADMIN_ONLY_EXPERIMENTAL_MODELS } from "@/lib/ai/admin-model-policy";
import ModelLabClient from "./model-lab-client";

export default function AdminModelLabPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-white/[0.04] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200">
              <Beaker size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Admin only</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Model Lab experimental</h1>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">
                Entorno privado para comparar motores visuales antes de promoverlos a producción. La fase inicial habilita FLUX.2 Klein 4B y Z-Image Turbo mediante adapters controlados desde backend.
              </p>
            </div>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft size={16} /> Volver a Admin
          </Link>
        </header>

        <section className="flex gap-3 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-50/85">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-200" size={19} />
          <p>
            El laboratorio permanece apagado hasta configurar <code>ADMIN_MODEL_LAB_ENABLED=true</code> y <code>FAL_KEY</code> en el servidor. El acceso y los adapters se validan desde backend.
          </p>
        </section>

        <ModelLabClient models={ADMIN_ONLY_EXPERIMENTAL_MODELS} />
      </div>
    </main>
  );
}
