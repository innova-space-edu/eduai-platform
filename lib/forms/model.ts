export const QUESTION_TYPES = [
  'single', 'multi', 'dropdown', 'short', 'long', 'number',
  'scale', 'date', 'yesno', 'checklist', 'email', 'table', 'section'
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type FormKind = 'encuesta' | 'entrevista' | 'registro' | 'checklist' | 'ticket' | 'evaluacion';
export type TableAnswer = string[][];
export type Answer = string | string[] | number | TableAnswer;
export const MAX_TABLE_ROWS = 40;
export const MAX_TABLE_COLUMNS = 8;
export const MAX_TABLE_CELL_LENGTH = 180;
export const DEFAULT_TABLE_COLUMNS = ['Cantidad', 'Material', 'Asignatura', 'OA'];
export const isTableAnswer = (value: unknown): value is TableAnswer => Array.isArray(value) && value.every(row => Array.isArray(row));
export type FormQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;
  required: boolean;
  options: string[];
  min?: number;
  max?: number;
};
export type FormSettings = {
  collectName: boolean;
  collectEmail: boolean;
  oneResponse: boolean;
  endsAt: string | null;
  confirmationMessage: string;
  consentText: string;
};
export type FormRecord = {
  id: string;
  slug: string;
  user_id?: string;
  title: string;
  description: string;
  kind: FormKind;
  status: 'draft' | 'published' | 'closed';
  questions: FormQuestion[];
  settings: FormSettings;
  created_at?: string;
  updated_at?: string;
};
export type FormResponse = {
  id: string;
  form_id: string;
  answers: Record<string, Answer>;
  identity: { name?: string; email?: string };
  submitted_at: string;
};
export const DEFAULT_SETTINGS: FormSettings = {
  collectName: false,
  collectEmail: false,
  oneResponse: false,
  endsAt: null,
  confirmationMessage: 'Tu respuesta fue registrada correctamente.',
  consentText: 'Acepto que los datos proporcionados se utilicen únicamente para este formulario.'
};

const types = new Set<string>(QUESTION_TYPES);
const kinds = new Set<string>(['encuesta', 'entrevista', 'registro', 'checklist', 'ticket', 'evaluacion']);
const answerable = new Set<QuestionType>(QUESTION_TYPES.filter(t => t !== 'section'));
const choiceTypes = new Set<QuestionType>(['single','multi','dropdown','checklist']);
const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
const text = (v: unknown, max = 1000) => typeof v === 'string' ? v.trim().slice(0, max) : '';

