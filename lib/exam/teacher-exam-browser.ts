export type StatusFilter = "all" | "active" | "closed"

export type DateGroup = { dateKey: string; label: string; items: any[] }
export type SubjectGroup = { subject: string; dates: DateGroup[] }
export type CourseGroup = { course: string; subjects: SubjectGroup[] }

export const COURSE_OPTIONS = [
  "Sala cuna menor","Sala cuna mayor","Medio menor","Medio mayor","NT1","NT2",
  "1° básico","2° básico","3° básico","4° básico","5° básico","6° básico","7° básico","8° básico",
  "1° medio","2° medio","3° medio","4° medio",
]

export const SUBJECT_OPTIONS = [
  "Matemática","Lenguaje","Ciencias Naturales","Física","Química","Biología","Historia",
  "Geografía y Ciencias Sociales","Educación Ciudadana","Ciencias para la Ciudadanía","Inglés",
  "Tecnología","Filosofía","Artes Visuales","Música","Educación Física y Salud","Orientación","Otra",
]

export const UNKNOWN_COURSE = "Sin curso"
export const UNKNOWN_SUBJECT = "Sin asignatura"
export const UNKNOWN_DATE = "Sin fecha"
const CHILE_TIMEZONE = "America/Santiago"

export const getCourse = (exam:any) => String(exam?.settings?.curriculum?.curso || exam?.settings?.course || "").trim() || UNKNOWN_COURSE
export const getSubject = (exam:any) => String(exam?.settings?.subject || "").trim() || UNKNOWN_SUBJECT
export const normalizeExamSearch = (value:unknown) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

export function courseRank(course:string) {
  if (course === UNKNOWN_COURSE) return 9999
  const index = COURSE_OPTIONS.indexOf(course)
  return index === -1 ? 9998 : index
}

export function getExamDate(exam:any): Date | null {
  const raw = exam?.created_at || exam?.updated_at
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getExamTimestamp(exam:any) {
  return getExamDate(exam)?.getTime() || 0
}

export function getDateKey(exam:any) {
  const date = getExamDate(exam)
  if (!date) return UNKNOWN_DATE
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:CHILE_TIMEZONE, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  if (!values.year || !values.month || !values.day) return UNKNOWN_DATE
  return `${values.year}-${values.month}-${values.day}`
}

export function formatDateKey(dateKey:string) {
  if (dateKey === UNKNOWN_DATE) return UNKNOWN_DATE
  const [year,month,day] = dateKey.split("-").map(Number)
  if (!year || !month || !day) return UNKNOWN_DATE
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return new Intl.DateTimeFormat("es-CL", { timeZone:CHILE_TIMEZONE, day:"numeric", month:"long", year:"numeric" }).format(date)
}

export function formatExamTime(exam:any) {
  const date = getExamDate(exam)
  if (!date) return ""
  return new Intl.DateTimeFormat("es-CL", { timeZone:CHILE_TIMEZONE, hour:"2-digit", minute:"2-digit" }).format(date)
}

export function buildExamGroups(exams:any[]): CourseGroup[] {
  const map = new Map<string,Map<string,Map<string,any[]>>>()
  exams.forEach(exam => {
    const course=getCourse(exam), subject=getSubject(exam), dateKey=getDateKey(exam)
    if (!map.has(course)) map.set(course,new Map())
    const subjectMap=map.get(course)!
    if (!subjectMap.has(subject)) subjectMap.set(subject,new Map())
    const dateMap=subjectMap.get(subject)!
    if (!dateMap.has(dateKey)) dateMap.set(dateKey,[])
    dateMap.get(dateKey)!.push(exam)
  })
  return Array.from(map.entries())
    .sort(([a],[b]) => courseRank(a)-courseRank(b) || a.localeCompare(b,"es"))
    .map(([course,subjectMap]) => ({
      course,
      subjects:Array.from(subjectMap.entries())
        .sort(([a],[b]) => a===UNKNOWN_SUBJECT ? 1 : b===UNKNOWN_SUBJECT ? -1 : a.localeCompare(b,"es"))
        .map(([subject,dateMap]) => ({
          subject,
          dates:Array.from(dateMap.entries())
            .sort(([a],[b]) => a===UNKNOWN_DATE ? 1 : b===UNKNOWN_DATE ? -1 : b.localeCompare(a))
            .map(([dateKey,items]) => ({ dateKey, label:formatDateKey(dateKey), items:[...items].sort((a,b) => getExamTimestamp(b)-getExamTimestamp(a)) })),
        })),
    }))
}

export function countCourse(group:CourseGroup) {
  return group.subjects.reduce((total,subject) => total + subject.dates.reduce((sum,date) => sum + date.items.length,0),0)
}

export function countSubject(group:SubjectGroup) {
  return group.dates.reduce((total,date) => total + date.items.length,0)
}
