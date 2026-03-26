/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { confirm } from '@/components/ConfirmDialog';
import type { Product, ProductInput } from '@/lib/types';
import toast from 'react-hot-toast';



const emptyProduct: ProductInput = {
  code: '',
  name: '',
  unit: 'cái',
  purchase_price: 0,
  selling_price: 0,
  description: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({}); // product_id → quantity
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [{ data: prods }, { data: invData }] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('inventory').select('product_id, quantity'),
      ]);
      if (prods) setProducts(prods);
      if (invData) {
        const map: Record<string, number> = {};
        invData.forEach(i => { map[i.product_id] = Number(i.quantity); });
        setInventory(map);
      }
    } catch { /* Supabase not connected */ }
  }

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  function handleAdd() {
    setEditingId(null);
    setForm(emptyProduct);
    setShowModal(true);
  }

  function handleEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      code: product.code,
      name: product.name,
      unit: product.unit,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      description: product.description || '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.code || !form.name) {
      toast.error('Vui lòng nhập mã và tên hàng hóa');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(form)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Cập nhật thành công');
      } else {
        const { error } = await supabase
          .from('products')
          .insert({ ...form, user_id: (await supabase.auth.getUser()).data.user?.id });

        if (error) throw error;
        toast.success('Thêm hàng hóa thành công');
      }

      await loadAll();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra');
      // Demo mode: update local state
      if (editingId) {
        setProducts((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...form } : p))
        );
      } else {
        setProducts((prev) => [
          { ...form, id: Date.now().toString(), user_id: '', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Product,
          ...prev,
        ]);
      }
      setShowModal(false);
      toast.success(editingId ? 'Cập nhật (demo)' : 'Thêm mới (demo)');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(product: Product) {
    const stock = inventory[product.id] ?? 0;
    if (stock > 0) {
      toast.error(`Không thể xóa: "${product.name}" còn ${stock} trong tồn kho. Bán hết hàng trước.`);
      return;
    }
    if (!await confirm({
      title: 'Xóa hàng hóa',
      message: `Xóa "${product.name}"? Hành động này sẽ ẩn sản phẩm khỏi toàn bộ hệ thống.`,
      confirmText: 'Xóa',
      danger: true,
    })) return;

    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Lỗi xóa');
      toast.success(`Đã xóa "${product.name}"`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa hàng hóa');
    }
  }

  return (
    <>
      <Header
        title="Quản lý Hàng hóa"
        subtitle="Danh sách hàng hóa, dịch vụ"
        onMenuClick={() => {}}
        actions={
          <button onClick={handleAdd} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Thêm hàng hóa
          </button>
        }
      />

      <div className="page-content">
        {/* Search */}
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input
              type="text"
              placeholder="Tìm theo mã hoặc tên hàng hóa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>STT</th>
                  <th>Mã HH</th>
                  <th>Tên hàng hóa</th>
                  <th>ĐVT</th>
                  <th className="text-right">Giá mua</th>
                  <th className="text-right">Giá bán</th>
                  <th className="text-right">Lợi nhuận</th>
                  <th className="text-right">Tồn kho</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Chưa có hàng hóa</h3>
                        <p>Nhấn &quot;Thêm hàng hóa&quot; để bắt đầu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((product, idx) => (
                <tr key={product.id}>
                      <td className="text-center text-gray-400 text-sm">{idx + 1}</td>
                      <td className="font-mono font-medium text-blue-600">{product.code}</td>
                      <td className="font-medium">{product.name}</td>
                      <td>{product.unit}</td>
                      <td className="text-right font-mono">{formatCurrency(product.purchase_price)}</td>
                      <td className="text-right font-mono">{formatCurrency(product.selling_price)}</td>
                      <td className="text-right font-mono text-green-600">
                        {formatCurrency(product.selling_price - product.purchase_price)}
                      </td>
                      <td className="text-right font-mono">
                        {(() => {
                          const qty = inventory[product.id] ?? 0;
                          if (qty <= 0) return <span className="badge badge-danger">Hết</span>;
                          if (qty < 10) return <span className="badge badge-warning">{qty}</span>;
                          return <span className="badge badge-success">{qty}</span>;
                        })()}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(product)}
                            className="btn btn-ghost btn-sm"
                            title="Sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="btn btn-ghost btn-sm text-red-500"
                            title={(inventory[product.id] ?? 0) > 0 ? `Còn ${inventory[product.id]} tồn kho, không thể xóa` : 'Xóa hàng hóa'}
                            disabled={(inventory[product.id] ?? 0) > 0}
                            style={{ opacity: (inventory[product.id] ?? 0) > 0 ? 0.3 : 1 }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Sửa hàng hóa' : 'Thêm hàng hóa mới'}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">
              Hủy
            </button>
            <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Mã hàng hóa *</label>
            <input
              className="form-input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="VD: SP001"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Đơn vị tính</label>
            <select
              className="form-select"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="cái">Cái</option>
              <option value="chiếc">Chiếc</option>
              <option value="bao">Bao</option>
              <option value="kg">Kg</option>
              <option value="mét">Mét</option>
              <option value="viên">Viên</option>
              <option value="thùng">Thùng</option>
              <option value="lít">Lít</option>
              <option value="bộ">Bộ</option>
              <option value="tấn">Tấn</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tên hàng hóa *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nhập tên hàng hóa"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Giá mua (VNĐ)</label>
            <input
              className="form-input"
              type="number"
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Giá bán (VNĐ)</label>
            <input
              className="form-input"
              type="number"
              value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Mô tả</label>
          <textarea
            className="form-textarea"
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ghi chú thêm..."
          />
        </div>
      </Modal>
    </>
  );
}
