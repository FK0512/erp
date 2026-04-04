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
