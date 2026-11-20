import { NextRequest, NextResponse } from 'next/server';
import { formsAdmin, allowPublicSubmission, respondentFingerprint } from '@/lib/forms/server';
import { normalizeForm, validateSubmission, type FormRecord } from '@/lib/forms/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = {'Cache-Control':'no-store, max-age=0'};
type RouteContext = {params: Promise<{slug:string}>};
const isSlug = (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27,42}$/i.test(value);
const fail = (error:string,status:number) => NextResponse.json({error},{status,headers:HEADERS});

async function published(slug: string) {
  const {data,error} = await formsAdmin().from('eduai_forms')
    .select('id,slug,title,description,kind,status,questions,settings')
    .eq('slug',slug).eq('status','published').maybeSingle();
  if(error) throw error;
  if(!data) return null;
  const form = normalizeForm(data);
  const result: FormRecord = {...form,id:data.id,slug:data.slug,status:'published'};
  if(result.settings.endsAt && Date.parse(result.settings.endsAt) <= Date.now()) return null;
  return result;
}
export async function GET(_request: NextRequest,{params}:RouteContext) {
  const {slug} = await params;
  if(!isSlug(slug)) return fail('Enlace inválido.',404);
  try {
    const form = await published(slug);
    if(!form) return fail('Formulario no disponible o cerrado.',404);
    return NextResponse.json({form},{headers:HEADERS});
  } catch(e) {
    console.error('[form-public] read',e);
    return fail('No fue posible cargar el formulario.',503);
  }
}
export async function POST(request: NextRequest,{params}:RouteContext) {
  const {slug} = await params;
  if(!isSlug(slug)) return fail('Enlace inválido.',404);
  const contentLength = Number(request.headers.get('content-length')||0);
  // Tables may contain up to 40 rows of 8 columns; still cap anonymous payloads.
  if(contentLength > 120000) return fail('Respuestas demasiado extensas.',413);
  const bodyText = await request.text().catch(()=>null);
  if(!bodyText || bodyText.length > 120000) return fail('Solicitud inválida o demasiado extensa.',413);
  let body: unknown;
  try {body=JSON.parse(bodyText);}catch{return fail('JSON inválido.',400);}
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if(!(await allowPublicSubmission(ip,slug))) return fail('Demasiados envíos. Intenta más tarde.',429);
  try {
    const form = await published(slug);
    if(!form) return fail('El formulario ya no recibe respuestas.',404);
    if(!form.questions.some(q=>q.type !== 'section')) return fail('El formulario no contiene preguntas.',400);
    const {answers,identity} = validateSubmission(form,body);
    const fingerprint = form.settings.oneResponse && identity.email ? respondentFingerprint(form.id,identity.email) : null;
    const {data,error} = await formsAdmin().from('eduai_form_responses').insert({
      form_id:form.id, answers, identity, respondent_fingerprint:fingerprint,
      questions_snapshot:form.questions
    }).select('id').single();
    if(error?.code==='23505') return fail('Este correo ya registró una respuesta.',409);
    if(error) throw error;
    return NextResponse.json({ok:true,id:data.id,message:form.settings.confirmationMessage},{status:201,headers:HEADERS});
  } catch(e) {
    if(e instanceof Error && !('code' in e) && !String(e.message).includes('Supabase')) {
      const message = e.message;
      if(/(inválid|falta|ingresa|debes|demasiado|opción|número|fecha|correo|rango|completa|tabla|fila)/i.test(message))
        return fail(message,400);
    }
    console.error('[form-public] submit',e);
    return fail('No fue posible guardar la respuesta.',503);
  }
}
