"use client"

import {
  buildSchoolPlanningRenderRows,
  type SchoolPlanningPdfMeta,
} from "@/lib/school-planning-pdf"

type Props = {
  meta: SchoolPlanningPdfMeta
  content: string
}

function CellText({ value }: { value: string }) {
  return <span className="whitespace-pre-line break-words">{value}</span>
}

export default function SchoolPlanningPreview({ meta, content }: Props) {
  let rows: ReturnType<typeof buildSchoolPlanningRenderRows>
  try {
    rows = buildSchoolPlanningRenderRows(meta, content)
  } catch (error) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-950">
        {error instanceof Error ? error.message : "No fue posible construir la vista institucional."}
      </div>
    )
  }

  const base =
    meta.baseCurricular ||
    `Base curricular utilizada: ${meta.subject} ${meta.course}, Currículum Nacional MINEDUC. Planificación organizada según los OA seleccionados para el período.`

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100 p-3">
      <div className="mx-auto min-w-[980px] max-w-[1180px] bg-white p-5 shadow-sm">
        <div className="mb-3 text-center text-[11px] leading-tight text-slate-900">
          <p>{meta.establishment || "Colegio Providencia"}</p>
          <p className="font-black uppercase">{meta.city || "ANTOFAGASTA"}</p>
        </div>

        <table className="w-full table-fixed border-collapse text-[11px] leading-[1.35] text-slate-950">
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
                <td className="border border-black px-3 py-3 text-center font-bold"><CellText value={row.week} /></td>
                <td className="border border-black px-3 py-3"><CellText value={row.oa} /></td>
                <td className="border border-black px-3 py-3"><CellText value={row.indicators} /></td>
                <td className="border border-black px-3 py-3"><CellText value={row.objective} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-2 whitespace-pre-line text-[10px] italic leading-snug text-slate-800">{base}</p>
      </div>
    </div>
  )
}
