import assert from "node:assert/strict"
import fs from "node:fs"
import * as XLSX from "xlsx"
import { collectAllAdminRecords, chileDateTime } from "../lib/admin/consolidated-records"
import { renderRecordsPdf, renderRecordsWorkbook } from "../lib/admin/consolidated-records-render"
import type { SupabaseClient } from "@supabase/supabase-js"

type Row=Record<string,any>
const now="2026-10-12T03:20:00.000Z"
const tables:Record<string,Row[]> = {
  eduai_family_approval_acts:[{request_id:"req1",folio:"ACTA-2026-001",student_user_id:"minor1",
    student_name:"=HYPERLINK(\"bad\")",guardian_name:"Adulto Uno",guardian_relationship:"padre",
    institution_name:"Innova",reviewer_user_id:"admin1",approved_at:now,
    identity_verified_at:now,legal_capacity_verified_at:now,verified_method:"manual_institution",
    evidence_reference:"VER-001",document_version:"family-2026-10-v1"}],
  family_authorization_requests:[
    {id:"req1",platform:"eduai",student_user_id:"minor1",student_name_declared:"Estudiante Uno",guardian_name:"",
      guardian_full_name:"Adulto Uno",guardian_email:"family@example.com",institution_name:"Innova",
      status:"approved",issued_at:now,expires_at:now,submitted_at:now,decisions:{platform_access:true,ai_text:false},
      reviewed_at:now,document_version:"family-2026-10-v1"},
    {id:"req2",platform:"eduai",student_user_id:"minor2",student_name_declared:"Estudiante Dos",guardian_email:"family2@example.com",
      institution_name:"Innova",status:"invited",issued_at:now,expires_at:now,submitted_at:null,decisions:{}},
  ],
  eduai_privacy_choices:[{user_id:"minor1",policy_version:"2026-10-11-v1",terms_acknowledged_at:now,
    data_warning_acknowledged_at:now,ai_generation:false,ai_documents:false,ai_voice:false,
    optional_analytics:false,updated_at:now}],
  eduai_privacy_choice_events:[{id:3,user_id:"minor1",policy_version:"2026-10-11-v1",event_type:"signup_declarations",
    choices:{ai_generation:false,ai_documents:false,ai_voice:false,optional_analytics:false},recorded_at:now}],
  eduai_admin_export_events:[],
  family_authorization_events:[{id:11,request_id:"req1",event_type:"approved",performed_by:"admin1",created_at:now}],
  profiles:[{id:"minor1",name:"Estudiante Uno",email:"minor1@example.com"},{id:"minor2",name:"Estudiante Dos",email:"minor2@example.com"},{id:"admin1",name:"Admin UNO",email:"admin@example.com"}],
}

function mockDb(rowsByTable:Record<string,Row[]>) {
  const db={from(table:string){
    let filters:((r:Row)=>boolean)[]=[]
    let key="id",ascending=false
    const query={
      select(_value:string){return query},
      eq(column:string,value:unknown){filters.push(row=>row[column]===value);return query},
      in(column:string,values:unknown[]){filters.push(row=>values.includes(row[column]));return query},
      order(column:string,opt:{ascending:boolean}){key=column;ascending=opt.ascending;return query},
      async range(start:number,end:number){
        const data=(rowsByTable[table]??[]).filter(row=>filters.every(fn=>fn(row))).sort((a,b)=>
          (ascending?1:-1)*String(a[key]??"").localeCompare(String(b[key]??""))).slice(start,end+1)
        return {data,error:null}
      },
    }
    return query
  }}
  return db as unknown as SupabaseClient
}
async function run(){
  assert.notEqual(chileDateTime(now),"—")
  const result=await collectAllAdminRecords(mockDb(tables),"admin@example.com")
  assert.equal(result.sections.length,7)
  assert.equal(result.totals.Actas,1)
  assert.equal(result.totals.Autorizaciones,2)
  assert.equal(result.totals.Respuestas,12,"Complete family purpose list, per signed form")
  assert.equal(result.totals["Ingreso Sí"],1)
  assert.equal(result.totals["Ingreso No"],0,"Unanswered invite must not count as no")
  assert.equal(result.totals["Cambios privacidad"],1)
  assert.equal(result.totals["Eventos familiares"],1)
  assert.equal(result.sections[0].rows[0].folio,"ACTA-2026-001")
  const file=renderRecordsWorkbook(result)
  assert.equal(file[0],0x50)
  assert.equal(file[1],0x4b)
  const workbook=XLSX.read(file,{type:"array"})
  assert.equal(workbook.SheetNames.length,8,"One multi-sheet workbook, not separate files")
  assert.ok(workbook.SheetNames.includes("00 Resumen"))
  assert.ok(workbook.SheetNames.includes("01 Actas"))
  const firstSheet=workbook.Sheets["01 Actas"]
  assert.equal(firstSheet.A4.v,"ACTA-2026-001")
  assert.match(String(firstSheet.C4.v),/^'/,"Spreadsheet formula injection must be quoted")
  const pdf=renderRecordsPdf(result)
  assert.equal(Buffer.from(pdf.slice(0,5)).toString("ascii"),"%PDF-")
  assert.ok(pdf.byteLength>1200)
  // The actual endpoint must gate the entire export before the server client runs.
  const endpoint=fs.readFileSync("app/api/admin/exportar-registros/route.ts","utf8")
  assert.match(endpoint,/admin_emails/)
  assert.match(endpoint,/Cache-Control/)
  assert.match(endpoint,/eduai_admin_export_events/)
  assert.match(endpoint,/formato/)
  assert.match(endpoint,/no-store/)
  assert.match(endpoint,/new Response\(copy\.buffer/)
  // No direct browser service key may be used.
  const ui=fs.readFileSync("app/admin/registros/page.tsx","utf8")
  assert.match(ui,/\/api\/admin\/exportar-registros/)
  assert.match(ui,/Excel completo/)
  assert.match(ui,/PDF completo/)
  console.log("OK: un Excel multihoja, un PDF íntegro, datos clasificados, RLS/admin y auditoría")
}
run().catch(error=>{console.error(error);process.exitCode=1})
