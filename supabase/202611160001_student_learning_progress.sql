create table if not exists public.student_learning_progress (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.student_learning_progress enable row level security;

create policy "Students can read their own learning progress"
on public.student_learning_progress
for select
to authenticated
using (auth.uid() = owner_id);

create policy "Students can insert their own learning progress"
on public.student_learning_progress
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Students can update their own learning progress"
on public.student_learning_progress
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
