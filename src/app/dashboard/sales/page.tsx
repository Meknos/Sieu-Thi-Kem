'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, Receipt, FileDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, calculateVAT, generateInvoiceNumber } from '@/lib/utils';
import type { Sale, Product, SaleInput } from '@/lib/types';
import toast from 'react-hot-toast';

const demoProducts: Product[] = [
  { id: '1', user_id: '', code: 'XM001', name: 'Xi măng PCB40 Hà Tiên', unit: 'bao', purchase_price: 85000, selling_price: 95000, category: '', is_active: true, created_at: '', updated_at: '' },
  { id: '2', user_id: '', code: 'TH001', name: 'Thép cuộn phi 10', unit: 'kg', purchase_price: 14500, selling_price: 16000, category: '', is_active: true, created_at: '', updated_at: '' },
];

const demoSales: (Sale & { product?: Product })[] = [
  { id: '1', user_id: '', product_id: '1', sale_date: '2026-03-25', quantity: 50, unit_price: 95000, total_amount: 4750000, vat_amount: 380000, total_with_vat: 5130000, customer_name: 'Nguyễn Văn A', created_at: '', updated_at: '', product: demoProducts[0] },
  { id: '2', user_id: '', product_id: '2', sale_date: '2026-03-24', quantity: 200, unit_price: 16000, total_amount: 3200000, vat_amount: 256000, total_with_vat: 3456000, customer_name: 'Trần Thị B', created_at: '', updated_at: '', product: demoProducts[1] },
];

