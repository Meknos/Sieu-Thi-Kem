import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth-helper';

export async function GET(_req: NextRequest) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

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

  if (!body.code || !body.name || !body.unit) {
    return Response.json({ error: 'Thiếu thông tin bắt buộc: code, name, unit' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id,
      code: body.code,
      name: body.name,
      unit: body.unit,
      purchase_price: body.purchase_price ?? 0,
      selling_price: body.selling_price ?? 0,
      category: body.category ?? null,
      description: body.description ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return Response.json({ error: 'Missing product id' }, { status: 400 });

  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return Response.json({ error: 'Missing product id' }, { status: 400 });

  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}
