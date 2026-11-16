import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {cleanCourses,assignedCourses,hasCourseScope,courseAllowed,resolveCourseEntry,normalizeCourse} from "../lib/exam/course-assignment.mjs"
const original={rosterCourse:"1° medio A",curriculum:{curso:"1° medio"}}
const multi={...original,rosterCourses:["1° medio A","1° medio B","4° medio A"]}
assert.equal(courseAllowed(original,"1° Medio A"),true)
assert.equal(courseAllowed(original,"4° Medio A"),false)
assert.equal(courseAllowed(multi,"4° Medio A"),true)
assert.equal(courseAllowed(multi,"1° Medio C"),false)
assert.equal(courseAllowed({curriculum:{curso:"1° medio"}},"1° Medio B"),true)
assert.equal(courseAllowed({curriculum:{curso:"1° medio"}},"4° Medio A"),false)
assert.equal(courseAllowed({rosterCourses:[],rosterCourse:"1° medio A",curriculum:{curso:"1° medio"}},"1° Medio A"),false)
assert.equal(hasCourseScope({rosterCourses:[],curriculum:{curso:"1° medio"}}),false)
assert.equal(courseAllowed({},"1° Medio A"),false)
assert.deepEqual(cleanCourses("1° medio A; 1° Medio A; 4° medio A"),["1° medio A","4° medio A"])
assert.deepEqual(assignedCourses(multi),multi.rosterCourses)
assert.equal(normalizeCourse("1° Básico A"),normalizeCourse("1° basico A"))
const students=[{id:"s1",student_name:"Estudiante Uno",course:"4° Medio A"}]
assert.equal(resolveCourseEntry(students,original,()=>true).status,"course")
assert.equal(resolveCourseEntry(students,multi,()=>true).status,"ok")
assert.equal(resolveCourseEntry(students,multi,()=>false).status,"identity")
assert.equal(resolveCourseEntry([...students,...students],multi,()=>true).status,"identity")
const creator=readFileSync("app/examen/crear/page.tsx","utf8")
const edit=readFileSync("app/examen/editar/[id]/page.tsx","utf8")
const results=readFileSync("app/examen/resultados/[id]/page.tsx","utf8")
const route=readFileSync("app/api/agents/examen-docente/route.ts","utf8")
assert.match(creator,/rosterCourses: cleanCourses\(rosterCourse\)/)
assert.match(edit,/Guardar cursos sin modificar preguntas/)
assert.match(results,/submissions=\{visibleSubmissions\}/)
assert.match(results,/visibleSubmissions\.map/)
assert.match(route,/EXAM_COURSE_MISMATCH/)
assert.match(route,/resolveCourseEntry/)
console.log("OK: cursos múltiples, acceso exclusivo, identidad, compatibilidad y resultados separados")
