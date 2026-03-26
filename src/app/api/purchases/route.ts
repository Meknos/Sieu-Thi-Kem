import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from('purchases')
    .select('*, product:products(id, code, name, unit)')
    .order('purchase_date', { ascending: false });

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from) query = query.gte('purchase_date', from);
  if (to) query = query.lte('purchase_date', to);

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

  // Support both single-item (legacy) and multi-item (items[]) requests
  const items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    supplier_name?: string;
    supplier_invoice?: string;
    notes?: string;
    purchase_date?: string;
  }> = body.items
    ? body.items
    : [{ product_id: body.product_id, quantity: body.quantity, unit_price: body.unit_price }];

  if (!items.length || !items[0].product_id) {
    return Response.json({ error: 'Thiếu: product_id, quantity, unit_price' }, { status: 400 });
  }

  const purchase_date = body.purchase_date ?? new Date().toISOString().split('T')[0];
  const supplier_name = body.supplier_name ?? null;
  const supplier_invoice = body.supplier_invoice ?? null;
  const notes = body.notes ?? null;

  // Insert all purchase rows
  const rows = items.map(it => ({
    user_id,
    product_id: it.product_id,
    purchase_date: it.purchase_date ?? purchase_date,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    total_amount: Number(it.quantity) * Number(it.unit_price),
    supplier_name: it.supplier_name ?? supplier_name,
    supplier_invoice: it.supplier_invoice ?? supplier_invoice,
    notes: it.notes ?? notes,
  }));

  const { data, error } = await supabase
    .from('purchases')
    .insert(rows)
    .select('*, product:products(id, code, name, unit)');

  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Update inventory for each product (server-side upsert, reliable regardless of trigger)
  for (const it of items) {
    const qty = Number(it.quantity);
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', it.product_id)
      .eq('user_id', user_id)
      .single();

    if (inv) {
      await supabase.from('inventory').update({
        quantity: Number(inv.quantity) + qty,
        last_updated: new Date().toISOString(),
      }).eq('id', inv.id);
    } else {
      await supabase.from('inventory').insert({
        user_id,
        product_id: it.product_id,
        quantity: qty,
        last_updated: new Date().toISOString(),
      });
    }
  }

  return Response.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const user_id = await getUserId(request);
  if (!user_id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // DB trigger will auto-revert inventory on delete
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}

