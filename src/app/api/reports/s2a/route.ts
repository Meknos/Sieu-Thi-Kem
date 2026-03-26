/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  // Get date range for the month
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  // Get business info
  const { data: business } = await supabase
    .from('business_info')
    .select('*')
    .single();

  // Get sales for the month
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*, product:products(*), invoice:invoices(*)')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .order('sale_date', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Build S2a data
  const rows = (sales || []).map((sale: any) => ({
    date: sale.sale_date,
    invoice_number: sale.invoice?.invoice_number || '—',
    description: `Bán ${sale.product?.name || 'hàng hóa'}`,
    revenue: sale.total_with_vat,
  }));

  const total_revenue = rows.reduce((sum: number, r: any) => sum + r.revenue, 0);
  const vat_rate = business?.vat_rate || 8;
  const pit_rate = business?.pit_rate || 1.5;

  const report = {
    business_name: business?.business_name || 'Chưa cập nhật',
    owner_name: business?.owner_name || 'Chưa cập nhật',
    tax_code: business?.tax_code || '',
    address: business?.address || '',
    period: `Tháng ${month}`,
    month,
    year,
    rows,
    total_revenue,
    vat_amount: Math.round(total_revenue * vat_rate / 100),
    pit_amount: Math.round(total_revenue * pit_rate / 100),
  };

  return Response.json(report);
}
