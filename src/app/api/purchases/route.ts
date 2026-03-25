import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('purchases')
    .select('*, product:products(*)')
    .order('purchase_date', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const total_amount = body.quantity * body.unit_price;

  const { data, error } = await supabase
    .from('purchases')
    .insert({ ...body, total_amount })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json(data, { status: 201 });
}
