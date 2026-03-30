-- Thêm cột box_unit: đơn vị của "thùng/hộp/bao" (mặc định 'thùng' để tương thích ngược)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS box_unit TEXT DEFAULT 'thùng';
