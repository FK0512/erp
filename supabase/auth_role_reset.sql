drop policy if exists "school members can read own school" on public.schools;
drop policy if exists "admins can update own school" on public.schools;

drop policy if exists "school members can read profiles in school" on public.user_profiles;
drop policy if exists "users can update own basic profile" on public.user_profiles;

drop policy if exists "admins can read invitations in school" on public.school_role_invitations;
drop policy if exists "admins can create invitations in school" on public.school_role_invitations;
drop policy if exists "admins can update invitations in school" on public.school_role_invitations;

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user_profile() cascade;
drop function if exists public.generate_school_code() cascade;
drop function if exists public.activate_school_subscription(uuid) cascade;
drop function if exists public.is_current_school_active() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.current_user_school_id() cascade;

drop table if exists public.school_role_invitations cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.schools cascade;

drop sequence if exists public.school_code_seq cascade;
