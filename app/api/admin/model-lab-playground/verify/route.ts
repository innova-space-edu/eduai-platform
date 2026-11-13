import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyLabSubtraction } from "@/lib/ai/model-lab/private-gateway";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
const HEADERS={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:HEADERS});

export async function POST(request:NextRequest){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user?.email)return respond({error:"Acceso solo para administración."},403);
  const {data,error}=await supabase.from("admin_emails").select("email").eq("email",user.email).maybeSingle();
  if(error||!data)return respond({error:"Acceso solo para administración."},403);
  const origin=request.headers.get("origin");
  if(origin){
    try{
      const u=new URL(origin);
      const host=request.headers.get("x-forwarded-host")||request.headers.get("host");
      if(u.protocol!=="https:"||u.host!==host)return respond({error:"Origen no permitido."},403);
    }catch{return respond({error:"Origen no permitido."},403)}
  }
  let input:Record<string,unknown>;
  try{
    const reader=request.body?.getReader();
    if(!reader)return respond({error:"Entrada inválida."},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>6000){await reader.cancel();return respond({error:"Solicitud demasiado grande."},413)}
      chunks.push(value);
    }
    const payload:unknown=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if(!payload||typeof payload!=="object"||Array.isArray(payload))return respond({error:"Entrada inválida."},400);
    input=payload as Record<string,unknown>;
  }catch{return respond({error:"JSON inválido."},400)}
  const prompt=typeof input.prompt==="string"?input.prompt.trim():"";
  if(!prompt||prompt.length>1000)return respond({error:"Usa un enunciado de hasta 1000 caracteres."},400);
  const candidate=input.candidate;
  if(candidate!==undefined&&candidate!==null&&(typeof candidate!=="string"||!(/^[+-]?\d{1,13}$/).test(candidate)))
    return respond({error:"El candidato debe ser un número entero de hasta 13 dígitos."},400);
  try{return respond(await verifyLabSubtraction(prompt,typeof candidate==="string"?candidate:undefined))}
  catch{return respond({error:"Verificador del Dell no disponible. Comprueba que el servicio esté actualizado; no se verificó la respuesta."},503)}
}
