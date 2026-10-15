-- ============================
-- Majors Table
-- ============================
CREATE TABLE IF NOT EXISTS majors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================
-- Staff Table (Doctor + Engineer + Head)
-- ============================
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  national_id VARCHAR(14) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('doctor', 'engineer', 'head')),
  major_id INT REFERENCES majors(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================
-- Majors -> Head (one head per major)
-- ============================
ALTER TABLE majors
  ADD COLUMN IF NOT EXISTS head_staff_id INT REFERENCES staff(id) ON DELETE SET NULL;

-- ============================
-- Students Table
-- ============================
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  national_id VARCHAR(14) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  academic_year VARCHAR(2) NOT NULL CHECK (academic_year IN ('1','2','3','4')),
  major_id INT REFERENCES majors(id) ON DELETE SET NULL,
  password_hash VARCHAR(255) NOT NULL,
  personal_qr TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(6),
  otp_expiry TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','banned')),
  device_fingerprint VARCHAR(255),
  last_login_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================
-- Courses Table
-- ============================
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  course_code VARCHAR(20) UNIQUE NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  major_id INT REFERENCES majors(id) ON DELETE CASCADE,
  academic_year VARCHAR(2) NOT NULL CHECK (academic_year IN ('1','2','3','4')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================
-- Course Staff (doctors + engineers per course)
-- ============================
CREATE TABLE IF NOT EXISTS course_staff (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  staff_id INT REFERENCES staff(id) ON DELETE CASCADE,
  role_in_course VARCHAR(20) NOT NULL CHECK (role_in_course IN ('doctor','engineer')),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, staff_id)
);

-- ============================
-- Enrollments (student <-> course)
-- ============================
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(student_id, course_id)
);

-- ============================
-- Sessions (lectures)
-- ============================
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  created_by INT REFERENCES staff(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================
-- Attendance Records
-- ============================
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  method VARCHAR(20) DEFAULT 'qr_scan' CHECK (method IN ('qr_scan','manual')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);