import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient();
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from('products')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerClient();
  const { id } = await params;

  // Check current inventory — cannot delete if stock > 0
  const { data: inv } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('product_id', id)
    .single();

  if (inv && Number(inv.quantity) > 0) {
    return Response.json({
      error: `Không thể xóa: sản phẩm còn ${inv.quantity} trong tồn kho. Hãy bán hoặc điều chỉnh về 0 trước.`,
    }, { status: 400 });
  }

  // Soft-delete the product
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Remove inventory record (already 0, clean up)
  await supabase.from('inventory').delete().eq('product_id', id);

  return Response.json({ success: true });
}
