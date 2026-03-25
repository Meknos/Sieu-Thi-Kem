'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { Product, ProductInput } from '@/lib/types';
import toast from 'react-hot-toast';

const demoProducts: Product[] = [
  { id: '1', user_id: '', code: 'XM001', name: 'Xi măng PCB40 Hà Tiên', unit: 'bao', purchase_price: 85000, selling_price: 95000, category: 'Vật liệu xây dựng', is_active: true, created_at: '', updated_at: '' },
  { id: '2', user_id: '', code: 'TH001', name: 'Thép cuộn phi 10 Hòa Phát', unit: 'kg', purchase_price: 14500, selling_price: 16000, category: 'Sắt thép', is_active: true, created_at: '', updated_at: '' },
  { id: '3', user_id: '', code: 'GO001', name: 'Gạch ống 4 lỗ', unit: 'viên', purchase_price: 800, selling_price: 1100, category: 'Vật liệu xây dựng', is_active: true, created_at: '', updated_at: '' },
  { id: '4', user_id: '', code: 'SN001', name: 'Sơn nước Dulux nội thất 5L', unit: 'thùng', purchase_price: 320000, selling_price: 380000, category: 'Sơn', is_active: true, created_at: '', updated_at: '' },
  { id: '5', user_id: '', code: 'TL001', name: 'Tôn lợp 5 sóng 0.35mm', unit: 'mét', purchase_price: 72000, selling_price: 85000, category: 'Tôn', is_active: true, created_at: '', updated_at: '' },
];

const emptyProduct: ProductInput = {
  code: '',
  name: '',
  unit: 'cái',
  purchase_price: 0,
  selling_price: 0,
  category: '',
  description: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyProduct);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setProducts(data);
      }
    } catch (e) {
      console.log('Using demo data');
    }
  }

  const filtered = products.filter(
    (p) =>
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
      category: product.category || '',
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

      await loadProducts();
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

  async function handleDelete(id: string) {
    if (!confirm('Bạn có chắc muốn xóa hàng hóa này?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Đã xóa');
      await loadProducts();
    } catch {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Đã xóa (demo)');
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
                  <th>Mã HH</th>
                  <th>Tên hàng hóa</th>
                  <th>ĐVT</th>
                  <th>Danh mục</th>
                  <th className="text-right">Giá mua</th>
                  <th className="text-right">Giá bán</th>
                  <th className="text-right">Lợi nhuận</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Chưa có hàng hóa</h3>
                        <p>Nhấn &quot;Thêm hàng hóa&quot; để bắt đầu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((product) => (
                    <tr key={product.id}>
                      <td className="font-mono font-medium text-blue-600">{product.code}</td>
                      <td className="font-medium">{product.name}</td>
                      <td>{product.unit}</td>
                      <td>
                        {product.category && (
                          <span className="badge badge-info">{product.category}</span>
                        )}
                      </td>
                      <td className="text-right font-mono">{formatCurrency(product.purchase_price)}</td>
                      <td className="text-right font-mono">{formatCurrency(product.selling_price)}</td>
                      <td className="text-right font-mono text-green-600">
                        {formatCurrency(product.selling_price - product.purchase_price)}
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
                            onClick={() => handleDelete(product.id)}
                            className="btn btn-ghost btn-sm text-red-500"
                            title="Xóa"
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
        <div className="form-group">
          <label className="form-label">Danh mục</label>
          <input
            className="form-input"
            value={form.category || ''}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="VD: Vật liệu xây dựng"
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
