/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import {
  Search, FileText, Eye, Trash2, Plus, X,
  ChevronDown, ChevronUp, Edit2, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getPaymentMethodLabel, getStatusLabel, getStatusColor, generateInvoiceNumber } from '@/lib/utils';
import { apiPost, apiDelete } from '@/lib/api';
import { confirm } from '@/components/ConfirmDialog';
import type { Invoice, Product } from '@/lib/types';
import toast from 'react-hot-toast';

interface SaleItem {
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface InvoiceWithSales extends Invoice {
  sales?: any[];
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithSales[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithSales | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New order form
  const [orderForm, setOrderForm] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    customer_address: '',
    customer_tax_code: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'card',
    notes: '',
    vat_rate: 0,  // Không tính VAT
  });
  const [orderItems, setOrderItems] = useState<SaleItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, subtotal: 0 },
  ]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [invRes, prodRes] = await Promise.all([
        supabase.from('invoices')
          .select('*, sales:sales(*, product:products(id, code, name, unit))')
          .order('invoice_date', { ascending: false }),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);
      if (invRes.data && invRes.data.length > 0) setInvoices(invRes.data);
      if (prodRes.data) setProducts(prodRes.data);
    } catch { /* API unavailable */ }
  }

  const filtered = invoices.filter((inv) => {
    const matchSearch = !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !dateFrom || inv.invoice_date >= dateFrom;
    const matchTo = !dateTo || inv.invoice_date <= dateTo;
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchFrom && matchTo && matchStatus;
  });

  // Chỉ tính doanh thu từ hóa đơn hoàn thành
  const completedFiltered = filtered.filter(i => i.status === 'completed');
  const totalRevenue = completedFiltered.reduce((s, i) => s + Number(i.total_amount), 0);

  // --- Order Items Helpers ---
  function addItem() {
    setOrderItems(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  }

  function removeItem(idx: number) {
    setOrderItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof SaleItem, value: any) {
    setOrderItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value);
        updated.product = prod;
        updated.unit_price = prod?.selling_price || 0;
        updated.subtotal = updated.quantity * (prod?.selling_price || 0);
      } else if (field === 'quantity' || field === 'unit_price') {
        updated.subtotal = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  }

  const orderSubtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);

  // --- Create Order ---
  async function handleCreateOrder() {
    const validItems = orderItems.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 mặt hàng');
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost<{ invoice_number: string }>('/api/invoices', {
        ...orderForm,
        items: validItems.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      toast.success(`Tạo đơn hàng ${result.invoice_number} thành công`);
      setShowCreateModal(false);
      resetOrderForm();
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tạo đơn hàng. Kiểm tra kết nối hoặc tồn kho.');
    } finally {
      setLoading(false);
    }
  }

  function resetOrderForm() {
    setOrderForm({
      invoice_date: new Date().toISOString().split('T')[0],
      customer_name: '',
      customer_address: '',
      customer_tax_code: '',
      payment_method: 'cash',
      notes: '',
      vat_rate: 0,
    });
    setOrderItems([{ product_id: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  }

  // --- Delete Invoice ---
  async function handleDelete(inv: InvoiceWithSales) {
    if (!await confirm({ message: `Xóa hóa đơn ${inv.invoice_number}? Tồn kho sẽ được hoàn lại.`, confirmText: 'Xóa', danger: true })) return;
    try {
      await apiDelete(`/api/invoices/${inv.id}`);
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
      toast.success('Đã xóa hóa đơn');
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xóa hóa đơn');
    }
  }

  // --- Change Status ---
  async function handleStatusChange(inv: InvoiceWithSales, newStatus: string) {
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi cập nhật');
      }
      // Update local state
      setInvoices(prev => prev.map(i =>
        i.id === inv.id ? { ...i, status: newStatus as any } : i
      ));
      const statusLabels: Record<string, string> = {
        completed: 'Hoàn thành',
        cancelled: 'Đã hủy',
        draft: 'Nháp',
      };
      toast.success(`Đã đổi trạng thái → ${statusLabels[newStatus] || newStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật trạng thái');
    }
  }

  return (
    <>
      <Header
        title="Hóa đơn"
        subtitle="Quản lý đơn hàng và hóa đơn bán hàng"
        onMenuClick={() => {}}
        actions={
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Tạo đơn hàng
          </button>
        }
      />

      <div className="page-content">
        {/* Filters */}
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input type="text" placeholder="Tìm theo số HĐ hoặc khách hàng..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Từ:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Đến:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="completed">Hoàn thành</option>
            <option value="draft">Nháp</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-600 mb-1">Tổng hóa đơn</div>
            <div className="text-2xl font-bold text-blue-700">{filtered.length}</div>
            <div className="text-xs text-blue-400 mt-1">{completedFiltered.length} hoàn thành</div>
          </div>
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="text-xs text-green-600 mb-1">Doanh thu</div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totalRevenue)}</div>
            <div className="text-xs text-green-400 mt-1">Chỉ tính HĐ hoàn thành</div>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
            <div className="text-xs text-purple-600 mb-1">Trung bình / HĐ</div>
            <div className="text-lg font-bold text-purple-700">{formatCurrency(completedFiltered.length ? totalRevenue / completedFiltered.length : 0)}</div>
          </div>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Số HĐ</th>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th className="text-right">Tổng tiền</th>
                  <th className="text-center">Thanh toán</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Chưa có hóa đơn</h3>
                        <p>Nhấn &quot;Tạo đơn hàng&quot; để bắt đầu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => (
                    <>
                      <tr key={inv.id}>
                        <td>
                          <button
                            className="btn btn-ghost p-1"
                            onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                          >
                            {expandedId === inv.id
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="font-mono font-medium text-blue-600">{inv.invoice_number}</td>
                        <td className="font-mono">{formatDate(inv.invoice_date)}</td>
                        <td className="font-medium">{inv.customer_name}</td>
                        <td className="text-right font-mono font-medium text-green-600">{formatCurrency(inv.total_amount)}</td>
                        <td className="text-center text-sm">{getPaymentMethodLabel(inv.payment_method)}</td>
                        <td className="text-center">
                          <select
                            className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${getStatusColor(inv.status)}`}
                            value={inv.status}
                            onChange={(e) => handleStatusChange(inv, e.target.value)}
                          >
                            <option value="draft">Nháp</option>
                            <option value="completed">Hoàn thành</option>
                            <option value="cancelled">Đã hủy</option>
                          </select>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Xem chi tiết"
                              onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm text-red-500"
                              title="Xóa hóa đơn"
                              onClick={() => handleDelete(inv)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row: show items */}
                      {expandedId === inv.id && inv.sales && inv.sales.length > 0 && (
                        <tr key={`${inv.id}-detail`} className="bg-blue-50/50">
                          <td colSpan={8} className="py-3 px-6">
                            <div className="text-xs font-semibold text-blue-700 mb-2">
                              Chi tiết mặt hàng ({inv.sales.length} loại):
                            </div>
                            <table className="text-sm w-full max-w-2xl">
                              <thead>
                                <tr className="text-xs text-gray-500">
                                  <th className="text-left py-1">Hàng hóa</th>
                                  <th className="text-right py-1">SL</th>
                                  <th className="text-right py-1">Đơn giá</th>
                                  <th className="text-right py-1">Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inv.sales.map((s: any, idx: number) => (
                                  <tr key={idx} className="border-t border-blue-100">
                                    <td className="py-1 font-medium">{s.product?.name || '—'}</td>
                                    <td className="text-right py-1">{s.quantity} {s.product?.unit}</td>
                                    <td className="text-right py-1 font-mono">{formatCurrency(s.unit_price)}</td>
                                    <td className="text-right py-1 font-mono font-medium">{formatCurrency(s.total_amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Order Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetOrderForm(); }}
        title="Tạo đơn hàng mới"
        large
        footer={
          <>
            <button onClick={() => { setShowCreateModal(false); resetOrderForm(); }} className="btn btn-secondary">
              Hủy
            </button>
            <button onClick={handleCreateOrder} className="btn btn-primary" disabled={loading}>
              <Check className="w-4 h-4" />
              {loading ? 'Đang lưu...' : 'Xác nhận đơn hàng'}
            </button>
          </>
        }
      >
        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">Ngày bán</label>
            <input className="form-input" type="date" value={orderForm.invoice_date}
              onChange={(e) => setOrderForm({ ...orderForm, invoice_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Thanh toán</label>
            <select className="form-select" value={orderForm.payment_method}
              onChange={(e) => setOrderForm({ ...orderForm, payment_method: e.target.value as any })}>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="form-group">
            <label className="form-label">Khách hàng</label>
            <input className="form-input" placeholder="Để trống = Khách lẻ"
              value={orderForm.customer_name}
              onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Mã số thuế KH</label>
            <input className="form-input" placeholder="Nếu có"
              value={orderForm.customer_tax_code}
              onChange={(e) => setOrderForm({ ...orderForm, customer_tax_code: e.target.value })} />
          </div>
        </div>
        <div className="form-group mb-4">
          <label className="form-label">Địa chỉ khách hàng</label>
          <input className="form-input"
            value={orderForm.customer_address}
            onChange={(e) => setOrderForm({ ...orderForm, customer_address: e.target.value })} />
        </div>

        {/* Items */}
        <div className="mb-2 flex items-center justify-between">
          <label className="form-label mb-0 font-semibold">Danh sách mặt hàng</label>
          <button onClick={addItem} className="btn btn-secondary btn-sm">
            <Plus className="w-3 h-3" /> Thêm mặt hàng
          </button>
        </div>

        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Sản phẩm *</th>
                <th className="text-right px-3 py-2 w-20">SL</th>
                <th className="text-right px-3 py-2 w-28">Đơn giá</th>
                <th className="text-right px-3 py-2 w-28">Thành tiền</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2">
                    <select className="form-select text-sm py-1" value={item.product_id}
                      onChange={(e) => updateItem(idx, 'product_id', e.target.value)}>
                      <option value="">-- Chọn sản phẩm --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name} ({formatCurrency(p.selling_price)}/{p.unit})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="form-input text-sm py-1 text-right" style={{ width: 70 }}
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" className="form-input text-sm py-1 text-right font-mono" style={{ width: 110 }}
                      value={item.unit_price || ''}
                      onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    {formatCurrency(item.subtotal)}
                  </td>
                  <td className="px-3 py-2">
                    {orderItems.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border border-green-100">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">Tổng thanh toán:</span>
            <div className="font-bold text-green-600 text-lg">{formatCurrency(orderSubtotal)}</div>
          </div>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Ghi chú</label>
          <textarea className="form-textarea" value={orderForm.notes}
            onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} />
        </div>
      </Modal>

      {/* Detail Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Hóa đơn ${selectedInvoice.invoice_number}`}
          large
          footer={
            <button onClick={() => setShowDetailModal(false)} className="btn btn-secondary">Đóng</button>
          }
        >
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div><span className="text-gray-500">Ngày:</span> <span className="font-medium">{formatDate(selectedInvoice.invoice_date)}</span></div>
            <div><span className="text-gray-500">Thanh toán:</span> <span className="font-medium">{getPaymentMethodLabel(selectedInvoice.payment_method)}</span></div>
            <div><span className="text-gray-500">Khách hàng:</span> <span className="font-medium">{selectedInvoice.customer_name}</span></div>
            <div><span className="text-gray-500">Trạng thái:</span> <span className={`badge ${getStatusColor(selectedInvoice.status)}`}>{getStatusLabel(selectedInvoice.status)}</span></div>
            {selectedInvoice.customer_address && (
              <div className="col-span-2"><span className="text-gray-500">Địa chỉ:</span> {selectedInvoice.customer_address}</div>
            )}
          </div>

          {selectedInvoice.sales && selectedInvoice.sales.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Hàng hóa</th>
                    <th className="text-right px-3 py-2">SL</th>
                    <th className="text-right px-3 py-2">Đơn giá</th>
                    <th className="text-right px-3 py-2">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.sales.map((s: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium">{s.product?.name || '—'}</td>
                      <td className="px-3 py-2 text-right">{s.quantity} {s.product?.unit}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(s.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-green-600">{formatCurrency(s.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold border-t-2">
                    <td colSpan={3} className="px-3 py-2 text-right">Tổng cộng:</td>
                    <td className="px-3 py-2 text-right font-mono text-green-600 text-base">{formatCurrency(selectedInvoice.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {selectedInvoice.notes && (
            <div className="p-3 rounded-lg bg-gray-50 text-sm">
              <span className="font-medium">Ghi chú:</span> {selectedInvoice.notes}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
