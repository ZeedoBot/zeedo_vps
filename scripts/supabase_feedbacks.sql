-- Tabela de feedbacks (SQL Editor do Supabase).
-- O feedback no app só aparece após login; RLS restringe insert a usuário autenticado
-- com user_id = auth.uid() (não dá para enviar em nome de outro usuário).

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feedback_type text not null,
  title text not null,
  description text not null,
  constraint feedbacks_title_len check (char_length(title) between 1 and 200),
  constraint feedbacks_desc_len check (char_length(description) between 1 and 2000)
);

create index if not exists feedbacks_created_at_idx on public.feedbacks (created_at desc);
create index if not exists feedbacks_user_id_idx on public.feedbacks (user_id);

alter table public.feedbacks enable row level security;

drop policy if exists "feedbacks_insert_own" on public.feedbacks;
drop policy if exists "feedbacks_insert_anon" on public.feedbacks;
drop policy if exists "feedbacks_insert_authenticated" on public.feedbacks;

create policy "feedbacks_insert_authenticated"
  on public.feedbacks
  for insert
  to authenticated
  with check (auth.uid() = user_id);
