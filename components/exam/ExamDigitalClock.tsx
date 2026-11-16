"use client";
import { useEffect, useState } from "react";

export default function ExamDigitalClock() {
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{
    const tick=()=>setNow(new Date());
    tick();
    const timer=window.setInterval(tick,1000);
    return ()=>window.clearInterval(timer);
  },[]);
  const time=now?new Intl.DateTimeFormat("es-CL",{timeZone:"America/Santiago",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(now):"--:--:--";
  return <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[var(--exam-border)] bg-[var(--exam-surface)] px-4 py-2 text-xs print:hidden">
    <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"/>
    <span className="font-semibold text-muted2">Hora actual · Chile continental</span>
    <time className="font-mono text-sm font-bold tabular-nums text-main" dateTime={now?.toISOString()}>{time}</time>
  </div>;
}
