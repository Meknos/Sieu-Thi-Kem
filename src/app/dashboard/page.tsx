/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import {
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { apiGet } from '@/lib/api';
import type { DashboardStats, Sale, Purchase } from '@/lib/types';

const emptyStats: DashboardStats = {
  total_products: 0,
  total_revenue_today: 0,
  total_revenue_month: 0,
  total_revenue_year: 0,
  total_purchases_month: 0,
  low_stock_count: 0,
  total_invoices_month: 0,
  vat_payable_month: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const data = await apiGet<DashboardStats>('/api/dashboard');
      // Only update if we got real data
      if (data) setStats(data);
      // Fetch recent sales
      const sales = await apiGet<any[]>('/api/sales');
      if (sales?.length) setRecentSales(sales.slice(0, 5));
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      label: 'Doanh thu hôm nay',
      value: formatCurrency(stats.total_revenue_today),
      icon: DollarSign,
      color: 'blue' as const,
      sub: 'Cập nhật realtime',
    },
    {
      label: 'Doanh thu tháng',
      value: formatCurrency(stats.total_revenue_month),
      icon: TrendingUp,
      color: 'green' as const,
      sub: `Chi phí: ${formatCurrency(stats.total_purchases_month)}`,
    },
    {
      label: 'Tổng sản phẩm',
      value: stats.total_products.toString(),
      icon: Package,
      color: 'purple' as const,
      sub: `${stats.low_stock_count} sắp hết hàng`,
    },
    {
      label: 'Hóa đơn tháng',
      value: stats.total_invoices_month.toString(),
      icon: FileText,
      color: 'orange' as const,
      sub: `VAT: ${formatCurrency(stats.vat_payable_month)}`,
    },
  ];

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Tổng quan kinh doanh • ${formatDate(new Date())}`}
        onMenuClick={() => {}}
      />

      <div className="page-content">
        {/* Stat Cards */}
        <div className="stats-grid">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="stat-card">
                <div className={`stat-icon ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="stat-info">
                  <h3>{stat.label}</h3>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-sub">{stat.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart Placeholder */}
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">Doanh thu năm {new Date().getFullYear()}</h2>
              <span className="text-sm text-gray-500">{formatCurrency(stats.total_revenue_year)}</span>
            </div>
            <div className="card-body">
              <div className="flex items-end gap-2 h-48">
                {[65, 45, 72, 58, 80, 62, 90, 75, 85, 70, 55, 0].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{
                        height: `${h}%`,
                        background: i === new Date().getMonth()
                          ? 'linear-gradient(to top, #2563eb, #60a5fa)'
                          : 'linear-gradient(to top, #e2e8f0, #cbd5e1)',
                        minHeight: h > 0 ? '8px' : '2px',
                      }}
                    />
                    <span className="text-[10px] text-gray-400">T{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Thuế phải nộp</h2>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </div>
            <div className="card-body space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="text-xs text-blue-600 font-medium mb-1">Thuế GTGT (8%)</div>
                <div className="text-xl font-bold text-blue-700">
                  {formatCurrency(stats.vat_payable_month)}
                </div>
                <div className="text-xs text-blue-500 mt-1">Tháng này</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                <div className="text-xs text-purple-600 font-medium mb-1">Thuế TNCN (1.5%)</div>
                <div className="text-xl font-bold text-purple-700">
                  {formatCurrency(Math.round(stats.total_revenue_month * 0.015))}
                </div>
                <div className="text-xs text-purple-500 mt-1">Tháng này</div>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                <div className="text-xs text-orange-600 font-medium mb-1">Lợi nhuận ước tính</div>
                <div className="text-xl font-bold text-orange-700">
                  {formatCurrency(stats.total_revenue_month - stats.total_purchases_month)}
                </div>
                <div className="text-xs text-orange-500 mt-1">Trước thuế</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card mt-6">
          <div className="card-header">
            <h2 className="card-title">Giao dịch gần đây</h2>
            <a href="/dashboard/sales" className="btn btn-ghost btn-sm">
              Xem tất cả <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th>Sản phẩm</th>
                  <th className="text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale: any) => (
                  <tr key={sale.id}>
                    <td className="font-mono text-sm">{formatDate(sale.sale_date)}</td>
                    <td className="font-medium">{sale.customer_name || 'Khách lẻ'}</td>
                    <td className="text-gray-600">{sale.product?.name}</td>
                    <td className="text-right font-mono font-medium text-green-600">
                      {formatCurrency(sale.total_with_vat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alert */}
        {stats.low_stock_count > 0 && (
          <div className="card mt-6 border-orange-200 bg-orange-50/50">
            <div className="card-body flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <span className="font-medium text-orange-700">Cảnh báo tồn kho: </span>
                <span className="text-orange-600">
                  Có {stats.low_stock_count} sản phẩm sắp hết hàng. Kiểm tra tại{' '}
                  <a href="/dashboard/inventory" className="underline font-medium">
                    trang tồn kho
                  </a>.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
