import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'node:crypto';

export function formsAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Almacenamiento de formularios no configurado.');
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}

export function respondentFingerprint(formId: string, email: string) {
  const key = process.env.FORM_RESPONSE_HASH_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta secreto de formularios.');
  return createHmac('sha256',key).update(formId+':'+email.trim().toLowerCase()).digest('hex');
}

const fallback = new Map<string,{count:number,until:number}>();
async function limited(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if(url && token) {
    try {
      const hashed = createHash('sha256').update(key).digest('hex');
      const redisKey = 'eduai:forms:limit:'+hashed;
      const run = async (cmd: (string|number)[]) => {
        const r = await fetch(url, {method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(cmd),signal:AbortSignal.timeout(2500)});
        if(!r.ok) throw new Error('Redis unavailable');
        const data = await r.json();
        return Number(data.result);
      };
      const count = await run(['INCR',redisKey]);
      if(count === 1) await run(['EXPIRE',redisKey,windowSeconds]);
      return count <= max;
    } catch { /* Fallback protects each active instance if Redis is unavailable. */ }
  }
  const now = Date.now();
  if(fallback.size > 10000) fallback.clear();
  const previous = fallback.get(key);
  const entry = previous && previous.until > now ? {count:previous.count+1,until:previous.until} : {count:1,until:now+windowSeconds*1000};
  fallback.set(key,entry);
  return entry.count <= max;
}

export async function allowPublicSubmission(ip: string, slug: string) {
  const source = ip.slice(0,96);
  const perPerson = await limited('ip:'+source+':'+slug,20,3600);
  if(!perPerson) return false;
  return limited('form:'+slug,120,60);
}
