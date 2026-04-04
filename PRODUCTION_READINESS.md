# Production Readiness

## 1. Supabase schema order

Run these SQL files in this order in the Supabase SQL editor:

1. `supabase/auth_role_setup.sql`
2. `supabase/erp_modules.sql`
3. `supabase/classes_rls_fix.sql`
4. `supabase/classes_constraint_repair.sql`
5. `supabase/classes_teacher_profile_fix.sql`
6. `supabase/attendance_context_fix.sql`
7. `supabase/announcements_schema_fix.sql`
8. `supabase/announcements_policy_fix.sql`
9. `supabase/auth_role_policy_fix.sql`

Use these only when needed for repair/debug:

- `supabase/debug_announcements.sql`
- `supabase/connection_test.sql`
- `supabase/create_classes_1_12.sql`

## 2. Environment

Create a local `.env` file from `.env.example` and fill in:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 3. Required production checks

Before deployment, verify all of the following:

1. Admin signup creates a `schools` row and a matching `user_profiles` row.
2. Teacher, student, and accountant signup with a valid school code creates `user_profiles` rows in the same school.
3. `students.user_profile_id` is populated for every student account expected to use the student portal.
4. Classes `1` to `12` exist for the school with section `A`.
5. Attendance saves with the full uniqueness context:
   `student_id + attendance_date + class_id + subject + period`
6. Announcements support `audience` targeting and are visible only to the intended role views.
7. Fee payments update `fees.paid_amount`, `fees.due_amount`, and `fees.status` through the trigger.
8. RLS is enabled on every ERP table and authenticated users only see their own school data.

## 4. Manual smoke test plan

Run the app and test these flows with separate accounts:

### Admin

1. Sign up as a new admin.
2. Confirm the dashboard loads school metrics.
3. Add a student manually from Student Management.
4. Publish one announcement for `all` and one for `students`.
5. Open Fees, Attendance, Staff, and Reports and verify each panel loads data without console/database errors.

### Teacher

1. Sign in with a teacher account from the same school.
2. Open attendance and save attendance for a class with subject and period.
3. Re-open the same date, subject, and period and confirm data reloads exactly.
4. Upload marks manually and via CSV/XLSX.
5. Post homework with and without a due date.
6. Post a teacher-only notice and verify it appears in the teacher panel.

### Student

1. Sign in with a student account linked in `students.user_profile_id`.
2. Confirm Attendance shows subject and period rows.
3. Confirm Homework, Fees, and Marks all load correctly.
4. Confirm Notices shows `all` and `students` announcements only.

### Accountant

1. Sign in with an accountant account.
2. Open Fees Collection.
3. Record a fee payment using each payment mode.
4. Confirm overpayment is blocked.
5. Confirm the updated paid/due values appear immediately.

## 5. SQL verification queries

Run these after smoke testing:

```sql
select count(*) as schools from public.schools;
select role, count(*) from public.user_profiles group by role order by role;
select school_id, class_name, section from public.classes order by class_name, section;
select status, count(*) from public.attendance group by status order by status;
select audience, count(*) from public.announcements group by audience order by audience;
select status, count(*) from public.fees group by status order by status;
```

Check for orphaned student accounts:

```sql
select up.id, up.email, up.name
from public.user_profiles up
left join public.students s on s.user_profile_id = up.id
where up.role = 'student'
  and s.id is null;
```

## 6. Build and deploy

1. Run `npm install`
2. Run `npm run build`
3. Run `npm run preview`
4. Repeat the role smoke test against the preview build
5. Deploy only after preview matches local testing

## 7. Current local limitation

This workspace can patch code and SQL files, but it cannot apply SQL to your live Supabase project from here. The SQL execution and final browser-based role validation still need to be run against your real project before deployment.
