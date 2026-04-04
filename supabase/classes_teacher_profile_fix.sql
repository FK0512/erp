alter table if exists public.classes
add column if not exists teacher_profile_id uuid references public.user_profiles(id) on delete set null;

create index if not exists idx_classes_teacher_profile_id
on public.classes(teacher_profile_id);
