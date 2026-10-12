import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import type { CompleteExport, ExportSection } from "@/lib/admin/consolidated-records"

function safeSheetValue(value: string | number | undefined): string | number {
  const v = value === undefined ? "" : value
  if(typeof v==="number") return v
  const text=String(v).replace(/[\r\n\u0000-\u001F\u007F]/g," ").slice(0,16000)
  // Treat external strings as text rather than formulas, even when forged by an account.
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text
}
const excelColumn=(n:number)=>{let s="";for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s}
export function renderRecordsWorkbook(exportData:CompleteExport):Uint8Array {
  const workbook=XLSX.utils.book_new()
  const summaryRows: (string|number)[][] = [
    ["EDUAI - Archivo administrativo consolidado"],
    ["Documento confidencial: contiene datos de menores y preferencias de personas"],
    ["Generado (UTC)",exportData.generatedAt],
    ["Administrador",exportData.requestedBy],
    ["Categoría","Registros"],
    ...Object.entries(exportData.totals).map(([key,value])=>[key,value]),
    [],
    ["Nota","Cada hoja conserva los registros existentes en su categoría. La ausencia de respuesta nunca se interpreta como No."],
    ["Nota","Una respuesta afirmativa familiar no equivale a aprobación institucional."],
    ["Nota","Las actas no sustituyen la documentación externa usada para verificar identidad y representación."],
  ]
  const summary=XLSX.utils.aoa_to_sheet(summaryRows)
  summary["!cols"]=[{wch:58},{wch:30}]
  XLSX.utils.book_append_sheet(workbook,summary,"00 Resumen")
  exportData.sections.forEach((section,index)=>{
    const heading=section.columns.map(c=>c.title)
    const rows=[
      [section.name+" | EDUAI"],
      [section.description],
      heading,
      ...section.rows.map(row=>section.columns.map(c=>safeSheetValue(row[c.key])))
    ]
    const sheet=XLSX.utils.aoa_to_sheet(rows)
    const lastCol=excelColumn(heading.length)
    sheet["!autofilter"]={ref:"A3:"+lastCol+Math.max(3,rows.length)}
    sheet["!cols"]=section.columns.map(c=>({wch:Math.max(18,Math.min(44,c.title.length+12))}))
    const number=String(index+1).padStart(2,"0")
    XLSX.utils.book_append_sheet(workbook,sheet,number+" "+section.name.slice(0,28))
  })
  const content=XLSX.write(workbook,{type:"buffer",bookType:"xlsx",compression:true})
  return new Uint8Array(content)
}

function pdfValue(value:unknown):string {
  // jsPDF core fonts support Latin-1. Replace non-supported characters (e.g. emojis).
  return String(value??"—").replace(/[^\u0020-\u007E\u00A0-\u00FF]/g," ")
    .replace(/\s+/g," ").trim().slice(0,2000)||"—"
}
export function renderRecordsPdf(exportData:CompleteExport):Uint8Array {
  const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true})
  pdf.setProperties({title:"EDUAI - Archivo documental consolidado",subject:"Informe administrativo confidencial"})
  const pageHeight=297, margin=16, width=178, bottom=275
  let y=20
  const freshPage=()=>{pdf.addPage();y=22}
  const ensure=(height:number)=>{if(y+height>bottom)freshPage()}
  const write=(line:string,size=9,style:"normal"|"bold"="normal",indent=0)=>{
    pdf.setFont("helvetica",style)
    pdf.setFontSize(size)
    const fragments=pdf.splitTextToSize(pdfValue(line),width-indent) as string[]
    for (const fragment of fragments){
      ensure(size>=14?8:5.5)
      pdf.text(fragment,margin+indent,y)
      y+=size>=14?7.5:5
    }
  }
  const heading=(line:string)=>{
    ensure(15);y+=4
    pdf.setDrawColor(207,220,235);pdf.line(margin,y-1,194,y-1)
    pdf.setTextColor(25,61,120);write(line,14,"bold")
    pdf.setTextColor(28,40,59);y+=2
  }
  pdf.setTextColor(25,61,120)
  write("EDUAI | REGISTRO ADMINISTRATIVO CONSOLIDADO",17,"bold")
  pdf.setTextColor(50,65,85)
  write("CONFIDENCIAL. Solo administración autorizada.",10,"bold")
  write("Generado: "+exportData.generatedAt+" UTC",9)
  write("Responsable de la descarga: "+exportData.requestedBy,9)
  y+=4;heading("Indice y resumen")
  for (const [category,count] of Object.entries(exportData.totals))
    write(category+": "+count,9)
  y+=5
  write("Cada sección contiene todos los registros disponibles al generar el informe.",9)
  write("Las invitaciones sin respuesta no se cuentan como negativas. Una respuesta Sí requiere aprobación institucional.",9)
  write("Las actas registran una revisión administrativa; no sustituyen pruebas externas de identidad y representación.",9)
  for (const [index,section] of exportData.sections.entries()){
    freshPage()
    pdf.setTextColor(25,61,120)
    write(String(index+1)+". "+section.name+" ("+section.rows.length+" registros)",15,"bold")
    pdf.setTextColor(60,75,95)
    write(section.description,9)
    if (!section.rows.length){y+=5;write("No existen registros en esta categoría al momento de la descarga.",9);continue}
    section.rows.forEach((row,recordIndex)=>{
      const predicted=14+section.columns.length*5
      ensure(Math.min(42,predicted))
      y+=4
      pdf.setDrawColor(225,233,242);pdf.line(margin,y-2,194,y-2)
      pdf.setTextColor(24,52,98)
      write("Registro "+(recordIndex+1),10,"bold")
      pdf.setTextColor(40,51,68)
      for(const col of section.columns)write(col.title+": "+String(row[col.key]??"—"),8,"normal",3)
      y+=2
    })
  }
  const totalPages=pdf.getNumberOfPages()
  for(let i=1;i<=totalPages;i++){
    pdf.setPage(i)
    pdf.setFont("helvetica","normal")
    pdf.setFontSize(8)
    pdf.setTextColor(105,119,134)
    pdf.text("EDUAI | INFORME CONFIDENCIAL | "+i+" / "+totalPages,margin,pageHeight-10)
  }
  return new Uint8Array(pdf.output("arraybuffer"))
}
