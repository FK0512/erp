create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  teacher_profile_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, class_name)
);

alter table if exists public.classes
drop column if exists section;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_profile_id uuid unique references public.user_profiles(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  full_name text not null,
  roll_number text not null,
  admission_number text,
  gender text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  created_at timestamptz not null default now(),
  unique (school_id, roll_number)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'leave')),
  marked_by uuid references public.user_profiles(id) on delete set null,
  subject text not null check (subject != '' and subject is not null), -- Required and not empty
  period text not null check (period != '' and period is not null), -- Required and not empty
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date, class_id, subject, period)
);

create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_title text not null default 'School Fee',
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  due_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('paid', 'pending', 'partial')),
  due_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.fees
add column if not exists school_id uuid references public.schools(id) on delete cascade;

alter table if exists public.fees
add column if not exists student_id uuid references public.students(id) on delete cascade;

alter table if exists public.fees
add column if not exists fee_title text not null default 'School Fee';

alter table if exists public.fees
add column if not exists total_amount numeric(12,2) not null default 0;

alter table if exists public.fees
add column if not exists paid_amount numeric(12,2) not null default 0;

alter table if exists public.fees
add column if not exists due_amount numeric(12,2) not null default 0;

alter table if exists public.fees
add column if not exists status text not null default 'pending';

alter table if exists public.fees
add column if not exists due_date date;

alter table if exists public.fees
add column if not exists updated_at timestamptz not null default now();

alter table if exists public.fees
add column if not exists created_at timestamptz not null default now();

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  fee_id uuid not null references public.fees(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode text not null default 'cash' check (payment_mode in ('cash', 'online', 'bank')),
  receipt_number text not null default ('RCPT-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.fee_payments
add column if not exists created_by uuid references public.user_profiles(id) on delete set null;

alter table if exists public.fee_payments
add column if not exists receipt_number text not null default ('RCPT-' || upper(substr(gen_random_uuid()::text, 1, 8)));

alter table if exists public.fee_payments
add column if not exists receipt_number text not null default ('RCPT-' || upper(substr(gen_random_uuid()::text, 1, 8)));

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  message text not null,
  audience text not null default 'all' check (audience in ('all', 'teachers', 'students', 'accountant')),
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text not null,
  due_date date,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_name text not null,
  exam_type text not null,
  marks numeric(6,2) not null default 0,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.marks
add column if not exists school_id uuid references public.schools(id) on delete cascade;

alter table if exists public.marks
add column if not exists student_id uuid references public.students(id) on delete cascade;

alter table if exists public.marks
add column if not exists subject_name text;

alter table if exists public.marks
add column if not exists exam_type text;

alter table if exists public.marks
add column if not exists marks numeric(6,2) not null default 0;

alter table if exists public.marks
add column if not exists created_by uuid references public.user_profiles(id) on delete set null;

alter table if exists public.marks
add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marks'
      and column_name = 'subject_id'
  ) then
    alter table public.marks
    alter column subject_id drop not null;
  end if;
end
$$;

create table if not exists public.daily_schedule (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  teacher_profile_id uuid references public.user_profiles(id) on delete set null,
  subject_name text not null,
  day_name text not null,
  start_time time not null,
  end_time time not null,
  room_label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_classes_school_id on public.classes(school_id);
create unique index if not exists idx_classes_school_class_unique on public.classes(school_id, class_name);
create index if not exists idx_classes_teacher_profile_id on public.classes(teacher_profile_id);

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

  if public.current_user_role() not in ('admin', 'teacher') then
    raise exception 'Only admin or teacher can prepare classes';
  end if;

  for v_class_num in 1..12 loop
    insert into public.classes (school_id, class_name, teacher_profile_id)
    values (p_school_id, v_class_num::text, p_teacher_profile_id)
    on conflict (school_id, class_name)
    do update set teacher_profile_id = coalesce(public.classes.teacher_profile_id, excluded.teacher_profile_id);
  end loop;
end;
$$;

grant execute on function public.ensure_school_classes(uuid, uuid) to authenticated;

create index if not exists idx_students_school_id on public.students(school_id);
create index if not exists idx_students_class_id on public.students(class_id);
create index if not exists idx_students_school_class on public.students(school_id, class_id);
create index if not exists idx_students_school_roll_number on public.students(school_id, roll_number);
create index if not exists idx_students_user_profile_id on public.students(user_profile_id);

create index if not exists idx_attendance_school_id on public.attendance(school_id);
create index if not exists idx_attendance_class_date on public.attendance(class_id, attendance_date);
create index if not exists idx_attendance_student_date on public.attendance(student_id, attendance_date);
create index if not exists idx_attendance_school_class_date on public.attendance(school_id, class_id, attendance_date);

create index if not exists idx_fees_school_id on public.fees(school_id);
create index if not exists idx_fees_student_id on public.fees(student_id);
create index if not exists idx_fees_school_status_due_date on public.fees(school_id, status, due_date);

create index if not exists idx_fee_payments_school_id on public.fee_payments(school_id);
create index if not exists idx_fee_payments_fee_id on public.fee_payments(fee_id);
create index if not exists idx_fee_payments_student_id on public.fee_payments(student_id);
create index if not exists idx_fee_payments_payment_date on public.fee_payments(payment_date);

create index if not exists idx_announcements_school_id on public.announcements(school_id);
create index if not exists idx_homework_school_id on public.homework(school_id);
create index if not exists idx_homework_class_id on public.homework(class_id);
create index if not exists idx_marks_school_id on public.marks(school_id);
create index if not exists idx_marks_student_id on public.marks(student_id);
create index if not exists idx_daily_schedule_school_id on public.daily_schedule(school_id);
create index if not exists idx_daily_schedule_teacher_profile_id on public.daily_schedule(teacher_profile_id);
create index if not exists idx_daily_schedule_class_id on public.daily_schedule(class_id);

create or replace function public.update_fee_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.due_amount := greatest(new.total_amount - new.paid_amount, 0);
  new.status := case
    when new.paid_amount >= new.total_amount then 'paid'
    when new.paid_amount > 0 then 'partial'
    else 'pending'
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fees_before_save on public.fees;
create trigger fees_before_save
before insert or update on public.fees
for each row execute procedure public.update_fee_balance();

create or replace function public.apply_fee_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fees
  set paid_amount = paid_amount + new.amount
  where id = new.fee_id;
  return new;
end;
$$;

drop trigger if exists fee_payments_after_insert on public.fee_payments;
create trigger fee_payments_after_insert
after insert on public.fee_payments
for each row execute procedure public.apply_fee_payment();

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.fee_payments enable row level security;
alter table public.announcements enable row level security;
alter table public.homework enable row level security;
alter table public.marks enable row level security;
alter table public.daily_schedule enable row level security;
alter table public.report_cards enable row level security;

drop policy if exists "classes school scoped select" on public.classes;
create policy "classes school scoped select"
on public.classes
for select
to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "classes admin teacher manage" on public.classes;
create policy "classes admin teacher manage"
on public.classes
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

drop policy if exists "students scoped select" on public.students;
create policy "students scoped select"
on public.students
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher', 'accountant')
    or user_profile_id = auth.uid()
  )
);

