/**
 * Read-only, fail-closed component readiness probes for a SINGLE Gestión Docente.
 * A production probe must actively test the connected resource and return a
 * timestamp plus a trusted, NON-secret evidence reference. Container 'healthy'
 * alone cannot certify application integration.
 */
const POLICY=[
 ['identity','Inicio de sesión EDUAI','Autenticación EDUAI real y consentimiento'],
 ['membership','Roles institucionales','Vigencia y aislamiento escolar en Dell'],
 ['tasks','Tareas y formularios','Datos persistentes y operaciones autorizadas'],
 ['storage','Archivos privados','Carga/descarga real cifrada en Dell'],
 ['clamav','Antivirus ClamAV','Escaneo real por INSTREAM desde el servicio'],
 ['eduai_connect','EDUAI Connect','Lectura privada de recursos autorizados'],
 ['google','Google Workspace','OAuth individual y sincronización consentida'],
 ['backup','Respaldos','Restauración de datos cifrados y PostgreSQL'],
 ['browser','Navegador y E2E','Pruebas de roles por navegador y HTTPS']
];
function sane(v){return typeof v==='string'&&v.length<=140&&!/[\x00-\x1f]/.test(v)}
export async function getConfigurationStatus({probes={},now=()=>Date.now(),maxAgeMs=3600000}={}){
 if(!Number.isInteger(maxAgeMs)||maxAgeMs<1000)throw new Error('INVALID_MAX_AGE');
 const results=await Promise.all(POLICY.map(async([id,label,detail])=>{
  const fn=probes[id];
  if(typeof fn!=='function')return {id,label,status:'pending',detail,verifiedAt:null};
  try{
   const r=await fn();
   if(r?.blocked===true)return {id,label,status:'blocked',detail:sane(r.reason)?r.reason:'Verificación fallida',verifiedAt:null};
   const fresh=Number.isSafeInteger(r?.checkedAt)&&r.checkedAt<=now()&&now()-r.checkedAt<=maxAgeMs;
   if(r?.verified===true&&fresh&&sane(r.evidenceId)&&r.evidenceId.length>=12)
    return {id,label,status:'ready',detail:'Verificación confirmada',verifiedAt:r.checkedAt};
   return {id,label,status:'pending',detail:'Falta una verificación vigente y documentada',verifiedAt:null};
  }catch{return {id,label,status:'blocked',detail:'No se pudo completar la verificación',verifiedAt:null}}
 }));
 results.push({id:'napsis',label:'Napsis',status:'not_connected',detail:'Sin API oficial autorizada: no verificable',verifiedAt:null});
 return results;
}
