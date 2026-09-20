"use client"

import { parseParvulariaPlanningDocument } from "@/lib/parvularia-planning"

type Props = {
  content: string
}

function Text({ value, className = "" }: { value: string; className?: string }) {
  return <span className={`whitespace-pre-line break-words ${className}`}>{value}</span>
}

export default function ParvulariaPlanningPreview({ content }: Props) {
  let doc
  try {
    doc = parseParvulariaPlanningDocument(content)
  } catch (error) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-950">
        {error instanceof Error ? error.message : "No fue posible construir la vista de Educación Parvularia."}
      </div>
    )
  }

  const labelCell = "border border-black bg-[#fbe4d5] px-3 py-2 align-top font-bold"
  const valueCell = "border border-black bg-white px-3 py-2 align-top"

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100 p-3">
      <div
        className="mx-auto min-w-[1180px] max-w-[1420px] bg-white px-8 py-6 shadow-sm"
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        <h2 className="mb-4 text-center text-[20px] font-bold underline">{doc.titulo}</h2>

        <div className="mb-3 text-[12px] leading-[1.35]">
          <p><strong>Nivel Educativo:</strong> {doc.nivelEducativo}</p>
          <p><strong>Fechas:</strong> {doc.fechas}</p>
          <p><strong>Educadora de Párvulos:</strong> {doc.educadoraParvulos}</p>
          <p><strong>Asistentes de Párvulos:</strong> {doc.asistentesParvulos}</p>
        </div>

        <table className="mb-0 w-full table-fixed border-collapse text-[11px] leading-[1.26] text-black">
          <colgroup>
            <col style={{ width: "35%" }} />
            <col style={{ width: "65%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td className={labelCell}>Objetivo de aprendizaje:</td>
              <td className={valueCell}><Text value={doc.objetivoAprendizaje} /></td>
            </tr>
            <tr>
              <td className={labelCell}>Principio de Juego:</td>
              <td className={valueCell}><Text value={doc.principioJuego} /></td>
            </tr>
            <tr>
              <td className={labelCell}>Principio de actividad:</td>
              <td className={valueCell}><Text value={doc.principioActividad} /></td>
            </tr>
            <tr>
              <td className={labelCell}>Foco de experiencia:</td>
              <td className={valueCell}><Text value={doc.focoExperiencia} /></td>
            </tr>
          </tbody>
        </table>

        <table className="w-full table-fixed border-collapse text-[10.5px] leading-[1.25] text-black">
          <colgroup>
            <col style={{ width: "13.4%" }} />
            <col style={{ width: "13.4%" }} />
            <col style={{ width: "25.7%" }} />
            <col style={{ width: "15.7%" }} />
            <col style={{ width: "10.1%" }} />
            <col style={{ width: "8.5%" }} />
            <col style={{ width: "13.2%" }} />
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
              <tr key={index} className="align-top">
                <td className="border border-black px-2 py-3"><Text value={row.ambitoNucleo} /></td>
                <td className="border border-black px-2 py-3"><Text value={row.objetivosAprendizajes} /></td>
                <td className="border border-black px-2 py-3"><Text value={row.experienciaAprendizaje} /></td>
                <td className="border border-black px-2 py-3"><Text value={row.orientacionesRelevantes} /></td>
                <td className="border border-black px-2 py-3"><Text value={row.rolEquipoFamilia} /></td>
                <td className="border border-black px-2 py-3"><Text value={row.recursos} /></td>
                <td className="border border-black px-2 py-3"><Text value={row.evaluacion} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
