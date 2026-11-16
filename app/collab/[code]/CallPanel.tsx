"use client"
import {useEffect,useRef,useState} from "react"
import {Camera,CameraOff,Hand,Mic,MicOff,MonitorUp,PhoneOff,Video,Users} from "lucide-react"

type Person={user_id:string;name:string;peer_id:string;mic:boolean;camera:boolean;hand:boolean}
type Signal={id:number;sender:string;payload:{type:"offer"|"answer"|"candidate";description?:RTCSessionDescriptionInit;candidate?:RTCIceCandidateInit}}
type Peer={pc:RTCPeerConnection;stream:MediaStream;pending:RTCIceCandidateInit[]}
const btn="flex min-w-14 flex-col items-center justify-center gap-1 rounded-2xl border border-soft bg-card-theme p-2 text-xs text-main transition hover:border-violet-400 disabled:opacity-40"
function Tile({person,stream,local=false,large=false}:{person:Person;stream?:MediaStream;local?:boolean;large?:boolean}){
 const ref=useRef<HTMLVideoElement>(null)
 useEffect(()=>{if(ref.current){ref.current.srcObject=stream||null;void ref.current.play().catch(()=>{})}},[stream])
 return <div className={"relative isolate overflow-hidden rounded-2xl border border-violet-300/35 bg-card-theme shadow-sm "+(large?"min-h-[220px] flex-1":"aspect-video min-h-20")} style={{backgroundImage:"linear-gradient(135deg,rgba(167,139,250,.18),rgba(45,212,191,.11))"}}>
  <video ref={ref} autoPlay playsInline muted={local} className={"absolute inset-0 h-full w-full object-contain "+(!person.camera?"opacity-0":"")}/>
  {!person.camera&&<div className="absolute inset-0 grid place-items-center"><div className={"grid place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 font-bold text-white shadow-md "+(large?"h-20 w-20 text-3xl":"h-10 w-10 text-lg")}>{person.name.slice(0,1).toUpperCase()}</div></div>}
  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2"><span className="truncate rounded-full bg-card-theme/90 px-2.5 py-1 text-xs font-semibold">{person.name}{local?" (tú)":""}</span><span className="flex items-center gap-1 rounded-full bg-card-theme/90 p-1.5">{person.hand&&<Hand size={14} className="text-amber-600"/>}{person.mic?<Mic size={14} className="text-emerald-600"/>:<MicOff size={14} className="text-rose-600"/>}</span></div>
 </div>
}
export default function CallPanel({code,userId,userName,enabled,onExit}:{code:string;userId:string;userName:string;enabled:boolean;onExit:()=>void}){
 const [joined,setJoined]=useState(false),[connecting,setConnecting]=useState(false),[error,setError]=useState(""),[people,setPeople]=useState<Person[]>([]),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[preview,setPreview]=useState<MediaStream>(),[mic,setMic]=useState(false),[camera,setCamera]=useState(false),[sharing,setSharing]=useState(false),[hand,setHand]=useState(false),[relay,setRelay]=useState(true),[focused,setFocused]=useState("")
 const peer=useRef(""),peers=useRef(new Map<string,Peer>()),local=useRef<MediaStream|null>(null),screen=useRef<MediaStream|null>(null),ice=useRef<RTCIceServer[]>([]),cursor=useRef(0),polling=useRef(false),alive=useRef(false),flags=useRef({mic:false,camera:false,hand:false}),mediaBusy=useRef(false),joinBusy=useRef(false)
 async function api(action:string,extra:Record<string,unknown>={}){
  const res=await fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,code,peer:peer.current,...extra})})
  const data=await res.json().catch(()=>({}))
  if(!res.ok)throw Error(data.error||"Error de conexión.")
  return data
 }
 function updatePreview(){const tracks=[...(local.current?.getAudioTracks()||[]),...(screen.current?.getVideoTracks()||local.current?.getVideoTracks()||[])];setPreview(new MediaStream(tracks))}
 function stopMedia(){for(const stream of [local.current,screen.current])stream?.getTracks().forEach(t=>t.stop());local.current=null;screen.current=null;for(const p of peers.current.values())p.pc.close();peers.current.clear();setRemote({});setPeople([]);setPreview(undefined);setMic(false);setCamera(false);setSharing(false);setHand(false);flags.current={mic:false,camera:false,hand:false}}
 function leave(){const id=peer.current;alive.current=false;peer.current="";stopMedia();setJoined(false);if(id)void fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"call-leave",code,peer:id}),keepalive:true}).catch(()=>{})}
 useEffect(()=>{return()=>{const id=peer.current;alive.current=false;peer.current="";for(const stream of [local.current,screen.current])stream?.getTracks().forEach(t=>t.stop());for(const p of peers.current.values())p.pc.close();if(id)void fetch("/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"call-leave",code,peer:id}),keepalive:true}).catch(()=>{})}},[code])
 async function join(){if(joinBusy.current||joined)return;joinBusy.current=true;setConnecting(true);setError("");try{if(!window.RTCPeerConnection||!navigator.mediaDevices)throw Error("Este navegador no permite videollamadas seguras.");peer.current=crypto.randomUUID();cursor.current=0;const data=await api("call-join");ice.current=data.iceServers;setRelay(data.turnConfigured);alive.current=true;setJoined(true)}catch(e){peer.current="";setError(e instanceof Error?e.message:"No se pudo conectar.")}finally{joinBusy.current=false;setConnecting(false)}}
 function trackFor(kind:string){return kind==="audio"?local.current?.getAudioTracks()[0]||null:screen.current?.getVideoTracks()[0]||local.current?.getVideoTracks()[0]||null}
 async function applyTracks(p:Peer){for(const t of p.pc.getTransceivers()){const kind=t.receiver.track.kind;await t.sender.replaceTrack(trackFor(kind))}}
 function getPeer(id:string,initiator=false){
  let p=peers.current.get(id);if(p)return p
  const pc=new RTCPeerConnection({iceServers:ice.current}),stream=new MediaStream()
  p={pc,stream,pending:[]};peers.current.set(id,p)
  pc.ontrack=e=>{if(!stream.getTracks().some(t=>t.id===e.track.id))stream.addTrack(e.track);setRemote(prev=>({...prev,[id]:new MediaStream(stream.getTracks())}))}
  pc.onicecandidate=e=>{if(e.candidate&&alive.current)void api("signal",{to:id,payload:{type:"candidate",candidate:e.candidate.toJSON()}}).catch(()=>{})}
  pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed")setError("No se pudo conectar con un participante. Sal y vuelve a entrar; algunas redes requieren TURN.")}
  if(initiator){pc.addTransceiver("audio",{direction:"sendrecv"});pc.addTransceiver("video",{direction:"sendrecv"})}
  return p
 }
 async function offer(id:string){const p=getPeer(id,true);await applyTracks(p);await p.pc.setLocalDescription(await p.pc.createOffer());await api("signal",{to:id,payload:{type:"offer",description:p.pc.localDescription?.toJSON()}})}
 async function accept(sig:Signal){
  const p=getPeer(sig.sender),v=sig.payload
  if(v.type==="candidate"&&v.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(v.candidate);else p.pending.push(v.candidate);return}
  if(!v.description)return
  await p.pc.setRemoteDescription(v.description)
  for(const candidate of p.pending.splice(0))await p.pc.addIceCandidate(candidate).catch(()=>{})
  if(v.type==="offer"){for(const t of p.pc.getTransceivers())t.direction="sendrecv";await applyTracks(p);await p.pc.setLocalDescription(await p.pc.createAnswer());await api("signal",{to:sig.sender,payload:{type:"answer",description:p.pc.localDescription?.toJSON()}})}
 }
 useEffect(()=>{
  if(!joined)return
  let stopped=false
  async function poll(){
   if(stopped||polling.current||!alive.current)return;polling.current=true
   try{
    const data=await api("call-poll",{after:cursor.current,...flags.current})
    if(stopped||!alive.current)return
    const roster=(data.people||[]) as Person[];setPeople(roster)
    const ids=new Set(roster.map(p=>p.peer_id))
    for(const [id,p] of peers.current)if(!ids.has(id)){p.pc.close();peers.current.delete(id);setRemote(prev=>{const next={...prev};delete next[id];return next})}
    // Process offers first. ICE may arrive before SDP, so candidates are queued.
    for(const sig of (data.signals||[]) as Signal[]){if(ids.has(sig.sender)){try{await accept(sig)}catch{setError("Error al negociar una conexión. Puedes volver a entrar.")}}cursor.current=Math.max(cursor.current,Number(sig.id))}
    for(const p of roster)if(p.peer_id!==peer.current&&!peers.current.has(p.peer_id)&&peer.current.localeCompare(p.peer_id)<0){try{await offer(p.peer_id)}catch{peers.current.get(p.peer_id)?.pc.close();peers.current.delete(p.peer_id)}}
   }catch(e){if(!stopped){setError(e instanceof Error?e.message:"Conexión interrumpida.");leave()}}
   finally{polling.current=false}
  }
  void poll();const timer=window.setInterval(()=>void poll(),1600)
  return()=>{stopped=true;window.clearInterval(timer)}
 },[joined])
 async function toggle(kind:"audio"|"video"){
  if(mediaBusy.current||!alive.current)return;mediaBusy.current=true;setError("")
  try{
   const existing=kind==="audio"?local.current?.getAudioTracks()[0]:local.current?.getVideoTracks()[0]
   if(existing){existing.stop();local.current?.removeTrack(existing)}
   else{
    const stream=await navigator.mediaDevices.getUserMedia(kind==="audio"?{audio:{echoCancellation:true,noiseSuppression:true}}:{video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:20,max:24}}})
    if(!alive.current){stream.getTracks().forEach(t=>t.stop());return}
    if(!local.current)local.current=new MediaStream()
    for(const t of stream.getTracks()){local.current.addTrack(t);t.onended=()=>{local.current?.removeTrack(t);syncMedia();void Promise.all(Array.from(peers.current.values()).map(applyTracks)).catch(()=>{})}}
   }
   syncMedia();await Promise.all(Array.from(peers.current.values()).map(applyTracks))
  }catch{setError("No se pudo acceder al micrófono o cámara. Revisa los permisos del navegador.")}finally{mediaBusy.current=false}
 }
 function syncMedia(){const m=!!local.current?.getAudioTracks().length,c=!!local.current?.getVideoTracks().length,s=!!screen.current?.getVideoTracks().length;setMic(m);setCamera(c);setSharing(s);flags.current={...flags.current,mic:m,camera:c||s};updatePreview()}
 async function toggleScreen(){
  if(mediaBusy.current||!alive.current)return;mediaBusy.current=true
  try{
   if(screen.current){screen.current.getTracks().forEach(t=>t.stop());screen.current=null}
   else{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});if(!alive.current){stream.getTracks().forEach(t=>t.stop());return};screen.current=stream;stream.getVideoTracks()[0].onended=()=>{screen.current=null;syncMedia();void Promise.all(Array.from(peers.current.values()).map(applyTracks)).catch(()=>{})}}
   syncMedia();await Promise.all(Array.from(peers.current.values()).map(applyTracks))
  }catch{setError("No se pudo compartir la pantalla.")}finally{mediaBusy.current=false}
 }
 const me:Person={user_id:userId,name:userName,peer_id:peer.current,mic,camera:camera||sharing,hand}
 const roster=[me,...people.filter(p=>p.peer_id!==peer.current)]
 const main=roster.find(p=>p.peer_id===focused)||roster.find(p=>p.peer_id!==peer.current&&p.camera)||me
 return <section className={(enabled?"flex":"hidden")+" min-h-0 flex-1 flex-col gap-2 rounded-3xl border border-violet-400/20 bg-card-theme/70 p-3 sm:p-4"}>
  {!joined?<div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-violet-500/5 p-5 text-center"><div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg"><Video size={35}/></div><h2 className="text-xl font-bold">Videollamada del equipo</h2><p className="max-w-md text-sm text-muted2">Hasta 6 participantes. Tu cámara y micrófono estarán apagados hasta que los actives.</p><button type="button" disabled={connecting} onClick={()=>void join()} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{connecting?"Conectando…":"Entrar a la llamada"}</button>{error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}</div>:<>
   <div className="flex items-center justify-between text-xs text-muted2"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500"/><strong className="text-main">En llamada</strong><Users size={14}/>{roster.length} participantes</span>{!relay&&<span title="TURN aún no configurado">Conexión directa</span>}</div>
   <Tile person={main} stream={main.peer_id===peer.current?preview:remote[main.peer_id]} local={main.peer_id===peer.current} large/>
   {roster.length>1&&<div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-5">{roster.filter(p=>p.peer_id!==main.peer_id).map(p=><button type="button" key={p.peer_id} onClick={()=>setFocused(p.peer_id)} aria-label={"Destacar "+p.name} className="min-w-0"><Tile person={p} stream={p.peer_id===peer.current?preview:remote[p.peer_id]} local={p.peer_id===peer.current}/></button>)}</div>}
   {error&&<p role="alert" className="text-xs text-rose-600">{error}</p>}
   <div className="flex shrink-0 flex-wrap justify-center gap-2 rounded-2xl border border-soft bg-card-theme p-2"><button type="button" aria-pressed={mic} className={btn} onClick={()=>void toggle("audio")}>{mic?<Mic size={20}/>:<MicOff size={20}/>}Micrófono</button><button type="button" aria-pressed={camera} className={btn} onClick={()=>void toggle("video")}>{camera?<Camera size={20}/>:<CameraOff size={20}/>}Cámara</button><button type="button" aria-pressed={sharing} className={btn} onClick={()=>void toggleScreen()}><MonitorUp size={20}/>Pantalla</button><button type="button" aria-pressed={hand} className={btn} onClick={()=>{setHand(!hand);flags.current.hand=!hand}}><Hand size={20}/>Mano</button><button type="button" className={btn+" !bg-rose-600 !text-white"} onClick={()=>{leave();onExit()}}><PhoneOff size={20}/>Salir</button></div>
  </>}
 </section>
}
