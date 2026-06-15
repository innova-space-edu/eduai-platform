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
    <div
      className="min-w-0 rounded-2xl border px-3 py-3 text-center shadow-sm print:hidden"
      style={{
        borderColor: "color-mix(in srgb, var(--exam-accent) 18%, white)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--exam-accent) 7%, white), color-mix(in srgb, var(--exam-accent-soft) 35%, white))",
        color: "var(--exam-text)",
      }}
    >
      <div className="mb-2 flex items-center justify-center gap-2">
        <span
          className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            backgroundColor: "color-mix(in srgb, var(--exam-accent) 12%, white)",
            color: "var(--exam-accent)",
          }}
        >
          Hora
        </span>
        <span aria-hidden="true" className="text-sm">
          ⏱️
        </span>
      </div>

      <div className="font-mono tabular-nums leading-none">
        <span
          className="text-2xl font-black"
          style={{ color: "var(--exam-accent)" }}
        >
          {hour}:{minute}
        </span>
        <span className="ml-1 text-sm font-black text-muted2">{second}s</span>
      </div>

      <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted2">
        {dateLabel}
      </p>
    </div>
  );
}
