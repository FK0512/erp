alter table public.attendance
drop constraint if exists attendance_status_check;

alter table public.attendance
add constraint attendance_status_check
check (status in ('present', 'absent', 'late', 'leave'));

alter table public.attendance
add column if not exists subject text,
add column if not exists period text;

update public.attendance
set subject = coalesce(nullif(subject, ''), 'General')
where subject is null or subject = '';

update public.attendance
set period = coalesce(nullif(period, ''), '1')
where period is null or period = '';

drop index if exists idx_attendance_student_date;
drop index if exists idx_attendance_subject;
drop index if exists idx_attendance_period;

alter table public.attendance
drop constraint if exists attendance_student_id_attendance_date_key;

create unique index if not exists idx_attendance_student_context_unique
on public.attendance(student_id, attendance_date, class_id, subject, period);

create index if not exists idx_attendance_subject on public.attendance(subject);
create index if not exists idx_attendance_period on public.attendance(period);
create index if not exists idx_attendance_student_date on public.attendance(student_id, attendance_date);
