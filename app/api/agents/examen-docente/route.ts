// src/app/api/agents/examen-docente/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let code = ""
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Nota MINEDUC: 60% exigencia por defecto
function calcGrade(score: number, exigencia = 60): number {
  const pct = Math.max(0, Math.min(100, score))
  let nota: number
  if (pct >= exigencia) {
    nota = 4.0 + ((pct - exigencia) * 3.0) / (100 - exigencia)
  } else {
    nota = 1.0 + (pct * 3.0) / exigencia
  }
  return Math.round(nota * 10) / 10
}

// POST: Crear examen o enviar respuesta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // ── CREAR EXAMEN (docente) ──
    if (action === "create") {
      const { teacherId, title, topic, instructions, questions, settings } = body

      if (!teacherId || !title || !topic || !questions?.length) {
        return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
      }

      // Generar código único
      let code = generateCode()
      let attempts = 0
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from("teacher_exams")
          .select("code")
          .eq("code", code)
          .maybeSingle()
        if (!existing) break
        code = generateCode()
        attempts++
      }

      const { data, error } = await supabase
        .from("teacher_exams")
        .insert({
          teacher_id: teacherId,
          code,
          title,
          topic,
          instructions: instructions || null,
          questions,
          settings: {
            timeLimit: settings?.timeLimit || 30,
            questionCount: settings?.questionCount || 10,
            showResultToStudent: settings?.showResultToStudent !== false,
            examPercentage: settings?.examPercentage || 60,
          },
          status: "active",
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, exam: data, code })
    }

    // ── ENVIAR RESPUESTA (estudiante, público) ──
    if (action === "submit") {
      const { examId, studentName, studentCourse, studentRut, answers, questions, timeSpent, examPercentage } = body

      if (!examId || !studentName || !studentCourse || !answers || !questions) {
        return NextResponse.json({ error: "Faltan datos del estudiante" }, { status: 400 })
      }

      // Calcular score
      let correct = 0
      const gradedAnswers = answers.map((a: any, i: number) => {
        const q = questions[i]
        const isCorrect = a.selectedAnswer === q?.correctAnswer
        if (isCorrect) correct++
        return { questionIndex: i, selectedAnswer: a.selectedAnswer, isCorrect }
      })

      const total = questions.length
      const score = total > 0 ? (correct / total) * 100 : 0
      const grade = calcGrade(score, examPercentage || 60)

      const { data, error } = await supabase
        .from("exam_submissions")
        .insert({
          exam_id: examId,
          student_name: studentName,
          student_course: studentCourse,
          student_rut: studentRut || null,
          answers: gradedAnswers,
          score: Math.round(score * 10) / 10,
          grade,
          correct_count: correct,
          total_questions: total,
          time_spent: timeSpent || null,
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, submission: data })
    }

    // ── CERRAR EXAMEN ──
    if (action === "close") {
      const { examId, teacherId } = body
      const { error } = await supabase
        .from("teacher_exams")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", examId)
        .eq("teacher_id", teacherId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── REABRIR EXAMEN ──
    if (action === "reopen") {
      const { examId, teacherId } = body
      const { error } = await supabase
        .from("teacher_exams")
        .update({ status: "active", closed_at: null })
        .eq("id", examId)
        .eq("teacher_id", teacherId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err: any) {
    console.error("Exam API error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: Obtener examen por código (público) o listar exámenes del docente
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const teacherId = searchParams.get("teacherId")
    const examId = searchParams.get("examId")

    // ── Obtener examen por código (público, para estudiante) ──
    if (code) {
      const { data, error } = await supabase
        .from("teacher_exams")
        .select("id, code, title, topic, instructions, questions, settings, status")
        .eq("code", code)
        .maybeSingle()

      if (error || !data) {
        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })
      }
      if (data.status !== "active") {
        return NextResponse.json({ error: "Este examen ya no está disponible" }, { status: 403 })
      }
      return NextResponse.json({ exam: data })
    }

    // ── Obtener resultados de un examen (docente) ──
    if (examId) {
      const { data: exam } = await supabase
        .from("teacher_exams")
        .select("*")
        .eq("id", examId)
        .maybeSingle()

      const { data: submissions } = await supabase
        .from("exam_submissions")
        .select("*")
        .eq("exam_id", examId)
        .order("submitted_at", { ascending: true })

      return NextResponse.json({ exam, submissions: submissions || [] })
    }

    // ── Listar exámenes del docente ──
    if (teacherId) {
      const { data, error } = await supabase
        .from("teacher_exams")
        .select("id, code, title, topic, status, created_at, settings")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Contar submissions por examen
      const examsWithCount = await Promise.all(
        (data || []).map(async (exam) => {
          const { count } = await supabase
            .from("exam_submissions")
            .select("*", { count: "exact", head: true })
            .eq("exam_id", exam.id)
          return { ...exam, submissionCount: count || 0 }
        })
      )

      return NextResponse.json({ exams: examsWithCount })
    }

    return NextResponse.json({ error: "Parámetros faltantes" }, { status: 400 })
  } catch (err: any) {
    console.error("Exam GET error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
