-- ===============================
--  SCHEMA: Student Management System
--  (Phiên bản phù hợp với script.js của bạn)
-- ===============================

-- Xóa bảng cũ nếu tồn tại (chỉ dùng trong môi trường học tập)
DROP TABLE IF EXISTS student CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===============================
--  BẢNG SINH VIÊN
-- ===============================
CREATE TABLE student (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  branch VARCHAR(50) NOT NULL,
  semester INT NOT NULL
);

-- ===============================
--  BẢNG NGƯỜI DÙNG
-- ===============================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(200) NOT NULL -- plaintext để mô phỏng Broken Auth
);

-- ===============================
--  DỮ LIỆU MẪU
-- ===============================
INSERT INTO student (name, branch, semester) VALUES
('Nguyen Van A', 'CSE', 5),
('Tran Thi B', 'ECE', 3),
('Le Van C', 'IT', 2),
('Pham Thi D', 'CE', 4),
('Hoang Van E', 'ME', 6);

INSERT INTO users (username, password) VALUES
('admin', 'admin123'),
('alice', 'password'),
('bob', '123456');

-- ===============================
--  QUYỀN TRUY CẬP (tùy chọn)
-- ===============================
-- Nếu bạn có user riêng (webapp_user), chạy:
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO webapp_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO webapp_user;
