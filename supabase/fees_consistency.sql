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