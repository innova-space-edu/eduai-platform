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

  setNativeValue(inputAfterLabel("NOMBRE"), "Acceso con código docente");
  const courseSelect = inputAfterLabel("CURSO") as HTMLSelectElement | null;
  if (courseSelect && !courseSelect.value) setNativeValue(courseSelect, "1° Medio A");
  setNativeValue(inputAfterLabel("RUT"), DUMMY_VALID_RUT);
}

function installAccessCodeBox() {
  const examCode = currentPublicExamCode();
  if (!examCode) return;
  if (document.querySelector(`[${CODE_BOX_ATTR}="true"]`)) return;

  const rutInput = inputAfterLabel("RUT") as HTMLInputElement | null;
  const rutContainer = rutInput?.parentElement;
  if (!rutInput || !rutContainer?.parentElement) return;

  const box = document.createElement("div");
  box.setAttribute(CODE_BOX_ATTR, "true");
  box.className = "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4";
  box.innerHTML = `
    <p class="text-sm font-black text-emerald-900">¿No sabes tu RUT?</p>
    <p class="mt-1 text-xs leading-relaxed text-emerald-800">Pide al docente un código temporal y escríbelo aquí. El sistema validará tu identidad sin mostrar datos personales.</p>
    <div class="mt-3 flex gap-2">
      <input id="eduai-access-code-input" autocomplete="off" placeholder="Ej: ABCD-1234" class="min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold uppercase tracking-widest text-emerald-950 outline-none" />
      <button id="eduai-access-code-use" type="button" class="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Usar</button>
    </div>
    <p id="eduai-access-code-note" class="mt-2 text-xs font-semibold text-emerald-700"></p>
  `;

  rutContainer.parentElement.insertBefore(box, rutContainer.nextSibling);

  const input = box.querySelector("#eduai-access-code-input") as HTMLInputElement | null;
  const button = box.querySelector("#eduai-access-code-use") as HTMLButtonElement | null;
  const note = box.querySelector("#eduai-access-code-note") as HTMLElement | null;

  const saved = sessionStorage.getItem(storageKeyForExam(examCode));
  if (saved && input) input.value = saved;

  const apply = () => {
    const clean = String(input?.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    if (!clean) {
      if (note) note.textContent = "Escribe el código entregado por el docente.";
      return;
    }
    sessionStorage.setItem(storageKeyForExam(examCode), clean);
    autofillRegisterForCodeMode();
    if (note) note.textContent = "Código preparado. Ahora presiona iniciar examen.";
  };

  button?.addEventListener("click", apply);
  input?.addEventListener("change", apply);
  input?.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
  });
}

function installFetchPatch() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & Record<string, unknown>;
  if (w[FETCH_PATCH_ATTR]) return;

  const originalFetch = window.fetch.bind(window);
  w[FETCH_PATCH_ATTR] = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || "GET").toUpperCase();
      const body = init?.body;

      if (path().startsWith("/examen/editar/") && method === "POST" && url.includes("/api/agents/examen-docente") && typeof body === "string") {
        const payload = JSON.parse(body);
        if (payload?.action === "update") {
          const textarea = document.querySelector(`[${INSTRUCTIONS_TEXTAREA_ATTR}="true"]`) as HTMLTextAreaElement | null;
          if (textarea) init = { ...init, body: JSON.stringify({ ...payload, instructions: textarea.value }) };
        }
      }

      if (url.includes("/api/agents/examen-docente") && method === "POST" && typeof body === "string") {
        const payload = JSON.parse(body);
        const examCode = currentPublicExamCode();
        const accessCode = examCode ? sessionStorage.getItem(storageKeyForExam(examCode)) : "";
        if (accessCode && ["start_or_resume_attempt", "autosave_attempt", "submit"].includes(payload?.action)) {
          const nextUrl = new URL("/api/exam-access", window.location.origin).toString();
          const action = payload.action === "start_or_resume_attempt" ? "start_with_code" : "proxy_attempt_with_code";
          return originalFetch(nextUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, examId: payload.examId, accessCode, innerBody: payload }),
          });
        }
      }
    } catch {}

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

async function enhanceEditInstructionsTextarea() {
  const examId = currentEditExamId();
  if (!examId) return;
  installFetchPatch();
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
  textarea.className = "w-full min-h-[120px] bg-card-soft-theme border border-soft rounded-xl px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-blue-500/30 resize-y";
  originalInput.insertAdjacentElement("afterend", textarea);
  try {
    const response = await fetch(`/api/agents/examen-docente?examId=${encodeURIComponent(examId)}`);
    const data = await response.json().catch(() => ({}));
    const instructions = String(data?.exam?.instructions || "");
    if (instructions) textarea.value = instructions;
  } catch {}
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
    const res = await fetch("/api/agents/examen-docente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public_exam_by_code", code: decodeURIComponent(match[1]) }) });
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
  } catch {}
}

export default function ExamUiPolish() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      installFetchPatch();
      autoCloseCreateDesign();
      autoCollapseEditColors();
      installAccessCodeBox();
      autofillRegisterForCodeMode();
      void enhanceEditInstructionsTextarea();
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
