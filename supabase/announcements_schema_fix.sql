alter table public.announcements
add column if not exists audience text not null default 'all';

alter table public.announcements
add column if not exists created_by uuid references public.user_profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_audience_check'
  ) then
    alter table public.announcements
    add constraint announcements_audience_check
    check (audience in ('all', 'teachers', 'students', 'accountant'));
  end if;
end $$;
