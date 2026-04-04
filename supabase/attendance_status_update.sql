-- Update attendance table to support more status types and add subject/period
-- This script fixes the database schema to match the code requirements

-- Step 1: Drop the old status constraint
ALTER TABLE public.attendance
DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Step 2: Add the new status constraint that allows 'present', 'absent', 'late', 'leave'
ALTER TABLE public.attendance
ADD CONSTRAINT attendance_status_check
CHECK (status IN ('present', 'absent', 'late', 'leave'));

-- Step 3: Add subject and period columns if they don't exist
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS period text;

-- Step 4: Add indexes for the new columns (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON public.attendance(subject);
CREATE INDEX IF NOT EXISTS idx_attendance_period ON public.attendance(period);

-- Step 5: Make attendance unique per student, date, class, subject, and period
ALTER TABLE public.attendance
DROP CONSTRAINT IF EXISTS attendance_student_id_attendance_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_context_unique
ON public.attendance(student_id, attendance_date, class_id, subject, period);
