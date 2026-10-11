-- Locks the declared date of birth at account creation; later editable auth metadata cannot remove parental gating.
-- The date remains self-declared: separate identity/age verification is still required when legally necessary.
create table if not exists public.family_age_status (
 user_id uuid primary key references auth.users(id) on delete cascade,
 declared_birth_date date,
 captured_at timestamptz not null default now(),
 verified_at timestamptz,
 verified_by uuid references auth.users(id)
);
alter table public.family_age_status enable row level security;
revoke all on public.family_age_status from public,anon,authenticated;
grant select,insert,update,delete on public.family_age_status to service_role;
create or replace function public.family_parse_birth(value text)
returns date language plpgsql stable set search_path='' as $$
declare parsed date;
begin
 if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
 parsed := value::date;
 if parsed > current_date or parsed < date '1900-01-01' then return null; end if;
 return parsed;
exception when others then return null;
end $$;
revoke all on function public.family_parse_birth(text) from public,anon,authenticated;
grant execute on function public.family_parse_birth(text) to service_role;
create or replace function public.family_capture_age()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.family_age_status(user_id,declared_birth_date)
 values(new.id,public.family_parse_birth(new.raw_user_meta_data->>'birth_date'))
 on conflict(user_id) do nothing;
 return new;
end $$;
drop trigger if exists family_capture_age_insert on auth.users;
create trigger family_capture_age_insert after insert on auth.users for each row execute function public.family_capture_age();
-- Existing account backfill: no permissions are inferred where DOB is absent.
insert into public.family_age_status(user_id,declared_birth_date)
select id,public.family_parse_birth(raw_user_meta_data->>'birth_date') from auth.users
on conflict (user_id) do nothing;
comment on table public.family_age_status is 'Server-protected immutable birth-date snapshot for minor gating. Missing/invalid DOB fails closed until independently verified.';