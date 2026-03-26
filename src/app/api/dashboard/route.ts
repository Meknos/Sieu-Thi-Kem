import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];
  const yearStart = `${new Date().getFullYear()}-01-01`;

  // Only count revenue from COMPLETED invoices via sales linked to completed invoices
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

    // Revenue today: only sales linked to completed invoices (or standalone sales without invoice)
    supabase.from('sales')
      .select('total_with_vat, vat_amount, invoice:invoices(status)')
      .gte('sale_date', today),

    supabase.from('sales')
      .select('total_with_vat, vat_amount, invoice:invoices(status)')
      .gte('sale_date', monthStart),

    supabase.from('sales')
      .select('total_with_vat, invoice:invoices(status)')
      .gte('sale_date', yearStart),

    supabase.from('purchases')
      .select('total_amount')
      .gte('purchase_date', monthStart),

    supabase.from('inventory').select('*').lt('quantity', 10),

    supabase.from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('invoice_date', monthStart),
  ]);

  // Filter: only count sales where invoice is completed OR no invoice linked
  function isCountable(sale: any): boolean {
    if (!sale.invoice) return true; // standalone sale (no invoice) → count
    const inv = Array.isArray(sale.invoice) ? sale.invoice[0] : sale.invoice;
    return !inv || inv.status === 'completed';
  }

  const countableToday = (salesToday || []).filter(isCountable);
  const countableMonth = (salesMonth || []).filter(isCountable);
  const countableYear = (salesYear || []).filter(isCountable);

  return Response.json({
    total_products: totalProducts || 0,
    total_revenue_today: countableToday.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0),
    total_revenue_month: countableMonth.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0),
    total_revenue_year: countableYear.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0),
    total_purchases_month: (purchasesMonth || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0),
    low_stock_count: lowStock?.length || 0,
    total_invoices_month: invoicesMonth || 0,
    vat_payable_month: countableMonth.reduce((s: number, r: any) => s + Number(r.vat_amount), 0),
  });
}
