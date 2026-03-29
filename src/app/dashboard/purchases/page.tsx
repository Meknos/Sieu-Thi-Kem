/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, ShoppingCart, Trash2, PlusCircle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { confirm } from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';
import type { Purchase, Product } from '@/lib/types';
import toast from 'react-hot-toast';

interface PurchaseItem {
  product_id: string;
  quantity: number;        // số lượng theo đơn vị đã chọn
  unit_price: number;      // giá theo đơn vị đã chọn
  input_unit: 'piece' | 'box'; // đơn vị nhập: piece = cái, box = thùng
}

const emptyItem = (): PurchaseItem => ({ product_id: '', quantity: 0, unit_price: 0, input_unit: 'piece' });

/** Tính số cái thực tế từ lượng nhập */
function toActualQty(item: PurchaseItem, product?: Product): number {
  if (item.input_unit === 'box' && product?.box_quantity) {
    return item.quantity * product.box_quantity;
  }
  return item.quantity;
}

/** Tính giá mỗi cái từ giá nhập */
function toUnitPricePerPiece(item: PurchaseItem, product?: Product): number {
  if (item.input_unit === 'box' && product?.box_quantity) {
    return item.unit_price / product.box_quantity;
  }
  return item.unit_price;
}

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
      const [{ data: productsData }, { data: purchasesData }, { data: invData }] = await Promise.all([
        // Tải TẤT CẢ sản phẩm — lọc client-side
        supabase.from('products').select('*').order('name'),
        supabase.from('purchases').select('*, product:products(*)').order('purchase_date', { ascending: false }),
        supabase.from('inventory').select('product_id, quantity'),
      ]);

      if (invData && productsData) {
        const invMap: Record<string, number> = {};
        invData.forEach(i => { invMap[i.product_id] = Number(i.quantity); });
        // Nhập hàng — hiển tất cả sản phẩm is_active HOẶC còn tồn kho
        setProducts(productsData.filter(p => p.is_active || (invMap[p.id] ?? 0) > 0));
      } else if (productsData) {
        setProducts(productsData.filter(p => p.is_active));
      }

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
        next[idx] = {
          ...next[idx],
          product_id: value as string,
          unit_price: product?.purchase_price || 0,
          input_unit: 'piece', // reset về cái khi đổi sản phẩm
        };
      } else if (field === 'input_unit') {
        const product = products.find(p => p.id === next[idx].product_id);
        const newUnit = value as 'piece' | 'box';
        // Tự động điều chỉnh đơn giá khi đổi đơn vị
        let newPrice = next[idx].unit_price;
        if (newUnit === 'box' && product?.box_quantity) {
          // Đổi sang thùng: giá thùng = giá cái * số cái/thùng
          if (next[idx].input_unit === 'piece') {
            newPrice = next[idx].unit_price * product.box_quantity;
          }
        } else if (newUnit === 'piece' && product?.box_quantity) {
          // Đổi về cái: giá cái = giá thùng / số cái/thùng
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

  // Tính tổng theo giá nhập (không convert)
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

      // Snapshot inventory BEFORE inserting
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

      // Convert sang cái khi lưu
      const rows = validItems.map(it => {
        const product = products.find(p => p.id === it.product_id);
        const actualQty = toActualQty(it, product);
        const pricePerPiece = toUnitPricePerPiece(it, product);
        return {
          user_id: userId,
          product_id: it.product_id,
          purchase_date: purchaseDate,
          quantity: actualQty,             // luôn lưu theo cái
          unit_price: pricePerPiece,        // luôn lưu giá/cái
          total_amount: actualQty * pricePerPiece,
          supplier_name: supplierName || null,
          supplier_invoice: supplierInvoice || null,
          notes: notes || null,
        };
      });

      const { error: purchaseError } = await supabase.from('purchases').insert(rows);
      if (purchaseError) throw purchaseError;

      // Check & update inventory
      for (const it of validItems) {
        const product = products.find(p => p.id === it.product_id);
        const actualQty = toActualQty(it, product);

        const { data: afterInv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', it.product_id)
          .eq('user_id', userId)
          .maybeSingle();

        const afterQty = Number(afterInv?.quantity ?? 0);
        const expectedQty = beforeMap[it.product_id] + actualQty;
        const triggerRan = Math.abs(afterQty - expectedQty) < 0.001;

        if (!triggerRan) {
          if (afterInv) {
            await supabase.from('inventory').update({
              quantity: expectedQty,
              last_updated: new Date().toISOString(),
            }).eq('id', afterInv.id);
          } else {
            await supabase.from('inventory').insert({
              user_id: userId,
              product_id: it.product_id,
              quantity: actualQty,
              last_updated: new Date().toISOString(),
            });
          }
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
      toast.success(`Nhập hàng thành công: ${summaryParts.join(', ')}`);
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
                  <th className="text-right">Số lượng (cái)</th>
                  <th className="text-right">Đơn giá/cái</th>
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
                      <td className="text-right font-mono">{purchase.quantity} {purchase.product?.unit}</td>
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

          {items.map((item, idx) => {
            const product = products.find(p => p.id === item.product_id);
            const hasBox = !!(product?.box_quantity && product.box_quantity > 0);
            const actualQty = toActualQty(item, product);
            const pricePerPiece = toUnitPricePerPiece(item, product);
            const lineTotal = item.quantity * item.unit_price;

            return (
              <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                {/* Hàng 1: chọn sản phẩm */}
                <div className="grid gap-2 items-start mb-2" style={{ gridTemplateColumns: '1fr auto' }}>
                  <SearchableSelect
                    value={item.product_id}
                    onChange={(val) => updateItem(idx, 'product_id', val)}
                    placeholder="-- Chọn hàng hóa --"
                    options={products.map(p => ({
                      value: p.id,
                      label: `${p.code} - ${p.name}`,
                      sublabel: p.box_quantity
                        ? `ĐVT: ${p.unit} | 1 thùng = ${p.box_quantity} ${p.unit} | Giá nhập: ${p.purchase_price.toLocaleString('vi-VN')}đ`
                        : `ĐVT: ${p.unit} | Giá nhập: ${p.purchase_price.toLocaleString('vi-VN')}đ`,
                    }))}
                  />
                  <button type="button" onClick={() => removeItem(idx)} className="btn btn-ghost btn-sm text-red-400" disabled={items.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Hàng 2: đơn vị + số lượng + đơn giá */}
                <div className="grid gap-2 items-start" style={{ gridTemplateColumns: hasBox ? '1.2fr 1fr 1.2fr' : '1fr 1.2fr' }}>
                  {/* Chọn đơn vị – chỉ hiện khi sản phẩm có box_quantity */}
                  {hasBox && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Đơn vị nhập</label>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'input_unit', 'piece')}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${item.input_unit === 'piece' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          {product?.unit || 'Cái'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(idx, 'input_unit', 'box')}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${item.input_unit === 'box' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          Thùng
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Số lượng {item.input_unit === 'box' ? '(thùng)' : product ? `(${product.unit})` : ''}
                    </label>
                    <input
                      className="form-input text-right"
                      type="number"
                      min="1"
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

                {/* Preview convert */}
                {product && item.quantity > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 px-1">
                    <div className="flex items-center gap-2">
                      {item.input_unit === 'box' && hasBox ? (
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                          <Package className="w-3 h-3" />
                          {item.quantity} thùng × {product.box_quantity} = <strong>{actualQty} {product.unit}</strong>
                          {' · '}
                          Giá/cái: {formatCurrency(pricePerPiece)}
                        </span>
                      ) : (
                        <span>ĐVT: {product.unit}</span>
                      )}
                    </div>
                    <span className="font-medium text-red-600">= {formatCurrency(lineTotal)}</span>
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
