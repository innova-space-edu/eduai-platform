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


// The roster stores a single full-name field, which may place surnames first.
// Match whole words, not substrings or approximate spelling. Two distinct
// meaningful words are required; the six-digit prefix still scopes the query.
export function rosterNameMatches(registered, supplied){
 if(typeof registered!=="string"||typeof supplied!=="string"||supplied.length>160)return false
 const particles=new Set(["de","del","la","las","los","el","y","e"])
 const tokens=value=>normalizeCourse(value).split(" ").filter(Boolean)
 const official=tokens(registered),given=tokens(supplied)
 if(!given.length||given.some(v=>!/^\p{L}+$/u.test(v)))return false
 const meaningful=given.filter(v=>!particles.has(v))
 if(new Set(meaningful.filter(v=>v.length>=2)).size<2)return false
 const remaining=[...official]
 for(const word of given){
  const i=remaining.indexOf(word)
  if(i<0)return false
  remaining.splice(i,1)
 }
 return true
}
