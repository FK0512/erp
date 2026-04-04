# Attendance Save & Display Guide

## Overview
The attendance system allows teachers to mark attendance for their classes, and students can view their attendance records in the student portal.

## Teacher Workflow

### 1. Mark Attendance
1. Login as a teacher
2. Go to **Teacher Dashboard → Take Attendance**
3. Select the following:
   - **Date**: Attendance date (defaults to today)
   - **Class**: The class you're marking attendance for (Classes 1-12)
   - **Subject**: Subject name (e.g., Mathematics, English)
   - **Period**: Period number (1-8)

4. Mark each student's status:
   - ✅ Present
   - ❌ Absent
   - ⏳ Late
   - 🏠 Leave

5. Click **"Save Attendance"** button
   - You should see: "Attendance saved successfully for X students!"
   - If there's an error, check the error message for details

### 2. Excel Upload (Optional)
- Download the attendance template
- Fill in student names/roll numbers and status
- Upload the file to import multiple attendance records at once

## Student Workflow

### 1. View Attendance
1. Login as a student
2. Go to **Student Portal → Attendance Status**
3. You will see:
   - Present count
   - Absent count
   - Attendance percentage
   - Detailed attendance table with:
     - Date
     - Subject
     - Period
     - Status (Present/Absent/Late/Leave)

### 2. Data Refresh
- The attendance data refreshes automatically when you load the page
- To see the latest attendance, refresh the browser (F5)

## Technical Requirements

### Database Schema
The `attendance` table has these columns:
- `id` - UUID primary key
- `school_id` - References the school (auto-populated from teacher's profile)
- `class_id` - References the class (selected by teacher)
- `student_id` - References the student
- `attendance_date` - Date of attendance
- `status` - One of: 'present', 'absent', 'late', 'leave'
- `marked_by` - References the teacher who marked attendance
- `subject` - Subject name (defaults to "General")
- `period` - Period number (defaults to "1")
- `created_at` - Timestamp

### RLS Policy for Teachers
Teachers can **save and manage attendance** for their school via this policy:
```sql
create policy "attendance teacher manage"
on public.attendance
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role() in ('admin', 'teacher')
);
```

### RLS Policy for Students
Students can **view their own attendance** via this policy:
```sql
create policy "attendance scoped select"
on public.attendance
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role() in ('admin', 'teacher')
    or student_id in (
      select s.id from public.students s where s.user_profile_id = auth.uid()
    )
  )
);
```

## Troubleshooting

### Issue: "No students found for this class"
**Solution:**
1. Ensure students are assigned to the class
2. Admin → Student Management → Add New Student to add students to the class

### Issue: Attendance doesn't save
**Possible causes:**
1. **Missing Subject or Period**: Both fields are required
2. **RLS Policy Issue**: Verify the attendance RLS policy exists
   - Go to Supabase Dashboard → SQL Editor
   - Run: `SELECT * FROM pg_policies WHERE tablename = 'attendance';`
3. **Permission Problem**: Check that you're logged in as a teacher with the correct role
4. **Database Issue**: Check browser console (F12) for detailed error messages

### Issue: Student can't see their attendance
**Possible causes:**
1. **No student record linked**: Create a student record linked to the user
   - Admin → Students → Add/Generate students
2. **Attendance not saved yet**: Teachers need to mark attendance first
3. **RLS policy issue**: Verify the student read policy exists

### Issue: Data appears after refresh
**Solution:**
- The attendance page should auto-load, but if data doesn't appear:
1. Refresh the page (F5 or Cmd+R)
2. Log out and log back in
3. Check browser console (F12) for errors

## Database Verification Commands

To verify the attendance setup, run these in Supabase SQL Editor:

### 1. Check Attendance Table Schema
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;
```

### 2. Check RLS Policies
```sql
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'attendance'
ORDER BY policyname;
```

### 3. Check Attendance Records
```sql
SELECT a.id, a.attendance_date, a.status, a.subject, a.period,
       s.full_name, c.class_name, sc.name as school_name
FROM public.attendance a
LEFT JOIN public.students s ON a.student_id = s.id
LEFT JOIN public.classes c ON a.class_id = c.id
LEFT JOIN public.schools sc ON a.school_id = sc.id
ORDER BY a.created_at DESC
LIMIT 20;
```

### 4. Check if Student Record Linked
```sql
SELECT u.id, u.name, u.email, u.role, s.id as student_id, s.full_name, s.class_id
FROM public.user_profiles u
LEFT JOIN public.students s ON s.user_profile_id = u.id
WHERE u.role = 'student'
LIMIT 10;
```

## What Gets Saved

When a teacher clicks **"Save Attendance"**, this data is sent to the database:

```javascript
{
  school_id: "teacher's school UUID",
  class_id: "selected class UUID",
  student_id: "student's UUID",
  attendance_date: "2024-03-31",  // Selected date
  status: "present" | "absent" | "late" | "leave",
  marked_by: "teacher's profile UUID",
  subject: "Mathematics",  // Entered by teacher
  period: "1"  // Selected period
}
```

Each attendance entry is **upserted** (updated if exists, created if new) using this conflict key:
- `(student_id, attendance_date, class_id, subject, period)`

This means if you mark the same student on the same date for the same subject/period, it will update the status, not create a duplicate.

## Best Practices

1. ✅ **Always select Subject and Period** - These are required for proper attendance tracking
2. ✅ **Use class dropdown** - Don't type class names manually
3. ✅ **Mark attendance same day** - Don't mark old attendance if possible
4. ✅ **Use Excel upload** for bulk entries - More efficient than marking individually
5. ✅ **Have students verify** - Ask students to check their attendance regularly

## Support

If attendance still doesn't save:
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Try saving again
4. Look for error messages in the console
5. Screenshot the error and report with:
   - Your teacher name
   - Which class/subject/period
   - The exact error message
