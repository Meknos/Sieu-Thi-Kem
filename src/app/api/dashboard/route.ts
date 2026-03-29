/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();

  const user_id = await getUserId(request);
  if (!user_id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    // Đếm sản phẩm: is_active=true HOẶC còn tồn kho > 0
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('is_active', true),

    supabase
      .from('sales')
      .select('total_with_vat, vat_amount, invoice:invoices(status)')
      .eq('user_id', user_id)
      .gte('sale_date', today),

    supabase
      .from('sales')
      .select('total_with_vat, vat_amount, invoice:invoices(status)')
      .eq('user_id', user_id)
      .gte('sale_date', monthStart),

    supabase
      .from('sales')
      .select('total_with_vat, invoice:invoices(status)')
      .eq('user_id', user_id)
      .gte('sale_date', yearStart),

    supabase
      .from('purchases')
      .select('total_amount')
      .eq('user_id', user_id)
      .gte('purchase_date', monthStart),

    // Tồn kho thấp: < 10 cái, theo user
    supabase
      .from('inventory')
      .select('quantity')
      .eq('user_id', user_id)
      .gt('quantity', 0)   // chỉ đếm còn hàng nhưng sắp hết
      .lt('quantity', 10),

    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('status', 'completed')
      .gte('invoice_date', monthStart),
  ]);

  // Filter: chỉ tính sales có invoice completed HOẶC không có invoice
  function isCountable(sale: any): boolean {
    if (!sale.invoice) return true;
    const inv = Array.isArray(sale.invoice) ? sale.invoice[0] : sale.invoice;
    return !inv || inv.status === 'completed';
  }

  const countableToday = (salesToday || []).filter(isCountable);
  const countableMonth = (salesMonth || []).filter(isCountable);
  const countableYear = (salesYear || []).filter(isCountable);

  return Response.json({
    total_products: totalProducts || 0,
    total_revenue_today:   countableToday.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0),
    total_revenue_month:   countableMonth.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0),
    total_revenue_year:    countableYear.reduce((s: number, r: any) => s + Number(r.total_with_vat), 0),
    total_purchases_month: (purchasesMonth || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0),
    low_stock_count:       lowStock?.length || 0,
    total_invoices_month:  invoicesMonth || 0,
    vat_payable_month:     countableMonth.reduce((s: number, r: any) => s + Number(r.vat_amount), 0),
  });
}
