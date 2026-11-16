import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=p=>readFileSync(p,"utf8")
const ui=read("app/collab/[code]/CollabClient.tsx"),call=read("app/collab/[code]/CallPanel.tsx"),api=read("app/api/rooms/route.ts"),ai=read("app/api/agents/collab/route.ts"),files=read("app/api/rooms/files/route.ts")
for(const x of ['mode==="chat"?chat:<CallPanel','mode==="video"&&<button','https://wa.me/','mailto:','Pedir ayuda a la IA','storage:','Permitir'])assert.ok(ui.includes(x),x)
for(const x of ['RTCPeerConnection','getDisplayMedia','replaceTrack','call-leave','getUserMedia'])assert.ok(call.includes(x),x)
for(const x of ['member?.status!=="approved"','if(!host)return response','collab_enter_call','invite_token','call-poll','revision'])assert.ok(api.includes(x),x)
assert.ok(ai.includes('member?.status!=="approved"'));assert.ok(ai.includes("captureTraining:false"));assert.ok(!ui.includes("triggerACo"));assert.ok(files.includes("createSignedUrl"));assert.ok(files.includes('member?.status==="approved"'))
console.log("Collaboration workspace structural checks passed.")
