/**
 * lib/exam-guard.ts
 *
 * Módulo de seguridad para exámenes de docentes.
 * Detecta conductas sospechosas, aplica sanciones progresivas
 * y registra incidentes en la base de datos.
 *
 * Política de sanciones:
 *   1° incidente → advertencia (overlay 3s)
 *   2° incidente → bloqueo 15 segundos
 *   3° incidente → bloqueo 30 segundos
 *   4° + → bloqueo 60 segundos + bandera roja
 */

export type EventType =
  | "fullscreen_exit"
  | "window_blur"
  | "tab_hidden"
  | "copy_attempt"
  | "paste_attempt"
  | "cut_attempt"
  | "contextmenu_attempt"
  | "blocked_shortcut"
  | "print_attempt"
  | "reload_attempt"
  | "drag_attempt"

export type SanctionLevel = "warning" | "block_15" | "block_30" | "block_60"

export interface GuardState {
  incidentCount:    number
  sanctionLevel:    SanctionLevel | null
  blockUntil:       number          // timestamp ms
  isFlagged:        boolean
  lastEventType:    EventType | null
}

export interface GuardConfig {
  examId:          string
  attemptId:       string
  submissionId:    string | null
  studentName:     string
  studentCourse:   string
  studentRut:      string
  getTimeLeft:     () => number     // función que devuelve segundos restantes
  getCurrentQ:     () => number     // función que devuelve índice de pregunta actual
  onSanction:      (state: GuardState) => void  // callback al aplicar sanción
  securityMode:    boolean          // true = activar guardia
}

// Bloqueo en segundos por número de incidente
const BLOCK_SECONDS: Record<number, number> = {
  1: 0,    // advertencia, sin bloqueo
  2: 15,
  3: 30,
}
const BLOCK_SECONDS_MANY = 60  // 4° incidente en adelante

function getBlockSeconds(incidentNumber: number): number {
  return BLOCK_SECONDS[incidentNumber] ?? BLOCK_SECONDS_MANY
}

function getSanctionLevel(incidentNumber: number): SanctionLevel {
  if (incidentNumber === 1) return "warning"
  if (incidentNumber === 2) return "block_15"
  if (incidentNumber === 3) return "block_30"
  return "block_60"
}

export class ExamGuard {
  private config:   GuardConfig
  private state:    GuardState
  private cleanup:  (() => void)[] = []
  private debounceTimers: Record<string, NodeJS.Timeout> = {}

  constructor(config: GuardConfig) {
    this.config = config
    this.state  = {
      incidentCount:  0,
      sanctionLevel:  null,
      blockUntil:     0,
      isFlagged:      false,
      lastEventType:  null,
    }
  }

