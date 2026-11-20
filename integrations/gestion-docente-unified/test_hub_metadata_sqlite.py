import importlib.util
import multiprocessing
import os
import tempfile
import unittest
import uuid
from pathlib import Path

MODULE=Path(__file__).with_name('hub-metadata-sqlite.py')
spec=importlib.util.spec_from_file_location('hub_metadata_sqlite',MODULE)
mod=importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name]=mod
spec.loader.exec_module(mod)
HubMetaSQLite=mod.HubMetaSQLite
Principal=mod.Principal
Forbidden=mod.Forbidden

SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
AA='11111111-1111-4111-8111-111111111111'
AB='22222222-2222-4222-8222-222222222222'
UA='33333333-3333-4333-8333-333333333333'
UB='44444444-4444-4444-8444-444444444444'
UTP='55555555-5555-4555-8555-555555555555'
CLOCK=1795189200000
HASH='a'*64
OP='upload-attempt-unique-id-0001'

def process_reserve(dbfile,folder,op,queue):
 try:
  svc=HubMetaSQLite(dbfile,clock=lambda:CLOCK)
  principal=Principal(UA,True,'aal1',CLOCK+1000000)
  result=svc.reserve_upload(principal,SA,folder,op,70)
  queue.put(('ok',result))
 except Exception as e:
  queue.put(('fail',getattr(e,'code',type(e).__name__)))

