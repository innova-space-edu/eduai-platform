"use client";

import { useMemo, useState } from "react";

const BASIC_BUTTONS = [
  "7", "8", "9", "÷", "DEL",
  "4", "5", "6", "×", "AC",
  "1", "2", "3", "-", "(",
  "0", ".", "π", "+", ")",
];

const SCIENCE_BUTTONS = [
  "sin", "cos", "tan", "√",
  "log", "ln", "x²", "^",
  "ANS", "%", "e", "=",
];

function normalizeExpression(input: string) {
  const expression = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "PI")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9.]+)/g, "sqrt($1)")
    .replace(/\^/g, "**");

  if (!expression.trim()) return "0";

  if (/[^0-9+\-*/%().,\sA-Za-z_]/.test(expression)) {
    throw new Error("Caracteres no permitidos");
  }

  const allowedNames = new Set([
    "sin", "cos", "tan", "asin", "acos", "atan",
    "sqrt", "log", "ln", "abs", "floor", "ceil", "round",
    "PI", "E",
  ]);

  const names = expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const name of names) {
    if (!allowedNames.has(name)) {
      throw new Error(`Función no permitida: ${name}`);
    }
  }

  return expression;
}

function safeCalculate(input: string): number {
  const expression = normalizeExpression(input);
  const scope = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sqrt: Math.sqrt,
    log: Math.log10,
    ln: Math.log,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    PI: Math.PI,
    E: Math.E,
  };

  const fn = new Function(...Object.keys(scope), `"use strict"; return (${expression});`);
  const result = fn(...Object.values(scope));

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Resultado no válido");
  }

  return result;
}

function formatResult(value: number) {
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  if (abs > 0 && (abs < 0.000001 || abs >= 1e10)) return value.toExponential(6);
  return Number(value.toPrecision(12)).toString();
}

export default function ExamScientificCalculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [lastResult, setLastResult] = useState("0");
  const [error, setError] = useState("");

  const robotExpression = useMemo(() => {
    if (error) return "⚠️ Revisa la operación";
    if (display.length > 18) return `${display.slice(0, 18)}…`;
    return display;
  }, [display, error]);

  function append(value: string) {
    setError("");

    if (value === "AC") {
      setDisplay("0");
      return;
    }

    if (value === "DEL") {
      setDisplay((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
      return;
    }

    if (value === "=") {
      try {
        const result = formatResult(safeCalculate(display));
        setDisplay(result);
        setLastResult(result);
      } catch {
        setError("No se pudo calcular. Revisa paréntesis o símbolos.");
      }
      return;
    }

    const mapped: Record<string, string> = {
      sin: "sin(",
      cos: "cos(",
      tan: "tan(",
      log: "log(",
      ln: "ln(",
      "√": "√(",
      "x²": "^2",
      ANS: lastResult,
    };

    const next = mapped[value] ?? value;
    setDisplay((prev) => {
      const replaceInitialZero =
        prev === "0" && (/[0-9πe(√]/.test(next) || /^[a-z]+\(/.test(next));
      return replaceInitialZero ? next : prev + next;
    });
  }

  return (
    <div className="fixed left-3 top-28 z-[70] print:hidden md:left-5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex items-center gap-2 rounded-r-2xl border border-blue-400/30 bg-blue-600 px-3 py-3 text-sm font-black text-white shadow-2xl shadow-blue-900/20 transition hover:bg-blue-500"
        aria-expanded={open}
        aria-label="Abrir calculadora científica"
      >
        <span className="text-lg">🧮</span>
        <span className="hidden sm:inline">Calculadora</span>
      </button>

      <div
        className={`mt-3 w-[19rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[26px] border border-blue-400/20 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-[110%] opacity-0"
        }`}
      >
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-3xl shadow-inner">
              🤖
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Robot calculando</p>
              <p className="truncate text-sm font-semibold text-white/95">{robotExpression}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-right shadow-inner">
            <p className="min-h-8 break-all font-mono text-2xl font-black tabular-nums text-emerald-300">
              {display}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">RAD · científica</p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-5 gap-2">
            {BASIC_BUTTONS.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => append(btn)}
                className={`rounded-2xl px-2 py-2.5 text-sm font-black transition active:scale-95 ${
                  ["DEL", "AC"].includes(btn)
                    ? "bg-red-50 text-red-700 hover:bg-red-100"
                    : ["÷", "×", "-", "+"].includes(btn)
                      ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
              >
                {btn}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {SCIENCE_BUTTONS.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => append(btn)}
                className={`rounded-2xl px-2 py-2.5 text-xs font-black transition active:scale-95 ${
                  btn === "="
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-violet-50 text-violet-700 hover:bg-violet-100"
                }`}
              >
                {btn}
              </button>
            ))}
          </div>

          <p className="text-[10px] leading-relaxed text-slate-500">
            Funciones trigonométricas en radianes. Usa paréntesis para operaciones largas.
          </p>
        </div>
      </div>
    </div>
  );
}
