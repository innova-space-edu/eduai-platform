// Course assignment is independent of the curricular level used to generate questions.
export function normalizeCourse(value){
 return String(value??"").normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim()
}
export function cleanCourses(value){
 const list=Array.isArray(value)?value:typeof value==="string"?value.split(/[;\n,]+/):[]
 const seen=new Set()
 return list.flatMap(v=>{
  if(typeof v!=="string")return []
  const course=v.trim().slice(0,60),key=normalizeCourse(course)
  if(!key||seen.has(key))return []
  seen.add(key);return [course]
 }).slice(0,40)
}
export function assignedCourses(settings){
 if(Array.isArray(settings?.rosterCourses))return cleanCourses(settings.rosterCourses)
 return cleanCourses(settings?.rosterCourse)
}
export function hasCourseScope(settings){
 return assignedCourses(settings).length>0||(!Array.isArray(settings?.rosterCourses)&&!!normalizeCourse(settings?.curriculum?.curso))
}
export function courseAllowed(settings,course){
 const selected=assignedCourses(settings),key=normalizeCourse(course)
 if(!key)return false
 if(selected.length||Array.isArray(settings?.rosterCourses))return selected.some(v=>normalizeCourse(v)===key)
 const legacy=normalizeCourse(settings?.curriculum?.curso)
 return !!legacy&&(key===legacy||key.startsWith(legacy+" "))
}
// Only distinguish wrong course after a unique verified identity. Never leak roster details.
export function resolveCourseEntry(matches,settings,nameMatches){
 const candidates=matches.filter(nameMatches)
 if(candidates.length!==1)return {status:"identity"}
 return courseAllowed(settings,candidates[0].course)?{status:"ok",student:candidates[0]}:{status:"course"}
}
