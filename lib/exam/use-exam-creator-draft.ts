"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Data = Record<string, any>;
type Envelope = {version:1; savedAt:number; revision:number; dirty:boolean; data:Data|null};
type Cloud = "loading"|"local"|"syncing"|"synced"|"conflict"|"error";
const keyFor=(id:string)=>"eduai:exam-creator:draft:v1:"+id;

export function useExamCreatorDraft(userId:string|null,data:Data,restore:(data:Data)=>void){
  const [ready,setReady]=useState(false);
  const [draftRestored,setDraftRestored]=useState(false);
  const [autosaveAt,setAutosaveAt]=useState<number|null>(null);
  const [autosaveState,setAutosaveState]=useState<"idle"|"saving"|"saved"|"error">("idle");
  const [cloudState,setCloudState]=useState<Cloud>("loading");
  const client=useRef(createClient());
  const current=useRef<Envelope|null>(null);
  const restoreRef=useRef(restore);restoreRef.current=restore;
  const dataRef=useRef(data);dataRef.current=data;
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const queue=useRef<Promise<void>>(Promise.resolve());
  const enabled=useRef(false),closed=useRef(false);
  const owner=useRef<string|null>(null);
  const fingerprint=JSON.stringify(data);
  const lastFingerprint=useRef("");
  function store(id:string,value:Envelope){
    current.current=value;
    try{localStorage.setItem(keyFor(id),JSON.stringify(value));setAutosaveAt(value.savedAt);setAutosaveState("saved");}
    catch{setAutosaveState("error");}
  }
  function sync(id:string){
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      if(!enabled.current||owner.current!==id||!current.current?.dirty)return;
      const snapshot=current.current;
      setCloudState("syncing");
      try{
        const {data:revision,error}=await client.current.rpc("save_exam_creator_draft",{expected_revision:snapshot.revision,draft_payload:snapshot.data}).abortSignal(AbortSignal.timeout(10000));
        if(owner.current!==id)return;
        if(error)throw error;
        if(typeof revision!=="number"||revision<1){enabled.current=false;setCloudState("conflict");return;}
        const latest=current.current;
        if(!latest)return;
        const unchanged=latest===snapshot;
        store(id,{...latest,revision,dirty:!unchanged});
        setCloudState(unchanged?"synced":"local");
        if(!unchanged&&!closed.current)schedule(id);
      }catch{setCloudState("error");}
    });
    return queue.current;
  }
  function schedule(id:string){
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{timer.current=null;void sync(id)},1800);
  }
  function persistExamCreatorDraft(){
    if(!userId||!ready||closed.current||owner.current!==userId)return;
    const signature=JSON.stringify(dataRef.current);
    if(signature===lastFingerprint.current)return;
    lastFingerprint.current=signature;
    // Snapshot, not a live ref to a generation cache that is still mutating.
    store(userId,{version:1,savedAt:Date.now(),revision:current.current?.revision||0,dirty:true,data:JSON.parse(signature)});
    if(enabled.current)schedule(userId);
  }
  useEffect(()=>{
    if(!userId)return;
    let cancelled=false;
    owner.current=userId;closed.current=false;enabled.current=false;
    setReady(false);setCloudState("loading");setDraftRestored(false);
    let local:Envelope|null=null;
    try{
      const parsed=JSON.parse(localStorage.getItem(keyFor(userId))||"null");
      if(parsed&&(parsed.data===null||(parsed.data&&typeof parsed.data==="object"&&!Array.isArray(parsed.data))))local={...parsed,revision:Number.isInteger(parsed.revision)?parsed.revision:0,dirty:parsed.dirty!==false};
    }catch{}
    void(async()=>{
      let chosen=local;
      try{
        const {data:row,error}=await client.current.from("exam_creator_drafts").select("revision,payload,updated_at").eq("user_id",userId).maybeSingle().abortSignal(AbortSignal.timeout(8000));
        if(cancelled)return;
        if(error)throw error;
        const remote:Envelope={version:1,savedAt:row?Date.parse(row.updated_at):0,revision:Number(row?.revision||0),dirty:false,data:row?.payload??null};
        if(local?.dirty&&local.revision===remote.revision)chosen=local;
        else if(local?.dirty&&local.data!==null&&local.revision!==remote.revision){
          const keep=window.confirm("Hay cambios locales sin sincronizar y otro borrador en tu cuenta. ¿Conservar los cambios de este navegador? Aceptar: local. Cancelar: cuenta.");
          chosen=keep?{...local,revision:remote.revision,dirty:true}:remote;
        }else chosen=remote;
        enabled.current=true;setCloudState(chosen?.dirty?"local":"synced");
      }catch{if(cancelled)return;setCloudState("error");}
      if(cancelled)return;
      current.current=chosen;
      if(chosen?.data){
        restoreRef.current(chosen.data);setDraftRestored(true);lastFingerprint.current=JSON.stringify(chosen.data);
      }else lastFingerprint.current=JSON.stringify(dataRef.current);
      if(chosen)store(userId,chosen);
      setReady(true);
      if(chosen?.dirty&&enabled.current)schedule(userId);
    })();
    return()=>{cancelled=true;if(timer.current)clearTimeout(timer.current);};
  },[userId]);
  useEffect(()=>{persistExamCreatorDraft()},[fingerprint,ready,userId]);
  useEffect(()=>{
    const flush=()=>persistExamCreatorDraft();
    const visibility=()=>{if(document.visibilityState==="hidden")flush()};
    window.addEventListener("pagehide",flush);document.addEventListener("visibilitychange",visibility);
    return()=>{window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",visibility)};
  },[fingerprint,ready,userId]);
  async function saveNow(){
    persistExamCreatorDraft();
    if(!userId||!ready||closed.current)return;
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
    if(enabled.current)await sync(userId);
  }
  async function clearExamCreatorDraft(){
    if(!userId)return;
    closed.current=true;
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
    await queue.current.catch(()=>{});
    store(userId,{version:1,savedAt:Date.now(),revision:current.current?.revision||0,dirty:true,data:null});
    if(enabled.current)await sync(userId);
    setDraftRestored(false);
  }
  return{ready,draftRestored,autosaveAt,autosaveState,cloudState,persistExamCreatorDraft,clearExamCreatorDraft,saveNow};
}
