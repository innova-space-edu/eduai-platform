"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { normalizeMathTextForDisplay, latexToReadableText } from "@/lib/exam/latex-response";

type Props={value:string;onChange:(event:{target:{value:string}})=>void;className?:string;placeholder?:string;rows?:number;style?:CSSProperties;disabled?:boolean;id?:string};
type Kind="expression"|"fraction"|"root"|"power"|"subscript";
const symbols:Record<string,string>={"×":"\\times ","÷":"\\div ","≤":"\\leq ","≥":"\\geq ","≠":"\\neq ","≈":"\\approx ","π":"\\pi ","∥":"\\parallel ","△":"\\triangle ","→":"\\rightarrow ","α":"\\alpha ","β":"\\beta ","θ":"\\theta "};
function expression(s:string){return Array.from(s).map(ch=>symbols[ch]??(/[\\{}$&#%]/.test(ch)?"\\text{"+(ch==="\\"?"\\textbackslash{}":"\\"+ch)+"}":ch)).join("").replace(/(\d+)\s*\/\s*(\d+)/g,"\\frac{$1}{$2}")}
function build(k:Kind,a:string,b:string){const x=expression(a.trim()),y=expression(b.trim());return k==="fraction"?"\\frac{"+x+"}{"+y+"}":k==="root"?"\\sqrt{"+x+"}":k==="power"?"{"+x+"}^{"+y+"}":k==="subscript"?"{"+x+"}_{"+y+"}":x}
function atom(source:string){
 const el=document.createElement("span");el.contentEditable="false";el.dataset.examFormula=source;el.tabIndex=0;el.setAttribute("role","button");el.setAttribute("aria-label","Editar fórmula");
 el.className="inline-block cursor-pointer rounded px-1 hover:bg-blue-100 focus:outline focus:outline-blue-400";
 const block=source.startsWith("$$");
 try{el.innerHTML=katex.renderToString(source.slice(block?2:1,block?-2:-1),{displayMode:block,throwOnError:true,trust:false,strict:false})}catch{el.textContent=latexToReadableText(source)||"Fórmula pendiente";el.classList.add("bg-amber-50")}
 if(block)el.classList.add("w-full","overflow-x-auto","text-center");return el;
}
function populate(el:HTMLElement,value:string){el.replaceChildren();for(const part of normalizeMathTextForDisplay(value).split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g)){if(part)el.append(part.startsWith("$")&&part.endsWith("$")?atom(part):document.createTextNode(part))}}
function serialize(el:Node):string{
 if(el.nodeType===Node.TEXT_NODE)return el.textContent||"";
 if(el instanceof HTMLElement){if(el.dataset.examFormula)return el.dataset.examFormula;if(el.tagName==="BR")return "\n"}
 let out="";for(const child of Array.from(el.childNodes)){if(child instanceof HTMLElement&&["DIV","P"].includes(child.tagName)&&out&&!out.endsWith("\n"))out+="\n";out+=serialize(child)}return out;
}
export default function ExamVisualEditor({value,onChange,className="",placeholder="Escribe aquí…",style,disabled,id}:Props){
 const ref=useRef<HTMLDivElement>(null),last=useRef<string|null>(null),selection=useRef<Range|null>(null),target=useRef<HTMLElement|null>(null);
 const [editing,setEditing]=useState(false),[kind,setKind]=useState<Kind>("expression"),[a,setA]=useState(""),[b,setB]=useState(""),[block,setBlock]=useState(false),[original,setOriginal]=useState(""),[error,setError]=useState("");
 useEffect(()=>{if(ref.current&&last.current!==value){populate(ref.current,value||"");last.current=value}},[value]);
 const change=()=>{if(!ref.current)return;const next=serialize(ref.current);last.current=next;onChange({target:{value:next}})};
 const remember=()=>{const s=window.getSelection();if(s?.rangeCount&&ref.current?.contains(s.anchorNode))selection.current=s.getRangeAt(0).cloneRange()};
 const open=(el?:HTMLElement)=>{if(disabled)return;remember();target.current=el||null;const source=el?.dataset.examFormula||"";setOriginal(source);setKind("expression");setA("");setB("");setBlock(source.startsWith("$$"));setError("");setEditing(true)};
 const insert=()=>{
  if(!a.trim()||(["fraction","power","subscript"].includes(kind)&&!b.trim())){setError("Completa los campos.");return}
  if(!ref.current)return;const math=build(kind,a,b),source=(block?"$$":"$")+math+(block?"$$":"$");
  try{katex.renderToString(math,{throwOnError:true,trust:false})}catch{setError("Revisa la expresión matemática.");return}
  const el=atom(source);if(target.current&&ref.current.contains(target.current))target.current.replaceWith(el);else if(selection.current&&ref.current.contains(selection.current.commonAncestorContainer)){selection.current.deleteContents();selection.current.insertNode(el)}else ref.current.append(el);
  const space=document.createTextNode(" ");el.after(space);const r=document.createRange();r.setStartAfter(space);r.collapse(true);const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(r);selection.current=r;setEditing(false);change();ref.current.focus();
 };
 return <div className="min-w-0 space-y-2">
  <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>open()} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">＋ Fórmula</button><span className="text-[10px] text-slate-500">Escribe directamente · selecciona una fórmula para sustituirla</span></div>
  <div id={id} ref={ref} role="textbox" aria-label={placeholder} aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder} style={style} className={className+" exam-visual-content min-h-12 whitespace-pre-wrap break-words text-justify leading-relaxed outline-none focus:ring-2 focus:ring-blue-200 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"}
   onInput={change} onBlur={remember} onKeyUp={remember} onMouseUp={remember}
   onClick={e=>{const el=(e.target as HTMLElement).closest<HTMLElement>("[data-exam-formula]");if(el)open(el)}}
   onKeyDown={e=>{const el=(e.target as HTMLElement).closest<HTMLElement>("[data-exam-formula]");if(el&&(e.key==="Enter"||e.key===" ")){e.preventDefault();open(el)}}}
   onPaste={e=>{e.preventDefault();const sel=window.getSelection();if(!sel?.rangeCount)return;const r=sel.getRangeAt(0);if(!ref.current?.contains(r.commonAncestorContainer))return;r.deleteContents();const node=document.createTextNode(e.clipboardData.getData("text/plain"));r.insertNode(node);r.setStartAfter(node);r.collapse(true);sel.removeAllRanges();sel.addRange(r);change()}}/>
  {editing&&<div role="dialog" aria-label="Editor visual de fórmulas" className="rounded-xl border border-blue-200 bg-white p-4 space-y-3">
   <div className="flex justify-between"><strong className="text-sm text-blue-900">{original?"Modificar fórmula":"Insertar fórmula"}</strong><button type="button" onClick={()=>setEditing(false)} className="text-xs underline">Cancelar</button></div>
   {original&&<div className="rounded-lg bg-slate-50 p-2"><span className="text-xs text-slate-500">Fórmula actual</span><span ref={el=>{if(el)el.replaceChildren(atom(original))}}/></div>}
   <div className="flex flex-wrap gap-1">{([{id:"expression",label:"Expresión"},{id:"fraction",label:"Fracción"},{id:"root",label:"Raíz"},{id:"power",label:"Potencia"},{id:"subscript",label:"Subíndice"}] as const).map(item=><button type="button" key={item.id} onClick={()=>setKind(item.id)} className={"rounded-lg border px-2 py-1 text-xs "+(kind===item.id?"bg-blue-600 text-white":"bg-white")}>{item.label}</button>)}</div>
   <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-semibold">{kind==="fraction"?"Numerador":kind==="root"?"Radicando":kind==="power"||kind==="subscript"?"Base":"Expresión matemática"}<input value={a} onChange={e=>setA(e.target.value)} placeholder="Ej.: 3x + 2" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>{["fraction","power","subscript"].includes(kind)&&<label className="text-xs font-semibold">{kind==="fraction"?"Denominador":kind==="power"?"Exponente":"Índice"}<input value={b} onChange={e=>setB(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>}</div>
   <div className="flex flex-wrap gap-1">{Object.keys(symbols).map(s=><button type="button" key={s} onClick={()=>setA(v=>v+s)} className="rounded border px-2 py-1 text-sm">{s}</button>)}</div>
   <div className="flex items-center gap-2"><label className="flex gap-1 text-xs"><input type="checkbox" checked={block} onChange={e=>setBlock(e.target.checked)}/> En línea separada</label><button type="button" onClick={insert} className="ml-auto rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">{original?"Sustituir":"Insertar"}</button></div>{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>}
 </div>;
}
