create or replace function public.current_user_school_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (
    select school_id
    from public.user_profiles
    where id = auth.uid()
    limit 1
  );
end;
$$;

create or replace function public.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (
    select role
    from public.user_profiles
    where id = auth.uid()
    limit 1
  );
end;
$$;

create or replace function public.is_current_school_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select s.is_active
        and s.subscription_end_date is not null
        and s.subscription_end_date >= current_date
      from public.schools s
      where s.id = public.current_user_school_id()
    ),
    false
  );
end;
$$;
