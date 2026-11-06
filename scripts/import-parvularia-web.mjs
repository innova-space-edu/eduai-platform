// Explicit administrator operation. Never prints credentials or overwrites existing rows.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key)throw new Error('Configura SUPABASE_URL y una clave administrativa en el entorno')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const data=JSON.parse(readFileSync(new URL('../data/parvularia/web-2026-11/corpus.json',import.meta.url),'utf8'))
const sourceIds=new Map()
for(let i=0;i<data.sources.length;i+=50){
 const batch=data.sources.slice(i,i+50)
 const inserted=await db.from('parvularia_corpus_sources').upsert(batch,{onConflict:'source_hash',ignoreDuplicates:true})
 if(inserted.error)throw inserted.error
 const fetched=await db.from('parvularia_corpus_sources').select('id,source_hash').in('source_hash',batch.map(x=>x.source_hash))
 if(fetched.error)throw fetched.error
 for(const row of fetched.data||[])sourceIds.set(row.source_hash,row.id)
}
for(let i=0;i<data.activities.length;i+=50){
 const batch=data.activities.slice(i,i+50).map(({source_hash,...row})=>{
  const source_id=sourceIds.get(source_hash);if(!source_id)throw new Error('Fuente no encontrada')
  return{...row,source_id}
 })
 const result=await db.from('parvularia_activity_bank').upsert(batch,{onConflict:'activity_key',ignoreDuplicates:true})
 if(result.error)throw result.error
}
console.log(JSON.stringify({references:data.sources.length,adaptations:data.activities.length,mode:'insert-only',pendingReferences:data.sources.filter(x=>!x.active).length}))
