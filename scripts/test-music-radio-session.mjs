import test from "node:test";
import assert from "node:assert/strict";
import { isRadioTrack, nextRadioAttempt } from "../lib/music/radio-session.mjs";
test("existing radio favorites and legacy IDs remain separate from music", () => {
 const saved = [{id:"youtube-123",source:"youtube"},{id:"radio-preset-fmdos",source:"radio"},{id:"radio-legacy",source:"external"},{id:"audio-1",source:"external"}];
 assert.deepEqual(saved.filter(isRadioTrack).map(t=>t.id),["radio-preset-fmdos","radio-legacy"]);
 assert.deepEqual(saved.filter(t=>!isRadioTrack(t)).map(t=>t.id),["youtube-123","audio-1"]);
});
test("radio retries each source once and stops after last source", () => {
 let step=0; const order=[0];
 while (true) { const next=nextRadioAttempt(step,4); if(next===null)break; step=next; order.push(Math.floor(step/2)); }
 assert.deepEqual(order,[0,0,1,1,2,2,3,3]);
 assert.equal(nextRadioAttempt(0,0),null);
 assert.equal(nextRadioAttempt(1,1),null);
});
