import fs from "node:fs"

const PAGE = "app/examen/p/[code]/page.tsx"
const ROUTE = "app/api/agents/examen-docente/route.ts"
const MARKER = "EDUAI_EXAM_RUT_CONSENT_V1"

function read(file) {
  return fs.readFileSync(file, "utf8")
}

function write(file, source) {
  fs.writeFileSync(file, source)
}

function replaceOnce(source, oldValue, newValue, label) {
  const first = source.indexOf(oldValue)
  if (first < 0) throw new Error(`[student-rut-consent] No se encontró ${label}`)
  if (source.indexOf(oldValue, first + oldValue.length) >= 0) {
    throw new Error(`[student-rut-consent] ${label} aparece más de una vez`)
  }
  return source.replace(oldValue, newValue)
}

function replaceRegexOnce(source, regex, replacement, label) {
  let matches = 0
  source.replace(regex, () => {
    matches += 1
    return ""
  })
  if (matches !== 1) {
    throw new Error(`[student-rut-consent] ${label}: se esperó 1 coincidencia y hubo ${matches}`)
  }
  return source.replace(regex, replacement)
}

// ─────────────────────────────────────────────────────────────────────────────
// Página pública del estudiante
// ─────────────────────────────────────────────────────────────────────────────
{
  let source = read(PAGE)
  if (!source.includes(MARKER)) {
    source = replaceOnce(
      source,
      `  const [rut, setRut] = useState("");\n`,
      `  const [rut, setRut] = useState("");\n  // ${MARKER}: el estudiante solo ingresa RUT; nombre y curso vienen del servidor.\n  const [privacyConsent, setPrivacyConsent] = useState(false);\n  const [showPrivacyModal, setShowPrivacyModal] = useState(false);\n`,
      "estados de privacidad",
    )

    source = replaceRegexOnce(
      source,
      /\/\/ ── Cursos indexados ─+\nconst CURSOS_BASICA = \[.*?const TODOS_LOS_CURSOS = \[\.\.\.CURSOS_BASICA, \.\.\.CURSOS_MEDIA\];\n\n/s,
      "",
      "constantes de cursos",
    )

    source = source.replace(
      `            studentName: snapshot.name,\n            studentCourse: snapshot.course,\n            studentRut: snapshot.rut,`,
      `            studentRut: snapshot.rut,`,
    )

    source = replaceRegexOnce(
      source,
      /  \/\/ ── Inicio examen ─+\n  const startExam = useCallback\(async \(\) => \{.*?\n  \}, \[course, exam, isKiosk, name, requestFullscreen, rut, totalQ\]\);\n/s,
      `  // ── Inicio examen ──────────────────────────────────────────────────────────\n  const startExam = useCallback(async () => {\n    const cleanRut = normalizeRutInput(rut);\n\n    if (!exam?.id || !isValidRut(cleanRut)) {\n      setAutosaveStatus("error");\n      setAutosaveMessage(\n        "Ingresa un RUT válido sin puntos ni guion para identificarte.",\n      );\n      return;\n    }\n\n    if (!privacyConsent) {\n      setAutosaveStatus("error");\n      setAutosaveMessage(\n        "Debes confirmar que entiendes el uso de tus datos personales para continuar.",\n      );\n      return;\n    }\n\n    setSubmittedForSecurity(false);\n    setSecurityBlocked(false);\n    setSecurityTerminateReason("");\n    setAutosaveStatus("saving");\n    setAutosaveMessage("Verificando identidad...");\n\n    const fullscreenPromise = document.documentElement\n      .requestFullscreen({ navigationUI: "hide" } as any)\n      .catch(() => {});\n\n    try {\n      const res = await fetch("/api/agents/examen-docente", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({\n          action: "start_or_resume_attempt",\n          examId: exam.id,\n          studentRut: cleanRut,\n          consentAccepted: true,\n        }),\n      });\n\n      const data = await res.json().catch(() => ({}));\n      if (!res.ok || !data?.success) {\n        throw new Error(data?.error || "No se pudo verificar tu identidad.");\n      }\n\n      const attempt = data.attempt || {};\n      const resolvedName = String(attempt.studentName || "").trim();\n      const resolvedCourse = String(attempt.studentCourse || "").trim();\n\n      if (!resolvedName || !resolvedCourse) {\n        throw new Error(\n          "Tu registro de estudiante está incompleto. Consulta a tu docente.",\n        );\n      }\n\n      const savedAnswers = attempt.answers || {};\n      const nextAttemptId = String(attempt.clientAttemptId || createAttemptId());\n      attemptIdRef.current = nextAttemptId;\n\n      setName(resolvedName);\n      setCourse(resolvedCourse);\n      setRut(cleanRut);\n      setMcAnswers(normalizeNumberRecord(savedAnswers.mcAnswers));\n      setDevAnswers(normalizeTextRecord(savedAnswers.devAnswers));\n      setTfJustifications(normalizeTextRecord(savedAnswers.tfJustifications));\n      setDevelopmentArtifacts(\n        (savedAnswers.developmentArtifacts || {}) as Record<\n          number,\n          ExamNotebookArtifact\n        >,\n      );\n\n      const totalSeconds = Math.max(\n        60,\n        Number(exam?.settings?.timeLimit || 30) * 60,\n      );\n      const restoredTimeLeft = Number(attempt.timeLeft);\n      const safeTimeLeft =\n        Number.isFinite(restoredTimeLeft) && restoredTimeLeft > 0\n          ? Math.min(totalSeconds, Math.round(restoredTimeLeft))\n          : totalSeconds;\n      const restoredIndex = Math.max(\n        0,\n        Math.min(\n          totalQ > 0 ? totalQ - 1 : 0,\n          Number(attempt.currentQuestionIndex) || 0,\n        ),\n      );\n\n      startRef.current =\n        Date.now() - Math.max(0, totalSeconds - safeTimeLeft) * 1000;\n      setTimeLeft(safeTimeLeft);\n      setCurQ(restoredIndex);\n      setAutosaveStatus(data.resumed ? "saved" : "idle");\n      setAutosaveMessage(\n        data.resumed\n          ? \`Identidad verificada: \${resolvedName}. Avance anterior recuperado.\`\n          : \`Identidad verificada: \${resolvedName}. Tu avance se guardará automáticamente.\`,\n      );\n\n      await fullscreenPromise;\n      setPhase("exam");\n      setTimeout(() => requestFullscreen(), isKiosk ? 300 : 200);\n    } catch (error: any) {\n      setAutosaveStatus("error");\n      setAutosaveMessage(error?.message || "No se pudo verificar tu identidad.");\n      if (document.fullscreenElement) {\n        document.exitFullscreen().catch(() => {});\n      }\n    }\n  }, [exam, isKiosk, privacyConsent, requestFullscreen, rut, totalQ]);\n`,
      "función startExam",
    )

    source = source.replace(
      `            studentName: name,\n            studentCourse: course,\n            studentRut: normalizeRutInput(rut),`,
      `            studentRut: normalizeRutInput(rut),`,
    )

    source = replaceRegexOnce(
      source,
      /  if \(phase === "register"\) \{.*?\n  \}\n\n  if \(\(phase === "review" \|\| phase === "submitting"\) && submission\) \{/s,
      `  if (phase === "register") {\n    return (\n      <div className="min-h-screen bg-app px-4 py-8 text-main flex items-center justify-center">\n        <div className="w-full max-w-xl bg-card-soft-theme border border-soft rounded-2xl p-6 md:p-8">\n          <div className="text-center mb-6">\n            <div className="text-5xl mb-3">📝</div>\n            <h1 className="text-2xl md:text-3xl font-extrabold">\n              {exam?.title || "Examen"}\n            </h1>\n            <p className="text-sub text-sm mt-2">\n              {exam?.topic || "Evaluación"}\n            </p>\n            <p className="text-muted2 text-xs mt-3 leading-relaxed max-w-md mx-auto">\n              Ingresa únicamente tu RUT. EduAI consultará la nómina institucional\n              para reconocer tu nombre y curso antes de iniciar la evaluación.\n            </p>\n          </div>\n\n          <div>\n            <label className="text-sub text-xs font-semibold block mb-1">\n              RUT * <span className="text-muted2">(sin puntos ni guion)</span>\n            </label>\n            <input\n              value={rut}\n              onChange={(e) => {\n                setRut(normalizeRutInput(e.target.value));\n                if (autosaveStatus === "error") {\n                  setAutosaveStatus("idle");\n                  setAutosaveMessage("");\n                }\n              }}\n              placeholder="Ej: 123456789 o 12345678K"\n              autoComplete="off"\n              inputMode="text"\n              maxLength={9}\n              className="w-full bg-card-soft-theme border border-soft rounded-2xl px-4 py-3 text-main text-sm focus:outline-none focus:border-blue-500/30"\n            />\n            <div className="mt-1 flex flex-col gap-1 text-xs">\n              {rut ? (\n                <p className="text-muted2">\n                  RUT ingresado: <span className="font-semibold text-sub">{formatRut(rut)}</span>\n                </p>\n              ) : (\n                <p className="text-muted2">Acepta números y K como dígito verificador.</p>\n              )}\n              {rut && !isValidRut(rut) ? (\n                <p className="font-semibold text-red-600">\n                  RUT inválido. Revisa el dígito verificador.\n                </p>\n              ) : null}\n            </div>\n          </div>\n\n          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">\n            <div className="flex items-start gap-3">\n              <input\n                id="eduai-privacy-consent"\n                type="checkbox"\n                checked={privacyConsent}\n                onChange={(e) => {\n                  setPrivacyConsent(e.target.checked);\n                  if (autosaveStatus === "error") {\n                    setAutosaveStatus("idle");\n                    setAutosaveMessage("");\n                  }\n                }}\n                className="mt-0.5 h-4 w-4 rounded border-blue-300 accent-blue-600"\n              />\n              <p className="text-xs leading-relaxed text-slate-700">\n                <label htmlFor="eduai-privacy-consent" className="cursor-pointer">\n                  Entiendo y comprendo el uso de mis datos personales durante esta\n                  evaluación y acepto la{\" \"}\n                </label>\n                <button\n                  type="button"\n                  onClick={() => setShowPrivacyModal(true)}\n                  className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700"\n                >\n                  política de privacidad y seguridad de datos de EduAI\n                </button>\n                .\n              </p>\n            </div>\n          </div>\n\n          {/* ⚠️ Advertencia monitoreo IA */}\n          <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-50 px-4 py-4 space-y-2">\n            <div className="flex items-center gap-2">\n              <span className="text-xl">🔒</span>\n              <p className="text-sm font-bold text-amber-800">\n                Advertencia de monitoreo académico\n              </p>\n            </div>\n            <ul className="text-xs text-amber-700 space-y-1 pl-6 list-disc leading-relaxed">\n              <li>\n                Este examen está bajo{\" \"}\n                <strong>monitoreo de integridad académica</strong>.\n              </li>\n              <li>\n                Queda <strong>estrictamente prohibido</strong> el uso de\n                inteligencia artificial, buscadores, traductores o cualquier\n                herramienta de apoyo externo.\n              </li>\n              <li>\n                Cualquier intento de copiar, salir de la pantalla o usar otras\n                aplicaciones{\" \"}\n                <strong>será registrado y notificado al docente</strong>.\n              </li>\n              <li>\n                Al iniciar confirmas que realizarás esta evaluación{\" \"}\n                <strong>de forma honesta e individual</strong>.\n              </li>\n            </ul>\n            <p className="text-[11px] text-amber-600 pt-1 border-t border-amber-200">\n              Sistema de supervisión: EduAI Exam Security · Colegio Providencia\n            </p>\n          </div>\n\n          <button\n            onClick={startExam}\n            disabled={!isValidRut(rut) || !privacyConsent || autosaveStatus === "saving"}\n            className="w-full mt-4 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-30 transition-all"\n          >\n            {autosaveStatus === "saving"\n              ? "Verificando identidad..."\n              : "Identificarme e iniciar evaluación →"}\n          </button>\n\n          {autosaveMessage ? (\n            <p\n              className={\`mt-3 rounded-xl px-3 py-2 text-xs font-semibold \${autosaveStatus === "error" ? "bg-red-50 text-red-700" : autosaveStatus === "saving" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}\`}\n            >\n              {autosaveStatus === "saving" ? "🔎 " : autosaveStatus === "saved" ? "✅ " : autosaveStatus === "error" ? "⚠️ " : ""}\n              {autosaveMessage}\n            </p>\n          ) : null}\n\n          {showPrivacyModal ? (\n            <div\n              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4"\n              role="dialog"\n              aria-modal="true"\n              aria-labelledby="eduai-privacy-title"\n              onMouseDown={(e) => {\n                if (e.target === e.currentTarget) setShowPrivacyModal(false);\n              }}\n            >\n              <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl text-slate-800">\n                <div className="flex items-start justify-between gap-4">\n                  <div>\n                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600">\n                      Privacidad y ciberseguridad\n                    </p>\n                    <h2 id="eduai-privacy-title" className="mt-1 text-lg font-extrabold">\n                      Uso de datos en evaluaciones EduAI\n                    </h2>\n                  </div>\n                  <button\n                    type="button"\n                    onClick={() => setShowPrivacyModal(false)}\n                    className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"\n                    aria-label="Cerrar"\n                  >\n                    ✕\n                  </button>\n                </div>\n\n                <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">\n                  <p>\n                    Tu RUT se utiliza para localizar tu registro académico y\n                    confirmar tu nombre y curso. Durante la evaluación también se\n                    guardan tus respuestas, progreso y, cuando corresponda,\n                    eventos de seguridad asociados al examen.\n                  </p>\n                  <p>\n                    Estos datos se utilizan para identificar al estudiante,\n                    aplicar y revisar la evaluación, conservar su avance y apoyar\n                    la integridad académica. EduAI utiliza controles de acceso y\n                    medidas de seguridad para reducir accesos no autorizados.\n                  </p>\n                  <p>\n                    No compartas tu RUT ni el enlace de evaluación fuera de los\n                    canales oficiales. Si detectas un error en tus datos o tienes\n                    dudas sobre su uso, comunícate con tu docente o con la\n                    administración responsable de EduAI.\n                  </p>\n                  <p className="rounded-xl bg-blue-50 px-3 py-2 text-[11px] text-blue-700">\n                    Aviso de privacidad para evaluaciones EduAI · versión 1. La\n                    aceptación queda asociada al intento de evaluación.\n                  </p>\n                </div>\n\n                <button\n                  type="button"\n                  onClick={() => setShowPrivacyModal(false)}\n                  className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"\n                >\n                  Entendido\n                </button>\n              </div>\n            </div>\n          ) : null}\n        </div>\n      </div>\n    );\n  }\n\n  if ((phase === "review" || phase === "submitting") && submission) {`,
      "formulario de registro",
    )

    write(PAGE, source)
    console.log("[student-rut-consent] página pública actualizada")
  } else {
    console.log("[student-rut-consent] página pública ya actualizada")
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API de examen: la identidad se obtiene en servidor desde student_roster
// ─────────────────────────────────────────────────────────────────────────────
{
  let source = read(ROUTE)
  if (!source.includes(MARKER)) {
    source = replaceOnce(
      source,
      `function normalizeSavedAnswerBundle(value: any) {\n`,
      `const EXAM_PRIVACY_CONSENT_VERSION = "eduai_exam_privacy_v1"\n// ${MARKER}\nasync function resolveActiveRosterStudent(rutClean: string) {\n  const { data, error } = await supabase\n    .from("student_roster")\n    .select("id, student_name, course, school_year, updated_at")\n    .eq("rut_clean", rutClean)\n    .eq("active", true)\n    .order("school_year", { ascending: false })\n    .order("updated_at", { ascending: false })\n    .limit(1)\n\n  if (error) throw error\n  return Array.isArray(data) && data.length > 0 ? data[0] : null\n}\n\nfunction normalizeSavedAnswerBundle(value: any) {\n`,
      "helper de nómina",
    )

    source = replaceRegexOnce(
      source,
      /    \/\/ ── Iniciar o reanudar intento del estudiante ─+.*?\n    \/\/ ── Guardado automático del avance ─+/s,
      `    // ── Iniciar o reanudar intento del estudiante ───────────────────────────\n    // La identidad se resuelve en servidor a partir del RUT.\n    if (action === "start_or_resume_attempt") {\n      assertServerSupabaseAdmin()\n      const { examId, studentRut, consentAccepted } = body\n      const rutClean = normalizeRutClean(studentRut)\n\n      if (!examId) {\n        return NextResponse.json({ error: "Examen requerido" }, { status: 400 })\n      }\n\n      if (consentAccepted !== true) {\n        return NextResponse.json(\n          { error: "Debes aceptar la política de privacidad y seguridad de datos para continuar." },\n          { status: 400 }\n        )\n      }\n\n      if (!isValidRut(rutClean)) {\n        return NextResponse.json(\n          { error: "RUT inválido. Escríbelo sin puntos ni guion, incluyendo el dígito verificador o K." },\n          { status: 400 }\n        )\n      }\n\n      const { data: officialExam, error: examError } = await supabase\n        .from("teacher_exams")\n        .select("id, questions, settings, status")\n        .eq("id", examId)\n        .maybeSingle()\n\n      if (examError || !officialExam) {\n        return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 })\n      }\n\n      if (officialExam.status !== "active") {\n        return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })\n      }\n\n      const rosterStudent = await resolveActiveRosterStudent(rutClean)\n      if (!rosterStudent) {\n        return NextResponse.json(\n          { error: "No encontramos un estudiante activo con ese RUT. Revisa el RUT o consulta a tu docente." },\n          { status: 404 }\n        )\n      }\n\n      const studentName = String(rosterStudent.student_name || "").trim()\n      const studentCourse = String(rosterStudent.course || "").trim()\n      if (!studentName || !studentCourse) {\n        return NextResponse.json(\n          { error: "Tu registro de estudiante está incompleto. Consulta a tu docente antes de continuar." },\n          { status: 409 }\n        )\n      }\n\n      const formattedRut = formatRut(rutClean)\n      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0\n      const maxTimeLeft = getExamTimeLimitSeconds(officialExam.settings)\n      const acceptedAt = new Date().toISOString()\n\n      const { data: existingRows, error: existingError } = await supabase\n        .from("exam_attempt_drafts")\n        .select("id, client_attempt_id, answers, current_question_index, time_left, status, submission_id, started_at, last_saved_at, privacy_consent_at")\n        .eq("exam_id", examId)\n        .eq("student_rut_clean", rutClean)\n        .order("updated_at", { ascending: false })\n        .limit(1)\n\n      if (existingError) throw existingError\n      const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null\n\n      if (existing?.status === "submitted") {\n        return NextResponse.json(\n          {\n            error: "Este RUT ya tiene una entrega registrada para este examen.",\n            alreadySubmitted: true,\n            submissionId: existing.submission_id || null,\n          },\n          { status: 409 }\n        )\n      }\n\n      if (existing) {\n        const { error: identityUpdateError } = await supabase\n          .from("exam_attempt_drafts")\n          .update({\n            student_name: studentName,\n            student_course: studentCourse,\n            student_rut: formattedRut,\n            student_roster_id: rosterStudent.id,\n            privacy_consent_at: acceptedAt,\n            privacy_consent_version: EXAM_PRIVACY_CONSENT_VERSION,\n            updated_at: acceptedAt,\n          })\n          .eq("id", existing.id)\n\n        if (identityUpdateError) throw identityUpdateError\n\n        const nextIndex = Math.max(\n          0,\n          Math.min(totalQuestions > 0 ? totalQuestions - 1 : 0, Number(existing.current_question_index) || 0)\n        )\n        const savedTimeLeft = Number(existing.time_left)\n        return NextResponse.json({\n          success: true,\n          resumed: true,\n          attempt: {\n            clientAttemptId: existing.client_attempt_id,\n            answers: normalizeSavedAnswerBundle(existing.answers),\n            currentQuestionIndex: nextIndex,\n            timeLeft:\n              Number.isFinite(savedTimeLeft) && savedTimeLeft > 0\n                ? Math.min(maxTimeLeft, Math.round(savedTimeLeft))\n                : maxTimeLeft,\n            startedAt: existing.started_at || null,\n            lastSavedAt: existing.last_saved_at || null,\n            studentName,\n            studentCourse,\n            studentRut: formattedRut,\n            studentRutClean: rutClean,\n          },\n        })\n      }\n\n      const clientAttemptId = createServerAttemptId()\n      const defaultAnswers = normalizeSavedAnswerBundle(null)\n      const { data: created, error: createError } = await supabase\n        .from("exam_attempt_drafts")\n        .insert({\n          exam_id: examId,\n          student_name: studentName,\n          student_course: studentCourse,\n          student_rut: formattedRut,\n          student_rut_clean: rutClean,\n          student_roster_id: rosterStudent.id,\n          client_attempt_id: clientAttemptId,\n          answers: defaultAnswers,\n          current_question_index: 0,\n          time_left: maxTimeLeft,\n          status: "in_progress",\n          privacy_consent_at: acceptedAt,\n          privacy_consent_version: EXAM_PRIVACY_CONSENT_VERSION,\n          last_saved_at: acceptedAt,\n          updated_at: acceptedAt,\n        })\n        .select("id, client_attempt_id, answers, current_question_index, time_left, started_at, last_saved_at")\n        .single()\n\n      if (createError) throw createError\n\n      return NextResponse.json({\n        success: true,\n        resumed: false,\n        attempt: {\n          clientAttemptId: created.client_attempt_id,\n          answers: normalizeSavedAnswerBundle(created.answers),\n          currentQuestionIndex: 0,\n          timeLeft: maxTimeLeft,\n          startedAt: created.started_at || null,\n          lastSavedAt: created.last_saved_at || null,\n          studentName,\n          studentCourse,\n          studentRut: formattedRut,\n          studentRutClean: rutClean,\n        },\n      })\n    }\n\n    // ── Guardado automático del avance ───────────────────────────────────────`,
      "inicio/reanudación del intento",
    )

    source = source.replace(
      `      if (!examId || !String(studentName || "").trim() || !String(studentCourse || "").trim() || !clientAttemptId) {\n        return NextResponse.json({ error: "Faltan datos para guardar el avance" }, { status: 400 })\n      }`,
      `      if (!examId || !clientAttemptId) {\n        return NextResponse.json({ error: "Faltan datos para guardar el avance" }, { status: 400 })\n      }`,
    )

    source = source.replace(
      `.eq("student_rut_clean", rutClean)\n        .eq("student_course", String(studentCourse).trim())\n        .maybeSingle()`,
      `.eq("student_rut_clean", rutClean)\n        .eq("client_attempt_id", String(clientAttemptId))\n        .maybeSingle()`,
    )

    source = source.replace(
      `        student_name: String(studentName).trim(),\n        student_course: String(studentCourse).trim(),\n        student_rut: formattedRut,\n        student_rut_clean: rutClean,\n        client_attempt_id: String(clientAttemptId),`,
      `        client_attempt_id: String(clientAttemptId),`,
    )

    source = source.replace(
      `      const formattedRut = formatRut(rutClean)\n      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0`,
      `      const totalQuestions = Array.isArray(officialExam.questions) ? officialExam.questions.length : 0`,
    )

    source = source.replace(
      `        studentName,\n        studentCourse,\n        studentRut,`,
      `        studentRut,`,
    )

    source = source.replace(
      `      if (!examId || !studentName || !studentCourse || !answers) {\n        return NextResponse.json({ error: "Faltan datos" }, { status: 400 })\n      }`,
      `      if (!examId || !answers) {\n        return NextResponse.json({ error: "Faltan datos" }, { status: 400 })\n      }`,
    )

    const submitAnchor = `      if (officialExam.status !== "active") {\n        return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })\n      }\n\n      const sanitizedQuestions = sanitizeQuestions(officialExam.questions || [])`
    source = replaceOnce(
      source,
      submitAnchor,
      `      if (officialExam.status !== "active") {\n        return NextResponse.json({ error: "Este examen está cerrado" }, { status: 403 })\n      }\n\n      const rosterStudent = await resolveActiveRosterStudent(rutClean)\n      if (!rosterStudent) {\n        return NextResponse.json({ error: "No fue posible validar tu identidad para entregar el examen." }, { status: 404 })\n      }\n      const authoritativeName = String(rosterStudent.student_name || "").trim()\n      const authoritativeCourse = String(rosterStudent.course || "").trim()\n\n      const sanitizedQuestions = sanitizeQuestions(officialExam.questions || [])`,
      "validación de identidad al entregar",
    )

    source = source.replace(
      `          student_name:    studentName,\n          student_course:  studentCourse,\n          student_rut:     formattedRut,\n          student_rut_clean: rutClean,`,
      `          student_name:    authoritativeName,\n          student_course:  authoritativeCourse,\n          student_rut:     formattedRut,\n          student_rut_clean: rutClean,\n          student_roster_id: rosterStudent.id,`,
    )

    write(ROUTE, source)
    console.log("[student-rut-consent] API de examen actualizada")
  } else {
    console.log("[student-rut-consent] API de examen ya actualizada")
  }
}

const pageCheck = read(PAGE)
const routeCheck = read(ROUTE)
if (pageCheck.includes("NOMBRE *") || pageCheck.includes("CURSO *")) {
  throw new Error("[student-rut-consent] el formulario todavía solicita nombre o curso")
}
if (!pageCheck.includes("privacyConsent") || !pageCheck.includes("consentAccepted: true")) {
  throw new Error("[student-rut-consent] falta consentimiento obligatorio")
}
if (!routeCheck.includes("resolveActiveRosterStudent") || !routeCheck.includes("student_roster_id: rosterStudent.id")) {
  throw new Error("[student-rut-consent] la identidad no quedó vinculada a student_roster")
}

console.log("[student-rut-consent] identificación por RUT y consentimiento listos")
