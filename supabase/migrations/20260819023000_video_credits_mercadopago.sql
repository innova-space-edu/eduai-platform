-- EduAI AI credits + Mercado Pago ledger.
-- Credits are closed-loop consumption units inside EduAI, not withdrawable money.

create table if not exists public.ai_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_credits bigint not null default 0,
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  lifetime_purchased_credits bigint not null default 0 check (lifetime_purchased_credits >= 0),
  lifetime_spent_credits bigint not null default 0 check (lifetime_spent_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('purchase','generation','refund','chargeback','adjustment')),
  amount_credits bigint not null,
  balance_after bigint not null,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ai_credit_transactions_source_unique
  on public.ai_credit_transactions(user_id, kind, source_type, source_id)
  where source_id is not null;
create index if not exists ai_credit_transactions_user_created_idx
  on public.ai_credit_transactions(user_id, created_at desc);

create table if not exists public.ai_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider = 'mercadopago'),
  amount_clp integer not null check (amount_clp > 0),
  credits bigint not null check (credits > 0),
  status text not null default 'pending' check (status in ('pending','processing','approved','rejected','cancelled','refunded','charged_back')),
  idempotency_key uuid not null default gen_random_uuid(),
  mp_preference_id text,
  mp_payment_id text,
  payment_status_detail text,
  payer_email text,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key),
  unique (mp_payment_id)
);

create index if not exists ai_payment_orders_user_created_idx
  on public.ai_payment_orders(user_id, created_at desc);

create table if not exists public.ai_generation_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.video_jobs(id) on delete cascade,
  model_key text not null,
  provider text not null,
  estimate_usd numeric(12,6),
  reserved_credits bigint not null check (reserved_credits > 0),
  final_credits bigint,
  status text not null default 'reserved' check (status in ('reserved','captured','released')),
  release_reason text,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (job_id)
);

create index if not exists ai_generation_charges_user_created_idx
  on public.ai_generation_charges(user_id, created_at desc);