export function normalizeForm(raw: unknown): { title: string; description: string; kind: FormKind; questions: FormQuestion[]; settings: FormSettings } {
  if (!raw || typeof raw !== 'object') throw new Error('Formulario inválido.');
  const r = raw as Record<string, unknown>;
  const title = text(r.title, 160);
  if (!title) throw new Error('El formulario requiere un título.');
  const rawQuestions = Array.isArray(r.questions) ? r.questions : [];
  if (rawQuestions.length > 60) throw new Error('El máximo es de 60 preguntas.');
  const ids = new Set<string>();
  const questions: FormQuestion[] = rawQuestions.map((item, index) => {
    const q = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = text(q.id, 80);
    if (!id || ids.has(id)) throw new Error('Identificadores de preguntas inválidos o repetidos.');
    ids.add(id);
    const type = text(q.type, 30);
    if (!types.has(type)) throw new Error('Tipo de pregunta no admitido.');
    const label = text(q.label, 500);
    if (!label) throw new Error('Completa el enunciado de la pregunta ' + (index + 1) + '.');
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions.map(v => text(v, 180)).filter(Boolean).slice(0, 24);
    if (type === 'table' && (options.length < 2 || options.length > MAX_TABLE_COLUMNS || rawOptions.length > MAX_TABLE_COLUMNS))
      throw new Error('La tabla ' + (index + 1) + ' necesita entre 2 y ' + MAX_TABLE_COLUMNS + ' columnas.');
    if (type === 'table' && new Set(options.map(c => c.toLocaleLowerCase('es'))).size !== options.length)
      throw new Error('Los nombres de las columnas de la tabla deben ser diferentes.');
    if (choiceTypes.has(type as QuestionType) && options.length < 2) throw new Error('La pregunta ' + (index + 1) + ' necesita al menos dos opciones.');
    const min = typeof q.min === 'number' && Number.isFinite(q.min) ? q.min : undefined;
    const max = typeof q.max === 'number' && Number.isFinite(q.max) ? q.max : undefined;
    if (min !== undefined && max !== undefined && min > max) throw new Error('Rango inválido en la pregunta ' + (index + 1) + '.');
    return { id, type: type as QuestionType, label, description: text(q.description, 600), required: type !== 'section' && q.required === true, options, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
  });
  const rawSettings = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const endsAt = typeof rawSettings.endsAt === 'string' && rawSettings.endsAt && Number.isFinite(Date.parse(rawSettings.endsAt)) ? new Date(rawSettings.endsAt).toISOString() : null;
  const collectEmail = rawSettings.collectEmail === true;
  const settings: FormSettings = {
    collectName: rawSettings.collectName === true,
    collectEmail,
    oneResponse: collectEmail && rawSettings.oneResponse === true,
    endsAt,
    confirmationMessage: text(rawSettings.confirmationMessage, 400) || DEFAULT_SETTINGS.confirmationMessage,
    consentText: text(rawSettings.consentText, 600) || DEFAULT_SETTINGS.consentText
  };
  return { title, description: text(r.description, 1500), kind: kinds.has(String(r.kind)) ? r.kind as FormKind : 'encuesta', questions, settings };
}

export function validateSubmission(form: FormRecord, raw: unknown): { answers: Record<string, Answer>; identity: { name?: string; email?: string } } {
  if (!raw || typeof raw !== 'object') throw new Error('Respuestas inválidas.');
  const body = raw as Record<string, unknown>;
  if (typeof body.website === 'string' && body.website.trim()) throw new Error('Solicitud inválida.');
  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) throw new Error('No se recibieron respuestas.');
  const rawAnswers = body.answers as Record<string, unknown>;
  const rawIdentity = body.identity && typeof body.identity === 'object' ? body.identity as Record<string, unknown> : {};
  const identity: { name?: string; email?: string } = {};
  if (form.settings.collectName) {
    identity.name = text(rawIdentity.name, 160);
    if (!identity.name) throw new Error('Ingresa tu nombre.');
  }
  if (form.settings.collectEmail) {
    identity.email = text(rawIdentity.email, 254).toLowerCase();
    if (!validEmail(identity.email)) throw new Error('Ingresa un correo electrónico válido.');
  }
  const needsConsent = form.settings.collectEmail || form.settings.collectName || form.questions.some(q => q.type === 'email');
  if (needsConsent && body.consent !== true) throw new Error('Debes aceptar el tratamiento de los datos solicitados.');
  const answers: Record<string, Answer> = {};
  for (const q of form.questions) {
    if (!answerable.has(q.type)) continue;
    const value = rawAnswers[q.id];
    const blank = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (blank) {
      if (q.required) throw new Error('Falta responder: ' + q.label);
      continue;
    }
    if (q.type === 'table') {
      if (!Array.isArray(value) || value.length > MAX_TABLE_ROWS)
        throw new Error('Tabla inválida: ' + q.label + '. Máximo ' + MAX_TABLE_ROWS + ' filas.');
      const rows: TableAnswer = [];
      for (const rawRow of value) {
        if (!Array.isArray(rawRow) || rawRow.length !== q.options.length ||
            rawRow.some(cell => typeof cell !== 'string' || cell.length > MAX_TABLE_CELL_LENGTH)) {
          throw new Error('Fila inválida en la tabla: ' + q.label);
        }
        const cells = (rawRow as string[]).map(cell => cell.trim());
        if (cells.every(cell => !cell)) continue;
        if (cells.some(cell => !cell)) throw new Error('Completa todas las columnas de cada fila: ' + q.label);
        rows.push(cells);
      }
      if (!rows.length && q.required) throw new Error('Falta responder: ' + q.label);
      if (rows.length) answers[q.id] = rows;
      continue;
    }
    if (q.type === 'multi' || q.type === 'checklist') {
      if (!Array.isArray(value) || !value.length || value.length > q.options.length ||
          value.some(v => typeof v !== 'string' || !q.options.includes(v)) ||
          new Set(value).size !== value.length) throw new Error('Selección inválida: ' + q.label);
      answers[q.id] = value;
      continue;
    }
    if (q.type === 'number' || q.type === 'scale') {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num) || Math.abs(num) > 1e9 ||
          (q.min !== undefined && num < q.min) || (q.max !== undefined && num > q.max) ||
          (q.type === 'scale' && !Number.isInteger(num))) throw new Error('Número inválido: ' + q.label);
      answers[q.id] = num;
      continue;
    }
    if (typeof value !== 'string' || value.length > (q.type === 'long' ? 5000 : 500)) throw new Error('Respuesta demasiado extensa: ' + q.label);
    const cleaned = value.trim();
    if (!cleaned && q.required) throw new Error('Falta responder: ' + q.label);
    if (choiceTypes.has(q.type) && !q.options.includes(cleaned)) throw new Error('Opción inválida: ' + q.label);
    if (q.type === 'yesno' && !['Sí', 'No'].includes(cleaned)) throw new Error('Opción inválida: ' + q.label);
    if (q.type === 'email' && !validEmail(cleaned)) throw new Error('Correo inválido: ' + q.label);
    if (q.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) throw new Error('Fecha inválida: ' + q.label);
    answers[q.id] = cleaned;
  }
  return { answers, identity };
}

