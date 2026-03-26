import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const user_id = await getUserId(request);
  if (!user_id) {
    return Response.json({ error: 'Unauthorized - vui lòng đăng nhập' }, { status: 401 });
  }

  const { items, purchase_date, supplier_name, supplier_invoice } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Không có dữ liệu hàng hóa' }, { status: 400 });
  }

  const results = { success: 0, failed: 0, new_products: 0, errors: [] as string[] };

  for (const item of items) {
    try {
      let product_id: string | null = null;

      // Match by code
      const { data: byCode } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user_id)
        .eq('code', item.product_code ?? '')
        .maybeSingle();

      if (byCode?.id) {
        product_id = byCode.id;
      } else {
        // Match by name
        const { data: byName } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', user_id)
          .ilike('name', item.product_name ?? '')
          .maybeSingle();

        if (byName?.id) {
          product_id = byName.id;
        } else {
          // Create new product
          const { data: newProd, error: prodErr } = await supabase
            .from('products')
            .insert({
              user_id,
              code: item.product_code || `AUTO-${Date.now()}`,
              name: item.product_name,
              unit: item.unit ?? 'cái',
              purchase_price: Number(item.unit_price) ?? 0,
              selling_price: Math.round((Number(item.unit_price) ?? 0) * 1.15),
            })
            .select('id')
            .single();

          if (prodErr) throw new Error(`Tạo SP thất bại: ${prodErr.message}`);
          product_id = newProd.id;
          results.new_products++;
        }
      }

      const quantity = Number(item.quantity);
      const unit_price = Number(item.unit_price);

      const { error: purchErr } = await supabase
        .from('purchases')
        .insert({
          user_id,
          product_id,
          purchase_date: purchase_date ?? new Date().toISOString().split('T')[0],
          quantity,
          unit_price,
          total_amount: quantity * unit_price,
          supplier_name: supplier_name ?? null,
          supplier_invoice: supplier_invoice ?? null,
          notes: 'Import từ file hóa đơn',
        });

      if (purchErr) throw new Error(purchErr.message);
      results.success++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${item.product_name}: ${err.message}`);
    }
  }

  return Response.json(results, {
    status: results.success > 0 ? 200 : 400,
  });
}
