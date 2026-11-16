create table public.collab_spaces (
 id uuid primary key default gen_random_uuid(), code text unique not null, topic text not null,
 host_id uuid not null references auth.users(id) on delete cascade, access_mode text not null default 'invited' check(access_mode in ('invited','open')),
 invite_token uuid not null default gen_random_uuid(), created_at timestamptz not null default now()
);
create table public.collab_people (
 room_id uuid references public.collab_spaces(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
 name text not null, status text not null default 'pending' check(status in ('pending','approved','denied')),
 last_seen timestamptz not null default now(), peer_id uuid, call_seen timestamptz, mic boolean not null default false, camera boolean not null default false, hand boolean not null default false,
 primary key(room_id,user_id)
);
create table public.collab_chat (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.collab_spaces(id) on delete cascade, user_id uuid, user_name text not null, content text not null, type text not null default 'chat', created_at timestamptz not null default now()
);
create index collab_chat_room_time on public.collab_chat(room_id,created_at desc);
create table public.collab_tools (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.collab_spaces(id) on delete cascade,
 kind text not null check(kind in ('note','event','task','file','activity','board')), title text not null, content text not null default '', due_at timestamptz, done boolean not null default false, created_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now(), revision integer not null default 0
);
create index collab_tools_room on public.collab_tools(room_id,kind);
create table public.collab_signals (
 id bigint generated always as identity primary key, room_id uuid not null references public.collab_spaces(id) on delete cascade, sender uuid not null, receiver uuid not null, payload jsonb not null, created_at timestamptz not null default now()
);
create index collab_signals_receiver on public.collab_signals(room_id,receiver,id);
do $$ declare t text; begin foreach t in array array['collab_spaces','collab_people','collab_chat','collab_tools','collab_signals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop; end $$;
grant usage,select on sequence public.collab_signals_id_seq to service_role;
insert into public.collab_spaces(id,code,topic,host_id,created_at)
select id,code,topic,host_id,coalesce(created_at,now()) from public.study_rooms where host_id in(select id from auth.users) on conflict do nothing;
insert into public.collab_people(room_id,user_id,name,status)
select s.id,s.host_id,coalesce(p.name,'Anfitrión'),'approved' from public.collab_spaces s left join public.profiles p on p.id=s.host_id on conflict do nothing;
insert into public.collab_people(room_id,user_id,name,status)
select m.room_id,m.user_id,coalesce(m.user_name,'Participante'),'approved' from public.room_members m join public.collab_spaces s on s.id=m.room_id where m.user_id in(select id from auth.users) on conflict do nothing;
insert into public.collab_people(room_id,user_id,name,status)
select s.id,r.guest_id,coalesce(p.name,'Participante'),'approved' from public.study_rooms r join public.collab_spaces s on s.id=r.id left join public.profiles p on p.id=r.guest_id where r.guest_id in(select id from auth.users) on conflict do nothing;
insert into public.collab_chat(id,room_id,user_id,user_name,content,type,created_at)
select m.id,m.room_id,m.user_id,coalesce(m.user_name,'Participante'),coalesce(m.content,''),coalesce(m.type,'chat'),coalesce(m.created_at,now()) from public.room_messages m join public.collab_spaces s on s.id=m.room_id on conflict do nothing;
create function public.collab_enter_call(p_room uuid,p_user uuid,p_peer uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.collab_spaces where id=p_room for update;
 if not exists(select 1 from public.collab_people where room_id=p_room and user_id=p_user and status='approved') then return false; end if;
 if (select count(*) from public.collab_people where room_id=p_room and user_id<>p_user and status='approved' and peer_id is not null and call_seen>now()-interval '30 seconds')>=6 then return false; end if;
 update public.collab_people set peer_id=p_peer,call_seen=now(),mic=false,camera=false,hand=false where room_id=p_room and user_id=p_user;
 return true;
end $$;
revoke all on function public.collab_enter_call(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.collab_enter_call(uuid,uuid,uuid) to service_role;

;
