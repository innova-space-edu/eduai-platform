"use client";

import { useEffect, useState } from "react";

function getTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: parts.find((p) => p.type === "hour")?.value ?? "00",
    minute: parts.find((p) => p.type === "minute")?.value ?? "00",
    second: parts.find((p) => p.type === "second")?.value ?? "00",
  };
}

export default function ExamDigitalClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { hour, minute, second } = getTimeParts(now);
  const dateLabel = now.toLocaleDateString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <aside className="fixed right-3 top-3 z-[60] hidden rounded-2xl border border-blue-200/70 bg-white/85 px-4 py-2 text-slate-700 shadow-lg backdrop-blur-xl print:hidden lg:flex lg:items-center lg:gap-3">
      <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
        Hora
      </span>
      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        <span className="text-xl font-black text-blue-700">{hour}</span>
        <span className="text-blue-400">:</span>
        <span className="text-xl font-black text-blue-700">{minute}</span>
        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-sm font-black text-emerald-600">
          {second}s
        </span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {dateLabel}
      </span>
    </aside>
  );
}