create table if not exists public.ai_billing_settings (
  id smallint primary key default 1 check (id = 1),
  credits_per_clp numeric(12,4) not null default 1,
  usd_to_clp numeric(12,4) not null default 1000,
  markup_multiplier numeric(8,4) not null default 1.30,
  min_generation_credits bigint not null default 100,
  payments_enabled boolean not null default true,
  premium_video_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.ai_billing_settings(id)
values (1)
on conflict (id) do nothing;

alter table public.ai_wallets enable row level security;
alter table public.ai_credit_transactions enable row level security;
alter table public.ai_payment_orders enable row level security;
alter table public.ai_generation_charges enable row level security;
alter table public.ai_billing_settings enable row level security;

revoke all on public.ai_wallets from anon, authenticated;
revoke all on public.ai_credit_transactions from anon, authenticated;
revoke all on public.ai_payment_orders from anon, authenticated;
revoke all on public.ai_generation_charges from anon, authenticated;
revoke all on public.ai_billing_settings from anon, authenticated;

grant select on public.ai_wallets to authenticated;
grant select on public.ai_credit_transactions to authenticated;
grant select on public.ai_payment_orders to authenticated;
grant select on public.ai_generation_charges to authenticated;

drop policy if exists ai_wallets_owner_select on public.ai_wallets;
create policy ai_wallets_owner_select on public.ai_wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ai_credit_transactions_owner_select on public.ai_credit_transactions;
create policy ai_credit_transactions_owner_select on public.ai_credit_transactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ai_payment_orders_owner_select on public.ai_payment_orders;
create policy ai_payment_orders_owner_select on public.ai_payment_orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists ai_generation_charges_owner_select on public.ai_generation_charges;
create policy ai_generation_charges_owner_select on public.ai_generation_charges
  for select to authenticated using (user_id = auth.uid());

create or replace function public.eduai_reserve_generation_credits(
  p_job_id uuid,
  p_credits bigint,
  p_model_key text,
  p_provider text,
  p_estimate_usd numeric default null
)
returns table(reserved bigint, available_after bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.ai_wallets%rowtype;
  v_existing public.ai_generation_charges%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_credits is null or p_credits <= 0 then
    raise exception 'invalid_credit_reservation' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.video_jobs
    where id = p_job_id and user_id = v_uid
  ) then
    raise exception 'video_job_not_owned' using errcode = '42501';
  end if;

  select * into v_existing
  from public.ai_generation_charges
  where job_id = p_job_id;

  if found then
    if v_existing.user_id <> v_uid then
      raise exception 'charge_not_owned' using errcode = '42501';
    end if;
    if v_existing.status = 'reserved' then
      select * into v_wallet from public.ai_wallets where user_id = v_uid;
      return query select v_existing.reserved_credits, (v_wallet.balance_credits - v_wallet.reserved_credits);
      return;
    end if;
    raise exception 'charge_already_settled' using errcode = 'P0001';
  end if;

  insert into public.ai_wallets(user_id) values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.ai_wallets
  where user_id = v_uid
  for update;

  if (v_wallet.balance_credits - v_wallet.reserved_credits) < p_credits then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  update public.ai_wallets
  set reserved_credits = reserved_credits + p_credits,
      updated_at = now()
  where user_id = v_uid;

  insert into public.ai_generation_charges(
    user_id, job_id, model_key, provider, estimate_usd, reserved_credits
  ) values (
    v_uid, p_job_id, p_model_key, p_provider, p_estimate_usd, p_credits
  );

  return query select p_credits, (v_wallet.balance_credits - v_wallet.reserved_credits - p_credits);
end;
$$;

create or replace function public.eduai_capture_generation_credits(
  p_job_id uuid,
  p_final_credits bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.ai_generation_charges%rowtype;
  v_wallet public.ai_wallets%rowtype;
  v_final bigint;
begin
  select * into v_charge
  from public.ai_generation_charges
  where job_id = p_job_id
  for update;

  if not found then return 0; end if;
  if v_charge.status = 'captured' then return coalesce(v_charge.final_credits, 0); end if;
  if v_charge.status = 'released' then return 0; end if;

  v_final := coalesce(p_final_credits, v_charge.reserved_credits);
  if v_final < 0 or v_final > v_charge.reserved_credits then
    raise exception 'invalid_final_credits' using errcode = '22023';
  end if;

  select * into v_wallet
  from public.ai_wallets
  where user_id = v_charge.user_id
  for update;

  update public.ai_wallets
  set balance_credits = balance_credits - v_final,
      reserved_credits = greatest(0, reserved_credits - v_charge.reserved_credits),
      lifetime_spent_credits = lifetime_spent_credits + v_final,
      updated_at = now()
  where user_id = v_charge.user_id
  returning * into v_wallet;

  update public.ai_generation_charges
  set final_credits = v_final,
      status = 'captured',
      settled_at = now()
  where id = v_charge.id;

  insert into public.ai_credit_transactions(
    user_id, kind, amount_credits, balance_after, source_type, source_id, metadata
  ) values (
    v_charge.user_id, 'generation', -v_final, v_wallet.balance_credits,
    'video_job', p_job_id::text,
    jsonb_build_object('model_key', v_charge.model_key, 'provider', v_charge.provider)
  )
  on conflict do nothing;

  return v_final;
end;
$$;

create or replace function public.eduai_release_generation_credits(
  p_job_id uuid,
  p_reason text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge public.ai_generation_charges%rowtype;
begin
  select * into v_charge
  from public.ai_generation_charges
  where job_id = p_job_id
  for update;

  if not found then return 0; end if;
  if v_charge.status <> 'reserved' then return 0; end if;

  update public.ai_wallets
  set reserved_credits = greatest(0, reserved_credits - v_charge.reserved_credits),
      updated_at = now()
  where user_id = v_charge.user_id;

  update public.ai_generation_charges
  set status = 'released', release_reason = left(coalesce(p_reason, 'generation_not_charged'), 500), settled_at = now()
  where id = v_charge.id;

  return v_charge.reserved_credits;
end;
$$;

create or replace function public.eduai_credit_approved_payment(
  p_order_id uuid,
  p_payment_id text,
  p_status_detail text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.ai_payment_orders%rowtype;
  v_wallet public.ai_wallets%rowtype;
begin
  select * into v_order
  from public.ai_payment_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'payment_order_not_found' using errcode = 'P0002'; end if;
  if v_order.status = 'approved' then
    select * into v_wallet from public.ai_wallets where user_id = v_order.user_id;
    return coalesce(v_wallet.balance_credits, 0);
  end if;
  if v_order.mp_payment_id is not null and v_order.mp_payment_id <> p_payment_id then
    raise exception 'payment_id_mismatch' using errcode = 'P0001';
  end if;

  insert into public.ai_wallets(user_id) values (v_order.user_id)
  on conflict (user_id) do nothing;

  update public.ai_wallets
  set balance_credits = balance_credits + v_order.credits,
      lifetime_purchased_credits = lifetime_purchased_credits + v_order.credits,
      updated_at = now()
  where user_id = v_order.user_id
  returning * into v_wallet;

  update public.ai_payment_orders
  set status = 'approved',
      mp_payment_id = p_payment_id,
      payment_status_detail = p_status_detail,
      approved_at = coalesce(approved_at, now()),
      updated_at = now()
  where id = p_order_id;

  insert into public.ai_credit_transactions(
    user_id, kind, amount_credits, balance_after, source_type, source_id, metadata
  ) values (
    v_order.user_id, 'purchase', v_order.credits, v_wallet.balance_credits,
    'mercadopago_payment', p_payment_id,
    jsonb_build_object('order_id', p_order_id, 'amount_clp', v_order.amount_clp)
  )
  on conflict do nothing;

  return v_wallet.balance_credits;
end;
$$;

create or replace function public.eduai_reverse_payment(
  p_payment_id text,
  p_new_status text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.ai_payment_orders%rowtype;
  v_wallet public.ai_wallets%rowtype;
  v_kind text;
begin
  if p_new_status not in ('refunded','charged_back') then
    raise exception 'invalid_reversal_status' using errcode = '22023';
  end if;

  select * into v_order
  from public.ai_payment_orders
  where mp_payment_id = p_payment_id
  for update;

  if not found then return 0; end if;
  if v_order.status in ('refunded','charged_back') then
    select * into v_wallet from public.ai_wallets where user_id = v_order.user_id;
    return coalesce(v_wallet.balance_credits, 0);
  end if;

  if v_order.status = 'approved' then
    update public.ai_wallets
    set balance_credits = balance_credits - v_order.credits,
        lifetime_purchased_credits = greatest(0, lifetime_purchased_credits - v_order.credits),
        updated_at = now()
    where user_id = v_order.user_id
    returning * into v_wallet;

    v_kind := case when p_new_status = 'charged_back' then 'chargeback' else 'refund' end;
    insert into public.ai_credit_transactions(
      user_id, kind, amount_credits, balance_after, source_type, source_id, metadata
    ) values (
      v_order.user_id, v_kind, -v_order.credits, v_wallet.balance_credits,
      'mercadopago_payment', p_payment_id,
      jsonb_build_object('order_id', v_order.id, 'amount_clp', v_order.amount_clp)
    )
    on conflict do nothing;
  end if;

  update public.ai_payment_orders
  set status = p_new_status, updated_at = now()
  where id = v_order.id;

  return coalesce(v_wallet.balance_credits, 0);
end;
$$;

revoke all on function public.eduai_reserve_generation_credits(uuid,bigint,text,text,numeric) from public;
grant execute on function public.eduai_reserve_generation_credits(uuid,bigint,text,text,numeric) to authenticated;

revoke all on function public.eduai_capture_generation_credits(uuid,bigint) from public;
revoke all on function public.eduai_release_generation_credits(uuid,text) from public;
revoke all on function public.eduai_credit_approved_payment(uuid,text,text) from public;
revoke all on function public.eduai_reverse_payment(text,text) from public;
grant execute on function public.eduai_capture_generation_credits(uuid,bigint) to service_role;
grant execute on function public.eduai_release_generation_credits(uuid,text) to service_role;
grant execute on function public.eduai_credit_approved_payment(uuid,text,text) to service_role;
grant execute on function public.eduai_reverse_payment(text,text) to service_role;
