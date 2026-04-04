create extension if not exists pgcrypto;

create sequence if not exists public.school_code_seq start 1001;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  school_number bigint generated always as identity unique,
  school_code text not null unique,
  name text not null,
  address text,
  phone text,
  email text,
  subscription_start_date date,
  subscription_end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (school_code = upper(school_code))
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  profile_number bigint generated always as identity unique,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'teacher', 'student', 'accountant')),
  created_at timestamptz not null default now()
);

create table if not exists public.school_role_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'teacher', 'student', 'accountant')),
  invited_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (school_id, email, role)
);

create index if not exists idx_schools_school_code on public.schools(lower(school_code));
create index if not exists idx_user_profiles_school_id on public.user_profiles(school_id);
create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_invites_school_id on public.school_role_invitations(school_id);
create index if not exists idx_invites_email on public.school_role_invitations(lower(email));

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

create or replace function public.activate_school_subscription(p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.schools
  set
    subscription_start_date = current_date,
    subscription_end_date = current_date + interval '30 days',
    is_active = true
  where id = p_school_id;
end;
$$;

create or replace function public.generate_school_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_number bigint;
begin
  v_next_number := nextval('public.school_code_seq');
  return 'SCH' || lpad(v_next_number::text, 4, '0');
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.school_role_invitations%rowtype;
  v_school_id uuid;
  v_school_code text;
  v_school_name text;
  v_role text;
  v_name text;
  v_class_name text;
  v_section text;
  v_class_id uuid;
  v_roll_number text;
  v_school_is_active boolean;
begin
  v_school_code := upper(nullif(new.raw_user_meta_data ->> 'school_code', ''));
  v_school_name := nullif(new.raw_user_meta_data ->> 'school_name', '');
  v_role := nullif(new.raw_user_meta_data ->> 'role', '');
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));
  v_class_name := nullif(new.raw_user_meta_data ->> 'class_name', '');
  v_section := upper(coalesce(nullif(new.raw_user_meta_data ->> 'section', ''), 'A'));

  if v_role is null then
    raise exception 'Signup metadata must include role';
  end if;

  if v_role = 'admin' and v_school_code is null then
    if v_school_name is null then
      raise exception 'Admin signup must include school_name';
    end if;

    insert into public.schools (
      school_code,
      name,
      email,
      subscription_start_date,
      subscription_end_date,
      is_active
    )
    values (
      public.generate_school_code(),
      v_school_name,
      new.email,
      current_date,
      current_date + interval '30 days',
      true
    )
    returning id, school_code into v_school_id, v_school_code;

    insert into public.user_profiles (id, school_id, name, email, role)
    values (new.id, v_school_id, v_name, new.email, v_role);

    return new;
  end if;

  if v_school_code is null then
    raise exception 'Signup metadata must include school_code';
  end if;

  select id, is_active and subscription_end_date is not null and subscription_end_date >= current_date
  into v_school_id, v_school_is_active
  from public.schools
  where school_code = v_school_code
  limit 1;

  if v_school_id is null then
    raise exception 'Invalid school code';
  end if;

  if not coalesce(v_school_is_active, false) then
    raise exception 'School subscription is inactive';
  end if;

  if v_role = 'student' then
    if v_class_name is null then
      raise exception 'Student signup must include class_name';
    end if;

    insert into public.user_profiles (id, school_id, name, email, role)
    values (new.id, v_school_id, v_name, new.email, v_role);

    insert into public.classes (school_id, class_name, section)
    values (v_school_id, v_class_name, v_section)
    on conflict (school_id, class_name, section) do nothing;

    select id
    into v_class_id
    from public.classes
    where school_id = v_school_id
      and class_name = v_class_name
      and section = v_section
    limit 1;

    if v_class_id is null then
      raise exception 'Could not prepare the selected class for student signup';
    end if;

    v_roll_number := 'SELF-' || upper(substr(new.id::text, 1, 8));

    insert into public.students (
      school_id,
      user_profile_id,
      class_id,
      name,
      full_name,
      roll_number
    )
    values (
      v_school_id,
      new.id,
      v_class_id,
      v_name,
      v_name,
      v_roll_number
    )
    on conflict (school_id, roll_number)
    do update set
      user_profile_id = excluded.user_profile_id,
      class_id = excluded.class_id,
      name = excluded.name,
      full_name = excluded.full_name;

    return new;
  end if;

  if v_role in ('teacher', 'accountant') then
    insert into public.user_profiles (id, school_id, name, email, role)
    values (new.id, v_school_id, v_name, new.email, v_role);

    return new;
  end if;

  select *
  into v_invitation
  from public.school_role_invitations
  where school_id = v_school_id
    and lower(email) = lower(new.email)
    and role = v_role
    and accepted_at is null
  limit 1;

  if v_invitation.id is null then
    raise exception 'No approved invitation found for this staff account';
  end if;

  insert into public.user_profiles (id, school_id, name, email, role)
  values (new.id, v_school_id, v_name, new.email, v_role);

  update public.school_role_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

alter table public.schools enable row level security;
alter table public.user_profiles enable row level security;
alter table public.school_role_invitations enable row level security;

drop policy if exists "school members can read own school" on public.schools;
create policy "school members can read own school"
on public.schools
for select
to authenticated
using (id = public.current_user_school_id());

drop policy if exists "admins can update own school" on public.schools;
create policy "admins can update own school"
on public.schools
for update
to authenticated
using (
  id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
)
with check (
  id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
);

drop policy if exists "school members can read profiles in school" on public.user_profiles;
create policy "users can read own profile"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

create policy "school members can read profiles in school"
on public.user_profiles
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.is_current_school_active()
);

drop policy if exists "users can update own basic profile" on public.user_profiles;
create policy "users can update own basic profile"
on public.user_profiles
for update
to authenticated
using (
  id = auth.uid()
  and public.is_current_school_active()
)
with check (
  id = auth.uid()
  and school_id = public.current_user_school_id()
  and role = public.current_user_role()
);

drop policy if exists "admins can read invitations in school" on public.school_role_invitations;
create policy "admins can read invitations in school"
on public.school_role_invitations
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
  and public.is_current_school_active()
);

drop policy if exists "admins can create invitations in school" on public.school_role_invitations;
create policy "admins can create invitations in school"
on public.school_role_invitations
for insert
to authenticated
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
  and public.is_current_school_active()
);

drop policy if exists "admins can update invitations in school" on public.school_role_invitations;
create policy "admins can update invitations in school"
on public.school_role_invitations
for update
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
  and public.is_current_school_active()
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() = 'admin'
  and public.is_current_school_active()
);

comment on table public.user_profiles is
'Supabase auth creates UUIDs automatically. profile_number gives you a simple sequential user number for business use.';

comment on table public.school_role_invitations is
'Optional invitation table. Current UI flow allows student, teacher, and accountant signup directly with a valid school code.';

-- If your database was initialized before classes were linked to teachers
-- or before the classes unique key was added, run
-- supabase/classes_rls_fix.sql after the modules setup.

-- Admin signup can create a school automatically from the UI.
-- Staff invitation example:
-- insert into public.school_role_invitations (school_id, email, role)
-- values ('YOUR_SCHOOL_UUID', 'teacher@springfieldhigh.edu', 'teacher');
