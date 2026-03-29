-- Migration: Thêm cột box_quantity vào bảng products
-- Chạy trong Supabase SQL Editor

ALTER TABLE products
ADD COLUMN IF NOT EXISTS box_quantity INTEGER DEFAULT NULL;

COMMENT ON COLUMN products.box_quantity IS 'Số lượng cái trong 1 thùng. NULL = không dùng đơn vị thùng.';
