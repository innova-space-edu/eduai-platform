-- Bibliotecas de favoritos independientes de browser, dominio o sesión.
-- Cada entrada conserva metadatos de reproducción; un video bloqueado nunca
-- debe eliminar el registro guardado de un usuario.
create table if not exists public.eduai_music_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null check (length(track_id) between 1 and 256),
  track jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, track_id)
);
create index if not exists eduai_music_favorites_user_created_idx
  on public.eduai_music_favorites(user_id, created_at desc);

alter table public.eduai_music_favorites enable row level security;
drop policy if exists eduai_music_favorites_select_own on public.eduai_music_favorites;
create policy eduai_music_favorites_select_own on public.eduai_music_favorites
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists eduai_music_favorites_insert_own on public.eduai_music_favorites;
create policy eduai_music_favorites_insert_own on public.eduai_music_favorites
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists eduai_music_favorites_update_own on public.eduai_music_favorites;
create policy eduai_music_favorites_update_own on public.eduai_music_favorites
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists eduai_music_favorites_delete_own on public.eduai_music_favorites;
create policy eduai_music_favorites_delete_own on public.eduai_music_favorites
  for delete to authenticated using (auth.uid() = user_id);
