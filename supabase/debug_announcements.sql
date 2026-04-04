-- Debug announcements RLS policies
-- Run this to check the current state

-- Check if announcements table exists
select * from information_schema.tables where table_name = 'announcements';

-- Check current RLS policies on announcements
select * from pg_policies where tablename = 'announcements';

-- Test current_user_school_id() function
select public.current_user_school_id();

-- Test current_user_role() function  
select public.current_user_role();

-- Check if the user profile exists
select id, school_id, role from public.user_profiles where id = auth.uid();

-- Check if the school exists and is active
select id, school_code, name, is_active, subscription_end_date 
from public.schools 
where id = (select school_id from public.user_profiles where id = auth.uid());

-- Try to insert a test announcement to see the error
-- INSERT INTO public.announcements (school_id, title, message, audience, created_by)
-- SELECT 
--   (select school_id from public.user_profiles where id = auth.uid()),
--   'Test Announcement',
--   'Test message',
--   'all',
--   auth.uid()
-- RETURNING *;
