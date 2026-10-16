-- Catálogo de videos verificados compartido para ahorrar búsquedas a YouTube.
-- No contiene historiales ni preferencias personales.
create table if not exists public.eduai_music_mix_video_cache (
 song_key text primary key check (length(song_key) between 3 and 300),
 artist text not null,
 title text not null,
 track jsonb not null,
 verified_at timestamptz not null default now()
);
create index if not exists eduai_music_mix_video_cache_verified_idx on public.eduai_music_mix_video_cache(verified_at desc);
alter table public.eduai_music_mix_video_cache enable row level security;
-- Sin políticas para usuarios normales: solo el servidor/service role accede a la caché.
