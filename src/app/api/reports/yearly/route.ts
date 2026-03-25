import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: business } = await supabase
    .from('business_info')
    .select('*')
    .single();

  const { data: sales } = await supabase
    .from('sales')
    .select('sale_date, total_with_vat, total_amount, vat_amount')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate);

  const { data: purchases } = await supabase
    .from('purchases')
    .select('purchase_date, total_amount')
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDate);

  // Group by quarter
  const quarterlyBreakdown = [];
  for (let q = 1; q <= 4; q++) {
    const qStartMonth = (q - 1) * 3 + 1;
    const qEndMonth = q * 3;

    const qSales = (sales || []).filter((s: any) => {
      const m = new Date(s.sale_date).getMonth() + 1;
      return m >= qStartMonth && m <= qEndMonth;
    });
    const qPurchases = (purchases || []).filter((p: any) => {
      const m = new Date(p.purchase_date).getMonth() + 1;
      return m >= qStartMonth && m <= qEndMonth;
    });

    quarterlyBreakdown.push({
      quarter: q,
      revenue: qSales.reduce((sum: number, s: any) => sum + Number(s.total_with_vat), 0),
      cost: qPurchases.reduce((sum: number, p: any) => sum + Number(p.total_amount), 0),
    });
  }

  const totalRevenue = quarterlyBreakdown.reduce((s, q) => s + q.revenue, 0);
  const totalCost = quarterlyBreakdown.reduce((s, q) => s + q.cost, 0);
  const vatRate = business?.vat_rate || 8;
  const pitRate = business?.pit_rate || 1.5;

  return Response.json({
    year,
    business_info: business,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    vat_amount: Math.round(totalRevenue * vatRate / 100),
    pit_amount: Math.round(totalRevenue * pitRate / 100),
    quarterly_breakdown: quarterlyBreakdown,
  });
}
