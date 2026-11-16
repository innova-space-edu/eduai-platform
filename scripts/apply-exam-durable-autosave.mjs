import {readFileSync,writeFileSync} from "node:fs";

function edit(path,mutate){
 const original=readFileSync(path,"utf8");
 if(original.includes("// EXAM_DURABLE_AUTOSAVE_V2"))return;
 let source=original;
 const replace=(before,after)=>{if(!source.includes(before))throw Error("[exam-durable-autosave] "+path+": "+before.slice(0,120));source=source.replace(before,()=>after)};
 const section=(start,end,body)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0)throw Error("[exam-durable-autosave] missing section "+start);source=source.slice(0,a)+body+source.slice(b)};
 mutate(replace,section);
 writeFileSync(path,"// EXAM_DURABLE_AUTOSAVE_V2\n"+source);
}
edit("app/api/agents/examen-docente/route.ts",(r,s)=>{
 r('      const defaultAnswers = normalizeSavedAnswerBundle(null)','      const defaultAnswers = { ...normalizeSavedAnswerBundle(null), durationSeconds: maxTimeLeft }');
 r('            timeLeft: remainingExamSeconds(existing.started_at, maxTimeLeft),','            timeLeft: remainingExamSeconds(existing.started_at, Number(existing.answers?.durationSeconds) || maxTimeLeft),\n            durationSeconds: Number(existing.answers?.durationSeconds) || maxTimeLeft,\n            saveId: existing.answers?.saveId || null,');
 r('          startedAt: created.started_at || null,','          durationSeconds: maxTimeLeft,\n          saveId: null,\n          startedAt: created.started_at || null,');
 r('.select("id, status, submission_id, started_at")','.select("id, status, submission_id, started_at, answers, last_saved_at, current_question_index, time_left")');
 r('      const nextTimeLeft = remainingExamSeconds(existing.started_at, maxTimeLeft)','      const durationSeconds = Number(existing.answers?.durationSeconds) || maxTimeLeft\n      const nextTimeLeft = remainingExamSeconds(existing.started_at, durationSeconds)');
 r('      if (nextTimeLeft === 0) return NextResponse.json({ error: "El tiempo de la evaluación terminó." }, { status: 409 })','      if (nextTimeLeft === 0) return NextResponse.json({ error: "El tiempo de la evaluación terminó.", code:"EXAM_TIME_EXPIRED" }, { status: 409 })\n      const saveId = typeof body.saveId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(body.saveId) ? body.saveId : null\n      if(saveId && existing.answers?.saveId===saveId) return NextResponse.json({success:true,attempt:{clientAttemptId,currentQuestionIndex:existing.current_question_index,timeLeft:nextTimeLeft,lastSavedAt:existing.last_saved_at,saveId}})\n      if(Object.prototype.hasOwnProperty.call(body,"expectedSavedAt") && body.expectedSavedAt !== (existing.last_saved_at || null)) return NextResponse.json({error:"El avance cambió en otra sesión. Vuelve a identificarte para recuperar el último guardado.",code:"EXAM_SAVE_CONFLICT"},{status:409})');
 r('        answers: normalizeSavedAnswerBundle(answers),\n        current_question_index: nextIndex,','        answers: { ...normalizeSavedAnswerBundle(answers), durationSeconds, saveId },\n        current_question_index: nextIndex,');
 r('        last_saved_at: new Date().toISOString(),\n        updated_at: new Date().toISOString(),\n      }\n\n      const { data: saved, error: saveError } = await createServerSupabase()\n        .from("exam_attempt_drafts").update(row).eq("id", existing.id).eq("status", "in_progress")\n        .select("id, client_attempt_id, current_question_index, time_left, last_saved_at")\n        .single()\n\n      if (saveError) throw saveError','        last_saved_at: new Date(Math.max(Date.now(), (Date.parse(existing.last_saved_at || "") || 0) + 1)).toISOString(),\n        updated_at: new Date().toISOString(),\n      }\n\n      const write = createServerSupabase().from("exam_attempt_drafts").update(row).eq("id", existing.id).eq("status", "in_progress")\n      const { data: saved, error: saveError } = await (existing.last_saved_at ? write.eq("last_saved_at",existing.last_saved_at) : write.is("last_saved_at",null))\n        .select("id, client_attempt_id, current_question_index, time_left, last_saved_at").maybeSingle()\n      if (saveError) throw saveError\n      if (!saved) return NextResponse.json({error:"El avance cambió en otra sesión. Vuelve a identificarte.",code:"EXAM_SAVE_CONFLICT"},{status:409})');
 r('          lastSavedAt: saved.last_saved_at,','          lastSavedAt: saved.last_saved_at,\n          saveId,');
 r('      const duration = getExamTimeLimitSeconds(officialExam.settings)','      const duration = Number(existingDraft.answers?.durationSeconds) || getExamTimeLimitSeconds(officialExam.settings)');
});
edit("app/examen/p/[code]/page.tsx",(r,s)=>{
 r('import ExamDigitalClock from "@/components/exam/ExamDigitalClock";','import ExamDigitalClock from "@/components/exam/ExamDigitalClock";\nimport {saveCheckpoint,recoverCheckpoint,clearCheckpoint,type AttemptCheckpoint} from "@/lib/exam/attempt-checkpoint";');
 r('        latex: artifact.latex || "",','        pages: Array.isArray(artifact.pages) ? artifact.pages : [],\n        latex: artifact.latex || "",');
 r('  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);','  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const pendingCheckpoint=useRef<AttemptCheckpoint|null>(null);\n  const lastSavedAtRef=useRef<string|null>(null);\n  const lastSaveIdRef=useRef<string|null>(null);\n  const sendingSaveIdRef=useRef<string|null>(null);\n  const saveTailRef=useRef<Promise<boolean>>(Promise.resolve(true));\n  const submitLockRef=useRef(false);\n  const deadlineRef=useRef(0);');
 s('  // ── Guardado automático del intento','  // ── Inicio examen',`  // ── Guardado automático del intento ───────────────────────────────────────
  type SaveOverrides = {
    mcAnswers?: Record<number,number>; devAnswers?:Record<number,string>;
    tfJustifications?:Record<number,string>;developmentArtifacts?:Record<number,ExamNotebookArtifact>;
    currentQuestionIndex?:number;timeLeft?:number;
  };
  const stageCheckpoint=useCallback((overrides:SaveOverrides={})=>{
    const snapshot=latestExamStateRef.current;
    if(snapshot.phase!=="exam"||!snapshot.exam?.id||!credentialRef.current)return null;
    const merged={...snapshot,...overrides,curQ:overrides.currentQuestionIndex??snapshot.curQ};
    latestExamStateRef.current=merged;
    const checkpoint:AttemptCheckpoint={
      baseSavedAt:lastSavedAtRef.current,saveId:createAttemptId(),parentSaveId:sendingSaveIdRef.current||lastSaveIdRef.current,
      answers:{mcAnswers:merged.mcAnswers,devAnswers:merged.devAnswers,tfJustifications:merged.tfJustifications,developmentArtifacts:serializeDevelopmentArtifacts(merged.developmentArtifacts)},
      currentQuestionIndex:merged.curQ,timeLeft:merged.timeLeft
    };
    pendingCheckpoint.current=checkpoint;
    void saveCheckpoint(snapshot.exam.id,attemptIdRef.current,credentialRef.current,checkpoint);
    return checkpoint;
  },[]);
  const autosaveAttempt=useCallback((overrides:SaveOverrides={},options:{silent?:boolean}={}):Promise<boolean>=>{
    if(Object.keys(overrides).length)stageCheckpoint(overrides);
    const run=async()=>{
      const snapshot=latestExamStateRef.current;
      if(snapshot.phase!=="exam"||!snapshot.exam?.id||!credentialRef.current)return false;
      const checkpoint=pendingCheckpoint.current;
      if(!checkpoint)return true;
      const examId=snapshot.exam.id,attemptId=attemptIdRef.current,credential=credentialRef.current;
      const outgoing={...checkpoint,baseSavedAt:lastSavedAtRef.current,parentSaveId:lastSaveIdRef.current};
      sendingSaveIdRef.current=outgoing.saveId;
      setAutosaveStatus("saving");setAutosaveMessage("Guardando avance...");
      try{
        const res=await fetch("/api/agents/examen-docente",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          action:"autosave_attempt",examId,attemptCredential:credential,clientAttemptId:attemptId,answers:outgoing.answers,currentQuestionIndex:outgoing.currentQuestionIndex,timeLeft:outgoing.timeLeft,expectedSavedAt:outgoing.baseSavedAt,saveId:outgoing.saveId
        })});
        const data=await res.json().catch(()=>({}));
        if(!res.ok||!data.success)throw Error(data.error||"No se pudo guardar el avance.");
        lastSavedAtRef.current=data.attempt.lastSavedAt||null;lastSaveIdRef.current=outgoing.saveId;
        if(pendingCheckpoint.current?.saveId===outgoing.saveId){
          pendingCheckpoint.current=null;clearCheckpoint(examId,attemptId);
          setAutosaveStatus("saved");setAutosaveMessage("Avance guardado en servidor");
        }else if(pendingCheckpoint.current){
          const rebased={...pendingCheckpoint.current,baseSavedAt:lastSavedAtRef.current,parentSaveId:lastSaveIdRef.current};
          pendingCheckpoint.current=rebased;void saveCheckpoint(examId,attemptId,credential,rebased);
          setAutosaveStatus("saving");setAutosaveMessage("Guardando cambios recientes...");
        }
        return true;
      }catch(error:any){
        const latest=pendingCheckpoint.current;
        const local=latest?await saveCheckpoint(examId,attemptId,credential,latest):false;
        setAutosaveStatus("error");setAutosaveMessage((error?.message||"Sin conexión.")+(local?" Copia local cifrada guardada.":" No se pudo confirmar copia local; no cierres la página."));
        return false;
      }finally{sendingSaveIdRef.current=null}
    };
    const next=saveTailRef.current.catch(()=>false).then(run);saveTailRef.current=next;return next;
  },[stageCheckpoint]);
  const scheduleAutosave=useCallback((overrides:SaveOverrides={})=>{
    if(!stageCheckpoint(overrides))return;
    if(autosaveTimerRef.current)clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus("saving");setAutosaveMessage("Guardando avance...");
    autosaveTimerRef.current=setTimeout(()=>void autosaveAttempt(),350);
  },[stageCheckpoint,autosaveAttempt]);
  useEffect(()=>{
    if(phase!=="exam")return;
    const retry=()=>{if(pendingCheckpoint.current)void autosaveAttempt({}, {silent:true})};
    const interval=setInterval(retry,5000);
    const onVisibilityChange=()=>{if(document.visibilityState==="hidden")retry()};
    const onPageHide=()=>{
      const checkpoint=pendingCheckpoint.current,snapshot=latestExamStateRef.current;
      if(!checkpoint||!credentialRef.current||!snapshot.exam?.id)return;
      if(sendingSaveIdRef.current)return; // the encrypted checkpoint remains pending
      const body=JSON.stringify({action:"autosave_attempt",examId:snapshot.exam.id,attemptCredential:credentialRef.current,clientAttemptId:attemptIdRef.current,answers:checkpoint.answers,currentQuestionIndex:checkpoint.currentQuestionIndex,timeLeft:checkpoint.timeLeft,expectedSavedAt:lastSavedAtRef.current,saveId:checkpoint.saveId});
      if(new TextEncoder().encode(body).length<=60000)void fetch("/api/agents/examen-docente",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true}).catch(()=>{});
    };
    const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload()};
    window.addEventListener("online",retry);window.addEventListener("pagehide",onPageHide);window.addEventListener("pageshow",onPageShow);
    document.addEventListener("visibilitychange",onVisibilityChange);
    return ()=>{clearInterval(interval);window.removeEventListener("online",retry);window.removeEventListener("pagehide",onPageHide);window.removeEventListener("pageshow",onPageShow);document.removeEventListener("visibilitychange",onVisibilityChange)};
  },[phase,autosaveAttempt]);

`);
 r('      const savedAnswers = attempt.answers || {};','      let savedAnswers = attempt.answers || {};');
 r('      setExam({ ...exam, questions: attempt.questions });','      lastSavedAtRef.current=attempt.lastSavedAt||null;\n      lastSaveIdRef.current=attempt.saveId||null;\n      pendingCheckpoint.current=null;\n      const recovered=Number(attempt.timeLeft)>0?await recoverCheckpoint(exam.id,nextAttemptId,credentialRef.current,lastSavedAtRef.current,lastSaveIdRef.current):null;\n      if(recovered){savedAnswers=recovered.answers;pendingCheckpoint.current={...recovered,baseSavedAt:lastSavedAtRef.current,parentSaveId:lastSaveIdRef.current};attempt.currentQuestionIndex=recovered.currentQuestionIndex;}\n      setExam({ ...exam, questions: attempt.questions });');
 r('        Number(exam?.settings?.timeLimit || 30) * 60,','        Number(attempt.durationSeconds) || Number(exam?.settings?.timeLimit || 30) * 60,');
 r('      setTimeLeft(safeTimeLeft);','      deadlineRef.current=Date.now()+safeTimeLeft*1000;\n      setTimeLeft(safeTimeLeft);');
 r('      setAutosaveStatus(data.resumed ? "saved" : "idle");','      setAutosaveStatus(recovered?"saving":data.resumed?"saved":"idle");');
 r('        data.resumed\n          ? "Avance anterior recuperado"','        recovered ? "Avance local recuperado. Sincronizando…" : data.resumed\n          ? "Avance anterior recuperado"');
 r('      setTimeLeft((prev) => {\n        if (prev <= 1) {\n          if (timerRef.current) clearInterval(timerRef.current);\n          return 0;\n        }\n        return prev - 1;\n      });','      setTimeLeft(Math.max(0,Math.ceil((deadlineRef.current-Date.now())/1000)));');
 r('                      attemptId={attemptIdRef.current}','                      attemptId={attemptIdRef.current}\n                      initialArtifact={developmentArtifacts[curQ]}');
 r('        setDevelopmentArtifacts((current) => ({\n          ...current,\n          [curQ]: artifact,\n        }));','        const next={...latestExamStateRef.current.developmentArtifacts,[curQ]:artifact};\n        setDevelopmentArtifacts(next);\n        stageCheckpoint({developmentArtifacts:next});');
 r('    [curQ, currentNotebookEnabled, exam],','    [curQ, currentNotebookEnabled, exam,stageCheckpoint],');
 r('      if (phase === "submitting" || phase === "review") return;','      if (phase === "submitting" || phase === "review" || submitLockRef.current) return;\n      submitLockRef.current=true;');
 r('      if (currentNotebookEnabled && !latestArtifact) return;','      if (currentNotebookEnabled && !latestArtifact && _reason==="manual") {submitLockRef.current=false;return;}');
 r('        ? { ...developmentArtifacts, [curQ]: latestArtifact }\n        : developmentArtifacts;','        ? { ...latestExamStateRef.current.developmentArtifacts, [curQ]: latestArtifact }\n        : latestExamStateRef.current.developmentArtifacts;');
 r('      await autosaveAttempt(\n        {\n          developmentArtifacts: latestDevelopmentArtifacts,','      const synchronized=await autosaveAttempt(\n        {\n          developmentArtifacts: latestDevelopmentArtifacts,');
 r('      if (timerRef.current) clearInterval(timerRef.current);\n\n      setSubmittedForSecurity(true);','      if(!synchronized&&_reason==="manual"){submitLockRef.current=false;return;}\n      if (timerRef.current) clearInterval(timerRef.current);\n\n      setSubmittedForSecurity(true);');
 r('        setPhase("review");\n\n        if (document.fullscreenElement)','        pendingCheckpoint.current=null;clearCheckpoint(exam.id,attemptIdRef.current);\n        setPhase("review");\n\n        if (document.fullscreenElement)');
 r('        setErrorMsg(e?.message || "Error al enviar el examen.");\n        setPhase("error");','        submitLockRef.current=false;\n        setErrorMsg(e?.message || "Error al enviar el examen. Vuelve a identificarte para recuperar el avance.");\n        setPhase("error");');
});
console.log("[exam-durable-autosave] recuperación verificada, trazos, cola y copia cifrada");
