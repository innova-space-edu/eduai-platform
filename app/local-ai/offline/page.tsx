import Link from "next/link";
import { ArrowLeft, HardDrive, ShieldCheck, WifiOff } from "lucide-react";
import EduAILocalRuntimePanel from "@/components/admin/EduAILocalRuntimePanel";
import EduAILocalOfflineBootstrap from "@/components/local-ai/EduAILocalOfflineBootstrap";

export const dynamic = "force-static";

export default function EduAILocalOfflinePage() {
  return (
    <main className="min-h-screen bg-[#030712] px-3 py-5 text-white sm:px-5 sm:py-7">
      <div className="mx-auto max-w-[1280px] space-y-4">
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_34%),#07101f] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-emerald-200">
                <WifiOff className="h-4 w-4" />
                <p className="text-xs font-black uppercase tracking-[0.18em]">EDUAI Local · Offline Shell</p>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight">IA local sin depender de la nube</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Esta página contiene únicamente el runtime local. No carga paneles de administración, usuarios ni proveedores cloud.
                El RAG técnico abre apagado por defecto y solo se activa manualmente si este navegador ya tiene un Knowledge Pack.
              </p>
            </div>
            <Link
              href="/admin/model-lab"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-black text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" /> Model Lab
            </Link>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-950/10 p-3">
              <HardDrive className="h-4 w-4 text-emerald-300" />
              <p className="mt-2 text-xs font-black">Modelos cacheados</p>
              <p className="mt-1 text-[10px] text-slate-500">GGUF guardados en este navegador.</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/10 bg-cyan-950/10 p-3">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              <p className="mt-2 text-xs font-black">Sin APIs cloud</p>
              <p className="mt-1 text-[10px] text-slate-500">No consulta Supabase, proveedores ni rutas admin.</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/10 bg-fuchsia-950/10 p-3">
              <WifiOff className="h-4 w-4 text-fuchsia-300" />
              <p className="mt-2 text-xs font-black">RAG opt-in</p>
              <p className="mt-1 text-[10px] text-slate-500">El conocimiento técnico local se usa solo si lo activas.</p>
            </div>
          </div>
        </header>

        <EduAILocalOfflineBootstrap />
        <EduAILocalRuntimePanel standalone />
      </div>
    </main>
  );
}
