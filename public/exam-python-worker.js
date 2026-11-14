/* Dedicated worker: fixed reviewed Python; never execute code from an exam or model. */
let engine;
self.onmessage=async({data})=>{
 const id=data?.id;
 try{
  if(!Array.isArray(data.questions)||data.questions.length>100)throw new Error("Cantidad de preguntas inválida");
  if(!engine){
   const base="https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
   importScripts(base+"pyodide.js");
   engine=await loadPyodide({indexURL:base});
   const response=await fetch("/exam-python-check.py",{cache:"force-cache"});
   if(!response.ok)throw new Error("No se pudo cargar el verificador");
   await engine.runPythonAsync(await response.text());
  }
  engine.globals.set("exam_input_json",JSON.stringify(data.questions));
  const result=await engine.runPythonAsync("import json\njson.dumps([verify_question(q) for q in json.loads(exam_input_json)])");
  self.postMessage({id,results:JSON.parse(result)});
 }catch(error){self.postMessage({id,error:"Python no está disponible: "+String(error?.message||error).slice(0,160)})}
};
