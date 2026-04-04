create or replace function public.can_read_announcement(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.school_id = p_school_id
  );
end;
$$;

create or replace function public.can_manage_announcement(p_school_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.school_id = p_school_id
      and up.role in ('admin', 'teacher')
  );
end;
$$;

alter table public.announcements enable row level security;

drop policy if exists "announcements admin teacher manage" on public.announcements;
drop policy if exists "announcements school select" on public.announcements;
create policy "announcements school select"
on public.announcements
for select
to authenticated
using (
  public.can_read_announcement(school_id)
);

drop policy if exists "announcements admin teacher insert" on public.announcements;
create policy "announcements admin teacher insert"
on public.announcements
for insert
to authenticated
with check (
  public.can_manage_announcement(school_id)
);

drop policy if exists "announcements admin teacher update" on public.announcements;
create policy "announcements admin teacher update"
on public.announcements
for update
to authenticated
using (
  public.can_manage_announcement(school_id)
)
with check (
  public.can_manage_announcement(school_id)
);

drop policy if exists "announcements admin teacher delete" on public.announcements;
create policy "announcements admin teacher delete"
on public.announcements
for delete
to authenticated
using (
  public.can_manage_announcement(school_id)
);
