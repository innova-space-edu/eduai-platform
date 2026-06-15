"use client";

import { useEffect } from "react";

function text(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function path() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function autoCloseCreateDesign() {
  if (!path().startsWith("/examen/crear")) return;
  const button = Array.from(document.querySelectorAll("button")).find((el) => {
    const value = text(el);
    return value.includes("Personalización visual estilo Canva") && value.includes("Ocultar");
  }) as HTMLButtonElement | undefined;

  if (!button || button.dataset.eduaiClosedOnce === "true") return;
  button.dataset.eduaiClosedOnce = "true";
  button.click();
}

function findByText(selector: string, value: string) {
  return Array.from(document.querySelectorAll(selector)).find((el) => text(el).includes(value)) || null;
}

function autoCollapseEditColors() {
  if (!path().startsWith("/examen/editar/")) return;
  const title = findByText("p,h1,h2,h3,span", "Diseño y colores de esta prueba");
  if (!title) return;

  let panel = title.parentElement;
  while (panel && panel !== document.body) {
    const classes = String(panel.getAttribute("class") || "");
    if (classes.includes("rounded-2xl") && classes.includes("border") && panel.children.length >= 2) break;
    panel = panel.parentElement;
  }
  if (!panel || panel === document.body || panel.dataset.eduaiColorsReady === "true") return;

  const parts = Array.from(panel.children) as HTMLElement[];
  const header = parts[0];
  const body = parts.slice(1);
  panel.dataset.eduaiColorsReady = "true";
  panel.dataset.eduaiColorsOpen = "false";
  body.forEach((el) => (el.hidden = true));

  const row = (header.querySelector(".flex.flex-wrap") as HTMLElement | null) || header;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Abrir colores ↓";
  toggle.className = "rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50";
  toggle.addEventListener("click", () => {
    const open = panel?.dataset.eduaiColorsOpen !== "true";
    if (!panel) return;
    panel.dataset.eduaiColorsOpen = open ? "true" : "false";
    body.forEach((el) => (el.hidden = !open));
    toggle.textContent = open ? "Cerrar colores ↑" : "Abrir colores ↓";
  });
  row.appendChild(toggle);
}

async function showPublicInstructions() {
  const match = path().match(/^\/examen\/p\/([^/?#]+)/);
  if (!match) return;

  // La página pública ya puede renderizar las instrucciones desde React.
  // Si existe cualquier cuadro/título de instrucciones, no insertamos otro.
  if (findByText("p,h1,h2,h3,strong,span", "Instrucciones del docente")) return;
  if (document.querySelector("[data-eduai-student-instructions='true']")) return;

  const warning = findByText("p,strong,span", "Advertencia de monitoreo académico");
  const card = warning?.closest("div.rounded-2xl") as HTMLElement | null;
  if (!card?.parentElement) return;

  try {
    const res = await fetch("/api/agents/examen-docente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "public_exam_by_code", code: decodeURIComponent(match[1]) }),
    });
    const data = await res.json().catch(() => ({}));
    const instructions = String(data?.exam?.instructions || "").trim();
    if (!instructions) return;

    // Revalidamos después del fetch por si React ya renderizó el cuadro mientras esperábamos.
    if (findByText("p,h1,h2,h3,strong,span", "Instrucciones del docente")) return;

    const box = document.createElement("div");
    box.dataset.eduaiStudentInstructions = "true";
    box.className = "mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4";

    const head = document.createElement("p");
    head.className = "text-sm font-bold text-blue-900";
    head.textContent = "📌 Instrucciones del docente";

    const body = document.createElement("p");
    body.className = "mt-2 text-sm leading-relaxed text-blue-800";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = instructions;

    box.append(head, body);
    card.parentElement.insertBefore(box, card);
  } catch {
    // Si el examen aún no cargó o hay un corte de red, el observador reintentará.
  }
}

export default function ExamUiPolish() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      autoCloseCreateDesign();
      autoCollapseEditColors();
      void showPublicInstructions();
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 150);
    };

    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(run, 1500);

    return () => {
      if (timer) clearTimeout(timer);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return null;
}
