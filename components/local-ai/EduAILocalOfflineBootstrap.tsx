"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, WifiOff } from "lucide-react";

export default function EduAILocalOfflineBootstrap() {
  const [status, setStatus] = useState<"checking" | "ready" | "unsupported" | "error">("checking");

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      if (!("serviceWorker" in navigator)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register(
          "/eduai-local-sw.js",
          { scope: "/local-ai/" },
        );
        await navigator.serviceWorker.ready;

        const urls = new Set<string>([
          new URL("/local-ai/offline", window.location.origin).toString(),
          new URL("/eduai-local/wllama.wasm", window.location.origin).toString(),
        ]);

        for (const entry of performance.getEntriesByType("resource")) {
          const resource = entry as PerformanceResourceTiming;
          try {
            const url = new URL(resource.name);
            if (
              url.origin === window.location.origin &&
              (url.pathname.startsWith("/_next/static/") ||
                url.pathname.startsWith("/eduai-local/"))
            ) {
              urls.add(url.toString());
            }
          } catch {
            // Ignora recursos no URL.
          }
        }

        registration.active?.postMessage({
          type: "CACHE_URLS",
          urls: [...urls],
        });

        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  const meta =
    status === "ready"
      ? {
          icon: CheckCircle2,
          label: "Shell offline preparada",
          detail: "El runtime y los assets visitados quedan disponibles para próximos arranques sin red.",
          tone: "border-emerald-400/15 bg-emerald-950/15 text-emerald-200",
        }
      : status === "checking"
        ? {
            icon: Loader2,
            label: "Preparando modo offline",
            detail: "Registrando el shell local y su caché.",
            tone: "border-cyan-400/15 bg-cyan-950/15 text-cyan-200",
          }
        : status === "unsupported"
          ? {
              icon: WifiOff,
              label: "Service Worker no disponible",
              detail: "La IA local funciona mientras la página esté abierta, pero el arranque en frío offline no está garantizado.",
              tone: "border-amber-400/15 bg-amber-950/15 text-amber-200",
            }
          : {
              icon: ShieldCheck,
              label: "No se pudo preparar la shell offline",
              detail: "El runtime local sigue disponible; revisa permisos y contexto HTTPS.",
              tone: "border-red-400/15 bg-red-950/15 text-red-200",
            };

  const Icon = meta.icon;
  return (
    <div className={"rounded-2xl border px-4 py-3 " + meta.tone}>
      <div className="flex items-start gap-3">
        <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + (status === "checking" ? "animate-spin" : "")} />
        <div>
          <p className="text-xs font-black">{meta.label}</p>
          <p className="mt-1 text-[10px] leading-4 opacity-75">{meta.detail}</p>
        </div>
      </div>
    </div>
  );
}
