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