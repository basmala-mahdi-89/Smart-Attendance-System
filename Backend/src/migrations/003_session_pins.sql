-- ============================
-- Session PINs (for offline attendance)
-- ============================
CREATE TABLE IF NOT EXISTS session_pins (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
  pin_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_by INT REFERENCES students(id) ON DELETE SET NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_pins_session_id ON session_pins(session_id);
CREATE INDEX IF NOT EXISTS idx_session_pins_pin_code ON session_pins(pin_code);
CREATE INDEX IF NOT EXISTS idx_session_pins_expires_at ON session_pins(expires_at);
