"""
Gestion Docente: isolated transactional metadata prototype using Python stdlib SQLite.
NOT a production backend. It proves locking, quotas, idempotency, membership
revocation and task transitions before porting to Dell PostgreSQL 17.

NEVER accept a user-supplied principal in a public HTTP endpoint. 'Principal'
must be instantiated only by a trusted EDUAI session adapter in the future.
No real student names, RUTs, OAuth credentials or document bytes stored here.
"""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
import time
import uuid
from dataclasses import dataclass
from contextlib import contextmanager
from pathlib import Path
from typing import Callable

GROUPS = {'administrativos','pie','orientacion_convivencia','utp','docentes',
          'inspectoria','contabilidad','estudiantes','apoderados','otros'}
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',re.I)
HEX_RE = re.compile(r'^[a-f0-9]{64}$')
IDEMP_RE = re.compile(r'^[a-zA-Z0-9._:-]{16,100}$')
TASK_STATES = {'assigned','draft','returned','submitted','approved','cancelled'}

@dataclass(frozen=True)
class Principal:
    user_id: str
    verified: bool
    aal: str
    expires_at: int

class Forbidden(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code

def deny(code: str):
    raise Forbidden(code)

def vid(val: str):
    if not isinstance(val,str) or not UUID_RE.fullmatch(val):
        deny('INVALID_ID')
    return val.lower()

def opkey(val: str):
    if not isinstance(val,str) or not IDEMP_RE.fullmatch(val):
        deny('INVALID_IDEMPOTENCY_KEY')
    return val

def sha(val: str):
    if not isinstance(val,str) or not HEX_RE.fullmatch(val):
        deny('INVALID_SHA256')
    return val

def text(val: str,maxlen=160):
    if not isinstance(val,str) or not val.strip() or len(val.strip())>maxlen or any(ord(c)<32 or ord(c)==127 for c in val):
        deny('INVALID_TEXT')
    return val.strip()

class HubMetaSQLite:
    """Test harness: one connection/operation and BEGIN IMMEDIATE serializes writers."""
    def __init__(self, db_file: str, clock: Callable[[],int] | None=None, scan_receipt_verifier=None):
        p=Path(db_file)
        if str(p)==':memory:' or not p.is_absolute():
            deny('INVALID_DB_PATH')
        self.db_file=str(p)
        self.now=clock or (lambda:int(time.time()*1000))
        self.verify_receipt=scan_receipt_verifier
        self._init()

    @contextmanager
    def _connect(self):
        db=sqlite3.connect(self.db_file,timeout=8,isolation_level=None)
        db.row_factory=sqlite3.Row
        db.execute('PRAGMA busy_timeout=8000')
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA journal_mode=WAL')
        try:
            with db:
                yield db
        finally:
            db.close()

    def _init(self):
        with self._connect() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS schools(
              id TEXT PRIMARY KEY, label TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS members(
              school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL,
              group_key TEXT NOT NULL, active INTEGER NOT NULL,
              expires_at INTEGER NOT NULL,
              PRIMARY KEY(school_id,user_id)
            );
            CREATE TABLE IF NOT EXISTS folders(
              id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),
              owner_id TEXT NOT NULL,parent_id TEXT,name TEXT NOT NULL,
              FOREIGN KEY(school_id,owner_id) REFERENCES members(school_id,user_id),
              FOREIGN KEY(parent_id) REFERENCES folders(id)
            );
            CREATE TABLE IF NOT EXISTS folder_grants(
              school_id TEXT NOT NULL,folder_id TEXT NOT NULL REFERENCES folders(id),
              user_id TEXT NOT NULL,permission TEXT NOT NULL,expires_at INTEGER NOT NULL,
              revoked_at INTEGER,PRIMARY KEY(school_id,folder_id,user_id),
              FOREIGN KEY(school_id,user_id) REFERENCES members(school_id,user_id)
            );
            CREATE TABLE IF NOT EXISTS quotas(
              school_id TEXT PRIMARY KEY REFERENCES schools(id), hard_limit INTEGER NOT NULL,
              used INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL DEFAULT 0,
              CHECK(hard_limit>0 AND used>=0 AND reserved>=0 AND used+reserved<=hard_limit)
            );
            CREATE TABLE IF NOT EXISTS uploads(
              id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),
              owner_id TEXT NOT NULL, folder_id TEXT NOT NULL REFERENCES folders(id),
              idempotency_key TEXT NOT NULL, bytes INTEGER NOT NULL,
              sha256 TEXT, state TEXT NOT NULL CHECK(state IN ('reserved','ready','cancelled')),
              created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
              UNIQUE(school_id,owner_id,idempotency_key),
              FOREIGN KEY(school_id,owner_id) REFERENCES members(school_id,user_id)
            );
            CREATE TABLE IF NOT EXISTS tasks(
              id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),
              created_by TEXT NOT NULL,title TEXT NOT NULL,target_groups TEXT NOT NULL,form_schema TEXT NOT NULL,
              min_files INTEGER NOT NULL,deadline_at INTEGER NOT NULL,
              idempotency_key TEXT NOT NULL,created_at INTEGER NOT NULL,
              UNIQUE(school_id,created_by,idempotency_key),
              FOREIGN KEY(school_id,created_by) REFERENCES members(school_id,user_id)
            );
            CREATE TABLE IF NOT EXISTS task_recipients(
              school_id TEXT NOT NULL,task_id TEXT NOT NULL REFERENCES tasks(id),
              user_id TEXT NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,
              answers TEXT NOT NULL DEFAULT '{}', evidence TEXT NOT NULL DEFAULT '[]',
              submitted_at INTEGER,reviewed_at INTEGER,reviewed_by TEXT,reason TEXT,
              PRIMARY KEY(school_id,task_id,user_id),
              FOREIGN KEY(school_id,user_id) REFERENCES members(school_id,user_id)
            );
            CREATE TABLE IF NOT EXISTS events(
              id TEXT PRIMARY KEY,school_id TEXT NOT NULL,actor_id TEXT NOT NULL,
              event TEXT NOT NULL,resource_id TEXT NOT NULL,at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_user_state ON task_recipients(school_id,user_id,state);
            CREATE INDEX IF NOT EXISTS idx_upload_owner ON uploads(school_id,owner_id,state);
            """)
    def _actor(self, p: Principal, mfa=False):
        if not isinstance(p,Principal) or not p.verified or p.expires_at<=self.now():
            deny('SESSION_INVALID')
        if mfa and p.aal!='aal2':
            deny('MFA_REQUIRED')
        return vid(p.user_id)

    def _member(self,db,school,actor,groups=None):
        row=db.execute("""SELECT m.*,s.active AS school_active FROM members m
              JOIN schools s ON s.id=m.school_id
              WHERE m.school_id=? AND m.user_id=?""",(school,actor)).fetchone()
        if not row or row['active']!=1 or row['school_active']!=1 or row['expires_at']<=self.now():
            deny('MEMBERSHIP_REQUIRED')
        if groups is not None and row['group_key'] not in groups:
            deny('ROLE_REQUIRED')
        return row

    def _audit(self,db,school,actor,event,resource):
        db.execute('INSERT INTO events VALUES(?,?,?,?,?,?)',
             (str(uuid.uuid4()),school,actor,event,resource,self.now()))

    def bootstrap_school(self,school_id,admin_id,label,limit_bytes):
        """Test-only provisioning; NEVER export as public endpoint."""
        school,admin=vid(school_id),vid(admin_id)
        if not isinstance(limit_bytes,int) or limit_bytes<1:
            deny('QUOTA_INVALID')
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('INSERT INTO schools VALUES(?,?,1)',(school,text(label,120)))
            db.execute('INSERT INTO members VALUES(?,?,?,?,?)',
                       (school,admin,'administrativos',1,2**62))
            db.execute('INSERT INTO quotas VALUES(?,?,0,0)',(school,limit_bytes))
            self._audit(db,school,admin,'school_bootstrap',school)

    def add_member(self,p,school_id,user_id,group,expires_at):
        school,user=vid(school_id),vid(user_id)
        actor=self._actor(p,mfa=True)
        if group not in GROUPS or group=='administrativos' or expires_at<=self.now():
            deny('MEMBER_INVALID')
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor,{'administrativos'})
            old=db.execute('SELECT active FROM members WHERE school_id=? AND user_id=?',(school,user)).fetchone()
            if old and old['active']==1:
                deny('MEMBER_EXISTS')
            db.execute("""INSERT INTO members VALUES(?,?,?,?,?) ON CONFLICT(school_id,user_id)
               DO UPDATE SET group_key=excluded.group_key,active=1,expires_at=excluded.expires_at""",
               (school,user,group,1,expires_at))
            self._audit(db,school,actor,'member_added',user)

    def revoke_member(self,p,school_id,user_id):
        school,user=vid(school_id),vid(user_id)
        actor=self._actor(p,mfa=True)
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor,{'administrativos'})
            res=db.execute("""UPDATE members SET active=0 WHERE school_id=? AND user_id=?
                    AND active=1 AND group_key<>'administrativos'""",(school,user))
            if res.rowcount!=1:deny('NOT_REVOCABLE')
            self._audit(db,school,actor,'member_revoked',user)

    def create_folder(self,p,school_id,name,parent_id=None):
        school=vid(school_id)
        actor=self._actor(p)
        parent=vid(parent_id) if parent_id is not None else None
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor)
            if parent:self._folder_permission(db,school,parent,actor,write=True)
            folder_id=str(uuid.uuid4())
            db.execute('INSERT INTO folders VALUES(?,?,?,?,?)',
                       (folder_id,school,actor,parent,text(name,120)))
            self._audit(db,school,actor,'folder_created',folder_id)
        return folder_id

    def share_folder(self,p,school_id,folder_id,user_id,permission,expires_at):
        school,folder,user=vid(school_id),vid(folder_id),vid(user_id)
        actor=self._actor(p)
        if permission not in {'viewer','editor'} or expires_at<=self.now():
            deny('SHARE_INVALID')
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor)
            self._member(db,school,user)
            row=db.execute('SELECT owner_id FROM folders WHERE school_id=? AND id=?',(school,folder)).fetchone()
            if not row or row['owner_id']!=actor:deny('FOLDER_ACCESS_DENIED')
            db.execute("""INSERT INTO folder_grants VALUES(?,?,?,?,?,NULL)
                ON CONFLICT(school_id,folder_id,user_id) DO UPDATE
                SET permission=excluded.permission,expires_at=excluded.expires_at,revoked_at=NULL""",
                (school,folder,user,permission,expires_at))
            self._audit(db,school,actor,'folder_shared',folder)

    def _folder_permission(self,db,school,folder,actor,write=False):
        row=db.execute('SELECT owner_id FROM folders WHERE school_id=? AND id=?',(school,folder)).fetchone()
        if not row:deny('FOLDER_ACCESS_DENIED')
        if row['owner_id']==actor:return
        acl=db.execute("""SELECT permission FROM folder_grants WHERE school_id=? AND
              folder_id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?""",
              (school,folder,actor,self.now())).fetchone()
        if not acl or (write and acl['permission']!='editor'):
            deny('FOLDER_ACCESS_DENIED')

    def _expire_reservations(self,db,school):
        expired=db.execute("SELECT id,bytes FROM uploads WHERE school_id=? AND state='reserved' AND expires_at<=?",(school,self.now())).fetchall()
        if expired:
            for row in expired:
                db.execute("UPDATE uploads SET state='cancelled' WHERE id=?",(row['id'],))
            db.execute("UPDATE quotas SET reserved=reserved-? WHERE school_id=?",
                       (sum(r['bytes'] for r in expired),school))
        return len(expired)

    def reap_expired_uploads(self,p,school_id):
        school,actor=vid(school_id),self._actor(p,mfa=True)
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor,{'administrativos'})
            count=self._expire_reservations(db,school)
            if count:self._audit(db,school,actor,'uploads_reaped',school)
            return {'reaped':count}

    def reserve_upload(self,p,school_id,folder_id,idempotency_key,bytes_needed,ttl_ms=10*60_000):
        school,folder,actor=vid(school_id),vid(folder_id),self._actor(p)
        token=opkey(idempotency_key)
        if not isinstance(bytes_needed,int) or bytes_needed<1 or bytes_needed>20*1024*1024:
            deny('FILE_LIMIT')
        if not isinstance(ttl_ms,int) or ttl_ms<1000 or ttl_ms>3600_000:
            deny('TTL_INVALID')
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor)
            self._folder_permission(db,school,folder,actor,write=True)
            self._expire_reservations(db,school)
            prior=db.execute("""SELECT * FROM uploads WHERE school_id=? AND
               owner_id=? AND idempotency_key=?""",(school,actor,token)).fetchone()
            if prior:
                if prior['bytes']!=bytes_needed or prior['folder_id']!=folder:
                    deny('IDEMPOTENCY_CONFLICT')
                if prior['state']=='cancelled':deny('UPLOAD_CANCELLED')
                return {'uploadId':prior['id'],'state':prior['state'],'reused':True}
            quota=db.execute('SELECT used,reserved,hard_limit FROM quotas WHERE school_id=?',(school,)).fetchone()
            if quota['used']+quota['reserved']+bytes_needed>quota['hard_limit']:
                deny('QUOTA_EXCEEDED')
            upload_id=str(uuid.uuid4())
            db.execute('UPDATE quotas SET reserved=reserved+? WHERE school_id=?',(bytes_needed,school))
            db.execute('INSERT INTO uploads VALUES(?,?,?,?,?,?,?,?,?,?)',
                (upload_id,school,actor,folder,token,bytes_needed,None,'reserved',self.now(),self.now()+ttl_ms))
            self._audit(db,school,actor,'upload_reserved',upload_id)
            return {'uploadId':upload_id,'state':'reserved','reused':False}

    def commit_upload(self,p,school_id,upload_id,digest):
        if not callable(self.verify_receipt):deny('TRUSTED_RECEIPT_VERIFIER_REQUIRED')
        school,file,actor=vid(school_id),vid(upload_id),self._actor(p)
        checksum=sha(digest)
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor)
            row=db.execute('SELECT * FROM uploads WHERE school_id=? AND id=? AND owner_id=?',(school,file,actor)).fetchone()
            if not row:deny('UPLOAD_UNAVAILABLE')
            self._folder_permission(db,school,row['folder_id'],actor,write=True)
            if row['state']=='ready':
                if row['sha256']!=checksum:deny('IDEMPOTENCY_CONFLICT')
                return {'fileId':file,'reused':True}
            if row['state']!='reserved' or row['expires_at']<=self.now():deny('UPLOAD_NOT_RESERVED')
            receipt=self.verify_receipt({'uploadId':file,'ownerId':actor,'schoolId':school,'folderId':row['folder_id']})
            if (not isinstance(receipt,dict) or receipt.get('clean') is not True
                or receipt.get('scanEngine')!='clamav' or receipt.get('stored') is not True
                or receipt.get('id')!=file or receipt.get('ownerId')!=actor
                or receipt.get('schoolId')!=school or receipt.get('folderId')!=row['folder_id']
                or receipt.get('sizeBytes')!=row['bytes'] or receipt.get('sha256')!=checksum):
                deny('VERIFIED_STORAGE_REQUIRED')
            db.execute('UPDATE uploads SET state=?,sha256=? WHERE id=?',('ready',checksum,file))
            db.execute('UPDATE quotas SET reserved=reserved-?,used=used+? WHERE school_id=?',
                       (row['bytes'],row['bytes'],school))
            self._audit(db,school,actor,'file_committed',file)
            return {'fileId':file,'reused':False}

    def cancel_upload(self,p,school_id,upload_id):
        school,file,actor=vid(school_id),vid(upload_id),self._actor(p)
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor)
            row=db.execute('SELECT * FROM uploads WHERE school_id=? AND id=? AND owner_id=?',(school,file,actor)).fetchone()
            if not row or row['state']!='reserved':deny('UPLOAD_NOT_RESERVED')
            db.execute('UPDATE uploads SET state=? WHERE id=?',('cancelled',file))
            db.execute('UPDATE quotas SET reserved=reserved-? WHERE school_id=?',(row['bytes'],school))
            self._audit(db,school,actor,'upload_cancelled',file)

    def usage(self,p,school_id):
        school,actor=vid(school_id),self._actor(p)
        with self._connect() as db:
            self._member(db,school,actor)
            row=db.execute('SELECT hard_limit,used,reserved FROM quotas WHERE school_id=?',(school,)).fetchone()
            return dict(row)

    def create_task(self,p,school_id,title,groups,deadline_at,required_fields=(),min_files=0,idempotency_key=None):
        school,actor=vid(school_id),self._actor(p,mfa=True)
        token=opkey(idempotency_key)
        if not isinstance(groups,(tuple,list)) or not groups or any(g not in GROUPS for g in groups):
            deny('INVALID_GROUP')
        if not isinstance(required_fields,(list,tuple)) or len(required_fields)>20 or any(not isinstance(v,str) or not re.fullmatch('[a-z][a-z0-9_]{0,48}',v) for v in required_fields) or len(set(required_fields))!=len(required_fields):
            deny('INVALID_FORM')
        if not isinstance(min_files,int) or min_files<0 or min_files>5 or (min_files==0 and not required_fields):
            deny('EVIDENCE_REQUIRED')
        if not isinstance(deadline_at,int) or deadline_at<=self.now():deny('INVALID_DEADLINE')
        payload={'required':list(required_fields)}
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor,{'administrativos'})
            old=db.execute('SELECT id,title,target_groups,form_schema,min_files,deadline_at FROM tasks WHERE school_id=? AND created_by=? AND idempotency_key=?',(school,actor,token)).fetchone()
            title=text(title)
            if old:
                if old['title']!=title or json.loads(old['form_schema'])!=payload or json.loads(old['target_groups'])!=sorted(set(groups)) or old['min_files']!=min_files or old['deadline_at']!=deadline_at:
                    deny('IDEMPOTENCY_CONFLICT')
                return {'taskId':old['id'],'reused':True}
            members=db.execute("""SELECT user_id FROM members WHERE school_id=? AND active=1
                          AND expires_at>? AND group_key IN ("""+','.join('?' for _ in groups)+')',
                          [school,self.now(),*groups]).fetchall()
            if not members:deny('NO_RECIPIENTS')
            task_id=str(uuid.uuid4())
            db.execute('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?)',
                (task_id,school,actor,title,json.dumps(sorted(set(groups))),json.dumps(payload),min_files,deadline_at,token,self.now()))
            for m in members:
                db.execute('INSERT INTO task_recipients(school_id,task_id,user_id,state) VALUES(?,?,?,?)',
                           (school,task_id,m['user_id'],'assigned'))
            self._audit(db,school,actor,'task_created',task_id)
            return {'taskId':task_id,'assigned':len(members),'reused':False}

    def submit_task(self,p,school_id,task_id,answers,evidence_ids,expected_revision):
        school,task,actor=vid(school_id),vid(task_id),self._actor(p)
        if not isinstance(answers,dict) or not isinstance(evidence_ids,(list,tuple)) or not isinstance(expected_revision,int):
            deny('SUBMISSION_INVALID')
        file_ids=[vid(e) for e in evidence_ids]
        if len(file_ids)!=len(set(file_ids)) or len(file_ids)>20:deny('SUBMISSION_INVALID')
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor)
            assigned=db.execute("""SELECT r.*,t.form_schema,t.min_files FROM task_recipients r
                JOIN tasks t ON t.id=r.task_id AND t.school_id=r.school_id
                WHERE r.school_id=? AND r.task_id=? AND r.user_id=?""",(school,task,actor)).fetchone()
            if not assigned or assigned['state'] not in {'assigned','draft','returned'}:
                deny('TASK_NOT_WRITABLE')
            if assigned['revision']!=expected_revision:deny('REVISION_CONFLICT')
            schema=json.loads(assigned['form_schema'])
            keys=set(schema['required'])
            if not keys.issubset(answers) or not all(isinstance(answers[k],str) and 0<len(answers[k])<=4000 for k in keys) or set(answers)!=keys:
                deny('FORM_INVALID')
            if len(file_ids)<assigned['min_files']:deny('EVIDENCE_REQUIRED')
            for fid in file_ids:
                f=db.execute("SELECT state FROM uploads WHERE id=? AND school_id=? AND owner_id=?",(fid,school,actor)).fetchone()
                if not f or f['state']!='ready':deny('FILE_UNAVAILABLE')
            res=db.execute("""UPDATE task_recipients SET state='submitted',answers=?,evidence=?,
                 revision=revision+1,submitted_at=?,reason=NULL WHERE school_id=? AND task_id=?
                 AND user_id=? AND revision=?""",
                (json.dumps(answers),json.dumps(file_ids),self.now(),school,task,actor,expected_revision))
            if res.rowcount!=1:deny('REVISION_CONFLICT')
            self._audit(db,school,actor,'task_submitted',task)
            return {'status':'submitted','revision':expected_revision+1,'approved':False}

    def review_task(self,p,school_id,task_id,user_id,expected_revision,decision,reason=None):
        school,task,target=vid(school_id),vid(task_id),vid(user_id)
        actor=self._actor(p,mfa=True)
        if decision not in {'approve','return'}:deny('INVALID_DECISION')
        if decision=='return':text(reason,500)
        with self._connect() as db:
            db.execute('BEGIN IMMEDIATE')
            self._member(db,school,actor,{'administrativos'})
            row=db.execute("""SELECT state,revision FROM task_recipients
               WHERE school_id=? AND task_id=? AND user_id=?""",(school,task,target)).fetchone()
            if not row or row['state']!='submitted':deny('TASK_NOT_REVIEWABLE')
            if row['revision']!=expected_revision:deny('REVISION_CONFLICT')
            state='approved' if decision=='approve' else 'returned'
            db.execute("""UPDATE task_recipients SET state=?,revision=revision+1,
                reviewed_at=?,reviewed_by=?,reason=? WHERE school_id=? AND task_id=? AND user_id=?
                AND state='submitted' AND revision=?""",
                (state,self.now(),actor,reason if decision=='return' else None,school,task,target,expected_revision))
            self._audit(db,school,actor,'task_'+state,task)
            return {'status':state,'revision':expected_revision+1}

    def my_tasks(self,p,school_id):
        school,actor=vid(school_id),self._actor(p)
        with self._connect() as db:
            self._member(db,school,actor)
            return [dict(r) for r in db.execute("""SELECT t.id,t.title,r.state,r.revision
                FROM task_recipients r JOIN tasks t ON t.id=r.task_id
                WHERE r.school_id=? AND r.user_id=? ORDER BY t.created_at""",(school,actor))]
