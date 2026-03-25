import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('*, sales:sales(*, product:products(*))')
    .eq('id', id)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  return Response.json(data);
}
