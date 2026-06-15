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
    <aside
      className="fixed right-3 top-3 z-[60] hidden rounded-2xl border px-4 py-2 shadow-lg backdrop-blur-xl print:hidden lg:flex lg:items-center lg:gap-3"
      style={{
        borderColor: "color-mix(in srgb, var(--exam-accent) 24%, transparent)",
        backgroundColor:
          "color-mix(in srgb, var(--exam-surface) 88%, transparent)",
        color: "var(--exam-text-sub)",
      }}
    >
      <span
        className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
        style={{
          backgroundColor: "var(--exam-accent-soft)",
          color: "var(--exam-accent)",
        }}
      >
        Hora
      </span>
      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        <span
          className="text-xl font-black"
          style={{ color: "var(--exam-accent)" }}
        >
          {hour}
        </span>
        <span
          style={{ color: "color-mix(in srgb, var(--exam-accent) 55%, white)" }}
        >
          :
        </span>
        <span
          className="text-xl font-black"
          style={{ color: "var(--exam-accent)" }}
        >
          {minute}
        </span>
        <span
          className="ml-2 rounded-full px-2 py-0.5 text-sm font-black"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--exam-success) 12%, white)",
            color: "var(--exam-success)",
          }}
        >
          {second}s
        </span>
      </div>
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--exam-muted)" }}
      >
        {dateLabel}
      </span>
    </aside>
  );
}
