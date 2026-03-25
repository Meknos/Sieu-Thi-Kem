'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Purchase, Product, PurchaseInput } from '@/lib/types';
import toast from 'react-hot-toast';

const demoProducts: Product[] = [
  { id: '1', user_id: '', code: 'XM001', name: 'Xi măng PCB40 Hà Tiên', unit: 'bao', purchase_price: 85000, selling_price: 95000, category: '', is_active: true, created_at: '', updated_at: '' },
  { id: '2', user_id: '', code: 'TH001', name: 'Thép cuộn phi 10', unit: 'kg', purchase_price: 14500, selling_price: 16000, category: '', is_active: true, created_at: '', updated_at: '' },
];

const demoPurchases: (Purchase & { product?: Product })[] = [
  { id: '1', user_id: '', product_id: '1', purchase_date: '2026-03-20', quantity: 100, unit_price: 85000, total_amount: 8500000, supplier_name: 'CTCP Xi Măng Hà Tiên', supplier_invoice: 'NCC-2026-001', created_at: '', updated_at: '', product: demoProducts[0] },
  { id: '2', user_id: '', product_id: '2', purchase_date: '2026-03-18', quantity: 500, unit_price: 14500, total_amount: 7250000, supplier_name: 'Hòa Phát', supplier_invoice: 'NCC-2026-002', created_at: '', updated_at: '', product: demoProducts[1] },
];

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<(Purchase & { product?: Product })[]>(demoPurchases);
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<PurchaseInput>({
    product_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: 0,
    unit_price: 0,
    supplier_name: '',
    supplier_invoice: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [{ data: productsData }, { data: purchasesData }] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('purchases').select('*, product:products(*)').order('purchase_date', { ascending: false }),
      ]);

      if (productsData && productsData.length > 0) setProducts(productsData);
      if (purchasesData && purchasesData.length > 0) setPurchases(purchasesData);
    } catch {
      console.log('Using demo data');
    }
  }

  const filtered = purchases.filter((p) => {
    const matchSearch = !search ||
      p.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !dateFrom || p.purchase_date >= dateFrom;
    const matchTo = !dateTo || p.purchase_date <= dateTo;
    return matchSearch && matchFrom && matchTo;
  });

  const totalFiltered = filtered.reduce((sum, p) => sum + p.total_amount, 0);

  function handleProductSelect(productId: string) {
    const product = products.find((p) => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      unit_price: product?.purchase_price || 0,
    });
  }

  async function handleSave() {
    if (!form.product_id || form.quantity <= 0) {
      toast.error('Vui lòng chọn hàng hóa và nhập số lượng');
      return;
    }

    const total = form.quantity * form.unit_price;
    setLoading(true);

    try {
      const { error } = await supabase.from('purchases').insert({
        ...form,
        total_amount: total,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
      toast.success('Nhập hàng thành công');
      await loadData();
      setShowModal(false);
    } catch {
      const product = products.find((p) => p.id === form.product_id);
      setPurchases((prev) => [
        {
          ...form,
          id: Date.now().toString(),
          user_id: '',
          total_amount: total,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          product,
        } as Purchase & { product?: Product },
        ...prev,
      ]);
      setShowModal(false);
      toast.success('Nhập hàng thành công (demo)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header
        title="Nhập hàng"
        subtitle="Quản lý phiếu nhập hàng / mua vào"
        onMenuClick={() => {}}
        actions={
          <button onClick={() => { setForm({ product_id: '', purchase_date: new Date().toISOString().split('T')[0], quantity: 0, unit_price: 0, supplier_name: '', supplier_invoice: '', notes: '' }); setShowModal(true); }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Nhập hàng
          </button>
        }
      />

      <div className="page-content">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input
              type="text"
              placeholder="Tìm theo tên hàng hóa hoặc nhà cung cấp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
        <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            Tổng: <strong>{filtered.length}</strong> phiếu nhập
          </span>
          <span className="text-sm font-bold text-blue-700">
            {formatCurrency(totalFiltered)}
          </span>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày nhập</th>
                  <th>Hàng hóa</th>
                  <th>Nhà cung cấp</th>
                  <th className="text-right">Số lượng</th>
                  <th className="text-right">Đơn giá</th>
                  <th className="text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Chưa có phiếu nhập</h3>
                        <p>Nhấn &quot;Nhập hàng&quot; để bắt đầu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="font-mono">{formatDate(purchase.purchase_date)}</td>
                      <td className="font-medium">{purchase.product?.name || '—'}</td>
                      <td>{purchase.supplier_name || '—'}</td>
                      <td className="text-right font-mono">{purchase.quantity}</td>
                      <td className="text-right font-mono">{formatCurrency(purchase.unit_price)}</td>
                      <td className="text-right font-mono font-medium text-red-600">
                        {formatCurrency(purchase.total_amount)}
                      </td>
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
        title="Nhập hàng mới"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Hủy</button>
            <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu phiếu nhập'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Hàng hóa *</label>
          <select
            className="form-select"
            value={form.product_id}
            onChange={(e) => handleProductSelect(e.target.value)}
          >
            <option value="">-- Chọn hàng hóa --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ngày nhập</label>
            <input
              className="form-input"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Số HĐ nhà cung cấp</label>
            <input
              className="form-input"
              value={form.supplier_invoice || ''}
              onChange={(e) => setForm({ ...form, supplier_invoice: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Số lượng *</label>
            <input
              className="form-input"
              type="number"
              value={form.quantity || ''}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Đơn giá (VNĐ)</label>
            <input
              className="form-input"
              type="number"
              value={form.unit_price || ''}
              onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
            />
          </div>
        </div>
        {form.quantity > 0 && form.unit_price > 0 && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-sm">
            <strong>Thành tiền:</strong>{' '}
            <span className="text-green-700 font-bold">
              {formatCurrency(form.quantity * form.unit_price)}
            </span>
          </div>
        )}
        <div className="form-group mt-4">
          <label className="form-label">Nhà cung cấp</label>
          <input
            className="form-input"
            value={form.supplier_name || ''}
            onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
            placeholder="Tên nhà cung cấp"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Ghi chú</label>
          <textarea
            className="form-textarea"
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Modal>
    </>
  );
}
