import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {normalizeForm} from '@/lib/forms/model';

export const runtime = 'nodejs';
export const maxDuration = 45;
const headers = {'Cache-Control':'no-store'};
const TYPES = ['single','multi','dropdown','short','long','number','scale','date','yesno','checklist','email','table','section'];
const schema = {
  type:'object',
  properties:{
    title:{type:'string'},description:{type:'string'},
    questions:{type:'array',items:{type:'object',properties:{
      type:{type:'string',enum:TYPES},label:{type:'string'},
      description:{type:'string'},required:{type:'boolean'},
      options:{type:'array',items:{type:'string'}},
      min:{type:'number'},max:{type:'number'}
    },required:['type','label','description','required','options','min','max']}}
  },required:['title','description','questions']
};

export async function POST(request: NextRequest) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Inicia sesión para usar el generador.'},{status:401,headers});
  let body:Record<string,unknown>;
  try {
    const raw=await request.text();
    if(raw.length>4000)return NextResponse.json({error:'Solicitud demasiado larga.'},{status:413,headers});
    body=JSON.parse(raw);
  } catch{return NextResponse.json({error:'Solicitud inválida.'},{status:400,headers});}
  const topic=typeof body.topic==='string'?body.topic.trim().slice(0,600):'';
  const kind=typeof body.kind==='string'?body.kind:'encuesta';
  const count=Math.max(2,Math.min(20,Math.round(Number(body.count)||6)));
  if(topic.length<5)return NextResponse.json({error:'Describe el objetivo o tema de las preguntas.'},{status:400,headers});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return NextResponse.json({error:'El generador IA no está configurado. Puedes usar las plantillas y crear preguntas manualmente.'},{status:503,headers});
  try {
    const response=await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(process.env.GEMINI_FORM_MODEL||'gemini-2.5-flash')+':generateContent?key='+encodeURIComponent(key),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        system_instruction:{parts:[{text:'Eres diseñador de instrumentos de levantamiento de información para EDUAI. Devuelve SOLO JSON válido, en español de Chile. Redacta preguntas neutras, sin sesgo, claras y no redundantes. No solicites datos personales sensibles, contraseñas, RUT o información de menores salvo autorización explícita del usuario. No inventes resultados ni participantes. Usa diversos tipos de preguntas pertinentes al instrumento.'}]},
        contents:[{role:'user',parts:[{text:'Instrumento: '+kind+'\nObjetivo: '+topic+'\nNúmero aproximado de preguntas: '+count+'\nPara opciones múltiples genera de 2 a 6 alternativas. Para escala fija min=1 y max=5. Si se requiere un inventario, listado o registro de múltiples materiales o actividades, puedes usar type=table con 2 a 8 columnas en options (por ejemplo: Cantidad, Material, Asignatura, OA). Para otros tipos usa min=0 y max=0; opciones vacías cuando no correspondan. No incluyas IDs.'}]}],
        generationConfig:{temperature:0.45,maxOutputTokens:5000,responseMimeType:'application/json',responseSchema:schema}
      }),signal:AbortSignal.timeout(40000)
    });
    if(!response.ok) {
      console.error('[forms-ai] provider status',response.status);
      return NextResponse.json({error:response.status===429?'Generador ocupado. Intenta nuevamente.':'No fue posible generar preguntas.'},{status:response.status===429?429:502,headers});
    }
    const payload=await response.json();
    const raw=payload?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||'').join('')||'';
    const result=JSON.parse(raw);
    const questions=(Array.isArray(result.questions)?result.questions:[]).slice(0,count).map((q:Record<string,unknown>)=>({
      id:crypto.randomUUID(),type:q.type,label:q.label,
      description:q.description,required:q.required,options:q.options,
      ...(q.type==='scale'?{min:1,max:5}:q.type==='number'?{}:{})
    }));
    const validated=normalizeForm({title:result.title||topic,description:result.description||'',kind,questions,settings:{}});
    if(!validated.questions.length)throw new Error('Sin preguntas');
    return NextResponse.json({suggestion:validated},{headers});
  } catch(error) {
    console.error('[forms-ai] generation error',error);
    return NextResponse.json({error:'El generador no pudo crear un formulario válido. Intenta cambiar el tema.'},{status:502,headers});
  }
}
