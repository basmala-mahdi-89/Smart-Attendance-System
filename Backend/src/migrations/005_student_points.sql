-- ============================
-- Student bonus / penalty points
-- Awarded by doctors, engineers (teaching assistants) and heads/deans
-- ============================
CREATE TABLE IF NOT EXISTS student_points (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
  staff_id INT REFERENCES staff(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('bonus', 'penalty')),
  points INT NOT NULL DEFAULT 1 CHECK (points BETWEEN 1 AND 20),
  reason VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_points_student ON student_points(student_id);
CREATE INDEX IF NOT EXISTS idx_student_points_course ON student_points(course_id);
CREATE INDEX IF NOT EXISTS idx_student_points_session ON student_points(session_id);
CREATE INDEX IF NOT EXISTS idx_student_points_created ON student_points(created_at);
