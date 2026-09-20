"use client"

import { Fragment } from "react"
import {
  parseParvulariaPlanningDocument,
  serializeParvulariaPlanningDocument,
  type ParvulariaPlanningDocument,
  type ParvulariaPlanningRow,
} from "@/lib/parvularia-planning"

type Props = {
  content: string
  onChange: (content: string) => void
}

function Field({
  label,
  value,
  onChange,
  rows = 2,
  className = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  className?: string
}) {
  return (
    <textarea
      aria-label={label}
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full resize-y border-0 bg-white px-2 py-2 text-[10.5px] leading-[1.3] text-black outline-none transition focus:bg-sky-50 focus:ring-2 focus:ring-inset focus:ring-sky-400 ${className}`}
    />
  )
}

export default function ParvulariaPlanningEditor({ content, onChange }: Props) {
  let doc: ParvulariaPlanningDocument
  try {
    doc = parseParvulariaPlanningDocument(content)
  } catch (error) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-950">
        {error instanceof Error ? error.message : "No fue posible construir el editor de Educación Parvularia."}
      </div>
    )
  }

  function commit(next: ParvulariaPlanningDocument) {
    onChange(serializeParvulariaPlanningDocument(next))
  }

  function setHeader<K extends keyof ParvulariaPlanningDocument>(key: K, value: ParvulariaPlanningDocument[K]) {
    commit({ ...doc, [key]: value })
  }

  function setRow(index: number, key: keyof ParvulariaPlanningRow, value: string) {
    commit({
      ...doc,
      filas: doc.filas.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
    })
  }

  const labelCell = "border border-black bg-[#fbe4d5] px-3 py-2 align-top font-bold"
  const inputCell = "border border-black bg-white p-0 align-top"

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
        Todo el texto de la plantilla es editable: encabezado, datos generales, nombre de cada jornada y cada celda de las tres planificaciones diarias. Los cambios se conservan en la vista previa y en el PDF.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100 p-3">
        <div
          className="mx-auto min-w-[1180px] max-w-[1420px] bg-white px-8 py-6 shadow-sm"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          <Field
            label="Título de la planificación"
            value={doc.titulo}
            onChange={(value) => setHeader("titulo", value)}
            rows={1}
            className="mb-3 text-center text-[20px] font-bold underline"
          />

          <div className="mb-3 grid grid-cols-[190px_1fr] items-stretch text-[12px]">
            {[
              ["Nivel Educativo", "nivelEducativo"],
              ["Fechas", "fechas"],
              ["Educadora de Párvulos", "educadoraParvulos"],
              ["Asistentes de Párvulos", "asistentesParvulos"],
            ].map(([label, key]) => (
              <div key={key} className="contents">
                <div className="border-b border-slate-200 px-2 py-2 font-bold">{label}:</div>
                <Field
                  label={label}
                  value={String(doc[key as keyof ParvulariaPlanningDocument] || "")}
                  onChange={(value) => setHeader(key as keyof ParvulariaPlanningDocument, value as never)}
                  rows={1}
                />
              </div>
            ))}
          </div>

          <table className="w-full table-fixed border-collapse text-[11px] leading-[1.26] text-black">
            <colgroup><col style={{ width: "35%" }} /><col style={{ width: "65%" }} /></colgroup>
            <tbody>
              <tr><td className={labelCell}>Objetivo de aprendizaje:</td><td className={inputCell}><Field label="Objetivo de aprendizaje" value={doc.objetivoAprendizaje} onChange={(v) => setHeader("objetivoAprendizaje", v)} rows={4} /></td></tr>
              <tr><td className={labelCell}>Principio de Juego:</td><td className={inputCell}><Field label="Principio de Juego" value={doc.principioJuego} onChange={(v) => setHeader("principioJuego", v)} rows={3} /></td></tr>
              <tr><td className={labelCell}>Principio de actividad:</td><td className={inputCell}><Field label="Principio de actividad" value={doc.principioActividad} onChange={(v) => setHeader("principioActividad", v)} rows={3} /></td></tr>
              <tr><td className={labelCell}>Foco de experiencia:</td><td className={inputCell}><Field label="Foco de experiencia" value={doc.focoExperiencia} onChange={(v) => setHeader("focoExperiencia", v)} rows={3} /></td></tr>
            </tbody>
          </table>

          <table className="w-full table-fixed border-collapse text-[10.5px] leading-[1.25] text-black">
            <colgroup>
              <col style={{ width: "13.4%" }} /><col style={{ width: "13.4%" }} /><col style={{ width: "25.7%" }} />
              <col style={{ width: "15.7%" }} /><col style={{ width: "10.1%" }} /><col style={{ width: "8.5%" }} /><col style={{ width: "13.2%" }} />
            </colgroup>
            <thead>
              <tr className="bg-[#fbe4d5] text-center font-bold">
                <th className="border border-black px-2 py-2">Ámbito<br />Núcleo</th>
                <th className="border border-black px-2 py-2">Objetivos de<br />Aprendizajes</th>
                <th className="border border-black px-2 py-2">Experiencia de aprendizaje</th>
                <th className="border border-black px-2 py-2">Orientaciones Relevantes</th>
                <th className="border border-black px-2 py-2">Rol del equipo pedagógico y rol de la familia</th>
                <th className="border border-black px-2 py-2">Recursos</th>
                <th className="border border-black px-2 py-2">Evaluación</th>
              </tr>
            </thead>
            <tbody>
              {doc.filas.map((row, index) => (
                <Fragment key={index}>
                  <tr>
                    <td colSpan={7} className="border border-black bg-[#fbe4d5] p-0">
                      <Field
                        label={`Nombre de jornada ${index + 1}`}
                        value={row.jornada || `Jornada ${index + 1}`}
                        onChange={(v) => setRow(index, "jornada", v)}
                        rows={1}
                        className="bg-[#fbe4d5] text-[11px] font-bold"
                      />
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td className={inputCell}><Field label={`Ámbito y núcleo, fila ${index + 1}`} value={row.ambitoNucleo} onChange={(v) => setRow(index, "ambitoNucleo", v)} rows={12} /></td>
                    <td className={inputCell}><Field label={`Objetivos de aprendizaje, fila ${index + 1}`} value={row.objetivosAprendizajes} onChange={(v) => setRow(index, "objetivosAprendizajes", v)} rows={12} /></td>
                    <td className={inputCell}><Field label={`Experiencia de aprendizaje, fila ${index + 1}`} value={row.experienciaAprendizaje} onChange={(v) => setRow(index, "experienciaAprendizaje", v)} rows={18} /></td>
                    <td className={inputCell}><Field label={`Orientaciones relevantes, fila ${index + 1}`} value={row.orientacionesRelevantes} onChange={(v) => setRow(index, "orientacionesRelevantes", v)} rows={14} /></td>
                    <td className={inputCell}><Field label={`Rol del equipo y familia, fila ${index + 1}`} value={row.rolEquipoFamilia} onChange={(v) => setRow(index, "rolEquipoFamilia", v)} rows={14} /></td>
                    <td className={inputCell}><Field label={`Recursos, fila ${index + 1}`} value={row.recursos} onChange={(v) => setRow(index, "recursos", v)} rows={14} /></td>
                    <td className={inputCell}><Field label={`Evaluación, fila ${index + 1}`} value={row.evaluacion} onChange={(v) => setRow(index, "evaluacion", v)} rows={14} /></td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
