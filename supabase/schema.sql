-- =============================================
-- HÓA ĐƠN APP - Database Schema for Supabase
-- Sổ kế toán hộ kinh doanh theo mẫu S2a-HKD
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS (managed by Supabase Auth, extended here)
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. BUSINESS_INFO (thông tin hộ kinh doanh)
-- =============================================
CREATE TABLE IF NOT EXISTS public.business_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,           -- Tên hộ kinh doanh
  owner_name TEXT NOT NULL,              -- Tên chủ hộ
  tax_code TEXT,                          -- Mã số thuế
  address TEXT,                           -- Địa chỉ
  phone TEXT,                             -- Số điện thoại
  bank_account TEXT,                      -- Số tài khoản ngân hàng
  bank_name TEXT,                         -- Tên ngân hàng
  business_type TEXT DEFAULT 'retail',    -- Loại hình: retail, service, production
  vat_rate DECIMAL(5,2) DEFAULT 8.00,    -- Thuế GTGT (%)
  pit_rate DECIMAL(5,2) DEFAULT 1.50,    -- Thuế TNCN (%)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =============================================
-- 3. PRODUCTS (hàng hóa/dịch vụ)
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                     -- Mã hàng hóa
  name TEXT NOT NULL,                     -- Tên hàng hóa
  unit TEXT NOT NULL DEFAULT 'cái',       -- Đơn vị tính
  purchase_price DECIMAL(15,2) DEFAULT 0, -- Giá mua
  selling_price DECIMAL(15,2) DEFAULT 0,  -- Giá bán
  category TEXT,                           -- Danh mục
  description TEXT,                        -- Mô tả
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, code)
);

-- =============================================
-- 4. PURCHASES (nhập hàng / mua vào)
-- =============================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity DECIMAL(15,2) NOT NULL,         -- Số lượng
  unit_price DECIMAL(15,2) NOT NULL,       -- Đơn giá
  total_amount DECIMAL(15,2) NOT NULL,     -- Thành tiền
  supplier_name TEXT,                       -- Tên nhà cung cấp
  supplier_invoice TEXT,                    -- Số hóa đơn nhà cung cấp
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. SALES (bán hàng / xuất ra)
-- =============================================
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_id UUID,                         -- Liên kết hóa đơn
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity DECIMAL(15,2) NOT NULL,          -- Số lượng
  unit_price DECIMAL(15,2) NOT NULL,        -- Đơn giá
  total_amount DECIMAL(15,2) NOT NULL,      -- Thành tiền (trước thuế)
  vat_amount DECIMAL(15,2) DEFAULT 0,       -- Tiền thuế GTGT
  total_with_vat DECIMAL(15,2) DEFAULT 0,   -- Tổng tiền (sau thuế)
  customer_name TEXT,                        -- Tên khách hàng
  customer_address TEXT,
  customer_tax_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. INVENTORY (tồn kho - tự động tính)
-- =============================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity DECIMAL(15,2) DEFAULT 0,         -- Số lượng tồn
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- =============================================
-- 7. INVOICES (hóa đơn bán hàng)
-- =============================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,             -- Số hóa đơn
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,              -- Tên khách hàng
  customer_address TEXT,
  customer_tax_code TEXT,
  subtotal DECIMAL(15,2) DEFAULT 0,         -- Tổng tiền hàng (trước thuế)
  vat_rate DECIMAL(5,2) DEFAULT 8.00,       -- Thuế suất GTGT
  vat_amount DECIMAL(15,2) DEFAULT 0,       -- Tiền thuế GTGT
  total_amount DECIMAL(15,2) DEFAULT 0,     -- Tổng thanh toán
  payment_method TEXT DEFAULT 'cash',       -- Phương thức: cash, transfer, card
  status TEXT DEFAULT 'completed',          -- Status: draft, completed, cancelled
  pdf_url TEXT,                              -- URL file PDF trên Supabase Storage
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, invoice_number)
);

-- Add foreign key from sales to invoices
ALTER TABLE public.sales
  ADD CONSTRAINT fk_sales_invoice
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- =============================================
-- TRIGGERS: Tự động cập nhật tồn kho
-- =============================================

-- Function: Cập nhật tồn kho khi nhập hàng
CREATE OR REPLACE FUNCTION update_inventory_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory (user_id, product_id, quantity)
  VALUES (NEW.user_id, NEW.product_id, NEW.quantity)
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET
    quantity = inventory.quantity + NEW.quantity,
    last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Cập nhật tồn kho khi bán hàng
CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory (user_id, product_id, quantity)
  VALUES (NEW.user_id, NEW.product_id, -NEW.quantity)
  ON CONFLICT (user_id, product_id)
  DO UPDATE SET
    quantity = inventory.quantity - NEW.quantity,
    last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER tr_purchase_inventory
  AFTER INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION update_inventory_on_purchase();

CREATE TRIGGER tr_sale_inventory
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION update_inventory_on_sale();

CREATE TRIGGER tr_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_business_updated
  BEFORE UPDATE ON public.business_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_purchases_updated
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_sales_updated
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- AUTO-CREATE USER ROW ON SUPABASE AUTH SIGNUP
-- Bắt buộc: khi user đăng ký Auth → tự tạo row trong public.users
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER tr_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- INVENTORY CORRECTION ON DELETE
-- Khi xóa purchase → trừ lại tồn kho
-- Khi xóa sale → cộng lại tồn kho
-- =============================================
CREATE OR REPLACE FUNCTION revert_inventory_on_purchase_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = quantity - OLD.quantity, last_updated = NOW()
  WHERE user_id = OLD.user_id AND product_id = OLD.product_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION revert_inventory_on_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inventory
  SET quantity = quantity + OLD.quantity, last_updated = NOW()
  WHERE user_id = OLD.user_id AND product_id = OLD.product_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_purchase_delete_inventory
  AFTER DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION revert_inventory_on_purchase_delete();

CREATE TRIGGER tr_sale_delete_inventory
  AFTER DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION revert_inventory_on_sale_delete();


-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Business info policies
CREATE POLICY "Users can manage own business" ON public.business_info
  FOR ALL USING (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Users can manage own products" ON public.products
  FOR ALL USING (auth.uid() = user_id);

-- Purchases policies
CREATE POLICY "Users can manage own purchases" ON public.purchases
  FOR ALL USING (auth.uid() = user_id);

-- Sales policies
CREATE POLICY "Users can manage own sales" ON public.sales
  FOR ALL USING (auth.uid() = user_id);

-- Inventory policies
CREATE POLICY "Users can view own inventory" ON public.inventory
  FOR ALL USING (auth.uid() = user_id);

-- Invoices policies
CREATE POLICY "Users can manage own invoices" ON public.invoices
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_products_user ON public.products(user_id);
CREATE INDEX idx_purchases_user_date ON public.purchases(user_id, purchase_date);
CREATE INDEX idx_sales_user_date ON public.sales(user_id, sale_date);
CREATE INDEX idx_inventory_user ON public.inventory(user_id);
CREATE INDEX idx_invoices_user_date ON public.invoices(user_id, invoice_date);
CREATE INDEX idx_invoices_number ON public.invoices(invoice_number);

-- =============================================
-- STORAGE BUCKET for PDF invoices
-- =============================================
-- Run in Supabase Dashboard > Storage:
-- Create bucket: 'invoices' (public or private as needed)
