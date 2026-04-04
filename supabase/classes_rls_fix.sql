alter table if exists public.classes
add column if not exists teacher_profile_id uuid references public.user_profiles(id) on delete set null;

with ranked_classes as (
  select
    id,
    row_number() over (
      partition by school_id, class_name, section
      order by created_at nulls last, id
    ) as rn
  from public.classes
)
delete from public.classes c
using ranked_classes r
where c.id = r.id
  and r.rn > 1;

create unique index if not exists idx_classes_school_class_section_unique
on public.classes(school_id, class_name, section);

create index if not exists idx_classes_teacher_profile_id
on public.classes(teacher_profile_id);

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
    insert into public.classes (school_id, class_name, section, teacher_profile_id)
    values (p_school_id, v_class_num::text, 'A', p_teacher_profile_id)
    on conflict (school_id, class_name, section)
    do update set teacher_profile_id = coalesce(public.classes.teacher_profile_id, excluded.teacher_profile_id);
  end loop;
end;
$$;

grant execute on function public.ensure_school_classes(uuid, uuid) to authenticated;
