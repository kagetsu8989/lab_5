CREATE DATABASE IF NOT EXISTS lost_found_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lost_found_db;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lost_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  lost_date DATE NOT NULL,
  lost_location VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'reported',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lost_items_user FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Туршилтын хэрэглэгч нэмэх (production нууц үг биш, зөвхөн FK тестэд ашиглана)
INSERT INTO users (name, email, password_hash)
VALUES ('Test User', 'test@example.com', 'test-only-placeholder')
ON DUPLICATE KEY UPDATE name = VALUES(name);

SELECT user_id, name, email FROM users;
SELECT * FROM lost_items;
