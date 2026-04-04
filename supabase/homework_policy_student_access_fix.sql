alter table public.homework enable row level security;

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
      select s.class_id
      from public.students s
      where s.user_profile_id = auth.uid()
    )
  )
);
