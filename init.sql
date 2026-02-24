CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  reservation_id VARCHAR(50) UNIQUE NOT NULL,
  property_id VARCHAR(50) NOT NULL,
  guest_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests INTEGER NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  guest_first_name VARCHAR(100),
  guest_last_name VARCHAR(100),
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  webhook_id VARCHAR(50),
  event_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guests (
  guest_id VARCHAR(50) PRIMARY KEY NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50)
)