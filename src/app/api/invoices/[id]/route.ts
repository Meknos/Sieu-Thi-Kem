/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

// GET /api/invoices/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items(
        id, product_id, product_name, product_code, unit,
        quantity, unit_price, cost_price, total_price,
        vat_rate, vat_amount, total_with_vat,
        product:products(id, code, name, unit, purchase_price, selling_price)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    // Fallback to legacy schema
    const { data: legacy } = await supabase
      .from('invoices')
      .select('*, sales:sales(*, product:products(id, code, name, unit))')
      .eq('id', id)
      .single();
    if (!legacy) return Response.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    return Response.json(legacy);
  }
  return Response.json(data);
}

// PATCH /api/invoices/[id] — sửa header hoặc toàn bộ hóa đơn
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const user_id = await getUserId(request);
  const body = await request.json();

  // ── Nếu có items → cập nhật chi tiết hóa đơn ──────────
  if (body.items && Array.isArray(body.items)) {
    if (!user_id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const vatNum = Number(body.vat_rate ?? 8);

    // Get current items to calculate inventory diff
    const { data: currentItems } = await supabase
      .from('invoice_items')
      .select('id, product_id, quantity')
      .eq('invoice_id', id);

    // Validate new inventory for each item
    for (const item of body.items) {
      if (!item.product_id) continue;
      const currentQty = currentItems?.find(ci => ci.product_id === item.product_id)?.quantity ?? 0;
      const newQty = Number(item.quantity);
      const qtyDiff = newQty - currentQty; // additional qty needed

      if (qtyDiff > 0) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', item.product_id)
          .eq('user_id', user_id)
          .single();

        const available = inv?.quantity ?? 0;
        if (available < qtyDiff) {
          return Response.json({
            error: `Không đủ hàng: "${item.product_name}" cần thêm ${qtyDiff}, chỉ còn ${available}`,
          }, { status: 400 });
        }
      }
    }

    // Delete old items (triggers will revert inventory)
    await supabase.from('invoice_items').delete().eq('invoice_id', id);

    // Insert new items (triggers will deduct inventory)
    const newItems = await Promise.all(body.items.map(async (item: any) => {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const total = qty * price;
      const itemVat = Math.round(total * vatNum / 100);

      let costPrice = item.cost_price ?? 0;
      if (item.product_id && !costPrice) {
        const { data: prod } = await supabase
          .from('products').select('purchase_price').eq('id', item.product_id).single();
        costPrice = prod?.purchase_price ?? 0;
      }

      return {
        invoice_id: id,
        user_id,
        product_id: item.product_id || null,
        product_name: item.product_name || item.name || '',
        product_code: item.product_code || item.code || null,
        unit: item.unit || 'cái',
        quantity: qty,
        unit_price: price,
        cost_price: costPrice,
        total_price: total,
        vat_rate: vatNum,
        vat_amount: itemVat,
        total_with_vat: total + itemVat,
      };
    }));

    const { error: itemErr } = await supabase.from('invoice_items').insert(newItems);
    if (itemErr) return Response.json({ error: itemErr.message }, { status: 400 });
  }

  // ── Update invoice header ──────────────────────────────
  const headerUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowedFields = ['customer_name', 'customer_address', 'customer_tax_code',
    'payment_method', 'status', 'notes', 'invoice_date', 'vat_rate'];
  for (const f of allowedFields) {
    if (body[f] !== undefined) headerUpdate[f] = body[f];
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(headerUpdate)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}

// DELETE /api/invoices/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const user_id = await getUserId(request);
  if (!user_id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Delete invoice_items first (triggers revert inventory)
  await supabase.from('invoice_items').delete().eq('invoice_id', id);

  // Delete legacy sales (triggers revert inventory for old records)
  await supabase.from('sales').delete().eq('invoice_id', id).eq('user_id', user_id);

  // Delete invoice
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}
