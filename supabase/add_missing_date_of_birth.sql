-- Add missing date_of_birth column to students table
-- Run this in Supabase SQL Editor if students.date_of_birth column is missing

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'date_of_birth';
