import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LAB_MODELS, LAB_R5_ENABLED, selectLabModels, type LabModelId } from "@/lib/ai/model-lab/catalog";
import { referenceExactMath } from "@/lib/ai/model-lab/exact-reference";
import { configuredLabInference, inferLabModel, probeLabInference, type LabChatMessage } from "@/lib/ai/model-lab/private-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const requestBudget = new Map<string,{remaining:number;resets:number}>();

async function requireAdmin() {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if(!user?.email)return null;
  const {data,error} = await supabase.from("admin_emails").select("email").eq("email",user.email).maybeSingle();
  return !error&&data?user:null;
}
function sameOrigin(request:NextRequest){
  const origin=request.headers.get("origin");
  if(!origin)return true; // Non-browser callers still require a valid admin session.
  try{
    const url=new URL(origin);
    const host=request.headers.get("x-forwarded-host")||request.headers.get("host");
    return url.protocol==="https:"&&url.host===host;
  }catch{return false}
}
function consumeBudget(userId:string):boolean{
  const now=Date.now();
  const old=requestBudget.get(userId);
  if(!old||old.resets<=now){
    if(requestBudget.size>1000)requestBudget.clear();
    requestBudget.set(userId,{remaining:11,resets:now+300000});
    return true;
  }
  if(old.remaining<=0)return false;
  old.remaining--;
  return true;
}
function safeHistory(value:unknown):LabChatMessage[]{
  if(!Array.isArray(value))return [];
  return value.slice(-6).flatMap((item):LabChatMessage[]=>{
    if(!item||typeof item!=="object")return [];
    const m=item as Record<string,unknown>;
    if((m.role!=="user"&&m.role!=="assistant")||typeof m.content!=="string"||m.content.length>1500)return [];
    return [{role:m.role,content:m.content}];
  });
}
function respond(data:unknown,status=200){return NextResponse.json(data,{status,headers:HEADERS})}
export async function GET(){
  if(!await requireAdmin())return respond({error:"Acceso solo para administración."},403);
  const status=await probeLabInference();
  return respond({
    online:status.online,
    reason:status.reason||null,
    models:LAB_MODELS.map(model=>({
      ...model,
      approved:model.version==="R2"||LAB_R5_ENABLED(),
      available:(model.version==="R2"||LAB_R5_ENABLED())
        &&Boolean(status.models.find(x=>x.id===model.id&&x.available)),
      loaded:Boolean(status.models.find(x=>x.id===model.id&&x.loaded)),
    })),
    serviceConfigured:configuredLabInference(),
    labOnly:true,
  });
}
export async function POST(request:NextRequest){
  const user=await requireAdmin();
  if(!user)return respond({error:"Acceso solo para administración."},403);
  if(!sameOrigin(request))return respond({error:"Origen de solicitud no permitido."},403);
  if(!consumeBudget(user.id))return respond({error:"Límite de pruebas alcanzado; evita ejecuciones consecutivas."},429);
  let input:Record<string,unknown>;
  try{
    const raw=await request.text();
    if(raw.length>12000)return respond({error:"Solicitud demasiado grande."},413);
    const payload=JSON.parse(raw) as unknown;
    if(!payload||typeof payload!=="object"||Array.isArray(payload))return respond({error:"Entrada inválida."},400);
    input=payload as Record<string,unknown>;
  }catch{return respond({error:"JSON inválido."},400)}
  const prompt=typeof input.prompt==="string"?input.prompt.trim():"";
  if(!prompt||prompt.length>2500)return respond({error:"La pregunta debe tener entre 1 y 2500 caracteres."},400);
  const version=input.version==="r5"?"r5":"r2";
  const mode=input.mode==="exact"?"exact":"raw";
  let models:LabModelId[];
  try{models=selectLabModels(input.selection,version)}
  catch{return respond({error:version==="r5"?"R5 requiere aprobación del Quality Gate.":"Modelo no reconocido."},400)}
  const status=await probeLabInference();
  if(!status.online)return respond({error:"Motor Nano/Lite no disponible en Dell.",reason:status.reason},503);
  const available=new Set(status.models.filter(x=>x.available).map(x=>x.id));
  if(models.some(id=>!available.has(id)))return respond({error:"Uno de los adaptadores seleccionados no está instalado en el servidor Dell.",models:status.models},503);
  const historyByModel=input.history&&typeof input.history==="object"&&!Array.isArray(input.history)
    ?input.history as Record<string,unknown>:{};
  const responses: Array<{
    model:LabModelId;ok:boolean;text?:string;latencyMs?:number;
    promptTokens?:number|null;completionTokens?:number|null;engine?:string;error?:string;
  }>=[];
  for(const model of models){
    const messages:LabChatMessage[]=[
      {role:"system",content:"Eres un modelo experimental EDUAI. Responde en español, sin fingir herramientas ni consultas externas. Sigue las instrucciones de la pregunta. Si desconoces algo, indícalo."},
      ...safeHistory(historyByModel[model]),
      {role:"user",content:prompt},
    ];
    try{
      const answer=await inferLabModel(model,messages);
      responses.push({model,ok:true,text:answer.text,latencyMs:answer.latencyMs,
        promptTokens:answer.promptTokens,completionTokens:answer.completionTokens,engine:answer.engine});
    }catch(error){
      responses.push({model,ok:false,error:error instanceof Error?error.message:"Error de inferencia."});
    }
  }
  const reference=mode==="exact"?referenceExactMath(prompt):null;
  return respond({responses,reference,mode,version,productionReady:false});
}
