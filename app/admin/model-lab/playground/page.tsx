import Link from "next/link";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import NanoLitePlayground from "@/components/admin/NanoLitePlayground";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NanoLiteLabPage(){
  return <main className="min-h-screen bg-[#050e1b] px-3 py-5 text-white sm:px-6">
    <div className="mx-auto max-w-[1540px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#081526] p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300"><FlaskConical className="h-5 w-5"/></span>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">EDUAI Model Lab</p>
            <h1 className="text-xl font-black">Laboratorio de pruebas Nano / Lite</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 text-xs text-emerald-200 sm:flex"><ShieldCheck className="h-4 w-4"/> Admin</span>
          <Link href="/admin/model-lab#nano-lite" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4"/> Volver al Model Lab
          </Link>
        </div>
      </header>
      <NanoLitePlayground/>
    </div>
  </main>;
}
