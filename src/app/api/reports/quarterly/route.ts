/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const quarter = parseInt(searchParams.get('quarter') || String(Math.ceil((new Date().getMonth() + 1) / 3)));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, endMonth, 0).toISOString().split('T')[0];

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

  // Group by month
  const monthlyBreakdown = [];
  for (let m = startMonth; m <= endMonth; m++) {
    const monthSales = (sales || []).filter((s: any) => {
      const sMonth = new Date(s.sale_date).getMonth() + 1;
      return sMonth === m;
    });
    const monthPurchases = (purchases || []).filter((p: any) => {
      const pMonth = new Date(p.purchase_date).getMonth() + 1;
      return pMonth === m;
    });

    monthlyBreakdown.push({
      month: m,
      revenue: monthSales.reduce((sum: number, s: any) => sum + Number(s.total_with_vat), 0),
      cost: monthPurchases.reduce((sum: number, p: any) => sum + Number(p.total_amount), 0),
    });
  }

  const totalRevenue = monthlyBreakdown.reduce((s, m) => s + m.revenue, 0);
  const totalCost = monthlyBreakdown.reduce((s, m) => s + m.cost, 0);
  const vatRate = business?.vat_rate || 8;
  const pitRate = business?.pit_rate || 1.5;

  return Response.json({
    quarter,
    year,
    business_info: business,
    total_revenue: totalRevenue,
    total_cost: totalCost,
    vat_amount: Math.round(totalRevenue * vatRate / 100),
    pit_amount: Math.round(totalRevenue * pitRate / 100),
    monthly_breakdown: monthlyBreakdown,
  });
}