drop policy if exists "students admin manage" on public.students;
create policy "students admin manage"
on public.students
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
);

drop policy if exists "attendance scoped select" on public.attendance;
create policy "attendance scoped select"
on public.attendance
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher')
    or student_id in (
      select s.id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "attendance teacher manage" on public.attendance;
create policy "attendance teacher manage"
on public.attendance
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

drop policy if exists "fees scoped select" on public.fees;
create policy "fees scoped select"
on public.fees
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'accountant')
    or student_id in (
      select s.id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "fees accountant manage" on public.fees;
create policy "fees accountant manage"
on public.fees
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'accountant')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'accountant')
);

drop policy if exists "fee payments scoped select" on public.fee_payments;
create policy "fee payments scoped select"
on public.fee_payments
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'accountant')
    or student_id in (
      select s.id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "fee payments accountant manage" on public.fee_payments;
create policy "fee payments accountant manage"
on public.fee_payments
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'accountant')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'accountant')
);

drop policy if exists "announcements school select" on public.announcements;
create policy "announcements school select"
on public.announcements
for select
to authenticated
using (school_id = public.current_user_school_id());

drop policy if exists "announcements admin teacher manage" on public.announcements;
create policy "announcements admin teacher manage"
on public.announcements
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

drop policy if exists "homework school select" on public.homework;
create policy "homework school select"
on public.homework
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher', 'student')
    or class_id in (
      select s.class_id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "homework teacher manage" on public.homework;
create policy "homework teacher manage"
on public.homework
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

drop policy if exists "marks scoped select" on public.marks;
create policy "marks scoped select"
on public.marks
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher')
    or student_id in (
      select s.id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "marks teacher manage" on public.marks;
create policy "marks teacher manage"
on public.marks
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

drop policy if exists "schedule scoped select" on public.daily_schedule;
create policy "schedule scoped select"
on public.daily_schedule
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher')
    or class_id in (
      select s.class_id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "schedule teacher manage" on public.daily_schedule;
create policy "schedule teacher manage"
on public.daily_schedule
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);

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
  grade text not null,
  attendance_percentage numeric(5,2) not null default 0,
  total_working_days integer not null default 0,
  days_present integer not null default 0,
  remarks text,
  generated_by uuid references public.user_profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year)
);

create index if not exists idx_report_cards_school_id on public.report_cards(school_id);
create index if not exists idx_report_cards_student_id on public.report_cards(student_id);
create index if not exists idx_report_cards_academic_year on public.report_cards(academic_year);
create index if not exists idx_report_cards_class_name on public.report_cards(class_name);
create index if not exists idx_report_cards_school_class_year on public.report_cards(school_id, class_name, academic_year);

alter table if exists public.report_cards
drop column if exists section;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists report_cards_updated_at on public.report_cards;
create trigger report_cards_updated_at
before update on public.report_cards
for each row execute procedure public.handle_updated_at();

alter table public.report_cards enable row level security;

drop policy if exists "report_cards scoped select" on public.report_cards;
create policy "report_cards scoped select"
on public.report_cards
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher')
    or student_id in (
      select s.id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);

drop policy if exists "report_cards admin teacher manage" on public.report_cards;
create policy "report_cards admin teacher manage"
on public.report_cards
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);
