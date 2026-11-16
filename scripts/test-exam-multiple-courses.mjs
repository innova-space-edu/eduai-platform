import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {cleanCourses,assignedCourses,hasCourseScope,courseAllowed,resolveCourseEntry,normalizeCourse,rosterNameMatches} from "../lib/exam/course-assignment.mjs"
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

const registered="Pérez Soto Ana María"
for(const name of ["Ana Pérez","ANA PEREZ","Pérez Ana","Ana María Pérez Soto","  Ana   Pérez  "])assert.equal(rosterNameMatches(registered,name),true,name)
for(const name of ["Ana","Pérez","Ana Ana","Ana de","An Pérez","Ana Pere","Ana López","Ana Pérez López","Ana Pérez 123",""])assert.equal(rosterNameMatches(registered,name),false,name)
assert.equal(rosterNameMatches("María José De la Cruz Soto","María Cruz"),true)
assert.equal(rosterNameMatches("Ana Pérez Soto","Ana Pérez Pérez"),false)
const sharedPrefix=[{id:"s1",student_name:"Pérez Soto Ana María",course:"4° Medio A"},{id:"s2",student_name:"Pérez Rojas Ana Isabel",course:"1° Medio A"}]
const matchesName=name=>student=>rosterNameMatches(student.student_name,name)
assert.equal(resolveCourseEntry(sharedPrefix,multi,matchesName("Ana Pérez")).status,"identity","ambiguous prefix and name must not enter")
assert.equal(resolveCourseEntry(sharedPrefix,original,matchesName("Ana Pérez")).status,"identity","course must not resolve an ambiguous identity")
assert.equal(resolveCourseEntry(sharedPrefix,multi,matchesName("Ana Soto")).student.id,"s1")
assert.equal(resolveCourseEntry(sharedPrefix,original,matchesName("Ana Soto")).status,"course")
assert.equal(resolveCourseEntry(sharedPrefix,multi,matchesName("Ana López")).status,"identity")
assert.match(route,/rosterNameMatches\(item.student_name, body.studentName\)/)
console.log("OK: flexible whole-word names, accent and order independence, ambiguity rejected")
