alter table public.study_sessions
 add column if not exists study_profile text not null default 'personal',
 add column if not exists objective text not null default '',
 add column if not exists area text not null default '',
 add column if not exists favorite boolean not null default false,
 add column if not exists archived_at timestamptz,
 add column if not exists subtopic text,
 add column if not exists study_route text;
