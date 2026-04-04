# Teacher View Students - Troubleshooting & Fix Guide

## Issue Description
Teacher panel "View Class Students" shows no students even though students exist in the database and are assigned to classes.

## What Was Fixed

### 1. **Component Enhancement** ✅
The `TeacherViewStudents.jsx` component has been updated with:
- **Error handling** for database queries
- **Error messages** displayed to users when queries fail
- **Helpful feedback** when no students are found
- **School ID validation** on component load

**What to look for**: When you select a class now, if no students appear, you'll see an error message explaining why.

---

## Database Issues to Check

The most common reasons students don't appear are:

### Issue 1: Missing school_id on students
**Symptom**: No error message, but students don't appear

**Check this SQL query** in Supabase dashboard:
```sql
-- Count students with missing school_id
SELECT COUNT(*) as students_without_school_id
FROM public.students
WHERE school_id IS NULL;
```

**If count > 0**, run this fix:
```sql
-- Fill missing school_id from class
UPDATE public.students s
SET school_id = c.school_id
FROM public.classes c
WHERE s.school_id IS NULL
  AND s.class_id = c.id;
```

---

### Issue 2: Teacher's role not set correctly
**Symptom**: Error "Failed to load students" or RLS policy blocks access

**Check this SQL query**:
```sql
-- Check your teacher's profile
SELECT id, name, email, role, school_id 
FROM public.user_profiles
WHERE role = 'teacher'
LIMIT 5;
```

**Look for**:
- Role must be exactly: `teacher` (lowercase, no spaces)
- school_id must NOT be NULL
- school_id must match the school that has the students

**If role has spaces**, run this fix:
```sql
-- Fix role whitespace
UPDATE public.user_profiles
SET role = TRIM(role)
WHERE role IS NOT NULL;
```

**If role is wrong**, fix it:
```sql
-- Replace 'YOUR_TEACHER_EMAIL@example.com' with actual teacher email
UPDATE public.user_profiles
SET role = 'teacher'
WHERE email = 'YOUR_TEACHER_EMAIL@example.com';
```

---

### Issue 3: Classes not properly associated with school
**Symptom**: Classes dropdown is empty

**Check this SQL query**:
```sql
-- Count classes per school
SELECT 
  s.school_code,
  COUNT(c.id) as class_count
FROM public.schools s
LEFT JOIN public.classes c ON c.school_id = s.id
GROUP BY s.id, s.school_code;
```

**If your school has 0 classes**, you need to create them:
```sql
-- Run this as an admin user from your school
-- This creates classes 1-12 for your school
SELECT public.ensure_school_classes(
  (SELECT school_id FROM public.user_profiles WHERE email = 'YOUR_ADMIN_EMAIL@example.com' LIMIT 1),
  NULL
);
```

---

### Issue 4: Students exist but not assigned to any class
**Symptom**: Classes appear but have no students

**Check this SQL query**:
```sql
-- See class-student assignments
SELECT 
  c.class_name,
  c.section,
  COUNT(s.id) as student_count
FROM public.classes c
LEFT JOIN public.students s ON s.class_id = c.id
GROUP BY c.id, c.class_name, c.section
ORDER BY c.class_name;
```

**If 0 students in some classes**:
- Use Admin panel → Student Management to add students to the classes manually

---

## Complete Fix Script

If you want to apply all fixes at once, run this in Supabase SQL Editor:

```sql
-- COMPLETE FIX: Run this as an admin user
-- 1. Fix whitespace in roles
UPDATE public.user_profiles SET role = TRIM(role) WHERE role IS NOT NULL;

-- 2. Fix missing school_id on students
UPDATE public.students s
SET school_id = c.school_id
FROM public.classes c
WHERE s.school_id IS NULL AND s.class_id = c.id;

-- 3. Recreate RLS policies
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

-- 4. Verify data
SELECT 
  'Classes with students' as check_type,
  COUNT(DISTINCT c.id) as count
FROM public.classes c
JOIN public.students s ON s.class_id = c.id;
```

---

## Testing Steps

1. **Log out** and log back in as a teacher
2. Go to **Teacher Panel** → **View Class Students**
3. **Select a class** from the dropdown
4. **Check what appears**:
   - ✅ Students should load
   - ❌ Error message? Check solutions above
   - ❌ "No students found"? Make sure students are assigned to the class

---

## Debugging Tips

If you still have issues:

1. **Check browser console** for Supabase errors (F12 → Console tab)
2. **Check user_profiles** - make sure teacher record exists with proper school_id and role='teacher'
3. **Check students table** - make sure students have school_id that matches the teacher's school_id
4. **Run queries** above one by one to identify the exact missing piece
5. **Check RLS policies** - make sure the "students scoped select" policy exists

---

## Contact
If issues persist after trying these fixes, provide the error message from the browser console and the results of the CHECK queries above.