export function templateQuestions(kind: FormKind): FormQuestion[] {
  const q = (type: QuestionType, label: string, options: string[] = [], required = true): FormQuestion =>
    ({ id: crypto.randomUUID(), type, label, options, required });
  switch (kind) {
    case 'entrevista': return [q('short','Nombre o identificación de la persona entrevistada'), q('long','¿Cuál es su experiencia con este tema?'), q('long','¿Qué dificultades ha encontrado?'), q('long','¿Qué mejoras propondría?')];
    case 'registro': return [q('short','Nombre completo'), q('email','Correo electrónico'), q('dropdown','Área o categoría',['Docente','Estudiante','Apoderado','Otro']), q('short','Observaciones',[],false)];
    case 'checklist': return [q('checklist','Marque los requisitos cumplidos',['Documento entregado','Información revisada','Evidencia adjuntada','Actividad completada']),q('long','Observaciones y pendientes',[],false)];
    case 'ticket': return [q('short','¿Qué aprendiste hoy?'),q('short','¿Qué duda te quedó?'),q('scale','¿Cuánto comprendiste? (1 a 5)')].map(x=>x.type === 'scale'?{...x,min:1,max:5}:x);
    case 'evaluacion': return [q('single','¿Cómo evaluarías la experiencia?',['Excelente','Buena','Regular','Deficiente']),q('scale','Puntuación general (1 a 10)'),q('long','Justifica tu evaluación',[],false)].map(x=>x.type === 'scale'?{...x,min:1,max:10}:x);
    default: return [q('single','¿Qué tan satisfecho/a estás?',['Muy satisfecho/a','Satisfecho/a','Neutral','Insatisfecho/a']),q('multi','¿Qué aspectos valoras más?',['Calidad','Claridad','Atención','Rapidez']),q('long','¿Qué sugerencias tienes?',[],false)];
  }
}
