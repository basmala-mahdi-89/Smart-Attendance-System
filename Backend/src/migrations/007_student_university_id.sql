-- University / student code (e.g. 2530604), separate from the 14-digit national ID.
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_id VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_students_university_id ON students (university_id);
