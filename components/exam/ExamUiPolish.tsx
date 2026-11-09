"use client";

import { useEffect } from "react";

const INSTRUCTIONS_TEXTAREA_ATTR = "data-eduai-edit-instructions-textarea";
const FETCH_PATCH_ATTR = "__eduaiExamFetchPatched";

function text(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function path() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function currentEditExamId() {
  const match = path().match(/^\/examen\/editar\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function findByText(selector: string, value: string) {
  return Array.from(document.querySelectorAll(selector)).find((el) => text(el).includes(value)) || null;
}

function installEditInstructionsFetchPatch() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & Record<string, any>;
  if (w[FETCH_PATCH_ATTR]) return;

  const originalFetch = window.fetch.bind(window);
  w[FETCH_PATCH_ATTR] = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || "GET").toUpperCase();
      const body = init?.body;

      if (
        path().startsWith("/examen/editar/") &&
        method === "POST" &&
        url.includes("/api/agents/examen-docente") &&
        typeof body === "string"
      ) {
        const payload = JSON.parse(body);
        if (payload?.action === "update") {
          const textarea = document.querySelector(
            `[${INSTRUCTIONS_TEXTAREA_ATTR}="true"]`,
          ) as HTMLTextAreaElement | null;
          if (textarea) {
            init = {
              ...init,
              body: JSON.stringify({ ...payload, instructions: textarea.value }),
            };
          }
        }
      }

    } catch {
      // Si no corresponde a este flujo, se envía sin cambios.
    }

    return originalFetch(input, init);
  };
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

function installInstructionsSavePatch() {
  // Este bloque queda integrado dentro del patch global de fetch.
}

async function enhanceEditInstructionsTextarea() {
  const examId = currentEditExamId();
  if (!examId) return;
  installInstructionsSavePatch();

  const label = findByText("label", "Instrucciones para los estudiantes");
  const container = label?.parentElement as HTMLElement | null;
  if (!container || container.dataset.eduaiInstructionsReady === "true") return;

  const originalInput = container.querySelector("input") as HTMLInputElement | null;
  if (!originalInput) return;

  container.dataset.eduaiInstructionsReady = "true";
  originalInput.style.display = "none";

  const textarea = document.createElement("textarea");
  textarea.setAttribute(INSTRUCTIONS_TEXTAREA_ATTR, "true");
  textarea.value = originalInput.value || "";
  textarea.placeholder = "Ej: Lee atentamente y responde.\nNo puedes usar apuntes.\nNo uses otras páginas web.";
  textarea.rows = 5;
  textarea.className =
    "w-full min-h-[120px] bg-card-soft-theme border border-soft rounded-xl px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-blue-500/30 resize-y";

  const help = document.createElement("p");
  help.className = "mt-2 text-[11px] text-muted2";
  help.textContent = "Usa Enter para separar instrucciones en líneas. Se guardarán con esos saltos de línea.";

  originalInput.insertAdjacentElement("afterend", textarea);
  textarea.insertAdjacentElement("afterend", help);

  try {
    const response = await fetch(`/api/agents/examen-docente?examId=${encodeURIComponent(examId)}`);
    const data = await response.json().catch(() => ({}));
    const instructions = String(data?.exam?.instructions || "");
    if (instructions) textarea.value = instructions;
  } catch {
    // Si falla la carga secundaria, se mantiene el valor visible actual.
  }
}

function addAdminAccessShortcut() {
  if (!path().startsWith("/admin/exam-security")) return;
  if (document.querySelector("[data-eduai-exam-access-admin-shortcut='true']")) return;
  const target = document.querySelector("main, body") as HTMLElement | null;
  if (!target) return;
  const link = document.createElement("a");
  link.setAttribute("data-eduai-exam-access-admin-shortcut", "true");
  link.href = "/admin/exam-access";
  link.textContent = "🔐 Códigos de acceso";
  link.className = "fixed bottom-24 right-6 z-50 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-2xl";
  document.body.appendChild(link);
}

export default function ExamUiPolish() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    installEditInstructionsFetchPatch();

    const run = () => {
      autoCloseCreateDesign();
      autoCollapseEditColors();
      void enhanceEditInstructionsTextarea();
      addAdminAccessShortcut();
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
