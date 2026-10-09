import assert from "node:assert/strict";
import { indexClawText } from "../lib/agents/claw-document-chunks";
import { loadClawDocumentContext } from "../lib/agents/claw-document-retrieval";

async function main() {
const sample = Array.from({length:35},(_,i) =>
  `### Sección ${i+1}\n${(`La protección de datos requiere medidas y registros. Párrafo ${i+1}. `).repeat(28)}`).join("\n\n");
const indexed = indexClawText(sample);
assert.ok(indexed.length > 10, "El material completo debe indexarse en varios fragmentos");
assert.ok(indexed.every(chunk => chunk.content.length <= 2200), "Ningún fragmento debe exceder el objetivo");
assert.ok(indexed.some(chunk => chunk.content.includes("Párrafo 35")), "Debe conservarse la última sección");
assert.deepEqual(indexed.map(chunk => chunk.chunk_index), indexed.map((_,i) => i));

const owner = "ea1cdd77-455d-4b82-8841-8a8583638e9c";
const docId = "87f18a0a-1957-4435-a346-4859d1c1fe00";
const paperChunks = Array.from({length:30},(_,i)=>({
  chunk_index:i, section_title:`Apartado ${i+1}`,
  page_start: Math.floor(i/2)+1, page_end:Math.floor(i/2)+1,
  lexical_hint: i===21 ? "medidas de seguridad incidentes" : "",
  content: (i===21?"Procedimiento de medidas de seguridad incidentes y protocolos. ":"Introducción normativa y antecedentes. ").repeat(37),
}));
function fakeClient(authOwner: string) {
  return {
    from(table: string) {
      const filters: Record<string,unknown> = {};
      const source = table==="paper_documents" ? [{id:docId,user_id:owner,title:"Política institucional",summary:"Resumen preliminar"}]
        : table==="paper_chunks" ? paperChunks.map(row=>({...row,document_id:docId,user_id:owner}))
        : [];
      function found() {
        return source.filter(row=>Object.entries(filters).every(([key,value])=>
          (row as Record<string,unknown>)[key]===value));
      }
      const builder={
        select(_cols:string){return builder},
        eq(key:string,value:unknown){filters[key]=value;return builder},
        order(_key:string,_options:unknown){return builder},
        limit(max:number){return Promise.resolve({data:found().slice(0,max),error:null})},
        maybeSingle(){return Promise.resolve({data:found()[0] || null,error:null})},
      };
      return builder;
    }
  };
}
const docs=[{id:docId,name:"Política institucional",kind:"paper"}];
const context=await loadClawDocumentContext({
  supabase:fakeClient(owner) as any,userId:owner,attachments:docs,question:"¿Qué medidas de seguridad se establecen?",
});
assert.ok(context.length < 14000, "El contexto debe estar estrictamente acotado");
assert.ok(context.includes("Fragmento 22"), "La búsqueda lexical debe hallar el apartado pertinente");
assert.ok(context.includes("páginas 11-11"), "Se conservan páginas para referencias");
assert.ok(!context.includes("Fragmento 20"), "No se envían todos los fragmentos al modelo");

await assert.rejects(loadClawDocumentContext({
  supabase:fakeClient(owner) as any,
  userId:"12f2837a-997e-4b12-b4bb-33fc17d8a9b5",
  attachments:docs,
  question:"Resume el archivo",
}), /no está disponible para esta cuenta/);

console.log("Claw document indexing: fragmentación, selección lexical, límite de contexto y aislamiento OK");
}
void main().catch((error) => { console.error(error); process.exitCode = 1 });
