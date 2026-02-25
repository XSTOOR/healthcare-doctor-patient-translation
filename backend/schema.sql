-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('doctor', 'patient') NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  patient_id INT NOT NULL,
  doctor_language VARCHAR(10) DEFAULT 'en',
  patient_language VARCHAR(10) NOT NULL,
  status ENUM('active', 'ended', 'archived') DEFAULT 'active',
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_doctor (doctor_id),
  INDEX idx_patient (patient_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_role ENUM('doctor', 'patient') NOT NULL,
  original_text TEXT,
  translated_text TEXT,
  audio_url VARCHAR(500),
  audio_duration INT,
  message_type ENUM('text', 'audio') DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conversation (conversation_id),
  INDEX idx_sender (sender_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  symptoms TEXT,
  diagnosis TEXT,
  medications TEXT,
  follow_up_actions TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_by INT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_conversation (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert demo users (password: password)
INSERT INTO users (email, password, role, first_name, last_name) VALUES
('doctor@demo.com', '$2a$10$YourHashedPasswordHere', 'doctor', 'Dr. Sarah', 'Johnson'),
('patient@demo.com', '$2a$10$YourHashedPasswordHere', 'patient', 'Maria', 'Garcia')
ON DUPLICATE KEY UPDATE email=email;
