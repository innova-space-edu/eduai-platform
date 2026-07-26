"use client"

import type { EducationalFormat } from "@/app/api/creator/educational-document/route"

function list(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((item) => !(item && typeof item === "object" && item.hidden === true)) : []
}

function text(value: unknown) {
  return value == null ? "" : String(value)
}

function Header({ data, label, accentColor }: { data: any; label: string; accentColor: string }) {
  return (
    <header className="border-b-4 px-8 py-7" style={{ borderColor: accentColor }}>
      <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accentColor }}>{label}</p>
      <h1 className="mt-2 text-3xl font-black leading-tight text-slate-900">{data?.title || label}</h1>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
        {data?.subject && <span>Asignatura: <strong className="text-slate-700">{data.subject}</strong></span>}
        {data?.grade && <span>Curso: <strong className="text-slate-700">{data.grade}</strong></span>}
        {data?.duration && <span>Duración: <strong className="text-slate-700">{data.duration}</strong></span>}
        {data?.estimatedTime && <span>Tiempo: <strong className="text-slate-700">{data.estimatedTime}</strong></span>}
        {data?.totalPoints != null && <span>Puntaje: <strong className="text-slate-700">{data.totalPoints} puntos</strong></span>}
      </div>
    </header>
  )
}

function SectionTitle({ children, accentColor }: { children: React.ReactNode; accentColor: string }) {
  return <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900"><span className="h-6 w-1.5 rounded-full" style={{ background: accentColor }} />{children}</h2>
}

