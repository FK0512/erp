-- Admin Dashboard Attendance Debug Queries
-- Run these queries in Supabase SQL Editor as an admin user

-- 1. Check how many attendance records exist
SELECT COUNT(*) as total_attendance_records
FROM public.attendance;

-- 2. Check attendance records with class details
SELECT 
  a.id,
  a.attendance_date,
  a.status,
  a.class_id,
  a.school_id,
  c.class_name,
  c.section
FROM public.attendance a
LEFT JOIN public.classes c ON a.class_id = c.id
LIMIT 20;

-- 3. Check if admin can see attendance records with RLS
SELECT 
  COUNT(*) as visible_records,
  MAX(attendance_date) as latest_date
FROM public.attendance;

-- 4. Check class-wise attendance counts
SELECT 
  c.class_name,
  c.section,
  COUNT(a.id) as total_attendance,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
FROM public.classes c
LEFT JOIN public.attendance a ON a.class_id = c.id
WHERE c.school_id = (SELECT school_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
GROUP BY c.id, c.class_name, c.section
ORDER BY CAST(c.class_name AS INTEGER);

-- 5. Verify admin user details
SELECT 
  id,
  name,
  email,
  role,
  school_id
FROM public.user_profiles
WHERE id = auth.uid();
