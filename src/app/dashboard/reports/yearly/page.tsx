'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { FileDown, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function YearlyReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  // Demo data
  const quarterlyData = [
    { quarter: 1, revenue: 85000000, cost: 62000000 },
    { quarter: 2, revenue: 92000000, cost: 67000000 },
    { quarter: 3, revenue: 105000000, cost: 76000000 },
    { quarter: 4, revenue: 120000000, cost: 85000000 },
  ];

  const totalRevenue = quarterlyData.reduce((s, q) => s + q.revenue, 0);
  const totalCost = quarterlyData.reduce((s, q) => s + q.cost, 0);
  const profit = totalRevenue - totalCost;
  const vatAmount = Math.round(totalRevenue * 0.08);
  const pitAmount = Math.round(totalRevenue * 0.015);
  const profitMargin = ((profit / totalRevenue) * 100).toFixed(1);

  return (
    <>
      <Header
        title="Báo cáo Năm"
        subtitle={`Năm ${year}`}
        onMenuClick={() => {}}
        actions={
          <button className="btn btn-primary" onClick={() => alert('PDF export')}>
            <FileDown className="w-4 h-4" /> Xuất PDF
          </button>
        }
      />

      <div className="page-content">
        <div className="toolbar">
          <div className="filter-group">
            <label>Năm:</label>
            <select className="form-select" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Annual Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon green"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Tổng doanh thu năm</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon red"><TrendingDown className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Tổng chi phí</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCost)}</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full" style={{ width: `${(totalCost / totalRevenue) * 100}%` }} />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="stat-icon blue"><Calendar className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Lợi nhuận ({profitMargin}%)</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(profit)}</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${profitMargin}%` }} />
            </div>
          </div>
        </div>

        {/* Quarterly Comparison Visual */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title">So sánh theo quý</h2>
          </div>
          <div className="card-body">
            <div className="flex items-end gap-6 h-56 justify-center">
              {quarterlyData.map((q) => {
                const maxRevenue = Math.max(...quarterlyData.map((d) => d.revenue));
                const revenueHeight = (q.revenue / maxRevenue) * 100;
                const costHeight = (q.cost / maxRevenue) * 100;
                return (
                  <div key={q.quarter} className="flex flex-col items-center gap-2 flex-1 max-w-32">
                    <div className="flex items-end gap-1 h-44 w-full">
                      <div className="flex-1 rounded-t-md transition-all duration-700" style={{ height: `${revenueHeight}%`, background: 'linear-gradient(to top, #10b981, #6ee7b7)' }} />
                      <div className="flex-1 rounded-t-md transition-all duration-700" style={{ height: `${costHeight}%`, background: 'linear-gradient(to top, #f87171, #fca5a5)' }} />
                    </div>
                    <span className="text-sm font-medium text-gray-600">Q{q.quarter}</span>
                    <span className="text-xs text-gray-400">{formatCurrency(q.revenue)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Doanh thu</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300" /> Chi phí</span>
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title">Bảng tổng hợp năm {year}</h2>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quý</th>
                  <th className="text-right">Doanh thu</th>
                  <th className="text-right">Chi phí</th>
                  <th className="text-right">Lợi nhuận</th>
                  <th className="text-right">GTGT (8%)</th>
                  <th className="text-right">TNCN (1.5%)</th>
                  <th className="text-right">Tổng thuế</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyData.map((q) => {
                  const qVat = Math.round(q.revenue * 0.08);
                  const qPit = Math.round(q.revenue * 0.015);
                  return (
                    <tr key={q.quarter}>
                      <td className="font-medium">Quý {q.quarter}</td>
                      <td className="text-right font-mono text-green-600">{formatCurrency(q.revenue)}</td>
                      <td className="text-right font-mono text-red-600">{formatCurrency(q.cost)}</td>
                      <td className="text-right font-mono font-medium">{formatCurrency(q.revenue - q.cost)}</td>
                      <td className="text-right font-mono text-blue-600">{formatCurrency(qVat)}</td>
                      <td className="text-right font-mono text-purple-600">{formatCurrency(qPit)}</td>
                      <td className="text-right font-mono font-medium text-red-600">{formatCurrency(qVat + qPit)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-gray-50 border-t-2">
                  <td>CẢ NĂM</td>
                  <td className="text-right font-mono text-green-700">{formatCurrency(totalRevenue)}</td>
                  <td className="text-right font-mono text-red-700">{formatCurrency(totalCost)}</td>
                  <td className="text-right font-mono">{formatCurrency(profit)}</td>
                  <td className="text-right font-mono text-blue-700">{formatCurrency(vatAmount)}</td>
                  <td className="text-right font-mono text-purple-700">{formatCurrency(pitAmount)}</td>
                  <td className="text-right font-mono text-red-700 text-lg">{formatCurrency(vatAmount + pitAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
