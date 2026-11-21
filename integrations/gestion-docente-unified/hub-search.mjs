/**
 * Federated authorized search in Gestión Docente. Search results are references:
 * own/explicitly shared files, tasks permitted by oversight, and connected,
 * personally authorized source metadata. No fulltext of private mail content.
 */
const KIND=new Set(['all','tasks','files','external']);
export function searchHub({hub,registry,token,schoolId,query='',kind='all',taskStatus=null,group=null,userId=null}){
 if(!hub||!registry||!KIND.has(kind)||typeof query!=='string'||query.length>100)throw new Error('SEARCH_INVALID');
 const tasks=['all','tasks'].includes(kind)?hub.searchTasks(token,{schoolId,textQuery:query,status:taskStatus,group,userId}):[];
 const files=['all','files'].includes(kind)?hub.searchFiles(token,{schoolId,query}):[];
 const external=['all','external'].includes(kind)?registry.searchOwn(token,schoolId,{query}):[];
 const statuses=registry.status(token,schoolId);
 const official=/(?:notas?|calificaciones?|asistencia|matr[ií]cula|informes? de curso)/i.test(query)
  ?registry.externalVerification(token,schoolId,{provider:'napsis',kind:/(?:notas?|calificaciones?)/i.test(query)?'grades':/asistencia/i.test(query)?'attendance':/matr[ií]cula/i.test(query)?'enrollment':'course_reports'})
  :null;
 return {
  tasks,files,external,
  counts:{tasks:tasks.length,files:files.length,external:external.length},
  sourceStates:statuses,
  officialVerification:official,
  explanation:official?'Los estados de entrega de tareas NO prueban el cumplimiento oficial en Napsis; API oficial no conectada.':'Resultados filtrados por tus permisos vigentes.'
 };
}
export function taskProgress({hub,token,schoolId,group=null,query=''}){
 const rows=hub.searchTasks(token,{schoolId,group,textQuery:query});
 const counts={assigned:0,draft:0,submitted:0,returned:0,approved:0,cancelled:0,overdue:0};
 for(const r of rows){if(Object.hasOwn(counts,r.status))counts[r.status]++;if(r.overdue)counts.overdue++}
 return {total:rows.length,counts,
  pendingEvidence:rows.filter(x=>!['submitted','approved','cancelled'].includes(x.status)).map(x=>({taskId:x.taskId,assigneeId:x.assigneeId,group:x.group,status:x.status,dueAt:x.dueAt,overdue:x.overdue})),
  awaitingReview:rows.filter(x=>x.status==='submitted').map(x=>({taskId:x.taskId,assigneeId:x.assigneeId})),
  meaning:'Seguimiento de tareas y evidencias del HUB, no indicadores oficiales de Napsis.'
 };
}
