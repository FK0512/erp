-- Fix for teacher viewing students
-- This script ensures proper RLS policies and data integrity

-- 1. Verify and fix user_profiles role consistency for teachers
-- Ensure all teachers have the correct role format
UPDATE public.user_profiles 
SET role = trim(role) 
WHERE role IS NOT NULL;

-- 2. Ensure students table RLS policies are correct
DROP POLICY IF EXISTS "students scoped select" ON public.students;

CREATE POLICY "students scoped select"
ON public.students
FOR SELECT
TO authenticated
USING (
  school_id = public.current_user_school_id()
  AND (
    public.current_user_role() IN ('admin', 'teacher', 'accountant')
    OR user_profile_id = auth.uid()
  )
);

-- 3. Verify students have proper school_id associations
-- This updates students whose school_id is missing but have a class_id
UPDATE public.students s
SET school_id = c.school_id
WHERE s.school_id IS NULL
  AND s.class_id IS NOT NULL
  AND c.id = s.class_id
  AND c.school_id IS NOT NULL;

-- 4. Verify all required RLS policies exist
DROP POLICY IF EXISTS "classes teacher select" ON public.classes;
CREATE POLICY "classes teacher select"
ON public.classes
FOR SELECT
TO authenticated
USING (
  school_id = public.current_user_school_id()
  AND public.current_user_role() IN ('admin', 'teacher')
);

-- 5. Check for basic data integrity
-- Verify we have classes and students
SELECT 
  c.class_name,
  COUNT(s.id) as student_count,
  c.school_id,
  s.school_id as sample_student_school_id
FROM public.classes c
LEFT JOIN public.students s ON s.class_id = c.id AND s.school_id = c.school_id
GROUP BY c.id, c.class_name, c.school_id, s.school_id
LIMIT 20;

-- Query to verify the issue
-- Run this to see what the teacher can currently access
SELECT 
  'Classes visible to teacher' as check_type,
  COUNT(*) as count
FROM public.classes
WHERE school_id = public.current_user_school_id();

SELECT 
  'Students visible to teacher' as check_type,
  COUNT(*) as count
FROM public.students
WHERE school_id = public.current_user_school_id()
  AND public.current_user_role() IN ('admin', 'teacher', 'accountant');
