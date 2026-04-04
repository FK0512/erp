-- Ensure all classes 1-12 exist in the database
-- This script creates any missing classes for a school

-- Replace 'your-school-id-here' with the actual school ID
-- You can get this from the schools table or user_profiles table

INSERT INTO public.classes (school_id, class_name, section)
SELECT
  'your-school-id-here' as school_id,
  class_num::text as class_name,
  'A' as section
FROM generate_series(1, 12) as class_num
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes
  WHERE school_id = 'your-school-id-here'
  AND class_name = class_num::text
  AND section = 'A'
)
ORDER BY class_num;

-- To run this for all schools (if you have multiple schools):
/*
INSERT INTO public.classes (school_id, class_name, section)
SELECT
  s.id as school_id,
  class_num::text as class_name,
  'A' as section
FROM public.schools s
CROSS JOIN generate_series(1, 12) as class_num
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.school_id = s.id
  AND c.class_name = class_num::text
  AND c.section = 'A'
)
ORDER BY s.id, class_num;
*/