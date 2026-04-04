-- Superadmin Schema Extensions
-- Add superadmin role and bypass email verification

-- Update user_profiles table to allow superadmin role
ALTER TABLE public.user_profiles
ADD CONSTRAINT check_role_extended
CHECK (role IN ('admin', 'teacher', 'student', 'accountant', 'superadmin'));

-- Create superadmin user (bypass normal signup process)
-- This will be inserted manually or through a special function
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin123@gmail.com',
  crypt('shakak11apolA$', gen_salt('bf')),
  now(), -- email_confirmed_at (bypass verification)
  NULL,
  '',
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Super Admin", "role": "superadmin"}',
  false,
  now(),
  now(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  '',
  0,
  NULL,
  NULL,
  ''
) ON CONFLICT (email) DO NOTHING;

-- Get the user ID for the superadmin
DO $$
DECLARE
  superadmin_user_id UUID;
BEGIN
  SELECT id INTO superadmin_user_id
  FROM auth.users
  WHERE email = 'admin123@gmail.com';

  -- Create superadmin profile if it doesn't exist
  INSERT INTO public.user_profiles (id, school_id, name, email, role)
  SELECT
    superadmin_user_id,
    NULL, -- No school_id for superadmin
    'Super Admin',
    'admin123@gmail.com',
    'superadmin'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE email = 'admin123@gmail.com'
  );
END $$;

-- Update current_user_role function to handle superadmin
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Superadmin check first
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RETURN 'superadmin';
  END IF;

  RETURN (
    SELECT role
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- Update current_user_school_id to return NULL for superadmin (cross-school access)
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Superadmin has no school restriction
  IF public.current_user_role() = 'superadmin' THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT school_id
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- Superadmin subscription management functions
CREATE OR REPLACE FUNCTION public.superadmin_extend_subscription(p_school_id UUID, p_days INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superadmin can call this
  IF public.current_user_role() != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: superadmin required';
  END IF;

  UPDATE public.schools
  SET
    subscription_end_date = GREATEST(subscription_end_date, current_date) + INTERVAL '1 day' * p_days,
    is_active = true
  WHERE id = p_school_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_end_subscription(p_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only superadmin can call this
  IF public.current_user_role() != 'superadmin' THEN
    RAISE EXCEPTION 'Access denied: superadmin required';
  END IF;

  UPDATE public.schools
  SET
    subscription_end_date = current_date - INTERVAL '1 day',
    is_active = false
  WHERE id = p_school_id;
END;
$$;
-- Audit Logging System
-- Comprehensive audit trail for all critical operations

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_school_id ON public.audit_log(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON public.audit_log(record_id);

-- RLS Policy for audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_superadmin_all" ON public.audit_log
FOR ALL TO authenticated
USING (public.current_user_role() = 'superadmin');

CREATE POLICY "audit_log_school_admins" ON public.audit_log
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'admin' AND
  school_id = public.current_user_school_id()
);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_values JSONB := NULL;
  v_new_values JSONB := NULL;
  v_action TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new_values := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_values := row_to_json(OLD)::JSONB;
    v_new_values := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_values := row_to_json(OLD)::JSONB;
  END IF;

  -- Insert audit record
  INSERT INTO public.audit_log (
    school_id,
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_old_values,
    v_new_values,
    v_user_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit triggers to critical tables
DROP TRIGGER IF EXISTS audit_schools ON public.schools;
CREATE TRIGGER audit_schools
AFTER INSERT OR UPDATE OR DELETE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_user_profiles ON public.user_profiles;
CREATE TRIGGER audit_user_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_students ON public.students;
CREATE TRIGGER audit_students
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_fees ON public.fees;
CREATE TRIGGER audit_fees
AFTER INSERT OR UPDATE OR DELETE ON public.fees
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_attendance ON public.attendance;
CREATE TRIGGER audit_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_fee_payments ON public.fee_payments;
CREATE TRIGGER audit_fee_payments
AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
-- Fees Data Consistency Triggers
-- Ensure fees calculations are always correct

-- Function to validate and calculate fees consistency
CREATE OR REPLACE FUNCTION public.validate_fees_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure paid_amount cannot exceed total_amount
  IF NEW.paid_amount > NEW.total_amount THEN
    RAISE EXCEPTION 'Paid amount (%.2f) cannot exceed total amount (%.2f)',
      NEW.paid_amount, NEW.total_amount;
  END IF;

  -- Ensure amounts are not negative
  IF NEW.total_amount < 0 OR NEW.paid_amount < 0 THEN
    RAISE EXCEPTION 'Fee amounts cannot be negative';
  END IF;

  -- Auto-calculate due_amount
  NEW.due_amount := NEW.total_amount - NEW.paid_amount;

  -- Auto-determine status based on amounts
  IF NEW.paid_amount = 0 THEN
    NEW.status := 'pending';
  ELSIF NEW.paid_amount >= NEW.total_amount THEN
    NEW.status := 'paid';
  ELSE
    NEW.status := 'partial';
  END IF;

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Function to validate fee payments
CREATE OR REPLACE FUNCTION public.validate_fee_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee_record RECORD;
BEGIN
  -- Get the associated fee record
  SELECT * INTO v_fee_record
  FROM public.fees
  WHERE id = NEW.fee_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee record not found';
  END IF;

  -- Check if payment would exceed the remaining due amount
  IF NEW.amount > v_fee_record.due_amount THEN
    RAISE EXCEPTION 'Payment amount (%.2f) exceeds due amount (%.2f)',
      NEW.amount, v_fee_record.due_amount;
  END IF;

  -- Update the fee record after payment
  UPDATE public.fees
  SET
    paid_amount = paid_amount + NEW.amount,
    due_amount = due_amount - NEW.amount,
    status = CASE
      WHEN paid_amount + NEW.amount >= total_amount THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = now()
  WHERE id = NEW.fee_id;

  RETURN NEW;
END;
$$;

-- Apply triggers to fees table
DROP TRIGGER IF EXISTS fees_validate ON public.fees;
CREATE TRIGGER fees_validate
BEFORE INSERT OR UPDATE ON public.fees
FOR EACH ROW
EXECUTE FUNCTION public.validate_fees_amounts();

-- Apply triggers to fee_payments table
DROP TRIGGER IF EXISTS fee_payments_validate ON public.fee_payments;
CREATE TRIGGER fee_payments_validate
BEFORE INSERT ON public.fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_fee_payments();

-- Function to get fee statistics for a school (cached view alternative)
CREATE OR REPLACE FUNCTION public.get_fee_statistics(p_school_id UUID)
RETURNS TABLE (
  total_fees NUMERIC,
  total_paid NUMERIC,
  total_due NUMERIC,
  pending_count BIGINT,
  partial_count BIGINT,
  paid_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permissions
  IF public.current_user_role() != 'superadmin' AND
     public.current_user_school_id() != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(f.total_amount), 0)::NUMERIC as total_fees,
    COALESCE(SUM(f.paid_amount), 0)::NUMERIC as total_paid,
    COALESCE(SUM(f.due_amount), 0)::NUMERIC as total_due,
    COUNT(*) FILTER (WHERE f.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE f.status = 'partial') as partial_count,
    COUNT(*) FILTER (WHERE f.status = 'paid') as paid_count
  FROM public.fees f
  WHERE f.school_id = p_school_id;
END;
$$;
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
