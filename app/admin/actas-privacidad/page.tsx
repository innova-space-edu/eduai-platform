"use client"
import Link from "next/link"
import {useEffect,useState} from "react"
import {OPTIONAL_PRIVACY_PURPOSES} from "@/components/legal/PrivacyConsentPanel"
type Act={folio:string;accountId:string;name:string;email:string|null;version:string;date:string;origin:string;choices:Record<string,boolean>}
export default function PrivacyActs(){
 const [acts,setActs]=useState<Act[]>([]),[next,setNext]=useState<string|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("")
 async function load(before?:string){
  setBusy(true);setError("")
  try{
   const res=await fetch("/api/admin/actas-privacidad"+(before?"?before="+encodeURIComponent(before):""),{cache:"no-store"})
   const data=await res.json()
   if(!res.ok)throw Error(data.error||"No se pudieron cargar las actas.")
   setActs(old=>before?[...old,...data.acts]:data.acts);setNext(data.next)
  }catch(e){setError(e instanceof Error?e.message:"No se pudo cargar el archivo.")}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[])
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-5xl space-y-5">
  <nav className="flex flex-wrap gap-4 text-sm text-blue-700"><Link href="/admin">← Administración</Link><Link href="/admin/actas-familiares">Actas familiares</Link><Link href="/admin/registros">Exportar PDF / Excel</Link></nav>
  <header className="rounded-2xl bg-slate-900 p-6 text-white"><h1 className="text-2xl font-bold">Actas de condiciones y privacidad</h1><p className="mt-2 text-sm text-slate-200">Cada declaración registrada y cada modificación de preferencias conserva su propio folio histórico, titular, versión y fecha. No equivale a una firma de identidad verificada.</p></header>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {acts.map(a=><article key={a.folio} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold text-blue-900">{a.folio}</h2><span className="text-sm">{new Date(a.date).toLocaleString("es-CL",{timeZone:"America/Santiago"})}</span></div><p className="mt-2 text-sm">{a.name} · {a.email||a.accountId}</p><p className="text-xs text-slate-600">Versión {a.version} · {a.origin==="signup_declarations"?"Declaración de registro":"Registro o modificación de decisiones"}</p><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div>Condiciones necesarias: <strong>Sí</strong></div><div>Advertencia de datos: <strong>Sí</strong></div>{OPTIONAL_PRIVACY_PURPOSES.map(p=><div key={p.key}>{p.title}: <strong>{a.choices?.[p.key]===true?"Sí":a.choices?.[p.key]===false?"No":"No consta"}</strong></div>)}</dl></article>)}
  {!busy&&!acts.length&&!error&&<p>No hay actas disponibles.</p>}{busy&&<p role="status">Consultando actas…</p>}{next&&<button type="button" disabled={busy} onClick={()=>void load(next)} className="rounded-xl border bg-white px-4 py-2">Cargar actas anteriores</button>}
 </div></main>
}