class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.dbfile=str(Path(self.tmp.name)/'gestionsandbox.sqlite3')
  self.receipts={}
  def verifier(q):
   return self.receipts.get(q['uploadId'])
  self.s=HubMetaSQLite(self.dbfile,clock=lambda:CLOCK,scan_receipt_verifier=verifier)
  self.admin=Principal(AA,True,'aal2',CLOCK+1000000)
  self.admin_b=Principal(AB,True,'aal2',CLOCK+1000000)
  self.user=Principal(UA,True,'aal1',CLOCK+1000000)
  self.user_b=Principal(UB,True,'aal1',CLOCK+1000000)
  self.utp=Principal(UTP,True,'aal1',CLOCK+1000000)
  self.s.bootstrap_school(SA,AA,'Colegio Alfa',100)
  self.s.bootstrap_school(SB,AB,'Colegio Beta',100)
  self.s.add_member(self.admin,SA,UA,'pie',CLOCK+1000000)
  self.s.add_member(self.admin,SA,UTP,'utp',CLOCK+1000000)
  self.s.add_member(self.admin_b,SB,UB,'pie',CLOCK+1000000)
  self.folder=self.s.create_folder(self.user,SA,'Evidencias PIE')

 def tearDown(self):self.tmp.cleanup()

 def denied(self,fn,expected):
  with self.assertRaises(Forbidden) as exc:fn()
  self.assertEqual(exc.exception.code,expected)

 def reserve(self,n=60,key=OP):
  return self.s.reserve_upload(self.user,SA,self.folder,key,n)

 def trust(self,upload_id,size=60):
  self.receipts[upload_id]={
    'id':upload_id,'ownerId':UA,'schoolId':SA,'folderId':self.folder,
    'clean':True,'scanEngine':'clamav','stored':True,
    'sha256':HASH,'sizeBytes':size
  }

 def test_two_tenants_are_isolated(self):
  self.denied(lambda:self.s.my_tasks(self.user,SB),'MEMBERSHIP_REQUIRED')
  self.denied(lambda:self.s.reserve_upload(self.user,SB,self.folder,OP,20),'MEMBERSHIP_REQUIRED')
  self.assertEqual(self.s.usage(self.user,SA)['used'],0)

 def test_any_member_can_create_private_folder(self):
  f=self.s.create_folder(self.utp,SA,'Carpeta UTP')
  self.denied(lambda:self.s.reserve_upload(self.user,SA,f,OP,20),'FOLDER_ACCESS_DENIED')
  self.assertTrue(f)

 def test_viewer_cannot_write_but_editor_can(self):
  f=self.s.create_folder(self.utp,SA,'UTP')
  self.s.share_folder(self.utp,SA,f,UA,'viewer',CLOCK+1000000)
  self.denied(lambda:self.s.reserve_upload(self.user,SA,f,OP,20),'FOLDER_ACCESS_DENIED')
  self.s.share_folder(self.utp,SA,f,UA,'editor',CLOCK+1000000)
  self.assertEqual(self.s.reserve_upload(self.user,SA,f,OP,20)['state'],'reserved')

 def test_idempotent_upload_reservation_no_double_charge(self):
  x=self.reserve()
  y=self.reserve()
  self.assertEqual(x['uploadId'],y['uploadId'])
  self.assertTrue(y['reused'])
  self.assertEqual(self.s.usage(self.user,SA)['reserved'],60)

 def test_reusing_key_with_different_payload_fails(self):
  self.reserve()
  self.denied(lambda:self.reserve(30),'IDEMPOTENCY_CONFLICT')
  self.assertEqual(self.s.usage(self.user,SA)['reserved'],60)

 def test_quota_blocks_oversubscription(self):
  self.reserve()
  self.denied(lambda:self.reserve(50,'upload-another-unique-key-0002'),'QUOTA_EXCEEDED')
  self.assertEqual(self.s.usage(self.admin,SA)['reserved'],60)

 def test_cancel_frees_reservation_without_reusing_key(self):
  r=self.reserve()
  self.s.cancel_upload(self.user,SA,r['uploadId'])
  self.assertEqual(self.s.usage(self.user,SA)['reserved'],0)
  self.denied(lambda:self.reserve(),'UPLOAD_CANCELLED')

 def test_unverified_object_cannot_be_committed(self):
  r=self.reserve()
  self.denied(lambda:self.s.commit_upload(self.user,SA,r['uploadId'],HASH),'VERIFIED_STORAGE_REQUIRED')
  self.assertEqual(self.s.usage(self.user,SA)['used'],0)

 def test_verified_antivirus_receipt_commits_once(self):
  r=self.reserve()
  self.trust(r['uploadId'])
  a=self.s.commit_upload(self.user,SA,r['uploadId'],HASH)
  b=self.s.commit_upload(self.user,SA,r['uploadId'],HASH)
  self.assertEqual(a['fileId'],b['fileId'])
  self.assertTrue(b['reused'])
  self.assertEqual(self.s.usage(self.user,SA),{'hard_limit':100,'used':60,'reserved':0})

 def test_mismatching_receipt_size_fails(self):
  r=self.reserve()
  self.trust(r['uploadId'],size=999)
  self.denied(lambda:self.s.commit_upload(self.user,SA,r['uploadId'],HASH),'VERIFIED_STORAGE_REQUIRED')

 def test_member_revocation_immediately_rejects_upload(self):
  r=self.reserve()
  self.s.revoke_member(self.admin,SA,UA)
  self.denied(lambda:self.s.commit_upload(self.user,SA,r['uploadId'],HASH),'MEMBERSHIP_REQUIRED')
  self.denied(lambda:self.s.my_tasks(self.user,SA),'MEMBERSHIP_REQUIRED')

 def test_nonadmin_and_admin_without_mfa_cannot_create_tasks(self):
  self.denied(lambda:self.s.create_task(self.user,SA,'Tarea PIE',['pie'],CLOCK+500000,['registro'],0,'task-key-pie-2026-001'),'MFA_REQUIRED')
  low=Principal(AA,True,'aal1',CLOCK+1000000)
  self.denied(lambda:self.s.create_task(low,SA,'Tarea PIE',['pie'],CLOCK+500000,['registro'],0,'task-key-pie-2026-001'),'MFA_REQUIRED')

 def test_task_has_independent_recipients_and_no_gradebook(self):
  row=self.s.create_task(self.admin,SA,'Verificar evidencia de notas',['pie','utp'],CLOCK+500000,['registro'],0,'task-key-pie-2026-001')
  self.assertEqual(row['assigned'],2)
  self.assertEqual(self.s.my_tasks(self.user,SA)[0]['state'],'assigned')
  self.assertEqual(self.s.my_tasks(self.utp,SA)[0]['state'],'assigned')
  res=self.s.submit_task(self.user,SA,row['taskId'],{'registro':'Constancia enviada'},[],0)
  self.assertEqual(res['approved'],False)
  self.assertEqual(self.s.my_tasks(self.utp,SA)[0]['state'],'assigned')
  self.denied(lambda:self.s.review_task(self.user,SA,row['taskId'],UA,1,'approve'),'MFA_REQUIRED')
  self.assertEqual(self.s.review_task(self.admin,SA,row['taskId'],UA,1,'approve')['status'],'approved')

 def test_task_revision_conflict_prevents_double_submit(self):
  tid=self.s.create_task(self.admin,SA,'Planificación',['pie'],CLOCK+500000,['observacion'],0,'task-key-pie-2026-001')['taskId']
  self.s.submit_task(self.user,SA,tid,{'observacion':'Revisado'},[],0)
  self.denied(lambda:self.s.submit_task(self.user,SA,tid,{'observacion':'Doble'},[],0),'TASK_NOT_WRITABLE')
  self.denied(lambda:self.s.review_task(self.admin,SA,tid,UA,0,'approve'),'REVISION_CONFLICT')

 def test_task_idempotency_suppresses_duplicate_dispatch(self):
  kwargs={'school_id':SA,'title':'Planificación','groups':['pie'],
          'deadline_at':CLOCK+500000,'required_fields':['observacion'],
          'min_files':0,'idempotency_key':'task-key-pie-2026-001'}
  a=self.s.create_task(self.admin,**kwargs)
  b=self.s.create_task(self.admin,**kwargs)
  self.assertEqual(a['taskId'],b['taskId'])
  self.assertTrue(b['reused'])
  self.assertEqual(len(self.s.my_tasks(self.user,SA)),1)

 def test_evidence_file_requires_ready_owned_object(self):
  tid=self.s.create_task(self.admin,SA,'Evidencia PDF',['pie'],CLOCK+500000,[],1,'task-key-pie-2026-001')['taskId']
  r=self.reserve()
  self.denied(lambda:self.s.submit_task(self.user,SA,tid,{},[r['uploadId']],0),'FILE_UNAVAILABLE')
  self.trust(r['uploadId']);self.s.commit_upload(self.user,SA,r['uploadId'],HASH)
  result=self.s.submit_task(self.user,SA,tid,{},[r['uploadId']],0)
  self.assertEqual(result['status'],'submitted')

 def test_cross_school_admin_denied(self):
  self.denied(lambda:self.s.create_task(self.admin_b,SA,'Tarea',['pie'],CLOCK+500000,['x'],0,'task-key-pie-2026-001'),'MEMBERSHIP_REQUIRED')

 def test_process_concurrency_quota_limit(self):
  # SQLite WAL BEGIN IMMEDIATE locks across independent process connections.
  from multiprocessing import get_context
  ctx=get_context('fork')
  q=ctx.Queue()
  a=ctx.Process(target=process_reserve,args=(self.dbfile,self.folder,'unique-process-key-00001',q))
  b=ctx.Process(target=process_reserve,args=(self.dbfile,self.folder,'unique-process-key-00002',q))
  a.start();b.start()
  a.join(timeout=7);b.join(timeout=7)
  if a.is_alive():a.terminate()
  if b.is_alive():b.terminate()
  self.assertEqual(a.exitcode,0)
  self.assertEqual(b.exitcode,0)
  results=[q.get(timeout=2),q.get(timeout=2)]
  self.assertEqual([x[0] for x in results].count('ok'),1,results)
  self.assertEqual([x[1] for x in results if x[0]=='fail'],['QUOTA_EXCEEDED'])
  self.assertEqual(self.s.usage(self.user,SA)['reserved'],70)


 def test_expired_reservation_releases_quota_for_next_request(self):
  r=self.s.reserve_upload(self.user,SA,self.folder,'expiration-test-key-00001',90,ttl_ms=1000)
  later=HubMetaSQLite(self.dbfile,clock=lambda:CLOCK+2000,scan_receipt_verifier=lambda q:None)
  v=later.reserve_upload(Principal(UA,True,'aal1',CLOCK+1000000),SA,self.folder,'new-expiration-test-00002',70)
  self.assertEqual(v['state'],'reserved')
  self.assertEqual(later.usage(self.user,SA)['reserved'],70)
  self.denied(lambda:later.reserve_upload(self.user,SA,self.folder,'expiration-test-key-00001',90),'UPLOAD_CANCELLED')

 def test_replayed_task_key_with_different_groups_is_denied(self):
  self.s.create_task(self.admin,SA,'Planificación',['pie'],CLOCK+500000,['observacion'],0,'task-key-pie-2026-001')
  self.denied(lambda:self.s.create_task(self.admin,SA,'Planificación',['pie','utp'],CLOCK+500000,['observacion'],0,'task-key-pie-2026-001'),'IDEMPOTENCY_CONFLICT')

 def test_receipt_bound_to_upload_and_owner(self):
  r=self.reserve();self.trust(r['uploadId'])
  self.receipts[r['uploadId']]['ownerId']=UTP
  self.denied(lambda:self.s.commit_upload(self.user,SA,r['uploadId'],HASH),'VERIFIED_STORAGE_REQUIRED')
  self.assertEqual(self.s.usage(self.user,SA)['reserved'],60)

 def test_restarted_instance_reads_persistent_task_revision(self):
  tid=self.s.create_task(self.admin,SA,'Formularios PIE',['pie'],CLOCK+500000,['detalle'],0,'task-key-pie-2026-001')['taskId']
  self.s.submit_task(self.user,SA,tid,{'detalle':'Completado'},[],0)
  reopened=HubMetaSQLite(self.dbfile,clock=lambda:CLOCK,scan_receipt_verifier=lambda q:None)
  self.assertEqual(reopened.my_tasks(self.user,SA)[0]['state'],'submitted')
  self.assertEqual(reopened.my_tasks(self.user,SA)[0]['revision'],1)

if __name__=='__main__':unittest.main()
