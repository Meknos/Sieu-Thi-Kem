import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('sales')
    .select('*, product:products(*), invoice:invoices(*)')
    .order('sale_date', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const subtotal = body.quantity * body.unit_price;
  const vat_rate = body.vat_rate || 8;
  const vat_amount = Math.round(subtotal * vat_rate / 100);
  const total_with_vat = subtotal + vat_amount;

  // Create invoice if requested
  let invoice_id = body.invoice_id || null;
  if (body.create_invoice) {
    const invoiceNumber = `HD${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        user_id: body.user_id,
        invoice_number: invoiceNumber,
        invoice_date: body.sale_date,
        customer_name: body.customer_name || 'Khách lẻ',
        customer_address: body.customer_address,
        customer_tax_code: body.customer_tax_code,
        subtotal,
        vat_rate,
        vat_amount,
        total_amount: total_with_vat,
        payment_method: body.payment_method || 'cash',
        status: 'completed',
      })
      .select()
      .single();

    if (!invError && invoice) {
      invoice_id = invoice.id;
    }
  }

  const { data, error } = await supabase
    .from('sales')
    .insert({
      user_id: body.user_id,
      product_id: body.product_id,
      sale_date: body.sale_date,
      quantity: body.quantity,
      unit_price: body.unit_price,
      total_amount: subtotal,
      vat_amount,
      total_with_vat,
      customer_name: body.customer_name,
      customer_address: body.customer_address,
      customer_tax_code: body.customer_tax_code,
      invoice_id,
      notes: body.notes,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json(data, { status: 201 });
}