function Question({ question, index, accentColor, showAnswer = false }: { question: any; index: number; accentColor: string; showAnswer?: boolean }) {
  const options = list(question?.options)
  const lines = Math.max(1, Number(question?.workspaceLines) || (question?.type === "development" ? 6 : 2))
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ background: accentColor }}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold leading-6 text-slate-800">{question?.prompt || question?.question || "Pregunta"}</p>{question?.points != null && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">{question.points} pts</span>}</div>
          {options.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{options.map((option, optionIndex) => <div key={optionIndex} className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600"><strong className="mr-2" style={{ color: accentColor }}>{String.fromCharCode(65 + optionIndex)}.</strong>{text(option)}</div>)}</div>}
          {!showAnswer && options.length === 0 && <div className="mt-3 space-y-2">{Array.from({ length: lines }).map((_, line) => <div key={line} className="h-5 border-b border-dashed border-slate-300" />)}</div>}
          {showAnswer && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><strong>Respuesta:</strong> {question?.correctAnswer || "Respuesta abierta"}{question?.explanation && <p className="mt-1"><strong>Explicación:</strong> {question.explanation}</p>}</div>}
        </div>
      </div>
    </article>
  )
}

function WorksheetPreview({ data, accentColor }: { data: any; accentColor: string }) {
  let questionIndex = 0
  return <><Header data={data} label="Guía de aprendizaje" accentColor={accentColor} /><div className="space-y-7 p-7 sm:p-9"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Objetivo</p><p className="mt-2 text-sm leading-6 text-slate-700">{data?.objective}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Instrucciones</p><p className="mt-2 text-sm leading-6 text-slate-700">{data?.instructions}</p></div></div>{list(data?.sections).map((section, sectionIndex) => <section key={sectionIndex}><SectionTitle accentColor={accentColor}>{section?.title || `Sección ${sectionIndex + 1}`}</SectionTitle>{section?.description && <p className="mb-3 text-sm leading-6 text-slate-600">{section.description}</p>}<div className="space-y-3">{list(section?.questions).map((question) => { const current = questionIndex++; return <Question key={question?.id || current} question={question} index={current} accentColor={accentColor} /> })}</div></section>)}{list(data?.reflection).length > 0 && <section><SectionTitle accentColor={accentColor}>Reflexión final</SectionTitle><div className="space-y-3">{list(data.reflection).map((prompt, index) => <Question key={index} question={{ prompt, workspaceLines: 3 }} index={questionIndex + index} accentColor={accentColor} />)}</div></section>}</div></>
}

function ExamPreview({ data, accentColor }: { data: any; accentColor: string }) {
  let questionIndex = 0
  return <><Header data={data} label="Evaluación" accentColor={accentColor} /><div className="space-y-7 p-7 sm:p-9"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Instrucciones generales</p><p className="mt-2 text-sm leading-6 text-slate-700">{data?.instructions}</p></div>{list(data?.sections).map((section, sectionIndex) => <section key={sectionIndex}><SectionTitle accentColor={accentColor}>{section?.title || `Ítem ${sectionIndex + 1}`}</SectionTitle>{section?.directions && <p className="mb-3 text-xs italic leading-5 text-slate-500">{section.directions}</p>}<div className="space-y-3">{list(section?.questions).map((question) => { const current = questionIndex++; return <Question key={question?.id || current} question={question} index={current} accentColor={accentColor} /> })}</div></section>)}</div></>
}

function RubricPreview({ data, accentColor }: { data: any; accentColor: string }) {
  const scale = list(data?.scale)
  return <><Header data={data} label="Rúbrica analítica" accentColor={accentColor} /><div className="space-y-6 p-7 sm:p-9"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Tarea evaluada</p><p className="mt-2 text-sm leading-6 text-slate-700">{data?.task}</p><p className="mt-2 text-xs leading-5 text-slate-500"><strong>Objetivo:</strong> {data?.objective}</p></div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead><tr className="bg-slate-100"><th className="border-b border-r border-slate-200 p-3 font-black text-slate-700">Criterio</th><th className="border-b border-r border-slate-200 p-3 font-black text-slate-700">Peso</th>{scale.map((level, index) => <th key={index} className="border-b border-r border-slate-200 p-3 font-black" style={{ color: accentColor }}>{level?.level}<span className="ml-1 text-[9px] text-slate-400">({level?.score})</span></th>)}</tr></thead><tbody>{list(data?.criteria).map((criterion, rowIndex) => <tr key={rowIndex} className={rowIndex % 2 ? "bg-slate-50" : "bg-white"}><td className="border-b border-r border-slate-200 p-3 align-top font-bold text-slate-700">{criterion?.criterion}<p className="mt-1 text-[10px] font-normal leading-4 text-slate-400">{criterion?.evidence}</p></td><td className="border-b border-r border-slate-200 p-3 align-top font-black" style={{ color: accentColor }}>{criterion?.weight}%</td>{scale.map((level, levelIndex) => { const descriptor = list(criterion?.descriptors).find((item) => item?.level === level?.level) || list(criterion?.descriptors)[levelIndex]; return <td key={levelIndex} className="border-b border-r border-slate-200 p-3 align-top leading-5 text-slate-600">{descriptor?.description || "—"}</td> })}</tr>)}</tbody></table></div></div></>
}

function AnswerKeyPreview({ data, accentColor }: { data: any; accentColor: string }) {
  return <><Header data={data} label="Solucionario" accentColor={accentColor} /><div className="space-y-4 p-7 sm:p-9">{list(data?.answers).map((answer, index) => <article key={index} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white" style={{ background: accentColor }}>{answer?.number || index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold leading-6 text-slate-800">{answer?.question}</p><span className="text-[10px] font-bold text-slate-400">{answer?.points} pts</span></div><p className="mt-2 text-sm leading-6 text-emerald-700"><strong>Respuesta:</strong> {answer?.correctAnswer}</p>{answer?.development && <p className="mt-2 text-xs leading-6 text-slate-600"><strong>Desarrollo:</strong> {answer.development}</p>}{list(answer?.commonErrors).length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong>Errores frecuentes:</strong> {list(answer.commonErrors).join(" · ")}</div>}{answer?.partialCredit && <p className="mt-2 text-[11px] leading-5 text-slate-500"><strong>Puntaje parcial:</strong> {answer.partialCredit}</p>}</div></div></article>)}</div></>
}

function LabPreview({ data, accentColor }: { data: any; accentColor: string }) {
  return <><Header data={data} label="Ficha de laboratorio" accentColor={accentColor} /><div className="space-y-7 p-7 sm:p-9"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Pregunta de investigación</p><p className="mt-2 text-sm font-bold leading-6 text-slate-700">{data?.researchQuestion}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Objetivo</p><p className="mt-2 text-sm leading-6 text-slate-700">{data?.objective}</p></div></div>{list(data?.safety).length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black text-amber-800">⚠ Seguridad</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-800">{list(data.safety).map((item, index) => <li key={index}>{text(item)}</li>)}</ul></section>}<div className="grid gap-6 sm:grid-cols-2"><section><SectionTitle accentColor={accentColor}>Materiales</SectionTitle><ul className="space-y-2">{list(data?.materials).map((item, index) => <li key={index} className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">□ {text(item)}</li>)}</ul></section><section><SectionTitle accentColor={accentColor}>Hipótesis</SectionTitle><p className="text-sm leading-6 text-slate-600">{data?.hypothesisPrompt}</p><div className="mt-3 space-y-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-5 border-b border-dashed border-slate-300" />)}</div></section></div><section><SectionTitle accentColor={accentColor}>Procedimiento</SectionTitle><div className="space-y-3">{list(data?.procedure).map((step, index) => <div key={index} className="flex gap-3 rounded-2xl border border-slate-200 p-4"><span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black text-white" style={{ background: accentColor }}>{step?.step || index + 1}</span><div><p className="text-sm leading-6 text-slate-700">{step?.instruction}</p>{step?.evidence && <p className="mt-1 text-[10px] italic text-slate-400">Evidencia: {step.evidence}</p>}</div></div>)}</div></section><section><SectionTitle accentColor={accentColor}>Registro de datos</SectionTitle><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[600px] border-collapse text-xs"><thead><tr>{list(data?.dataTable?.columns).map((column, index) => <th key={index} className="border-b border-r border-slate-200 bg-slate-100 p-3 text-left font-black" style={{ color: accentColor }}>{text(column)}</th>)}</tr></thead><tbody>{Array.from({ length: Math.min(12, Math.max(3, Number(data?.dataTable?.suggestedRows) || 6)) }).map((_, row) => <tr key={row}>{list(data?.dataTable?.columns).map((__, column) => <td key={column} className="h-10 border-b border-r border-slate-200 p-2" />)}</tr>)}</tbody></table></div></section><section><SectionTitle accentColor={accentColor}>Análisis</SectionTitle><div className="space-y-3">{list(data?.analysisQuestions).map((prompt, index) => <Question key={index} question={{ prompt, workspaceLines: 3 }} index={index} accentColor={accentColor} />)}</div></section></div></>
}

function ExitTicketPreview({ data, accentColor }: { data: any; accentColor: string }) {
  return <><Header data={data} label="Ticket de salida" accentColor={accentColor} /><div className="space-y-4 p-7 sm:p-9"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"><strong>Objetivo de la clase:</strong> {data?.lessonObjective}</div>{list(data?.prompts).map((prompt, index) => <Question key={index} question={{ prompt: prompt?.prompt, workspaceLines: prompt?.responseSpace === "short" ? 1 : prompt?.responseSpace === "long" ? 4 : 2 }} index={index} accentColor={accentColor} />)}</div></>
}

function ChecklistPreview({ data, accentColor }: { data: any; accentColor: string }) {
  return <><Header data={data} label="Lista de cotejo" accentColor={accentColor} /><div className="space-y-7 p-7 sm:p-9"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm leading-6 text-slate-700"><strong>Propósito:</strong> {data?.purpose}</p><p className="mt-2 text-xs leading-5 text-slate-500">{data?.instructions}</p></div>{list(data?.categories).map((category, index) => <section key={index}><SectionTitle accentColor={accentColor}>{category?.category || `Categoría ${index + 1}`}</SectionTitle><div className="overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[1fr_80px_80px_1.2fr] bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-500"><div className="p-3">Indicador</div><div className="p-3 text-center">Sí</div><div className="p-3 text-center">No</div><div className="p-3">Evidencia</div></div>{list(category?.items).map((item, itemIndex) => <div key={itemIndex} className="grid grid-cols-[1fr_80px_80px_1.2fr] border-t border-slate-200 text-xs text-slate-600"><div className="p-3">{item?.mandatory && <strong className="mr-1 text-red-500">*</strong>}{item?.item}</div><div className="border-l border-slate-200 p-3 text-center">□</div><div className="border-l border-slate-200 p-3 text-center">□</div><div className="border-l border-slate-200 p-3">{item?.evidence}</div></div>)}</div></section>)}</div></>
}

function ReportPreview({ data, accentColor }: { data: any; accentColor: string }) {
  return <><Header data={data} label="Informe" accentColor={accentColor} /><div className="space-y-8 p-7 sm:p-10"><section className="rounded-3xl border p-5" style={{ borderColor: `${accentColor}33`, background: `${accentColor}08` }}><p className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>Resumen ejecutivo</p><p className="mt-3 text-sm leading-7 text-slate-700">{data?.executiveSummary}</p></section><section><SectionTitle accentColor={accentColor}>Objetivos</SectionTitle><ul className="space-y-2">{list(data?.objectives).map((item, index) => <li key={index} className="flex gap-2 text-sm leading-6 text-slate-600"><span style={{ color: accentColor }}>●</span>{text(item)}</li>)}</ul></section><section><SectionTitle accentColor={accentColor}>Metodología</SectionTitle><p className="text-sm leading-7 text-slate-600">{data?.methodology}</p></section>{list(data?.sections).map((section, index) => <section key={index}><SectionTitle accentColor={accentColor}>{section?.heading || `Sección ${index + 1}`}</SectionTitle><p className="text-sm leading-7 text-slate-600">{section?.content}</p>{section?.keyFinding && <div className="mt-3 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: `${accentColor}30`, background: `${accentColor}08`, color: accentColor }}>Hallazgo clave: {section.keyFinding}</div>}</section>)}<section><SectionTitle accentColor={accentColor}>Conclusiones</SectionTitle><ol className="space-y-2">{list(data?.conclusions).map((item, index) => <li key={index} className="text-sm leading-6 text-slate-600"><strong className="mr-2" style={{ color: accentColor }}>{index + 1}.</strong>{text(item)}</li>)}</ol></section></div></>
}

export default function EducationalDocumentPreview({ format, data, accentColor }: { format: EducationalFormat; data: any; accentColor: string }) {
  return (
    <article className="mx-auto min-h-[900px] w-full max-w-[980px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {format === "worksheet" && <WorksheetPreview data={data} accentColor={accentColor} />}
      {format === "rubric" && <RubricPreview data={data} accentColor={accentColor} />}
      {format === "exam" && <ExamPreview data={data} accentColor={accentColor} />}
      {format === "answer-key" && <AnswerKeyPreview data={data} accentColor={accentColor} />}
      {format === "lab-sheet" && <LabPreview data={data} accentColor={accentColor} />}
      {format === "exit-ticket" && <ExitTicketPreview data={data} accentColor={accentColor} />}
      {format === "checklist" && <ChecklistPreview data={data} accentColor={accentColor} />}
      {format === "report" && <ReportPreview data={data} accentColor={accentColor} />}
      <footer className="flex items-center justify-between border-t border-slate-200 px-8 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-400"><span>EduAI Creator Studio</span><span>Documento editable por capas</span></footer>
    </article>
  )
}
