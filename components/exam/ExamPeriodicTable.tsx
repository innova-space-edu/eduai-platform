"use client";

import { useEffect, useState } from "react";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.2;

export default function ExamPeriodicTable({
  imageSrc = "/exam-resources/periodic-table.png",
}: {
  imageSrc?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function changeZoom(delta: number) {
    setZoom((current) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))),
    );
  }

  return (
    <>
      <div className="fixed right-3 top-28 z-[70] print:hidden md:right-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 rounded-l-2xl border border-emerald-400/30 bg-emerald-600 px-3 py-3 text-sm font-black text-white shadow-2xl shadow-emerald-900/20 transition hover:bg-emerald-500"
          aria-label="Abrir tabla periódica"
        >
          <span className="text-lg">⚗️</span>
          <span className="hidden sm:inline">Tabla periódica</span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm print:hidden sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Tabla periódica"
        >
          <div className="flex h-[92vh] w-[98vw] max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-black text-slate-900 sm:text-base">⚗️ Tabla periódica</p>
                <p className="text-[11px] text-slate-500 sm:text-xs">
                  Amplía o reduce la tabla para revisar elementos, símbolos y números atómicos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changeZoom(-ZOOM_STEP)}
                  className="grid h-9 min-w-9 place-items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Reducir tabla periódica"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-100"
                  aria-label="Restablecer zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => changeZoom(ZOOM_STEP)}
                  className="grid h-9 min-w-9 place-items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Ampliar tabla periódica"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white p-3 sm:p-5">
              {imageError ? (
                <div className="grid min-h-full place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div>
                    <p className="text-4xl">⚗️</p>
                    <p className="mt-3 text-sm font-black text-slate-800">Tabla periódica no disponible</p>
                    <p className="mt-1 text-xs text-slate-500">Avise al docente para que revise el recurso de la evaluación.</p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto min-w-fit">
                  <img
                    src={imageSrc}
                    alt="Tabla periódica completa de los elementos químicos"
                    onError={() => setImageError(true)}
                    draggable={false}
                    className="mx-auto h-auto select-none"
                    style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: "none" }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
