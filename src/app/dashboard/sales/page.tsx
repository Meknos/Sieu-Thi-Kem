/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, Receipt, Trash2, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';
import { formatCurrency, formatDate, calculateVAT, generateInvoiceNumber } from '@/lib/utils';
import { confirm } from '@/components/ConfirmDialog';
import type { Sale, Product } from '@/lib/types';
import toast from 'react-hot-toast';

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

const emptyItem = (): SaleItem => ({ product_id: '', quantity: 0, unit_price: 0 });

export default function SalesPage() {
  const [sales, setSales] = useState<(Sale & { product?: Product })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Multi-item form state
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxCode, setCustomerTaxCode] = useState('');
  const [notes, setNotes] = useState('');
  const [createInvoice, setCreateInvoice] = useState(true);
  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [{ data: productsData }, { data: salesData }] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('name'),
        supabase.from('sales').select('*, product:products(*)').order('sale_date', { ascending: false }),
      ]);
      if (productsData) setProducts(productsData);
      if (salesData) setSales(salesData);
    } catch { /* Supabase not connected */ }
  }

  function openModal() {
    setSaleDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setCustomerAddress('');
    setCustomerTaxCode('');
    setNotes('');
    setItems([emptyItem()]);
    setShowModal(true);
  }

  function updateItem(idx: number, field: keyof SaleItem, value: string | number) {
    setItems(prev => {
      const next = [...prev];
      if (field === 'product_id') {
        const product = products.find(p => p.id === value);
        next[idx] = { ...next[idx], product_id: value as string, unit_price: product?.selling_price || 0 };
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

  const subtotalAll = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const vatAll = calculateVAT(subtotalAll);
  const totalAll = subtotalAll + vatAll;

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

      // Validate inventory before selling
      for (const it of validItems) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', it.product_id)
          .eq('user_id', userId)
          .maybeSingle();

        const available = inv?.quantity ?? 0;
        if (available < it.quantity) {
          const product = products.find(p => p.id === it.product_id);
          throw new Error(`Không đủ hàng: "${product?.name}" chỉ còn ${available}, cần ${it.quantity}`);
        }
      }

      // Create invoice if requested
      let invoiceId: string | null = null;
      if (createInvoice) {
        const { data: invoice, error: invErr } = await supabase
          .from('invoices')
          .insert({
            user_id: userId,
            invoice_number: generateInvoiceNumber(),
            invoice_date: saleDate,
            customer_name: customerName || 'Khách lẻ',
            customer_address: customerAddress || null,
            customer_tax_code: customerTaxCode || null,
            subtotal: subtotalAll,
            vat_amount: vatAll,
            total_amount: totalAll,
            payment_method: 'cash',
            status: 'completed',
            notes: notes || null,
          })
          .select('id')
          .single();
        if (invErr) throw invErr;
        invoiceId = invoice.id;
      }

      // Insert sales records
      const salesRows = validItems.map(it => {
        const lineTotal = it.quantity * it.unit_price;
        const lineVAT = calculateVAT(lineTotal);
        return {
          user_id: userId,
          product_id: it.product_id,
          invoice_id: invoiceId,
          sale_date: saleDate,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total_amount: lineTotal,
          vat_amount: lineVAT,
          total_with_vat: lineTotal + lineVAT,
          customer_name: customerName || 'Khách lẻ',
          customer_address: customerAddress || null,
          customer_tax_code: customerTaxCode || null,
          notes: notes || null,
        };
      });

      // Snapshot inventory BEFORE selling
      const beforeMap: Record<string, number> = {};
      for (const it of validItems) {
        const { data: inv } = await supabase
          .from('inventory').select('quantity')
          .eq('product_id', it.product_id).eq('user_id', userId).maybeSingle();
        beforeMap[it.product_id] = Number(inv?.quantity ?? 0);
      }

      // Insert sales records
      const { error: salesErr } = await supabase.from('sales').insert(salesRows);
      if (salesErr) throw salesErr;

      // Check inventory AFTER insert — if trigger ran, quantity already decreased
      for (const it of validItems) {
        const { data: afterInv } = await supabase
          .from('inventory').select('id, quantity')
          .eq('product_id', it.product_id).eq('user_id', userId).maybeSingle();

        const afterQty = Number(afterInv?.quantity ?? 0);
        const expectedQty = beforeMap[it.product_id] - it.quantity;
        const triggerRan = Math.abs(afterQty - expectedQty) < 0.001;

        if (!triggerRan && afterInv) {
          // Trigger didn't run — manually deduct
          await supabase.from('inventory').update({
            quantity: Math.max(0, expectedQty),
            last_updated: new Date().toISOString(),
          }).eq('id', afterInv.id);
        }
      }

      toast.success(`Bán hàng thành công ${validItems.length} mặt hàng`);
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi bán hàng');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({
      title: 'Xóa giao dịch bán',
      message: 'Xóa giao dịch bán này? Tồn kho sẽ KHÔNG được tự động hoàn lại.',
      confirmText: 'Xóa',
      danger: true,
    })) return;
    try {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
      toast.success('Đã xóa giao dịch');
      setSales(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa giao dịch');
    }
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

  return (
    <>
      <Header
        title="Bán hàng"
        subtitle="Quản lý bán hàng và xuất hóa đơn"
        onMenuClick={() => {}}
        actions={
          <button onClick={openModal} className="btn btn-success">
            <Plus className="w-4 h-4" /> Bán hàng
          </button>
        }
      />

      <div className="page-content">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input
              type="text"
              placeholder="Tìm theo hàng hóa hoặc khách hàng..."
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
                  <th style={{ width: 48 }}>STT</th>
                  <th>Ngày</th>
                  <th>Hàng hóa</th>
                  <th>Khách hàng</th>
                  <th className="text-right">SL</th>
                  <th className="text-right">Đơn giá</th>
                  <th className="text-right">Thành tiền</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Tổng</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
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
                      <td className="text-center text-gray-400 text-sm">{filtered.indexOf(sale) + 1}</td>
                      <td className="font-mono">{formatDate(sale.sale_date)}</td>
                      <td className="font-medium">{sale.product?.name || '—'}</td>
                      <td>{sale.customer_name || 'Khách lẻ'}</td>
                      <td className="text-right font-mono">{sale.quantity}</td>
                      <td className="text-right font-mono">{formatCurrency(sale.unit_price)}</td>
                      <td className="text-right font-mono">{formatCurrency(sale.total_amount)}</td>
                      <td className="text-right font-mono text-blue-600">{formatCurrency(sale.vat_amount)}</td>
                      <td className="text-right font-mono font-medium text-green-600">
                        {formatCurrency(sale.total_with_vat)}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => handleDelete(sale.id)}
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

      {/* Multi-item sales modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Bán hàng"
        large
        footer={
          <>
            <div className="flex-1 text-left text-sm space-y-0.5">
              <div>
                <span className="text-gray-500">Trước thuế: </span>
                <span className="font-medium">{formatCurrency(subtotalAll)}</span>
              </div>
              <div>
                <span className="text-gray-500">VAT 8%: </span>
                <span className="text-blue-600 font-medium">{formatCurrency(vatAll)}</span>
              </div>
              <div>
                <span className="font-semibold">Tổng: </span>
                <span className="font-bold text-green-600 text-base">{formatCurrency(totalAll)}</span>
              </div>
            </div>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Hủy</button>
            <button onClick={handleSave} className="btn btn-success" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận bán'}
            </button>
          </>
        }
      >
        {/* Customer info */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ngày bán</label>
            <input
              className="form-input"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Khách hàng</label>
            <input
              className="form-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Để trống = Khách lẻ"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Địa chỉ</label>
            <input
              className="form-input"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mã số thuế</label>
            <input
              className="form-input"
              value={customerTaxCode}
              onChange={(e) => setCustomerTaxCode(e.target.value)}
            />
          </div>
        </div>

        <hr className="my-4" />

        {/* Item rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label mb-0 font-semibold">Danh sách hàng hóa bán</label>
            <button type="button" onClick={addItem} className="btn btn-ghost btn-sm text-green-600">
              <PlusCircle className="w-4 h-4 mr-1" /> Thêm mặt hàng
            </button>
          </div>

          <div
            className="grid gap-2 text-xs text-gray-400 font-medium px-1"
            style={{ gridTemplateColumns: '2fr 1fr 1.2fr auto' }}
          >
            <span>Hàng hóa</span>
            <span>Số lượng</span>
            <span>Đơn giá bán</span>
            <span></span>
          </div>

          {items.map((item, idx) => {
            const product = products.find(p => p.id === item.product_id);
            const lineTotal = item.quantity * item.unit_price;
            return (
              <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="grid gap-2 items-start" style={{ gridTemplateColumns: '2fr 1fr 1.2fr auto' }}>
                  <select
                    className="form-select"
                    value={item.product_id}
                    onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                  >
                    <option value="">-- Chọn hàng hóa --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="form-input text-right"
                    type="number"
                    min="1"
                    placeholder="SL"
                    value={item.quantity || ''}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  />

                  <input
                    className="form-input text-right"
                    type="number"
                    min="0"
                    placeholder="Đơn giá"
                    value={item.unit_price || ''}
                    onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                  />

                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="btn btn-ghost btn-sm text-red-400 mt-1"
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {product && item.quantity > 0 && (
                  <div className="mt-2 flex justify-between text-xs text-gray-500 px-1">
                    <span>ĐVT: {product.unit} · Giá bán gốc: {formatCurrency(product.selling_price)}</span>
                    <span className="font-medium text-green-600">= {formatCurrency(lineTotal)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Ghi chú</label>
          <textarea
            className="form-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú (không bắt buộc)"
            rows={2}
          />
        </div>
        <div className="form-group">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createInvoice}
              onChange={(e) => setCreateInvoice(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Tự động tạo hóa đơn</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
