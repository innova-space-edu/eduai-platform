-- Perfil personal de Mix Favorite: no se mezclan historiales entre cuentas.
-- El catálogo inicial permanece como datos de código; aquí solo se guarda aprendizaje de cada usuario.
create table if not exists public.eduai_music_mix_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  artists jsonb not null default '[]'::jsonb,
  tracks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint mix_artists_array check (jsonb_typeof(artists) = 'array'),
  constraint mix_tracks_array check (jsonb_typeof(tracks) = 'array')
);
alter table public.eduai_music_mix_profiles enable row level security;
drop policy if exists music_mix_select_own on public.eduai_music_mix_profiles;
create policy music_mix_select_own on public.eduai_music_mix_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists music_mix_insert_own on public.eduai_music_mix_profiles;
create policy music_mix_insert_own on public.eduai_music_mix_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists music_mix_update_own on public.eduai_music_mix_profiles;
create policy music_mix_update_own on public.eduai_music_mix_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists music_mix_delete_own on public.eduai_music_mix_profiles;
create policy music_mix_delete_own on public.eduai_music_mix_profiles for delete to authenticated using (auth.uid() = user_id);
