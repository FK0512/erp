-- Report Cards Table Schema
-- Add this to your Supabase SQL setup

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null,
  total_marks numeric(10,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  grade text not null,
  attendance_percentage numeric(5,2) not null default 0,
  subjects_data jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(student_id, academic_year)
);

-- Enable RLS
alter table public.report_cards enable row level security;

-- RLS Policies
drop policy if exists "report_cards school scoped select" on public.report_cards;
create policy "report_cards school scoped select"
on public.report_cards
for select
to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "report_cards school scoped insert" on public.report_cards;
create policy "report_cards school scoped insert"
on public.report_cards
for insert
to authenticated
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

drop policy if exists "report_cards school scoped update" on public.report_cards;
create policy "report_cards school scoped update"
on public.report_cards
for update
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

-- Indexes for performance
create index if not exists idx_report_cards_school_id on public.report_cards(school_id);
create index if not exists idx_report_cards_student_id on public.report_cards(student_id);
create index if not exists idx_report_cards_academic_year on public.report_cards(academic_year);

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for updated_at
drop trigger if exists handle_report_cards_updated_at on public.report_cards;
create trigger handle_report_cards_updated_at
  before update on public.report_cards
  for each row execute procedure public.handle_updated_at();