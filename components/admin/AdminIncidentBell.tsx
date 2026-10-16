"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Check, CheckCircle2, Clock3, Loader2, RotateCcw, ShieldAlert, X } from "lucide-react";

type Incident = {
  id: string; fingerprint: string; category: string; severity: string;
  module: string; provider: string | null; title: string; message: string;
  status: "open" | "acknowledged" | "resolved"; occurrences: number;
  first_seen_at: string; last_seen_at: string;
};
type Task = {
  id: string; task_key: string; module: string; title: string; detail: string;
  priority: string; status: "pending" | "in_progress" | "completed" | "cancelled";
  created_at: string;
};
type Snapshot = {
  checkedAt: string; monitor: string; incidents: Incident[]; tasks: Task[];
  providers: Array<{provider:string;capability:string;status:string;checked_at:string}>;
  counts: {open:number;acknowledged:number;high:number;pendingTasks:number};
  limitations: string[]; completeSystemAudit: boolean;
};

function elapsed(since: string, now: number) {
  const time = Date.parse(since);
  if (!Number.isFinite(time)) return "sin fecha";
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " h";
  return Math.floor(hours / 24) + " días";
}
export default function AdminIncidentBell() {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/edu-claw/overview", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setAdmin(false); setOpen(false); setSnapshot(null); return;
      }
      if (!response.ok) {
        if (response.status === 503) {
          setAdmin(true);
          setError("Supervisión no disponible: comprueba la conexión a Supabase.");
          return;
        }
        throw new Error("No se pudo consultar el estado.");
      }
      const data = await response.json();
      setAdmin(true); setSnapshot(data); setError(""); setNow(Date.now());
    } catch {
      setError("No se pudo actualizar Edu Claw.");
    }
  }, []);

  useEffect(() => {
    void refresh(); // reload on every admin navigation and sign-in/out SPA transition
  }, [pathname, refresh]);
  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 120_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open]);

  async function change(resource: "incident" | "task", id: string, status: string) {
    setChanging(id); setError("");
    try {
      const response = await fetch("/api/admin/edu-claw/overview", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({resource, id, status}),
      });
      if (!response.ok) throw new Error("No se pudo guardar el cambio");
      await refresh();
    } catch { setError("No se pudo actualizar el registro. Inténtalo nuevamente."); }
    finally { setChanging(null); }
  }

  const total = snapshot ? snapshot.counts.open + snapshot.counts.acknowledged + snapshot.counts.pendingTasks : 0;
  const sorted = useMemo(() => snapshot?.incidents || [], [snapshot]);
  if (!admin) return null;
  return (
    <div className="fixed right-4 top-[76px] z-[95] print:hidden">
      <button type="button" onClick={() => setOpen((value) => !value)}
        aria-label={"Notificaciones administrativas" + (total ? ", " + total + " pendientes" : "")}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/25 bg-[#0d1730] text-white shadow-lg shadow-slate-950/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
        <Bell className="h-5 w-5" />
        {total > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{total > 99 ? "99+" : total}</span>}
      </button>
      {open && (
        <aside role="dialog" aria-label="Centro de notificaciones Edu Claw" className="absolute right-0 top-12 flex max-h-[min(78vh,690px)] w-[min(92vw,440px)] flex-col overflow-hidden rounded-2xl border border-violet-400/20 bg-[#0a1328] text-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-white/10 p-4">
            <div><h2 className="text-sm font-black">Edu Claw · Supervisión</h2><p className="mt-1 text-[11px] text-slate-400">Solo administración · actualización al entrar</p></div>
            <div className="flex gap-2">
              <button type="button" onClick={() => {setFetching(true);void refresh().finally(()=>setFetching(false));}}
                disabled={fetching} className="rounded-lg border border-white/10 p-2" aria-label="Actualizar incidencias">
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              </button>
              <button type="button" aria-label="Cerrar notificaciones" className="rounded-lg border border-white/10 p-2" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
          </header>
          <div className="min-h-0 overflow-y-auto p-4">
            {error && <p role="alert" className="mb-3 rounded-lg border border-amber-300/25 bg-amber-950/30 p-3 text-xs text-amber-100">{error}</p>}
            {snapshot && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white/5 p-2"><p className="text-xl font-bold">{snapshot.counts.open}</p><p className="text-slate-400">Abiertas</p></div>
                  <div className="rounded-xl bg-white/5 p-2"><p className="text-xl font-bold">{snapshot.counts.high}</p><p className="text-slate-400">Altas/críticas</p></div>
                  <div className="rounded-xl bg-white/5 p-2"><p className="text-xl font-bold">{snapshot.counts.pendingTasks}</p><p className="text-slate-400">Pendientes</p></div>
                </div>
                {total === 0 && <p className="my-6 text-center text-xs text-slate-400">Sin incidencias registradas ni tareas pendientes. No garantiza que todos los servicios estén operativos.</p>}
                <div className="mt-4 space-y-2">
                  {sorted.map((i) => (
                    <article key={i.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start gap-2"><ShieldAlert className={ "mt-0.5 h-4 w-4 shrink-0 " + (i.severity === "high" || i.severity === "critical" ? "text-amber-300" : "text-sky-300")} />
                        <div className="min-w-0 flex-1"><p className="text-xs font-bold">{i.title}</p><p className="mt-1 text-[11px] text-slate-400">{i.message}</p></div></div>
                      <p className="mt-2 text-[10px] text-slate-400"><Clock3 className="mr-1 inline h-3 w-3" />Abierta hace {elapsed(i.first_seen_at, now)} · última detección hace {elapsed(i.last_seen_at, now)} · {i.occurrences} ocurrencias</p>
                      <div className="mt-2 flex gap-2">
                        {i.status === "open" && <button type="button" disabled={changing === i.id} onClick={() => void change("incident",i.id,"acknowledged")} className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">Reconocer</button>}
                        <button type="button" disabled={changing === i.id} onClick={() => void change("incident",i.id,"resolved")} className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300"><Check className="mr-1 inline h-3 w-3"/>Resolver</button>
                      </div>
                    </article>
                  ))}
                </div>
                {snapshot.tasks.length > 0 && <h3 className="mt-5 text-xs font-black">Tareas sin completar</h3>}
                <div className="mt-2 space-y-2">
                  {snapshot.tasks.map((t) => <article key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-semibold">{t.title}</p><p className="mt-1 text-[11px] text-slate-400">{t.detail}</p>
                    <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">Pendiente hace {elapsed(t.created_at,now)}</span>
                      <button type="button" disabled={changing === t.id} onClick={() => void change("task",t.id,"completed")} className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300"><CheckCircle2 className="mr-1 inline h-3 w-3"/>Completar</button></div>
                  </article>)}
                </div>
                <details className="mt-4 rounded-xl border border-white/10 p-3">
                  <summary className="cursor-pointer text-[11px] font-bold text-slate-300">Telemetría disponible y límites de revisión</summary>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                    {snapshot.providers.slice(0,10).map((p) => <p key={p.capability+":"+p.provider}>{p.provider} ({p.capability}): {p.status} · {new Date(p.checked_at).toLocaleString("es-CL")}</p>)}
                    {snapshot.limitations.map((s) => <p key={s}>• {s}</p>)}
                  </div>
                </details>
                <p className="mt-3 text-[10px] text-slate-500">Última revisión: {new Date(snapshot.checkedAt).toLocaleString("es-CL")}. Alertas iguales se actualizan; no se crean duplicados.</p>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
