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
    <aside className="fixed right-3 top-28 z-[60] hidden w-[8.5rem] rounded-[24px] border border-[var(--exam-border)] bg-[var(--exam-surface)] px-3 py-3 text-[var(--exam-text)] shadow-xl shadow-slate-900/10 backdrop-blur-xl print:hidden lg:block">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full border border-[color-mix(in_srgb,var(--exam-accent)_18%,transparent)] bg-[var(--exam-accent-soft)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--exam-accent)]">
          Hora
        </span>
        <span className="text-lg">⏱️</span>
      </div>

      <div className="rounded-2xl border border-[var(--exam-border)] bg-white/70 px-2 py-3 text-center font-mono shadow-inner shadow-slate-900/5">
        <div className="flex items-baseline justify-center gap-1 tabular-nums">
          <span className="text-2xl font-black text-[var(--exam-accent)]">{hour}</span>
          <span className="text-[var(--exam-text-sub)]">:</span>
          <span className="text-2xl font-black text-[var(--exam-accent)]">{minute}</span>
        </div>
        <div className="mt-1 rounded-full bg-[var(--exam-accent-soft)] px-2 py-0.5 text-lg font-black tabular-nums text-[var(--exam-accent)]">
          {second}s
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[var(--exam-text-sub)]">
        {dateLabel.replace(".", "")}
      </p>
    </aside>
  );
}
