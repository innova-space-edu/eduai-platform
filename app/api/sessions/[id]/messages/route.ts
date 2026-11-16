import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
interface Params { params: Promise<{id:string}> }
export async function GET(_req:Request,{params}:Params){
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)return NextResponse.json({error:"Unauthorized"},{status:401})
 const {id}=await params
 const {data,error}=await supabase.from("study_sessions").select("messages").eq("id",id).eq("user_id",user.id).maybeSingle()
 if(error)return NextResponse.json({error:"No se pudo cargar el historial."},{status:500})
 if(!data)return NextResponse.json({error:"Sesión no encontrada."},{status:404})
 return NextResponse.json(Array.isArray(data.messages)?data.messages:[],{headers:{"Cache-Control":"private, no-store"}})
}
