'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Search, Warehouse, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { confirm } from '@/components/ConfirmDialog';
import type { Inventory, Product } from '@/lib/types';
import toast from 'react-hot-toast';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<(Inventory & { product?: Product })[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => { loadInventory(); }, []);

  async function loadInventory() {
    try {
      const { data } = await supabase
        .from('inventory')
        .select('*, product:products(*)')
        .order('quantity', { ascending: true });
      if (data) setInventory(data);
    } catch { /* Supabase not connected */ }
  }

  async function handleDelete(item: Inventory & { product?: Product }) {
    const name = item.product?.name || 'sản phẩm này';
    if (!await confirm({
      title: 'Xóa khỏi tồn kho',
      message: `Xóa "${name}" (tồn kho: ${item.quantity}) khỏi danh sách hàng hóa?\n\nHành động này sẽ ẩn sản phẩm khỏi toàn bộ hệ thống.`,
      confirmText: 'Xóa',
      danger: true,
    })) return;

    try {
      const res = await fetch(`/api/products/${item.product_id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi xóa sản phẩm');
      }
      toast.success(`Đã xóa "${name}" khỏi hệ thống`);
      setInventory(prev => prev.filter(i => i.id !== item.id));
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa sản phẩm');
    }
  }

  const filtered = inventory.filter((item) => {
    const matchSearch = !search ||
      item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
      item.product?.code.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'low' && item.quantity > 0 && item.quantity < 10) ||
      (filter === 'out' && item.quantity <= 0);
    return matchSearch && matchFilter;
  });

  const totalValue = filtered.reduce((sum, item) => sum + (item.quantity * (item.product?.purchase_price || 0)), 0);
  const lowStockCount = inventory.filter((i) => i.quantity > 0 && i.quantity < 10).length;
  const outOfStockCount = inventory.filter((i) => i.quantity <= 0).length;

  function getStockBadge(qty: number) {
    if (qty <= 0) return <span className="badge badge-danger">Hết hàng</span>;
    if (qty < 10) return <span className="badge badge-warning">Sắp hết</span>;
    return <span className="badge badge-success">Còn hàng</span>;
  }

  return (
    <>
      <Header
        title="Tồn kho"
        subtitle="Theo dõi số lượng tồn kho tự động"
        onMenuClick={() => { }}
      />

      <div className="page-content">
        {/* Summary */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="stat-card cursor-pointer" onClick={() => setFilter('all')}>
            <div className={`stat-icon blue`}>
              <Warehouse className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <h3>Tổng mặt hàng</h3>
              <div className="stat-value">{inventory.length}</div>
            </div>
          </div>
          <div className="stat-card cursor-pointer" onClick={() => setFilter('low')}>
            <div className="stat-icon orange">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <h3>Sắp hết</h3>
              <div className="stat-value">{lowStockCount}</div>
            </div>
          </div>
          <div className="stat-card cursor-pointer" onClick={() => setFilter('out')}>
            <div className="stat-icon red">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <h3>Hết hàng</h3>
              <div className="stat-value">{outOfStockCount}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <Warehouse className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <h3>Giá trị tồn</h3>
              <div className="stat-value text-base">{formatCurrency(totalValue)}</div>
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input type="text" placeholder="Tìm theo mã hoặc tên hàng hóa..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Tất cả</option>
            <option value="low">Sắp hết hàng</option>
            <option value="out">Hết hàng</option>
          </select>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã HH</th>
                  <th>Tên hàng hóa</th>
                  <th>ĐVT</th>
                  <th className="text-right">Tồn kho</th>
                  <th className="text-right">Giá vốn</th>
                  <th className="text-right">Giá trị tồn</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Không có dữ liệu tồn kho</h3>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="text-center text-gray-400 text-sm font-mono">{idx + 1}</td>
                      <td className="font-medium">{item.product?.name}</td>
                      <td>{item.product?.unit}</td>
                      <td className={`text-right font-mono font-bold ${item.quantity <= 0 ? 'text-red-500' : ''}`}>
                        {item.quantity}
                      </td>
                      <td className="text-right font-mono">{formatCurrency(item.product?.purchase_price || 0)}</td>
                      <td className="text-right font-mono">{formatCurrency(item.quantity * (item.product?.purchase_price || 0))}</td>
                      <td className="text-center">{getStockBadge(item.quantity)}</td>
                      <td className="text-center">
                        {/* Chỉ cho xóa khi hết hàng */}
                        {item.quantity <= 0 && (
                          <button
                            onClick={() => handleDelete(item)}
                            className="btn btn-ghost btn-sm text-red-500"
                            title="Xóa sản phẩm hết hàng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {outOfStockCount > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            💡 Chỉ có thể xóa sản phẩm có tồn kho = 0. Xóa sẽ ẩn sản phẩm khỏi toàn bộ hệ thống.
          </p>
        )}
      </div>
    </>
  );
}
