-- Prevent ambassador usernames from being truncated after number 99.
-- Keep the generated identifiers collision-safe when the sequence is out of sync.

CREATE OR REPLACE FUNCTION public.fn_amb_generate_identifiers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_num INTEGER;
  v_code TEXT;
BEGIN
  IF NEW.ambassador_number IS NOT NULL
     OR NEW.username IS NOT NULL
     OR NEW.referral_code IS NOT NULL THEN
    RAISE EXCEPTION 'Os campos ambassador_number, username e referral_code não podem ser fornecidos manualmente. Eles são gerados automaticamente.';
  END IF;

  LOOP
    v_num := nextval('public.ambassador_number_seq');
    v_code := 'bryza' || CASE
      WHEN v_num < 100 THEN lpad(v_num::text, 2, '0')
      ELSE v_num::text
    END;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.ambassadors a
      WHERE a.ambassador_number = v_num
         OR a.username = v_code
         OR a.referral_code = v_code
    );
  END LOOP;

  NEW.ambassador_number := v_num;
  NEW.username := v_code;
  NEW.referral_code := v_code;

  RETURN NEW;
END;
$$;
