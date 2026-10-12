import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createFamilyAdminClient, privateResponse } from "@/lib/family-consent/server"
import { collectAllAdminRecords, ExportLimitError } from "@/lib/admin/consolidated-records"
import { renderRecordsPdf, renderRecordsWorkbook } from "@/lib/admin/consolidated-records-render"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("formato")
  if (format !== "xlsx" && format !== "pdf") {
    return privateResponse({error:"Elige un formato válido: xlsx o pdf."},400)
  }
  // These exports contain records of minors. Never serve them to a third-party origin.
  const fetchSite=request.headers.get("sec-fetch-site")
  if (fetchSite && !["same-origin","none"].includes(fetchSite)) {
    return privateResponse({error:"El informe solo se descarga desde Administración."},403)
  }
  try {
    const auth = await createClient()
    const {data:{user},error:authError}=await auth.auth.getUser()
    if(authError||!user?.email)return privateResponse({error:"Inicia sesión para descargar registros."},401)
    const {data:admin,error:adminError}=await auth.from("admin_emails")
      .select("email").eq("email",user.email.toLowerCase()).maybeSingle()
    if(adminError||!admin)return privateResponse({error:"Acceso restringido a administradores."},403)

    const db=createFamilyAdminClient()
    const data=await collectAllAdminRecords(db,user.email)
    const binary = format==="xlsx" ? renderRecordsWorkbook(data) : renderRecordsPdf(data)
    if(!binary.length)throw new Error("El archivo generado está vacío")

    // Mandatory minimal audit; fail closed if it cannot be recorded.
    const {error:auditError}=await db.from("eduai_admin_export_events").insert({
      exported_by:user.id,file_format:format,dataset:"registro_documental_completo",
      counts:{...data.totals,total:data.totals["Registros totales"]}
    })
    if(auditError)return privateResponse({error:"No se pudo registrar la descarga. No se entregó el archivo."},503)
    const day=new Date().toISOString().slice(0,10)
    const fileName="EDUAI-registros-completos-"+day+"."+format
    const copy=new Uint8Array(binary.byteLength)
    copy.set(binary)
    return new Response(copy.buffer, {
      status:200,
      headers:{
        "Content-Type":format==="xlsx"?
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/pdf",
        "Content-Disposition":'attachment; filename="'+fileName+'"',
        "Cache-Control":"private, no-store, no-cache, max-age=0",
        "Pragma":"no-cache",
        "X-Content-Type-Options":"nosniff",
        "X-Robots-Tag":"noindex, nofollow, noarchive",
        "Content-Security-Policy":"default-src 'none'",
      },
    })
  } catch(error) {
    if(error instanceof ExportLimitError) return privateResponse({error:error.message},413)
    return privateResponse({error:"No se pudo preparar el informe completo. Ningún archivo parcial fue entregado."},503)
  }
}
