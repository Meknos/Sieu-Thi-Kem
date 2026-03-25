// =============================================
// Database Types
// =============================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessInfo {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string;
  tax_code?: string;
  address?: string;
  phone?: string;
  bank_account?: string;
  bank_name?: string;
  business_type: 'retail' | 'service' | 'production';
  vat_rate: number;
  pit_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  code: string;
  name: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  category?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  product_id: string;
  purchase_date: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  supplier_name?: string;
  supplier_invoice?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  product?: Product;
}

export interface Sale {
  id: string;
  user_id: string;
  invoice_id?: string;
  product_id: string;
  sale_date: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_amount: number;
  total_with_vat: number;
  customer_name?: string;
  customer_address?: string;
  customer_tax_code?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  product?: Product;
  invoice?: Invoice;
}

export interface Inventory {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  last_updated: string;
  // Joined
  product?: Product;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_address?: string;
  customer_tax_code?: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  payment_method: 'cash' | 'transfer' | 'card';
  status: 'draft' | 'completed' | 'cancelled';
  pdf_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  sales?: Sale[];
}

// =============================================
// Form / Input Types
// =============================================

export interface ProductInput {
  code: string;
  name: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  category?: string;
  description?: string;
}

export interface PurchaseInput {
  product_id: string;
  purchase_date: string;
  quantity: number;
  unit_price: number;
  supplier_name?: string;
  supplier_invoice?: string;
  notes?: string;
}

export interface SaleInput {
  product_id: string;
  sale_date: string;
  quantity: number;
  unit_price: number;
  customer_name?: string;
  customer_address?: string;
  customer_tax_code?: string;
  notes?: string;
}

export interface InvoiceInput {
  invoice_date: string;
  customer_name: string;
  customer_address?: string;
  customer_tax_code?: string;
  payment_method: 'cash' | 'transfer' | 'card';
  items: SaleInput[];
  notes?: string;
}

// =============================================
// Report Types
// =============================================

export interface S2aRow {
  date: string;
  invoice_number: string;
  description: string;
  revenue: number;
  cost?: number;
  notes?: string;
}

export interface S2aReport {
  business_name: string;
  owner_name: string;
  tax_code: string;
  address: string;
  period: string;
  year: number;
  rows: S2aRow[];
  total_revenue: number;
  vat_amount: number;
  pit_amount: number;
}

export interface QuarterlyReport {
  quarter: number;
  year: number;
  business_info: BusinessInfo;
  total_revenue: number;
  total_cost: number;
  vat_amount: number;
  pit_amount: number;
  monthly_breakdown: {
    month: number;
    revenue: number;
    cost: number;
  }[];
}

export interface YearlyReport {
  year: number;
  business_info: BusinessInfo;
  total_revenue: number;
  total_cost: number;
  vat_amount: number;
  pit_amount: number;
  quarterly_breakdown: {
    quarter: number;
    revenue: number;
    cost: number;
  }[];
}

// =============================================
// Dashboard Types
// =============================================

export interface DashboardStats {
  total_products: number;
  total_revenue_today: number;
  total_revenue_month: number;
  total_revenue_year: number;
  total_purchases_month: number;
  low_stock_count: number;
  total_invoices_month: number;
  vat_payable_month: number;
}
