-- Performance Aggregation Views
-- Pre-computed views for faster dashboard queries

-- Class attendance summary view
CREATE OR REPLACE VIEW public.class_attendance_summary AS
SELECT
  c.id as class_id,
  c.class_name,
  c.school_id,
  COUNT(a.id) as total_records,
  COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE a.status = 'present') /
    NULLIF(COUNT(*), 0), 2
  ) as present_percentage,
  COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
  COUNT(*) FILTER (WHERE a.status = 'late') as late_count,
  COUNT(*) FILTER (WHERE a.status = 'leave') as leave_count,
  MAX(a.attendance_date) as last_attendance_date
FROM public.classes c
LEFT JOIN public.attendance a ON c.id = a.class_id
GROUP BY c.id, c.class_name, c.school_id;

-- RLS for attendance summary
ALTER VIEW public.class_attendance_summary SET (security_barrier = true);

CREATE POLICY "class_attendance_summary_access" ON public.class_attendance_summary
FOR SELECT TO authenticated
USING (
  school_id = public.current_user_school_id() OR
  public.current_user_role() = 'superadmin'
);

-- Student fee summary view
CREATE OR REPLACE VIEW public.student_fee_summary AS
SELECT
  s.id as student_id,
  s.full_name,
  s.roll_number,
  s.class_id,
  s.school_id,
  COUNT(f.id) as total_fee_records,
  COALESCE(SUM(f.total_amount), 0) as total_fees,
  COALESCE(SUM(f.paid_amount), 0) as total_paid,
  COALESCE(SUM(f.due_amount), 0) as total_due,
  ROUND(
    100.0 * COALESCE(SUM(f.paid_amount), 0) /
    NULLIF(COALESCE(SUM(f.total_amount), 0), 0), 2
  ) as payment_percentage,
  COUNT(*) FILTER (WHERE f.status = 'paid') as paid_fees_count,
  COUNT(*) FILTER (WHERE f.status = 'pending') as pending_fees_count,
  COUNT(*) FILTER (WHERE f.status = 'partial') as partial_fees_count,
  MAX(f.due_date) as latest_due_date
FROM public.students s
LEFT JOIN public.fees f ON s.id = f.student_id
GROUP BY s.id, s.full_name, s.roll_number, s.class_id, s.school_id;

-- RLS for student fee summary
ALTER VIEW public.student_fee_summary SET (security_barrier = true);

CREATE POLICY "student_fee_summary_access" ON public.student_fee_summary
FOR SELECT TO authenticated
USING (
  school_id = public.current_user_school_id() OR
  public.current_user_role() = 'superadmin'
);

-- School overview statistics view
CREATE OR REPLACE VIEW public.school_overview_stats AS
SELECT
  sch.id as school_id,
  sch.name as school_name,
  sch.school_code,
  sch.subscription_end_date,
  sch.is_active,
  COUNT(DISTINCT c.id) as total_classes,
  COUNT(DISTINCT s.id) as total_students,
  COUNT(DISTINCT up.id) as total_staff,
  COALESCE(SUM(f.total_amount), 0) as total_fees,
  COALESCE(SUM(f.paid_amount), 0) as total_paid,
  COALESCE(SUM(f.due_amount), 0) as total_due,
  COUNT(DISTINCT a.id) as total_attendance_records,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE a.status = 'present') /
    NULLIF(COUNT(*), 0), 2
  ) as overall_attendance_percentage
FROM public.schools sch
LEFT JOIN public.classes c ON sch.id = c.school_id
LEFT JOIN public.students s ON sch.id = s.school_id
LEFT JOIN public.user_profiles up ON sch.id = up.school_id AND up.role IN ('admin', 'teacher', 'accountant')
LEFT JOIN public.fees f ON sch.id = f.school_id
LEFT JOIN public.attendance a ON sch.id = a.school_id
GROUP BY sch.id, sch.name, sch.school_code, sch.subscription_end_date, sch.is_active;

-- RLS for school overview (superadmin only)
ALTER VIEW public.school_overview_stats SET (security_barrier = true);

CREATE POLICY "school_overview_superadmin" ON public.school_overview_stats
FOR SELECT TO authenticated
USING (public.current_user_role() = 'superadmin');

-- Recent activity view for dashboards
CREATE OR REPLACE VIEW public.recent_activity AS
SELECT
  'attendance' as activity_type,
  a.id as record_id,
  a.attendance_date as activity_date,
  s.full_name as student_name,
  c.class_name,
  a.status,
  up.name as marked_by,
  a.created_at
FROM public.attendance a
JOIN public.students s ON a.student_id = s.id
JOIN public.classes c ON a.class_id = c.id
LEFT JOIN public.user_profiles up ON a.marked_by = up.id
WHERE a.created_at >= now() - INTERVAL '7 days'

UNION ALL

SELECT
  'fee_payment' as activity_type,
  fp.id as record_id,
  fp.payment_date as activity_date,
  s.full_name as student_name,
  f.fee_title as class_name,
  fp.payment_mode as status,
  up.name as marked_by,
  fp.created_at
FROM public.fee_payments fp
JOIN public.students s ON fp.student_id = s.id
JOIN public.fees f ON fp.fee_id = f.id
LEFT JOIN public.user_profiles up ON fp.created_by = up.id
WHERE fp.created_at >= now() - INTERVAL '7 days'

ORDER BY created_at DESC
LIMIT 50;

-- RLS for recent activity
ALTER VIEW public.recent_activity SET (security_barrier = true);

CREATE POLICY "recent_activity_access" ON public.recent_activity
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'superadmin' OR
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.school_id = public.current_user_school_id()
    AND s.full_name = recent_activity.student_name
  )
);