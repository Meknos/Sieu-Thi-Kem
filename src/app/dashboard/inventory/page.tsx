'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Search, Warehouse, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import type { Inventory, Product } from '@/lib/types';

const demoInventory: (Inventory & { product?: Product })[] = [
  { id: '1', user_id: '', product_id: '1', quantity: 50, last_updated: '2026-03-25T10:00:00', product: { id: '1', user_id: '', code: 'XM001', name: 'Xi măng PCB40 Hà Tiên', unit: 'bao', purchase_price: 85000, selling_price: 95000, is_active: true, created_at: '', updated_at: '' } },
  { id: '2', user_id: '', product_id: '2', quantity: 300, last_updated: '2026-03-25T10:00:00', product: { id: '2', user_id: '', code: 'TH001', name: 'Thép cuộn phi 10 Hòa Phát', unit: 'kg', purchase_price: 14500, selling_price: 16000, is_active: true, created_at: '', updated_at: '' } },
  { id: '3', user_id: '', product_id: '3', quantity: 8, last_updated: '2026-03-25T10:00:00', product: { id: '3', user_id: '', code: 'GO001', name: 'Gạch ống 4 lỗ', unit: 'viên', purchase_price: 800, selling_price: 1100, is_active: true, created_at: '', updated_at: '' } },
  { id: '4', user_id: '', product_id: '4', quantity: 25, last_updated: '2026-03-25T10:00:00', product: { id: '4', user_id: '', code: 'SN001', name: 'Sơn nước Dulux 5L', unit: 'thùng', purchase_price: 320000, selling_price: 380000, is_active: true, created_at: '', updated_at: '' } },
  { id: '5', user_id: '', product_id: '5', quantity: 0, last_updated: '2026-03-25T10:00:00', product: { id: '5', user_id: '', code: 'TL001', name: 'Tôn lợp 5 sóng', unit: 'mét', purchase_price: 72000, selling_price: 85000, is_active: true, created_at: '', updated_at: '' } },
];

export default function InventoryPage() {
  const [inventory, setInventory] = useState<(Inventory & { product?: Product })[]>(demoInventory);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    try {
      const { data } = await supabase
        .from('inventory')
        .select('*, product:products(*)')
        .order('quantity', { ascending: true });

      if (data && data.length > 0) setInventory(data);
    } catch { console.log('Using demo data'); }
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
        onMenuClick={() => {}}
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
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Không có dữ liệu tồn kho</h3>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono font-medium text-blue-600">{item.product?.code}</td>
                      <td className="font-medium">{item.product?.name}</td>
                      <td>{item.product?.unit}</td>
                      <td className="text-right font-mono font-bold">{item.quantity}</td>
                      <td className="text-right font-mono">{formatCurrency(item.product?.purchase_price || 0)}</td>
                      <td className="text-right font-mono">{formatCurrency(item.quantity * (item.product?.purchase_price || 0))}</td>
                      <td className="text-center">{getStockBadge(item.quantity)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
