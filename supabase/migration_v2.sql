-- =============================================
-- MIGRATION: Cải tiến toàn diện hệ thống
-- Mục tiêu: Đồng bộ dữ liệu, tồn kho chính xác,
--           báo cáo đúng nghiệp vụ
-- =============================================

-- =============================================
-- 1. CATEGORIES (danh mục hàng hóa)
-- =============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_categories_user ON public.categories(user_id);

-- Add FK category_id to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- =============================================
-- 2. INVOICE_ITEMS (chi tiết hóa đơn)
-- Tách riêng khỏi sales để dễ sửa từng dòng
-- =============================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,   -- Snapshot tên tại thời điểm bán
  product_code TEXT,
  unit TEXT DEFAULT 'cái',
  quantity DECIMAL(15,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,       -- Giá bán
  cost_price DECIMAL(15,2) DEFAULT 0,      -- Giá vốn (từ purchase_price lúc bán)
  total_price DECIMAL(15,2) NOT NULL,      -- quantity * unit_price
  vat_rate DECIMAL(5,2) DEFAULT 8,
  vat_amount DECIMAL(15,2) DEFAULT 0,
  total_with_vat DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own invoice_items" ON public.invoice_items
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON public.invoice_items(product_id);

-- =============================================
-- 3. TRIGGER: Auto-update invoice totals
-- Khi thêm/sửa/xóa invoice_item → cập nhật
-- invoice.subtotal, vat_amount, total_amount
-- =============================================
CREATE OR REPLACE FUNCTION sync_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_sub DECIMAL(15,2);
  v_vat DECIMAL(15,2);
  v_total DECIMAL(15,2);
BEGIN
  -- Determine which invoice to update
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- Recalculate totals from all items
  SELECT
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(vat_amount), 0),
    COALESCE(SUM(total_with_vat), 0)
  INTO v_sub, v_vat, v_total
  FROM public.invoice_items
  WHERE invoice_id = v_invoice_id;

  UPDATE public.invoices
  SET
    subtotal = v_sub,
    vat_amount = v_vat,
    total_amount = v_total,
    updated_at = NOW()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_invoice_items_sync ON public.invoice_items;
CREATE TRIGGER tr_invoice_items_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_totals();

-- =============================================
-- 4. TRIGGER: Inventory management for invoice_items
-- INSERT → giảm tồn
-- DELETE → tăng tồn
-- UPDATE → điều chỉnh theo chênh lệch
-- =============================================
CREATE OR REPLACE FUNCTION update_inventory_on_item_insert()
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

CREATE OR REPLACE FUNCTION update_inventory_on_item_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.product_id IS NOT NULL THEN
    UPDATE public.inventory
    SET quantity = quantity + OLD.quantity, last_updated = NOW()
    WHERE user_id = OLD.user_id AND product_id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_inventory_on_item_update()
RETURNS TRIGGER AS $$
DECLARE
  v_diff DECIMAL(15,2);
BEGIN
  -- Only process if quantity or product changed
  IF OLD.product_id = NEW.product_id THEN
    v_diff := NEW.quantity - OLD.quantity;
    IF v_diff <> 0 THEN
      UPDATE public.inventory
      SET quantity = quantity - v_diff, last_updated = NOW()
      WHERE user_id = NEW.user_id AND product_id = NEW.product_id;
    END IF;
  ELSE
    -- Product changed: revert old, apply new
    IF OLD.product_id IS NOT NULL THEN
      UPDATE public.inventory
      SET quantity = quantity + OLD.quantity, last_updated = NOW()
      WHERE user_id = OLD.user_id AND product_id = OLD.product_id;
    END IF;
    INSERT INTO public.inventory (user_id, product_id, quantity)
    VALUES (NEW.user_id, NEW.product_id, -NEW.quantity)
    ON CONFLICT (user_id, product_id)
    DO UPDATE SET quantity = inventory.quantity - NEW.quantity, last_updated = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_item_inv_insert ON public.invoice_items;
DROP TRIGGER IF EXISTS tr_item_inv_delete ON public.invoice_items;
DROP TRIGGER IF EXISTS tr_item_inv_update ON public.invoice_items;

CREATE TRIGGER tr_item_inv_insert
  AFTER INSERT ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_on_item_insert();

CREATE TRIGGER tr_item_inv_delete
  AFTER DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_on_item_delete();

CREATE TRIGGER tr_item_inv_update
  AFTER UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_on_item_update();

-- updated_at triggers
CREATE OR REPLACE TRIGGER tr_categories_updated
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER tr_invoice_items_updated
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 5. Populate category_id from existing category text
-- (chạy 1 lần để migrate dữ liệu cũ)
-- =============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, category
    FROM public.products
    WHERE category IS NOT NULL AND category <> ''
  LOOP
    INSERT INTO public.categories (user_id, name)
    VALUES (r.user_id, r.category)
    ON CONFLICT (user_id, name) DO NOTHING;
  END LOOP;

  UPDATE public.products p
  SET category_id = c.id
  FROM public.categories c
  WHERE p.user_id = c.user_id
    AND p.category = c.name
    AND p.category_id IS NULL;
END $$;

-- =============================================
-- GRANT permissions for service role
-- =============================================
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.invoice_items TO service_role;
