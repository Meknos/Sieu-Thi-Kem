'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, ShoppingCart, Trash2, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { confirm } from '@/components/ConfirmDialog';
import type { Purchase, Product } from '@/lib/types';
import toast from 'react-hot-toast';

interface PurchaseItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

const emptyItem = (): PurchaseItem => ({ product_id: '', quantity: 0, unit_price: 0 });

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<(Purchase & { product?: Product })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [{ data: productsData }, { data: purchasesData }] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('purchases').select('*, product:products(*)').order('purchase_date', { ascending: false }),
      ]);
      if (productsData) setProducts(productsData);
      if (purchasesData) setPurchases(purchasesData);
    } catch { /* Supabase not connected */ }
  }

  function openModal() {
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setSupplierName('');
    setSupplierInvoice('');
    setNotes('');
    setItems([emptyItem()]);
    setShowModal(true);
  }

  function updateItem(idx: number, field: keyof PurchaseItem, value: string | number) {
    setItems(prev => {
      const next = [...prev];
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        next[idx] = { ...next[idx], product_id: value as string, unit_price: product?.purchase_price || 0 };
      } else {
        next[idx] = { ...next[idx], [field]: Number(value) };
      }
      return next;
    });
  }

  function addItem() { setItems(prev => [...prev, emptyItem()]); }
  function removeItem(idx: number) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const grandTotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  async function handleSave() {
    const validItems = items.filter(it => it.product_id && it.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Vui lòng thêm ít nhất một mặt hàng với số lượng > 0');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (!userId) {
        toast.error('Chưa đăng nhập. Vui lòng đăng nhập để lưu dữ liệu.');
        setLoading(false);
        return;
      }

      // Snapshot inventory BEFORE inserting (to detect if trigger ran)
      const beforeMap: Record<string, number> = {};
      for (const it of validItems) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', it.product_id)
          .eq('user_id', userId)
          .maybeSingle();
        beforeMap[it.product_id] = Number(inv?.quantity ?? 0);
      }

      // Insert purchase records
      const rows = validItems.map(it => ({
        user_id: userId,
        product_id: it.product_id,
        purchase_date: purchaseDate,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_amount: it.quantity * it.unit_price,
        supplier_name: supplierName || null,
        supplier_invoice: supplierInvoice || null,
        notes: notes || null,
      }));

      const { error: purchaseError } = await supabase.from('purchases').insert(rows);
      if (purchaseError) throw purchaseError;

      // Check inventory AFTER insert — if trigger ran, quantity already increased
      for (const it of validItems) {
        const { data: afterInv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', it.product_id)
          .eq('user_id', userId)
          .maybeSingle();

        const afterQty = Number(afterInv?.quantity ?? 0);
        const expectedQty = beforeMap[it.product_id] + it.quantity;
        const triggerRan = Math.abs(afterQty - expectedQty) < 0.001;

        if (!triggerRan) {
          // Trigger didn't run — do manual inventory update
          if (afterInv) {
            await supabase.from('inventory').update({
              quantity: expectedQty,
              last_updated: new Date().toISOString(),
            }).eq('id', afterInv.id);
          } else {
            await supabase.from('inventory').insert({
              user_id: userId,
              product_id: it.product_id,
              quantity: it.quantity,
              last_updated: new Date().toISOString(),
            });
          }
        }
      }

      toast.success(`Nhập hàng thành công ${validItems.length} mặt hàng`);
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi nhập hàng');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({
      title: 'Xóa phiếu nhập',
      message: 'Xóa phiếu nhập hàng này? Tồn kho sẽ KHÔNG được tự động hoàn lại.',
      confirmText: 'Xóa',
      danger: true,
    })) return;
    try {
      const { error } = await supabase.from('purchases').delete().eq('id', id);
      if (error) throw error;
      toast.success('Đã xóa phiếu nhập');
      setPurchases(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa phiếu nhập');
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

  return (
    <>
      <Header
        title="Nhập hàng"
        subtitle="Quản lý phiếu nhập hàng / mua vào"
        onMenuClick={() => {}}
        actions={
          <button onClick={openModal} className="btn btn-primary">
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

        <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            Tổng: <strong>{filtered.length}</strong> dòng nhập
          </span>
          <span className="text-sm font-bold text-blue-700">{formatCurrency(totalFiltered)}</span>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>STT</th>
                  <th>Ngày nhập</th>
                  <th>Hàng hóa</th>
                  <th>Nhà cung cấp</th>
                  <th className="text-right">Số lượng</th>
                  <th className="text-right">Đơn giá</th>
                  <th className="text-right">Thành tiền</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
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
                      <td className="text-center text-gray-400 text-sm">{filtered.indexOf(purchase) + 1}</td>
                      <td className="font-mono">{formatDate(purchase.purchase_date)}</td>
                      <td className="font-medium">{purchase.product?.name || '—'}</td>
                      <td>{purchase.supplier_name || '—'}</td>
                      <td className="text-right font-mono">{purchase.quantity}</td>
                      <td className="text-right font-mono">{formatCurrency(purchase.unit_price)}</td>
                      <td className="text-right font-mono font-medium text-red-600">
                        {formatCurrency(purchase.total_amount)}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="btn btn-ghost btn-sm text-red-500"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        title="Phiếu nhập hàng"
        footer={
          <>
            <div className="flex-1 text-left">
              <span className="text-sm text-gray-500">Tổng cộng: </span>
              <span className="font-bold text-red-600">{formatCurrency(grandTotal)}</span>
            </div>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Hủy</button>
            <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu phiếu nhập'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ngày nhập</label>
            <input className="form-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nhà cung cấp</label>
            <input className="form-input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tên nhà cung cấp" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Số HĐ nhà cung cấp</label>
          <input className="form-input" value={supplierInvoice} onChange={(e) => setSupplierInvoice(e.target.value)} placeholder="VD: NCC-2026-001" />
        </div>

        <hr className="my-4" />

        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label mb-0 font-semibold">Danh sách hàng hóa nhập</label>
            <button type="button" onClick={addItem} className="btn btn-ghost btn-sm text-blue-600">
              <PlusCircle className="w-4 h-4 mr-1" /> Thêm mặt hàng
            </button>
          </div>

          <div className="grid gap-2 text-xs text-gray-400 font-medium px-1" style={{ gridTemplateColumns: '2fr 1fr 1.2fr auto' }}>
            <span>Hàng hóa</span><span>Số lượng</span><span>Đơn giá</span><span></span>
          </div>

          {items.map((item, idx) => {
            const product = products.find(p => p.id === item.product_id);
            return (
              <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="grid gap-2 items-start" style={{ gridTemplateColumns: '2fr 1fr 1.2fr auto' }}>
                  <select className="form-select" value={item.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)}>
                    <option value="">-- Chọn hàng hóa --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                  </select>
                  <input className="form-input text-right" type="number" min="1" placeholder="SL" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                  <input className="form-input text-right" type="number" min="0" placeholder="Đơn giá" value={item.unit_price || ''} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} />
                  <button type="button" onClick={() => removeItem(idx)} className="btn btn-ghost btn-sm text-red-400 mt-1" disabled={items.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {product && item.quantity > 0 && (
                  <div className="mt-2 flex justify-between text-xs text-gray-500 px-1">
                    <span>ĐVT: {product.unit}</span>
                    <span className="font-medium text-red-600">= {formatCurrency(item.quantity * item.unit_price)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Ghi chú</label>
          <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú (không bắt buộc)" rows={2} />
        </div>
      </Modal>
    </>
  );
}
