create extension if not exists pgcrypto;

alter table if exists public.classes
add column if not exists section text not null default 'A';

update public.classes
set section = 'A'
where section is null or btrim(section) = '';

alter table if exists public.students
add column if not exists name text;

update public.students
set name = full_name
where name is null or btrim(name) = '';

drop index if exists public.idx_classes_school_class_unique;
create unique index if not exists idx_classes_school_class_unique
on public.classes (school_id, class_name, section);

create or replace function public.ensure_school_classes(
  p_school_id uuid,
  p_teacher_profile_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_num integer;
begin
  if p_school_id is null then
    raise exception 'school_id is required';
  end if;

  if p_school_id <> public.current_user_school_id() then
    raise exception 'Not allowed to prepare classes for another school';
  end if;

  if public.current_user_role() not in ('admin', 'teacher', 'superadmin') then
    raise exception 'Only admin, teacher, or superadmin can prepare classes';
  end if;

  for v_class_num in 1..12 loop
    insert into public.classes (school_id, class_name, section, teacher_profile_id)
    values (p_school_id, v_class_num::text, 'A', p_teacher_profile_id)
    on conflict (school_id, class_name, section)
    do update
    set teacher_profile_id = coalesce(public.classes.teacher_profile_id, excluded.teacher_profile_id);
  end loop;
end;
$$;

grant execute on function public.ensure_school_classes(uuid, uuid) to authenticated;

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null,
  class_name text not null,
  student_name text not null,
  roll_number text not null,
  subjects_data jsonb not null default '[]'::jsonb,
  total_marks numeric(6,2) not null default 0,
  obtained_marks numeric(6,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  grade text not null default 'F',
  attendance_percentage numeric(5,2) not null default 0,
  total_working_days integer not null default 0,
  days_present integer not null default 0,
  remarks text,
  generated_by uuid references public.user_profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year)
);

alter table public.report_cards enable row level security;

create index if not exists idx_report_cards_school_id on public.report_cards(school_id);
create index if not exists idx_report_cards_student_id on public.report_cards(student_id);

create or replace view public.class_attendance_summary as
select
  c.id as class_id,
  c.class_name,
  c.section,
  c.school_id,
  count(a.id) as total_records,
  count(*) filter (where a.status = 'present') as present_count,
  round(
    100.0 * count(*) filter (where a.status = 'present') /
    nullif(count(*), 0), 2
  ) as present_percentage,
  count(*) filter (where a.status = 'absent') as absent_count,
  count(*) filter (where a.status = 'late') as late_count,
  count(*) filter (where a.status = 'leave') as leave_count,
  max(a.attendance_date) as last_attendance_date
from public.classes c
left join public.attendance a on c.id = a.class_id
group by c.id, c.class_name, c.section, c.school_id;

create or replace view public.student_fee_summary as
select
  s.id as student_id,
  s.full_name,
  s.roll_number,
  s.class_id,
  s.school_id,
  count(f.id) as total_fee_records,
  coalesce(sum(f.total_amount), 0) as total_fees,
  coalesce(sum(f.paid_amount), 0) as total_paid,
  coalesce(sum(f.due_amount), 0) as total_due,
  round(
    100.0 * coalesce(sum(f.paid_amount), 0) /
    nullif(coalesce(sum(f.total_amount), 0), 0), 2
  ) as payment_percentage,
  count(*) filter (where f.status = 'paid') as paid_fees_count,
  count(*) filter (where f.status = 'pending') as pending_fees_count,
  count(*) filter (where f.status = 'partial') as partial_fees_count,
  max(f.due_date) as latest_due_date
from public.students s
left join public.fees f on s.id = f.student_id
group by s.id, s.full_name, s.roll_number, s.class_id, s.school_id;

create or replace view public.school_overview_stats as
select
  sch.id as school_id,
  sch.name as school_name,
  sch.school_code,
  sch.subscription_end_date,
  sch.is_active,
  count(distinct c.id) as total_classes,
  count(distinct s.id) as total_students,
  count(distinct up.id) as total_staff,
  coalesce(sum(f.total_amount), 0) as total_fees,
  coalesce(sum(f.paid_amount), 0) as total_paid,
  coalesce(sum(f.due_amount), 0) as total_due,
  count(distinct a.id) as total_attendance_records,
  round(
    100.0 * count(*) filter (where a.status = 'present') /
    nullif(count(*), 0), 2
  ) as overall_attendance_percentage
from public.schools sch
left join public.classes c on sch.id = c.school_id
left join public.students s on sch.id = s.school_id
left join public.user_profiles up on sch.id = up.school_id and up.role in ('admin', 'teacher', 'accountant')
left join public.fees f on sch.id = f.school_id
left join public.attendance a on sch.id = a.school_id
group by sch.id, sch.name, sch.school_code, sch.subscription_end_date, sch.is_active;

create or replace view public.recent_activity as
select
  'attendance' as activity_type,
  a.id as record_id,
  a.attendance_date as activity_date,
  s.full_name as student_name,
  c.class_name,
  a.status,
  up.name as marked_by,
  a.created_at
from public.attendance a
join public.students s on a.student_id = s.id
join public.classes c on a.class_id = c.id
left join public.user_profiles up on a.marked_by = up.id
where a.created_at >= now() - interval '90 days'

union all

select
  'fee_payment' as activity_type,
  fp.id as record_id,
  fp.payment_date as activity_date,
  s.full_name as student_name,
  f.fee_title as class_name,
  fp.payment_mode as status,
  up.name as marked_by,
  fp.created_at
from public.fee_payments fp
join public.students s on fp.student_id = s.id
join public.fees f on fp.fee_id = f.id
left join public.user_profiles up on fp.created_by = up.id
where fp.created_at >= now() - interval '90 days';

grant select on public.class_attendance_summary to authenticated;
grant select on public.student_fee_summary to authenticated;
grant select on public.school_overview_stats to authenticated;
grant select on public.recent_activity to authenticated;