  // ── Iniciar la guardia ──────────────────────────────────────────────────────
  start() {
    if (!this.config.securityMode) return

    const add = (
      target: EventTarget,
      type: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fn: (e: any) => void,
      opts?: boolean | AddEventListenerOptions
    ) => {
      target.addEventListener(type, fn as EventListener, opts)
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts as any))
    }

    // Fullscreen change
    add(document, "fullscreenchange", this.onFullscreenChange.bind(this))

    // Tab hidden / visibility
    add(document, "visibilitychange", this.onVisibilityChange.bind(this))

    // Window blur
    add(window, "blur", this.onWindowBlur.bind(this))

    // Clipboard
    add(document, "copy",  (e) => this.onClipboard(e as ClipboardEvent, "copy_attempt"),  true)
    add(document, "cut",   (e) => this.onClipboard(e as ClipboardEvent, "cut_attempt"),   true)
    add(document, "paste", (e) => this.onClipboard(e as ClipboardEvent, "paste_attempt"), true)

    // Context menu
    add(document, "contextmenu", (e) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      this.recordEvent("contextmenu_attempt")
    }, true)

    // Drag
    add(document, "dragstart", (e) => {
      e.preventDefault()
      this.recordEvent("drag_attempt", "drag", false) // sin sanción, solo log
    }, true)

    // Teclas
    add(document, "keydown", this.onKeyDown.bind(this), true)
    add(document, "keyup",   this.onKeyUp.bind(this),   true)

    // Before unload
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "El examen está en progreso."
      this.recordEvent("reload_attempt")
    }
    add(window, "beforeunload", onBeforeUnload)
  }

  // ── Detener la guardia ──────────────────────────────────────────────────────
  stop() {
    this.cleanup.forEach(fn => fn())
    this.cleanup = []
    Object.values(this.debounceTimers).forEach(clearTimeout)
  }

  // ── Estado actual ───────────────────────────────────────────────────────────
  getState(): GuardState { return { ...this.state } }

  isBlocked(): boolean { return Date.now() < this.state.blockUntil }

  // ── Vincular submissionId después de enviado ────────────────────────────────
  setSubmissionId(id: string) {
    this.config.submissionId = id
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  private onFullscreenChange() {
    if (!document.fullscreenElement) {
      this.debounce("fs_exit", () => this.recordEvent("fullscreen_exit"), 200)
    }
  }

  private onVisibilityChange() {
    if (document.hidden) {
      this.recordEvent("tab_hidden", document.visibilityState)
    }
  }

  private onWindowBlur() {
    // Debounce para evitar falsos positivos al cambiar de fullscreen
    this.debounce("blur", () => this.recordEvent("window_blur"), 300)
  }

  private onClipboard(e: ClipboardEvent, type: EventType) {
    e.preventDefault()
    e.stopImmediatePropagation()
    this.recordEvent(type)
  }

  private onKeyDown(e: KeyboardEvent) {
    const k = e.key; const ctrl = e.ctrlKey; const shift = e.shiftKey
    const meta = e.metaKey; const alt = e.altKey

    const blocked =
      k === "Escape" || k === "F11" || k === "F12" || k === "F5" ||
      k === "PrintScreen" || k === "Meta" || meta ||
      (alt && k === "F4") ||
      (ctrl && ["c","C","v","V","x","X","a","A","p","P","s","S","u","U","r","R",
                "w","W","t","T","n","N","l","L"].includes(k)) ||
      (ctrl && shift && ["i","I","j","J","c","C","n","N"].includes(k)) ||
      (ctrl && (k === "Tab" || k === "F4")) ||
      (ctrl && alt && k === "Tab")

    if (blocked) {
      e.preventDefault()
      e.stopImmediatePropagation()

      // Solo registrar si es una combinación "seria" (no solo Ctrl solo)
      if (k !== "Control" && k !== "Shift" && k !== "Alt") {
        const detail = ctrl ? `Ctrl+${k}` : shift ? `Shift+${k}` : k
        // Ctrl+P y PrintScreen son intentos de imprimir
        if ((ctrl && (k === "p" || k === "P")) || k === "PrintScreen") {
          this.recordEvent("print_attempt", detail)
        } else {
          this.recordEvent("blocked_shortcut", detail)
        }
      }
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    if (["Escape","F11","Meta","PrintScreen"].includes(e.key)) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  // ── Registrar evento y aplicar sanción ─────────────────────────────────────
  private recordEvent(
    type:      EventType,
    detail:    string  = "",
    sanction:  boolean = true
  ) {
    if (!this.config.securityMode) return

    this.state.lastEventType  = type
    this.state.incidentCount += 1
    const n = this.state.incidentCount

    if (n >= 4) this.state.isFlagged = true

    if (sanction) {
      const secs   = getBlockSeconds(n)
      const level  = getSanctionLevel(n)
      this.state.sanctionLevel = level
      this.state.blockUntil   = secs > 0 ? Date.now() + secs * 1000 : 0
      this.config.onSanction({ ...this.state })
    }

    // Enviar al backend (fire & forget — no bloquear la UI)
    this.sendEvent(type, detail, n).catch(console.error)
  }

  private async sendEvent(type: EventType, detail: string, incidentNumber: number) {
    try {
      await fetch("/api/exam-security/event", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId:          this.config.examId,
          attemptId:       this.config.attemptId,
          submissionId:    this.config.submissionId,
          studentName:     this.config.studentName,
          studentCourse:   this.config.studentCourse,
          studentRut:      this.config.studentRut,
          eventType:       type,
          eventDetail:     detail,
          questionIndex:   this.config.getCurrentQ(),
          clientTimeLeft:  this.config.getTimeLeft(),
          incidentNumber,
          visibilityState: document.visibilityState,
          isFullscreen:    !!document.fullscreenElement,
          windowWidth:     window.innerWidth,
          windowHeight:    window.innerHeight,
        }),
      })
    } catch { /* silencioso — nunca interrumpir el examen */ }
  }

  private debounce(key: string, fn: () => void, ms: number) {
    clearTimeout(this.debounceTimers[key])
    this.debounceTimers[key] = setTimeout(fn, ms)
  }
}
