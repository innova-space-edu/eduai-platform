import Link from "next/link";
import { ArrowLeft, FlaskConical, ShieldCheck, WifiOff } from "lucide-react";
import LiteRTPrewarm from "@/components/admin/LiteRTPrewarm";
import ModelLabWorkspace from "@/components/admin/ModelLabWorkspace";
import styles from "./model-lab.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBuildFingerprint() {
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 8);
  const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || "local";
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
  return { commit, branch, environment };
}

export default function AdminModelLabPage() {
  const build = getBuildFingerprint();
  return (
    <main className={styles.darkLab + " flex min-h-[100dvh] flex-col px-3 py-3 text-white sm:px-5 lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:overflow-hidden"}>
      <LiteRTPrewarm />
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col gap-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#081224] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="inline-flex items-center gap-1 text-cyan-200"><FlaskConical className="h-3.5 w-3.5" /> Laboratorio de IA</span>
              <span className="inline-flex items-center gap-1 text-amber-200"><ShieldCheck className="h-3.5 w-3.5" /> Solo administración</span>
              <span className="text-slate-500" title={"Commit " + build.commit + " · rama " + build.branch + " · entorno " + build.environment}>Build {build.commit}</span>
            </div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">EDUAI Model Lab</h1>
            <p className="mt-1 text-xs text-slate-400">Modelos, entrenamiento y rendimiento organizados por sección.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/local-ai/offline" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-950/20 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-950/30">
              <WifiOff className="h-4 w-4" /> Local offline
            </Link>
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c1a2d] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-[#10223a]">
              <ArrowLeft className="h-4 w-4" /> Administración
            </Link>
          </div>
        </header>
        <div className="flex h-[calc(100dvh-13rem)] min-h-[440px] min-w-0 flex-col lg:h-auto lg:min-h-0 lg:flex-1">
          <ModelLabWorkspace />
        </div>
      </div>
    </main>
  );
}
