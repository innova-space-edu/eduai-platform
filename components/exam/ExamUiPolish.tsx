"use client";

import { useEffect } from "react";

const INSTRUCTIONS_TEXTAREA_ATTR = "data-eduai-edit-instructions-textarea";
const FETCH_PATCH_ATTR = "__eduaiExamFetchPatched";
const CODE_BOX_ATTR = "data-eduai-access-code-box";
const DUMMY_VALID_RUT = "111111111";

function text(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function path() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function currentPublicExamCode() {
  const match = path().match(/^\/examen\/p\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function currentEditExamId() {
  const match = path().match(/^\/examen\/editar\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function findByText(selector: string, value: string) {
  return Array.from(document.querySelectorAll(selector)).find((el) => text(el).includes(value)) || null;
}

function storageKeyForExam(code: string) {
  return `eduai_exam_access_code_${code}`;
}

function setNativeValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, value: string) {
  if (!el) return;
  const proto = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function inputAfterLabel(labelText: string) {
  const label = findByText("label", labelText);
  const parent = label?.parentElement;
  return parent?.querySelector("input,select,textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
}

function autofillRegisterForCodeMode() {
  const code = currentPublicExamCode();
  if (!code) return;
  const savedCode = sessionStorage.getItem(storageKeyForExam(code));
  const codeInput = document.getElementById("eduai-access-code-input") as HTMLInputElement | null;
  const activeCode = (codeInput?.value || savedCode || "").trim();
  if (!activeCode) return;

  const nameInput = inputAfterLabel("NOMBRE") as HTMLInputElement | null;
  const courseSelect = inputAfterLabel("CURSO") as HTMLSelectElement | null;
  const rutInput = inputAfterLabel("RUT") as HTMLInputElement | null;

  if (nameInput && !nameInput.value.trim()) setNativeValue(nameInput, "Acceso con código docente");
  if (courseSelect && !courseSelect.value) setNativeValue(courseSelect, "1° Medio A");
  if (rutInput && rutInput.value !== DUMMY_VALID_RUT) setNativeValue(rutInput, DUMMY_VALID_RUT);
}

function installExamAccessFetchPatch() {
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
      const examCode = currentPublicExamCode();

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

      if (
        examCode &&
        method === "POST" &&
        url.includes("/api/agents/examen-docente") &&
        typeof body === "string"
      ) {
        const payload = JSON.parse(typeof init?.body === "string" ? init.body : body);
        const action = String(payload?.action || "");
        const savedCode = sessionStorage.getItem(storageKeyForExam(examCode)) || "";
        const codeInput = document.getElementById("eduai-access-code-input") as HTMLInputElement | null;
        const accessCode = (codeInput?.value || savedCode || "").trim();

        if (accessCode && action === "start_or_resume_attempt") {
          const response = await originalFetch("/api/exam-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "start_with_code",
              examId: payload.examId,
              publicExamCode: examCode,
              accessCode,
              innerBody: payload,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (data?.success) {
            sessionStorage.setItem(storageKeyForExam(examCode), accessCode);
          }
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (savedCode && ["autosave_attempt", "submit"].includes(action)) {
          const response = await originalFetch("/api/exam-access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "proxy_attempt_with_code",
              examId: payload.examId,
              publicExamCode: examCode,
              accessCode: savedCode,
              innerBody: payload,
            }),
          });
          const data = await response.json().catch(() => ({}));
          return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    } catch {
      // Si no corresponde a este flujo, se envía sin cambios.
    }

    return originalFetch(input, init);
  };
}

function ensureAccessCodeBox() {
  const examCode = currentPublicExamCode();
  if (!examCode) return;
  if (document.querySelector(`[${CODE_BOX_ATTR}="true"]`)) {
    autofillRegisterForCodeMode();
    return;
  }

  const rutLabel = findByText("label", "RUT");
  const rutContainer = rutLabel?.parentElement as HTMLElement | null;
  if (!rutContainer) return;

  const box = document.createElement("div");
  box.setAttribute(CODE_BOX_ATTR, "true");
  box.className = "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4";
  box.innerHTML = `
    <p class="text-sm font-black text-emerald-900">🔐 ¿No sabes tu RUT?</p>
    <p class="mt-1 text-xs leading-relaxed text-emerald-800">Ingresa el código temporal entregado por el docente. No se mostrará tu RUT en esta pantalla.</p>
    <input id="eduai-access-code-input" autocomplete="off" placeholder="Ej: ABCD-1234" class="mt-3 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold tracking-widest text-emerald-950 outline-none" />
    <p id="eduai-access-code-status" class="mt-2 text-xs font-semibold text-emerald-700"></p>
  `;
  rutContainer.insertAdjacentElement("afterend", box);

  const codeInput = box.querySelector("#eduai-access-code-input") as HTMLInputElement | null;
  const status = box.querySelector("#eduai-access-code-status") as HTMLElement | null;
  const saved = sessionStorage.getItem(storageKeyForExam(examCode));
  if (saved && codeInput) {
    codeInput.value = saved;
    if (status) status.textContent = "Código activo en este equipo. Puedes continuar el examen.";
    autofillRegisterForCodeMode();
  }

  codeInput?.addEventListener("input", () => {
    const clean = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    codeInput.value = clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
    if (status) status.textContent = clean ? "Usaremos este código para identificarte de forma segura." : "";
    autofillRegisterForCodeMode();
  });
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

async function showPublicInstructions() {
  const match = path().match(/^\/examen\/p\/([^/?#]+)/);
  if (!match) return;

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
    // Reintenta con el observador.
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
    installExamAccessFetchPatch();

    const run = () => {
      autoCloseCreateDesign();
      autoCollapseEditColors();
      void enhanceEditInstructionsTextarea();
      void showPublicInstructions();
      ensureAccessCodeBox();
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
