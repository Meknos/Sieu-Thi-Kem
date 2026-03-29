/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, Receipt, Trash2, PlusCircle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, generateInvoiceNumber } from '@/lib/utils';
import { confirm } from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';
import type { Sale, Product } from '@/lib/types';
import toast from 'react-hot-toast';

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  input_unit: 'piece' | 'box';
}

const emptyItem = (): SaleItem => ({ product_id: '', quantity: 0, unit_price: 0, input_unit: 'piece' });

/** Tính số cái thực tế */
function toActualQty(item: SaleItem, product?: Product): number {
  if (item.input_unit === 'box' && product?.box_quantity) {
    return item.quantity * product.box_quantity;
  }
  return item.quantity;
}

/** Giá mỗi cái */
function toUnitPricePerPiece(item: SaleItem, product?: Product): number {
  if (item.input_unit === 'box' && product?.box_quantity) {
    return item.unit_price / product.box_quantity;
  }
  return item.unit_price;
}

export default function SalesPage() {
  const [sales, setSales] = useState<(Sale & { product?: Product })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxCode, setCustomerTaxCode] = useState('');
  const [notes, setNotes] = useState('');
  const [createInvoice, setCreateInvoice] = useState(true);
  const [vatRate, setVatRate] = useState(0); // Thuế suất GTGT (%) — mặc định không tính thuế
  const [items, setItems] = useState<SaleItem[]>([emptyItem()]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [{ data: productsData }, { data: salesData }, { data: invData }] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('sales').select('*, product:products(*)').order('sale_date', { ascending: false }),
        supabase.from('inventory').select('product_id, quantity'),
      ]);

      if (invData) {
        const invMap: Record<string, number> = {};
        invData.forEach(i => { invMap[i.product_id] = Number(i.quantity); });
        setInventoryMap(invMap);

        if (productsData) {
          setProducts(productsData.filter(p => p.is_active || (invMap[p.id] ?? 0) > 0));
        }
      } else if (productsData) {
        setProducts(productsData.filter(p => p.is_active));
      }

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
        next[idx] = {
          ...next[idx],
          product_id: value as string,
          unit_price: product?.selling_price || 0,
          input_unit: 'piece',
        };
      } else if (field === 'input_unit') {
        const product = products.find(p => p.id === next[idx].product_id);
        const newUnit = value as 'piece' | 'box';
        let newPrice = next[idx].unit_price;
        if (newUnit === 'box' && product?.box_quantity) {
          if (next[idx].input_unit === 'piece') {
            newPrice = next[idx].unit_price * product.box_quantity;
          }
        } else if (newUnit === 'piece' && product?.box_quantity) {
          if (next[idx].input_unit === 'box') {
            newPrice = next[idx].unit_price / product.box_quantity;
          }
        }
        next[idx] = { ...next[idx], input_unit: newUnit, unit_price: Math.round(newPrice) };
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
  const vatRateFraction = vatRate / 100;
  const vatAmountAll = Math.round(subtotalAll * vatRateFraction);
  const totalWithVatAll = subtotalAll + vatAmountAll;

  async function handleSave() {
    const validItems = items.filter(it => it.product_id && it.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Vui lòng thêm ít nhất một mặt hàng với số lượng > 0');
      return;
    }

    // Validate tồn kho ngay phía client trước khi gọi server
    for (const it of validItems) {
      const product = products.find(p => p.id === it.product_id);
      const actualQty = toActualQty(it, product);
      const available = inventoryMap[it.product_id] ?? 0;
      if (actualQty > available) {
        const unitLabel = it.input_unit === 'box' && product?.box_quantity
          ? `thùng (= ${actualQty} ${product.unit})`
          : product?.unit || 'cái';
        toast.error(`Không đủ hàng: "${product?.name}" còn ${available} ${product?.unit || 'cái'}, bạn cần ${actualQty} ${product?.unit || 'cái'}`);
        return;
      }
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

      // Validate tồn kho (theo số cái thực tế)
      for (const it of validItems) {
        const product = products.find(p => p.id === it.product_id);
        const actualQty = toActualQty(it, product);

        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', it.product_id)
          .eq('user_id', userId)
          .maybeSingle();

        const available = inv?.quantity ?? 0;
        if (available < actualQty) {
          const unitLabel = it.input_unit === 'box' && product?.box_quantity
            ? `thùng (cần ${actualQty} ${product.unit}, còn ${available} ${product.unit})`
            : product?.unit || 'cái';
          throw new Error(`Không đủ hàng: "${product?.name}" còn ${available} ${product?.unit || 'cái'}, cần ${actualQty}`);
        }
      }

      // Tạo hóa đơn với VAT đúng
      let invoiceId: string | null = null;
      if (createInvoice) {
        const invoiceVat = Math.round(subtotalAll * vatRateFraction);
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
            vat_amount: invoiceVat,
            total_amount: subtotalAll + invoiceVat,
            payment_method: 'cash',
            status: 'completed',
            notes: notes || null,
          })
          .select('id')
          .single();
        if (invErr) throw invErr;
        invoiceId = invoice.id;
      }

      // Snapshot inventory trước khi bán
      const beforeMap: Record<string, number> = {};
      for (const it of validItems) {
        const { data: inv } = await supabase
          .from('inventory').select('quantity')
          .eq('product_id', it.product_id).eq('user_id', userId).maybeSingle();
        beforeMap[it.product_id] = Number(inv?.quantity ?? 0);
      }

      // Insert sales — tính VAT đúng cho từng dòng
      const salesRows = validItems.map(it => {
        const product = products.find(p => p.id === it.product_id);
        const actualQty = toActualQty(it, product);
        const pricePerPiece = toUnitPricePerPiece(it, product);
        const lineTotal = actualQty * pricePerPiece;
        const lineVat = Math.round(lineTotal * vatRateFraction);
        return {
          user_id: userId,
          product_id: it.product_id,
          invoice_id: invoiceId,
          sale_date: saleDate,
          quantity: actualQty,             // cái
          unit_price: pricePerPiece,       // giá/cái (chưa VAT)
          total_amount: lineTotal,          // tổng trước thuế
          vat_amount: lineVat,              // tiền thuế
          total_with_vat: lineTotal + lineVat, // tổng sau thuế → dashboard dùng cái này
          customer_name: customerName || 'Khách lẻ',
          customer_address: customerAddress || null,
          customer_tax_code: customerTaxCode || null,
          notes: notes || null,
        };
      });

      const { error: salesErr } = await supabase.from('sales').insert(salesRows);
      if (salesErr) throw salesErr;

      // Check & update inventory
      for (const it of validItems) {
        const product = products.find(p => p.id === it.product_id);
        const actualQty = toActualQty(it, product);

        const { data: afterInv } = await supabase
          .from('inventory').select('id, quantity')
          .eq('product_id', it.product_id).eq('user_id', userId).maybeSingle();

        const afterQty = Number(afterInv?.quantity ?? 0);
        const expectedQty = beforeMap[it.product_id] - actualQty;
        const triggerRan = Math.abs(afterQty - expectedQty) < 0.001;

        if (!triggerRan && afterInv) {
          await supabase.from('inventory').update({
            quantity: Math.max(0, expectedQty),
            last_updated: new Date().toISOString(),
          }).eq('id', afterInv.id);
        }
      }

      // Build summary message
      const summaryParts = validItems.map(it => {
        const product = products.find(p => p.id === it.product_id);
        if (it.input_unit === 'box' && product?.box_quantity) {
          return `${it.quantity} thùng (= ${toActualQty(it, product)} ${product.unit})`;
        }
        return `${it.quantity} ${product?.unit || 'cái'}`;
      });
      toast.success(`Bán hàng thành công: ${summaryParts.join(', ')}`);
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="text-xs text-green-600 mb-1">Doanh thu</div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="text-xs text-blue-600 mb-1">Số giao dịch</div>
            <div className="text-lg font-bold text-blue-700">{filtered.length}</div>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
            <div className="text-xs text-purple-600 mb-1">Trung bình / giao dịch</div>
            <div className="text-lg font-bold text-purple-700">{formatCurrency(filtered.length ? totalRevenue / filtered.length : 0)}</div>
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
                  <th className="text-right">SL (cái)</th>
                  <th className="text-right">Đơn giá/cái</th>
                  <th className="text-right">Thành tiền</th>
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
                      <td className="text-right font-mono">{sale.quantity} {sale.product?.unit}</td>
                      <td className="text-right font-mono">{formatCurrency(sale.unit_price)}</td>
                      <td className="text-right font-mono font-medium text-green-600">{formatCurrency(sale.total_amount)}</td>
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
              <div className="text-gray-500">
                Trước thuế: <span className="font-medium text-gray-700">{formatCurrency(subtotalAll)}</span>
                {vatRate > 0 && (
                  <span className="ml-2 text-orange-500">+ VAT {vatRate}%: {formatCurrency(vatAmountAll)}</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Tổng thanh toán: </span>
                <span className="font-bold text-green-600 text-base">{formatCurrency(totalWithVatAll)}</span>
              </div>
            </div>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Hủy</button>
            <button onClick={handleSave} className="btn btn-success" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận bán'}
            </button>
          </>
        }
      >
        {/* Thông tin khách hàng */}
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

        {/* Danh sách hàng hóa */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label mb-0 font-semibold">Danh sách hàng hóa bán</label>
            <button type="button" onClick={addItem} className="btn btn-ghost btn-sm text-green-600">
              <PlusCircle className="w-4 h-4 mr-1" /> Thêm mặt hàng
            </button>
          </div>

          {items.map((item, idx) => {
            const product = products.find(p => p.id === item.product_id);
            const hasBox = !!(product?.box_quantity && product.box_quantity > 0);
            const actualQty = toActualQty(item, product);
            const pricePerPiece = toUnitPricePerPiece(item, product);
            const lineTotal = item.quantity * item.unit_price;
            const stockPieces = product ? (inventoryMap[product.id] ?? 0) : 0;
            const maxInUnit = product
              ? (item.input_unit === 'box' && product.box_quantity
                  ? Math.floor(stockPieces / product.box_quantity)
                  : stockPieces)
              : 0;
            const isOverStock = !!(product && item.quantity > 0 && actualQty > stockPieces);

            return (
              <div key={idx} className={`border rounded-lg p-3 ${isOverStock ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                {/* Hàng 1: chọn sản phẩm */}
                <div className="grid gap-2 items-start mb-2" style={{ gridTemplateColumns: '1fr auto' }}>
                  <SearchableSelect
                    value={item.product_id}
                    onChange={(val) => updateItem(idx, 'product_id', val)}
                    placeholder="-- Chọn hàng hóa --"
                    options={products.map(p => {
                      const stock = inventoryMap[p.id] ?? 0;
                      return {
                        value: p.id,
                        label: `${p.code} - ${p.name}`,
                        sublabel: `Tồn: ${stock} ${p.unit}${p.box_quantity ? ` (${Math.floor(stock / p.box_quantity)} thùng)` : ''} · Giá bán: ${p.selling_price.toLocaleString('vi-VN')}đ`,
                      };
                    })}
                  />
                  <button type="button" onClick={() => removeItem(idx)} className="btn btn-ghost btn-sm text-red-400" disabled={items.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Tồn kho hiện tại */}
                {product && (
                  <div className={`flex items-center justify-between text-xs px-1 mb-2 py-1.5 rounded-md ${isOverStock ? 'bg-red-100 border border-red-300' : 'bg-white border border-gray-200'}`}>
                    <span className={`font-medium flex items-center gap-1 ${isOverStock ? 'text-red-600' : 'text-gray-600'}`}>
                      📦 Tồn kho:&nbsp;
                      <strong className={stockPieces <= 0 ? 'text-red-500' : 'text-green-700'}>
                        {stockPieces} {product.unit}
                      </strong>
                      {hasBox && product.box_quantity && stockPieces > 0 && (
                        <span className="text-gray-400 font-normal">
                          &nbsp;(= {Math.floor(stockPieces / product.box_quantity)} thùng
                          {stockPieces % product.box_quantity > 0 ? ` + ${stockPieces % product.box_quantity} ${product.unit}` : ''})
                        </span>
                      )}
                    </span>
                    {isOverStock ? (
                      <span className="text-red-600 font-bold">⚠️ Vượt {actualQty - stockPieces} {product.unit}!</span>
                    ) : item.quantity > 0 ? (
                      <span className="text-green-600">Còn lại: {stockPieces - actualQty} {product.unit}</span>
                    ) : null}
                  </div>
                )}

                {/* Hàng 2: đơn vị + số lượng + đơn giá */}
                <div className="grid gap-2 items-start" style={{ gridTemplateColumns: hasBox ? '1.2fr 1fr 1.2fr' : '1fr 1.2fr' }}>
                  {/* Toggle đơn vị */}
                  {hasBox && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Đơn vị xuất</label>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'input_unit', 'piece')}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${item.input_unit === 'piece' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          {product?.unit || 'Cái'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'input_unit', 'box')}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${item.input_unit === 'box' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          Thùng
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Số lượng {item.input_unit === 'box' ? '(thùng)' : product ? `(${product.unit})` : ''}
                      {product && (
                        maxInUnit > 0
                          ? <span className="text-gray-400 ml-1">· tối đa {maxInUnit}</span>
                          : <span className="text-red-500 ml-1 font-semibold">· hết hàng!</span>
                      )}
                    </label>
                    <input
                      className={`form-input text-right ${isOverStock ? 'border-red-400 bg-red-50 focus:border-red-500' : ''}`}
                      type="number"
                      min="1"
                      max={maxInUnit > 0 ? maxInUnit : undefined}
                      placeholder="SL"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Đơn giá {item.input_unit === 'box' ? '(/ thùng)' : product ? `(/ ${product.unit})` : ''}
                    </label>
                    <input
                      className="form-input text-right"
                      type="number"
                      min="0"
                      placeholder="Đơn giá"
                      value={item.unit_price || ''}
                      onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                    />
                  </div>
                </div>

                {/* Preview */}
                {product && item.quantity > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 px-1">
                    <div className="flex items-center gap-2">
                      {item.input_unit === 'box' && hasBox ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <Package className="w-3 h-3" />
                          {item.quantity} thùng × {product.box_quantity} = <strong>{actualQty} {product.unit}</strong>
                          {' · '}
                          Giá/cái: {formatCurrency(pricePerPiece)}
                        </span>
                      ) : (
                        <span>ĐVT: {product.unit} · Giá bán gốc: {formatCurrency(product.selling_price)}</span>
                      )}
                    </div>
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
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createInvoice}
              onChange={(e) => setCreateInvoice(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Tự động tạo hóa đơn</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Thuế GTGT:</span>
            <select
              className="form-select py-1.5 text-sm"
              style={{ width: 'auto' }}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
            >
              <option value={0}>0% (không thuế)</option>
              <option value={8}>8%</option>
              <option value={10}>10%</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}
