import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('sales')
    .select('*, product:products(id, code, name, unit), invoice:invoices(invoice_number, status)')
    .order('sale_date', { ascending: false });

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from) query = query.gte('sale_date', from);
  if (to) query = query.lte('sale_date', to);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const user_id = await getUserId(request);
  if (!user_id) {
    return Response.json({ error: 'Unauthorized - vui lòng đăng nhập' }, { status: 401 });
  }

  if (!body.product_id || !body.quantity || !body.unit_price) {
    return Response.json({ error: 'Thiếu: product_id, quantity, unit_price' }, { status: 400 });
  }

  const quantity = Number(body.quantity);
  const unit_price = Number(body.unit_price);
  const subtotal = quantity * unit_price;
  const vat_rate = Number(body.vat_rate ?? 8);
  const vat_amount = Math.round(subtotal * vat_rate / 100);
  const total_with_vat = subtotal + vat_amount;
  const sale_date = body.sale_date ?? new Date().toISOString().split('T')[0];

  // ── Validate tồn kho trước khi bán ──────────────────────
  const { data: inv } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('product_id', body.product_id)
    .eq('user_id', user_id)
    .single();

  const available = inv?.quantity ?? 0;
  if (available < quantity) {
    // Get product name for readable error
    const { data: prod } = await supabase
      .from('products').select('name').eq('id', body.product_id).single();
    return Response.json({
      error: `Không đủ hàng: "${prod?.name || body.product_id}" chỉ còn ${available} ${available === 1 ? 'cái' : 'cái'}, cần ${quantity}`,
    }, { status: 400 });
  }
  // ─────────────────────────────────────────────────────────

  // Auto-create invoice
  let invoice_id: string | null = null;
  if (body.create_invoice !== false) {
    const invoiceNumber =
      `HD${new Date().getFullYear().toString().slice(-2)}` +
      `${(new Date().getMonth() + 1).toString().padStart(2, '0')}` +
      `-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const { data: invoice } = await supabase
      .from('invoices')
      .insert({
        user_id,
        invoice_number: invoiceNumber,
        invoice_date: sale_date,
        customer_name: body.customer_name || 'Khách lẻ',
        customer_address: body.customer_address ?? null,
        customer_tax_code: body.customer_tax_code ?? null,
        subtotal,
        vat_rate,
        vat_amount,
        total_amount: total_with_vat,
        payment_method: body.payment_method ?? 'cash',
        status: 'completed',
        notes: body.notes ?? null,
      })
      .select('id')
      .single();

    invoice_id = invoice?.id ?? null;
  }

  // DB trigger (tr_sale_inventory) will auto-deduct inventory after INSERT
  const { data, error } = await supabase
    .from('sales')
    .insert({
      user_id,
      product_id: body.product_id,
      invoice_id,
      sale_date,
      quantity,
      unit_price,
      total_amount: subtotal,
      vat_amount,
      total_with_vat,
      customer_name: body.customer_name ?? null,
      customer_address: body.customer_address ?? null,
      customer_tax_code: body.customer_tax_code ?? null,
      notes: body.notes ?? null,
    })
    .select('*, product:products(id, code, name, unit), invoice:invoices(invoice_number)')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const user_id = await getUserId(request);
  if (!user_id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // DB trigger will auto-revert inventory on sale delete
  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}

