import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
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
    .order('invoice_date', { ascending: false });

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const status = searchParams.get('status');

  if (from) query = query.gte('invoice_date', from);
  if (to) query = query.lte('invoice_date', to);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    // Fallback: try old schema (invoice joined with sales)
    const { data: legacyData } = await supabase
      .from('invoices')
      .select('*, sales:sales(*, product:products(id, code, name, unit))')
      .order('invoice_date', { ascending: false });
    return Response.json(legacyData ?? []);
  }
  return Response.json(data ?? []);
}

// POST: Tạo đơn hàng nhiều mặt hàng với invoice_items
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const user_id = await getUserId(request);
  if (!user_id) return Response.json({ error: 'Unauthorized - vui lòng đăng nhập' }, { status: 401 });

  const {
    invoice_date,
    customer_name,
    customer_address,
    customer_tax_code,
    payment_method = 'cash',
    notes,
    vat_rate = 8,
    items,
    status = 'completed',
  } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Đơn hàng phải có ít nhất 1 mặt hàng' }, { status: 400 });
  }

  // ── Validate inventory for each item ──────────────────────
  for (const item of items) {
    if (!item.product_id) continue;
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('user_id', user_id)
      .single();

    const available = inv?.quantity ?? 0;
    if (available < Number(item.quantity)) {
      return Response.json({
        error: `Không đủ hàng: "${item.product_name}" chỉ còn ${available} ${item.unit || 'cái'}`,
      }, { status: 400 });
    }
  }

  const now = new Date();
  const invoiceNumber =
    `HD${now.getFullYear().toString().slice(-2)}` +
    `${(now.getMonth() + 1).toString().padStart(2, '0')}` +
    `-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const vatNum = Number(vat_rate);
  const saleDate = invoice_date ?? now.toISOString().split('T')[0];

  // Create invoice header with 0 totals (triggers will update them)
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      user_id,
      invoice_number: invoiceNumber,
      invoice_date: saleDate,
      customer_name: customer_name || 'Khách lẻ',
      customer_address: customer_address ?? null,
      customer_tax_code: customer_tax_code ?? null,
      subtotal: 0,
      vat_rate: vatNum,
      vat_amount: 0,
      total_amount: 0,
      payment_method,
      status,
      notes: notes ?? null,
    })
    .select('id, invoice_number')
    .single();

  if (invError) return Response.json({ error: invError.message }, { status: 400 });

  // ── Build invoice_items ──────────────────────────────────
  const itemInserts = await Promise.all(items.map(async (item: any) => {
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    const total = qty * price;
    const itemVat = Math.round(total * vatNum / 100);

    // Get cost price from product
    let costPrice = 0;
    if (item.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('purchase_price')
        .eq('id', item.product_id)
        .single();
      costPrice = prod?.purchase_price ?? 0;
    }

    return {
      invoice_id: invoice.id,
      user_id,
      product_id: item.product_id || null,
      product_name: item.product_name || item.name || 'Không tên',
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

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemInserts);

  if (itemsError) {
    // Rollback invoice if items fail
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return Response.json({ error: `Lỗi tạo chi tiết hóa đơn: ${itemsError.message}` }, { status: 400 });
  }

  // Also insert into legacy sales table for backward compatibility with reports
  const salesInserts = itemInserts.map(item => ({
    user_id,
    invoice_id: invoice.id,
    product_id: item.product_id,
    sale_date: saleDate,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_amount: item.total_price,
    vat_amount: item.vat_amount,
    total_with_vat: item.total_with_vat,
    customer_name: customer_name || 'Khách lẻ',
    customer_address: customer_address ?? null,
    customer_tax_code: customer_tax_code ?? null,
    notes: notes ?? null,
  }));

  // Ignore sales insert error (non-critical, inventory already handled by invoice_items triggers)
  try {
    await supabase.from('sales').insert(salesInserts);
  } catch { /* ignore */ }

  const { data: fullInvoice } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items(*, product:products(id, code, name, unit))
    `)
    .eq('id', invoice.id)
    .single();

  return Response.json(fullInvoice, { status: 201 });
}
