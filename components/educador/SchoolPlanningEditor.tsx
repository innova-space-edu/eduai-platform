"use client"

import {
  buildSchoolPlanningRenderRows,
  replaceSchoolPlanningRows,
  type SchoolPlanningPdfMeta,
  type SchoolPlanningPdfRow,
} from "@/lib/school-planning-pdf"

type Props = {
  meta: SchoolPlanningPdfMeta
  content: string
  onChange: (content: string) => void
}

function EditableCell({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <textarea
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-[150px] w-full resize-y border-0 bg-white px-3 py-3 text-[11px] leading-[1.4] text-slate-950 outline-none transition focus:bg-sky-50 focus:ring-2 focus:ring-inset focus:ring-sky-400"
    />
  )
}

export default function SchoolPlanningEditor({ meta, content, onChange }: Props) {
  let rows: SchoolPlanningPdfRow[]
  try {
    rows = buildSchoolPlanningRenderRows(meta, content)
  } catch (error) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-950">
        {error instanceof Error ? error.message : "No fue posible construir el editor institucional."}
      </div>
    )
  }

  function updateRow(index: number, field: keyof SchoolPlanningPdfRow, value: string) {
    const nextRows = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row
    )
    onChange(replaceSchoolPlanningRows(content, nextRows))
  }

  const base =
    meta.baseCurricular ||
    `Base curricular utilizada: ${meta.subject} ${meta.course}, Currículum Nacional MINEDUC. Planificación organizada según los OA seleccionados para el período.`

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
        Edita directamente cualquier celda de la tabla. Los cambios se guardan en esta planificación y se respetan también al exportar el PDF.
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100 p-3">
        <div className="mx-auto min-w-[980px] max-w-[1180px] bg-white p-5 shadow-sm">
          <div className="mb-3 text-center text-[11px] leading-tight text-slate-900">
            <p>{meta.establishment || "Colegio Providencia"}</p>
            <p className="font-black uppercase">{meta.city || "ANTOFAGASTA"}</p>
          </div>

          <table className="w-full table-fixed border-collapse text-slate-950">
            <colgroup>
              <col className="w-1/4" />
              <col className="w-1/4" />
              <col className="w-1/4" />
              <col className="w-1/4" />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={4} className="border border-black bg-white px-3 py-2 text-center text-[22px] font-black">
                  CRONOGRAMA {meta.year}
                </th>
              </tr>
              <tr>
                <th colSpan={4} className="border border-black bg-[#fce4d6] px-3 py-2 text-center text-[17px] font-black">
                  {meta.periodLabel}
                </th>
              </tr>
              <tr className="bg-white text-left text-[11px] font-semibold">
                <td className="border border-black px-3 py-2"><strong>PROFESOR:</strong> {meta.professor}</td>
                <td className="border border-black px-3 py-2"><strong>ASIGNATURA:</strong> {meta.subject}</td>
                <td className="border border-black px-3 py-2"><strong>HORAS:</strong> {meta.hours}</td>
                <td className="border border-black px-3 py-2"><strong>CURSO:</strong> {meta.course}</td>
              </tr>
              <tr className="bg-[#ccc0da] text-center text-[11px] font-black">
                <th className="border border-black px-3 py-2">SEMANA / FECHA</th>
                <th className="border border-black px-3 py-2">OA</th>
                <th className="border border-black px-3 py-2">INDICADORES DE EVALUACIÓN</th>
                <th className="border border-black px-3 py-2">OBJETIVO DE LA CLASE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="align-top">
                  <td className="border border-black bg-white p-0">
                    <EditableCell
                      value={row.week}
                      onChange={(value) => updateRow(index, "week", value)}
                      label={`Semana o fecha, fila ${index + 1}`}
                    />
                  </td>
                  <td className="border border-black bg-white p-0">
                    <EditableCell
                      value={row.oa}
                      onChange={(value) => updateRow(index, "oa", value)}
                      label={`OA, fila ${index + 1}`}
                    />
                  </td>
                  <td className="border border-black bg-white p-0">
                    <EditableCell
                      value={row.indicators}
                      onChange={(value) => updateRow(index, "indicators", value)}
                      label={`Indicadores de evaluación, fila ${index + 1}`}
                    />
                  </td>
                  <td className="border border-black bg-white p-0">
                    <EditableCell
                      value={row.objective}
                      onChange={(value) => updateRow(index, "objective", value)}
                      label={`Objetivo de la clase, fila ${index + 1}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-2 whitespace-pre-line text-[10px] italic leading-snug text-slate-800">{base}</p>
        </div>
      </div>
    </div>
  )
}
