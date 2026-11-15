import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"

const files = [
 "app/(auth)/login/page.tsx",
 "app/consentimiento/page.tsx",
 "proxy.ts",
 "app/admin/actas-familiares/page.tsx",
 "app/api/admin/actas-familiares/route.ts",
 "app/profile/settings/page.tsx",
 "app/api/privacy/self/route.ts",
 "components/legal/ExamConsentDialog.tsx",
 "app/api/admin/actas-privacidad/route.ts",
 "app/admin/actas-privacidad/page.tsx",
 "app/examen/crear/page.tsx",
 "app/(auth)/register/page.tsx",
]
for(const path of files){
 const source=fs.readFileSync(path,"utf8")
 const result=ts.transpileModule(source,{
  fileName:path,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}
 })
 const errors=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
 assert.equal(errors.length,0,path+": "+errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join(", "))
}
const login=fs.readFileSync(files[0],"utf8")
const first=fs.readFileSync(files[1],"utf8")
const proxy=fs.readFileSync(files[2],"utf8")
const api=fs.readFileSync(files[4],"utf8")
const profile=fs.readFileSync(files[5],"utf8")
const migration=fs.readFileSync("supabase/migrations/202610120002_preserve_eduai_consent_timestamp.sql","utf8")
const actsMigration=fs.readFileSync("supabase/migrations/202610120001_eduai_family_approval_acts.sql","utf8")
assert.match(login,/eduai_privacy_choices/)
assert.match(login,/router\.push\("\/consentimiento"\)/)
assert.doesNotMatch(login,/<PrivacyConsentPanel/)
assert.doesNotMatch(login,/record_eduai_privacy_choices/,"No re-record on sign-in")
assert.match(first,/record_eduai_privacy_choices/)
assert.match(first,/acceptedTerms/)
assert.match(proxy,/needsPrivacyGate/)
assert.match(proxy,/action:"\/consentimiento"/)
assert.match(api,/admin_emails/)
assert.match(api,/createFamilyAdminClient/)
assert.match(actsMigration,/pg_advisory_xact_lock/,"Unique act serialisation required")
assert.match(actsMigration,/ACTA-/)
assert.match(actsMigration,/eduai_family_act_approved/)
assert.match(migration,/then public\.eduai_privacy_choices\.terms_acknowledged_at/)
assert.match(migration,/then public\.eduai_privacy_choices\.data_warning_acknowledged_at/)
assert.match(profile,/privacyAcceptedAt/)
assert.match(profile,/eduai_privacy_choice_events/)
const signup=fs.readFileSync("supabase/migrations/202610120003_eduai_signup_privacy_snapshot.sql","utf8")
assert.match(signup,/zz_eduai_initial_privacy_on_signup/)
assert.match(signup,/signup_declarations/)
assert.match(signup,/on conflict \(user_id\) do nothing/,"Never overwrite a previous user decision at signup")
assert.match(signup,/v_minor/,"Minor purposes must remain default-denied")

console.log("OK: privacy requested once, timestamp preserved and family acts restricted and archived")

const self=fs.readFileSync("app/api/privacy/self/route.ts","utf8")
const dialog=fs.readFileSync("components/legal/ExamConsentDialog.tsx","utf8")
const archive=fs.readFileSync("app/api/admin/actas-privacidad/route.ts","utf8")
const exam=fs.readFileSync("app/examen/crear/page.tsx","utf8")
const register=fs.readFileSync("app/(auth)/register/page.tsx","utf8")
const exportRecords=fs.readFileSync("lib/admin/consolidated-records.ts","utf8")
assert.match(self,/session\.auth\.getUser/)
assert.doesNotMatch(self,/ACTA-PRIV-/)
assert.match(archive,/admin_emails/)
assert.match(archive,/if\(role\.error\|\|!role\.data\)/)
assert.match(archive,/ACTA-PRIV-/)
assert.match(exportRecords,/ACTA-PRIV-/)
assert.match(dialog,/record_eduai_privacy_choices/)
assert.match(dialog,/data\.accepted!==true/)
assert.match(exam,/activeStep!==4/)
assert.match(exam,/data\?\.action==="\/consentimiento"/)
assert.match(exam,/Tratamiento de datos de la evaluación/)
assert.match(register,/current\?\{error:null\}:await supabase\.rpc/)
assert.match(proxy,/isManualExamPublish \? \[\] : requiredPrivacyPermissionsForRoute/)
console.log("OK: modal, registro único y archivo de actas exclusivo de administración")
