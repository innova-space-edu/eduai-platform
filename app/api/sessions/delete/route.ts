import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
export async function DELETE(req:Request){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401})
 const body=await req.json().catch(()=>null)
 if(typeof body?.session_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.session_id))return NextResponse.json({error:"Sesión inválida."},{status:400})
 const {data,error}=await supabase.from("study_sessions").delete().eq("id",body.session_id).eq("user_id",user.id).select("id").maybeSingle()
 if(error)return NextResponse.json({error:"No se pudo eliminar."},{status:500})
 return data?NextResponse.json({ok:true}):NextResponse.json({error:"Sesión no encontrada."},{status:404})
}