export default function SalesPage() {
  const [sales, setSales] = useState<(Sale & { product?: Product })[]>(demoSales);
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<SaleInput>({
    product_id: '',
    sale_date: new Date().toISOString().split('T')[0],
    quantity: 0,
    unit_price: 0,
    customer_name: '',
    customer_address: '',
    customer_tax_code: '',
    notes: '',
  });
  const [createInvoice, setCreateInvoice] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [{ data: productsData }, { data: salesData }] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('sales').select('*, product:products(*)').order('sale_date', { ascending: false }),
      ]);
      if (productsData?.length) setProducts(productsData);
      if (salesData?.length) setSales(salesData);
    } catch { console.log('Using demo data'); }
  }

  const filtered = sales.filter((s) => {
    const matchSearch = !search ||
      s.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      s.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !dateFrom || s.sale_date >= dateFrom;
    const matchTo = !dateTo || s.sale_date <= dateTo;
    return matchSearch && matchFrom && matchTo;
  });

  const totalRevenue = filtered.reduce((s, r) => s + r.total_amount, 0);
  const totalVAT = filtered.reduce((s, r) => s + r.vat_amount, 0);
  const totalWithVAT = filtered.reduce((s, r) => s + r.total_with_vat, 0);

  function handleProductSelect(productId: string) {
    const product = products.find((p) => p.id === productId);
    setForm({ ...form, product_id: productId, unit_price: product?.selling_price || 0 });
  }

  async function handleSave() {
    if (!form.product_id || form.quantity <= 0) {
      toast.error('Vui lòng chọn hàng hóa và nhập số lượng');
      return;
    }

    const subtotal = form.quantity * form.unit_price;
    const vat = calculateVAT(subtotal);
    const total = subtotal + vat;

    setLoading(true);
    try {
      let invoiceId = null;
      if (createInvoice) {
        const invoiceNumber = generateInvoiceNumber();
        const { data: invoice, error: invError } = await supabase.from('invoices').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          invoice_number: invoiceNumber,
          invoice_date: form.sale_date,
          customer_name: form.customer_name || 'Khách lẻ',
          customer_address: form.customer_address,
          customer_tax_code: form.customer_tax_code,
          subtotal,
          vat_amount: vat,
          total_amount: total,
          payment_method: 'cash',
          status: 'completed',
        }).select().single();

        if (invError) throw invError;
        invoiceId = invoice.id;
      }

      const { error } = await supabase.from('sales').insert({
        ...form,
        total_amount: subtotal,
        vat_amount: vat,
        total_with_vat: total,
        invoice_id: invoiceId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
      toast.success('Bán hàng thành công');
      await loadData();
      setShowModal(false);
    } catch {
      const product = products.find((p) => p.id === form.product_id);
      setSales((prev) => [{
        ...form,
        id: Date.now().toString(),
        user_id: '',
        total_amount: subtotal,
        vat_amount: vat,
        total_with_vat: total,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        product,
      } as Sale & { product?: Product }, ...prev]);
      setShowModal(false);
      toast.success('Bán hàng thành công (demo)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header
        title="Bán hàng"
        subtitle="Quản lý bán hàng và xuất hóa đơn"
        onMenuClick={() => {}}
        actions={
          <button onClick={() => { setForm({ product_id: '', sale_date: new Date().toISOString().split('T')[0], quantity: 0, unit_price: 0, customer_name: '', customer_address: '', customer_tax_code: '', notes: '' }); setShowModal(true); }} className="btn btn-success">
            <Plus className="w-4 h-4" /> Bán hàng
          </button>
        }
      />

      <div className="page-content">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input type="text" placeholder="Tìm theo hàng hóa hoặc khách hàng..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Từ:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Đến:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="text-xs text-green-600 mb-1">Doanh thu (trước thuế)</div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-600 mb-1">Thuế GTGT (8%)</div>
            <div className="text-lg font-bold text-blue-700">{formatCurrency(totalVAT)}</div>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
            <div className="text-xs text-purple-600 mb-1">Tổng thu (sau thuế)</div>
            <div className="text-lg font-bold text-purple-700">{formatCurrency(totalWithVAT)}</div>
          </div>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Hàng hóa</th>
                  <th>Khách hàng</th>
                  <th className="text-right">SL</th>
                  <th className="text-right">Đơn giá</th>
                  <th className="text-right">Thành tiền</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Chưa có giao dịch bán hàng</h3>
                        <p>Nhấn &quot;Bán hàng&quot; để bắt đầu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-mono">{formatDate(sale.sale_date)}</td>
                      <td className="font-medium">{sale.product?.name || '—'}</td>
                      <td>{sale.customer_name || 'Khách lẻ'}</td>
                      <td className="text-right font-mono">{sale.quantity}</td>
                      <td className="text-right font-mono">{formatCurrency(sale.unit_price)}</td>
                      <td className="text-right font-mono">{formatCurrency(sale.total_amount)}</td>
                      <td className="text-right font-mono text-blue-600">{formatCurrency(sale.vat_amount)}</td>
                      <td className="text-right font-mono font-medium text-green-600">{formatCurrency(sale.total_with_vat)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Bán hàng"
        large
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Hủy</button>
            <button onClick={handleSave} className="btn btn-success" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận bán'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Hàng hóa *</label>
          <select className="form-select" value={form.product_id} onChange={(e) => handleProductSelect(e.target.value)}>
            <option value="">-- Chọn hàng hóa --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} - {p.name} ({formatCurrency(p.selling_price)}/{p.unit})</option>
            ))}
          </select>
        </div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Ngày bán</label>
            <input className="form-input" type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Số lượng *</label>
            <input className="form-input" type="number" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Đơn giá</label>
            <input className="form-input" type="number" value={form.unit_price || ''} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
          </div>
        </div>

        {form.quantity > 0 && form.unit_price > 0 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border border-green-100 mb-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Thành tiền:</span>
                <div className="font-bold">{formatCurrency(form.quantity * form.unit_price)}</div>
              </div>
              <div>
                <span className="text-gray-500">VAT 8%:</span>
                <div className="font-bold text-blue-600">{formatCurrency(calculateVAT(form.quantity * form.unit_price))}</div>
              </div>
              <div>
                <span className="text-gray-500">Tổng:</span>
                <div className="font-bold text-green-600">{formatCurrency(form.quantity * form.unit_price + calculateVAT(form.quantity * form.unit_price))}</div>
              </div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Tên khách hàng</label>
          <input className="form-input" value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Để trống = Khách lẻ" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input className="form-input" value={form.customer_address || ''} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Mã số thuế</label>
            <input className="form-input" value={form.customer_tax_code || ''} onChange={(e) => setForm({ ...form, customer_tax_code: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={createInvoice} onChange={(e) => setCreateInvoice(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm">Tự động tạo hóa đơn</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
