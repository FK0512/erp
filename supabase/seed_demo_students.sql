create extension if not exists pgcrypto;

alter table if exists public.students
add column if not exists user_profile_id uuid unique references public.user_profiles(id) on delete set null;

alter table if exists public.students
add column if not exists school_id uuid references public.schools(id) on delete cascade,
add column if not exists class_id uuid references public.classes(id) on delete set null,
add column if not exists name text,
add column if not exists full_name text,
add column if not exists roll_number text,
add column if not exists admission_number text,
add column if not exists guardian_name text,
add column if not exists guardian_phone text;

create unique index if not exists idx_students_school_roll_number
on public.students(school_id, roll_number);

create or replace function public.seed_demo_students(
  p_students_per_class integer default 10,
  p_default_password text default 'Student@123'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_school_id uuid := public.current_user_school_id();
  v_school_code text;
  v_class_id uuid;
  v_class_num integer;
  v_slot integer;
  v_user_id uuid;
  v_email text;
  v_name text;
  v_roll_number text;
  v_created_accounts integer := 0;
  v_updated_students integer := 0;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can seed demo students';
  end if;

  if v_school_id is null then
    raise exception 'Current user is not linked to a school';
  end if;

  if coalesce(p_students_per_class, 0) < 1 or p_students_per_class > 50 then
    raise exception 'students_per_class must be between 1 and 50';
  end if;

  if length(coalesce(p_default_password, '')) < 8 then
    raise exception 'default_password must be at least 8 characters';
  end if;

  select school_code
  into v_school_code
  from public.schools
  where id = v_school_id;

  if v_school_code is null then
    raise exception 'School code not found for current school';
  end if;

  perform public.ensure_school_classes(v_school_id, null);

  for v_class_num in 1..12 loop
    select id
    into v_class_id
    from public.classes
    where school_id = v_school_id
      and class_name = v_class_num::text
      and section = 'A'
    limit 1;

    if v_class_id is null then
      raise exception 'Class % was not found after preparation', v_class_num;
    end if;

    for v_slot in 1..p_students_per_class loop
      v_email := lower(format('student%s%s@%s.demo', lpad(v_class_num::text, 2, '0'), lpad(v_slot::text, 2, '0'), v_school_code));
      v_name := format('Student %s-%s', lpad(v_class_num::text, 2, '0'), lpad(v_slot::text, 2, '0'));
      v_roll_number := format('%s%02s', lpad(v_class_num::text, 2, '0'), v_slot);

      select id
      into v_user_id
      from auth.users
      where lower(email) = v_email
      limit 1;

      if v_user_id is null then
        insert into auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token,
          email_change,
          email_change_token_new,
          recovery_token
        )
        values (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          v_email,
          extensions.crypt(p_default_password, extensions.gen_salt('bf')),
          now(),
          jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'role', 'student',
            'name', v_name,
            'school_code', v_school_code
          ),
          jsonb_build_object('name', v_name, 'role', 'student', 'school_code', v_school_code),
          now(),
          now(),
          '',
          '',
          '',
          ''
        )
        returning id into v_user_id;

        v_created_accounts := v_created_accounts + 1;
      end if;

      insert into public.students (
        school_id,
        user_profile_id,
        class_id,
        name,
        full_name,
        roll_number,
        admission_number,
        guardian_name,
        guardian_phone
      )
      values (
        v_school_id,
        v_user_id,
        v_class_id,
        v_name,
        v_name,
        v_roll_number,
        format('ADM-%s-%s', lpad(v_class_num::text, 2, '0'), lpad(v_slot::text, 2, '0')),
        format('Guardian %s-%s', lpad(v_class_num::text, 2, '0'), lpad(v_slot::text, 2, '0')),
        format('900000%04s', ((v_class_num - 1) * p_students_per_class + v_slot))
      )
      on conflict (school_id, roll_number)
      do update set
        user_profile_id = excluded.user_profile_id,
        class_id = excluded.class_id,
        name = excluded.name,
        full_name = excluded.full_name,
        admission_number = excluded.admission_number,
        guardian_name = excluded.guardian_name,
        guardian_phone = excluded.guardian_phone;

      v_updated_students := v_updated_students + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'school_code', v_school_code,
    'students_per_class', p_students_per_class,
    'created_accounts', v_created_accounts,
    'updated_students', v_updated_students,
    'default_password', p_default_password,
    'email_pattern', format('studentCCNN@%s.demo', v_school_code)
  );
end;
$$;

grant execute on function public.seed_demo_students(integer, text) to authenticated;
