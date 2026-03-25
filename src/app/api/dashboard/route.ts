import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [
    { count: totalProducts },
    { data: salesToday },
    { data: salesMonth },
    { data: salesYear },
    { data: purchasesMonth },
    { data: lowStock },
    { count: invoicesMonth },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('sales').select('total_with_vat').gte('sale_date', today),
    supabase.from('sales').select('total_with_vat, vat_amount').gte('sale_date', monthStart),
    supabase.from('sales').select('total_with_vat').gte('sale_date', yearStart),
    supabase.from('purchases').select('total_amount').gte('purchase_date', monthStart),
    supabase.from('inventory').select('*').lt('quantity', 10),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).gte('invoice_date', monthStart),
  ]);

  return Response.json({
    total_products: totalProducts || 0,
    total_revenue_today: salesToday?.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0) || 0,
    total_revenue_month: salesMonth?.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0) || 0,
    total_revenue_year: salesYear?.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0) || 0,
    total_purchases_month: purchasesMonth?.reduce((s: number, r: any) => s + Number(r.total_amount), 0) || 0,
    low_stock_count: lowStock?.length || 0,
    total_invoices_month: invoicesMonth || 0,
    vat_payable_month: salesMonth?.reduce((s: number, r: any) => s + Number(r.vat_amount), 0) || 0,
  });
}
