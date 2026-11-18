-- ============================
-- Fix staff uniqueness on major_id
--
-- `unique_head_major` was declared as a UNIQUE constraint on staff(major_id)
-- for every row, which made it impossible to have more than one staff member
-- (e.g. a head + a doctor) in the same major. The intent is one HEAD per
-- major, so replace it with a partial unique index scoped to role = 'head'.
-- ============================
ALTER TABLE staff DROP CONSTRAINT IF EXISTS unique_head_major;
DROP INDEX IF EXISTS unique_head_major;

CREATE UNIQUE INDEX IF NOT EXISTS unique_head_per_major
  ON staff (major_id)
  WHERE role = 'head';
