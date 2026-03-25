'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { FileDown, CalendarDays } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function QuarterlyReportPage() {
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [year, setYear] = useState(new Date().getFullYear());

  // Demo data
  const monthlyData = [
    { month: (quarter - 1) * 3 + 1, revenue: 28500000, cost: 20800000 },
    { month: (quarter - 1) * 3 + 2, revenue: 32100000, cost: 23500000 },
    { month: (quarter - 1) * 3 + 3, revenue: 35400000, cost: 25200000 },
  ];

  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalCost = monthlyData.reduce((s, m) => s + m.cost, 0);
  const profit = totalRevenue - totalCost;
  const vatAmount = Math.round(totalRevenue * 0.08);
  const pitAmount = Math.round(totalRevenue * 0.015);

  return (
    <>
      <Header
        title="Báo cáo Quý"
        subtitle={`Quý ${quarter}/${year}`}
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
            <label>Quý:</label>
            <select className="form-select" style={{ width: 'auto' }} value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Quý {q}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Năm:</label>
            <select className="form-select" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <div className="stat-icon green"><CalendarDays className="w-5 h-5" /></div>
            <div className="stat-info">
              <h3>Doanh thu</h3>
              <div className="stat-value text-base">{formatCurrency(totalRevenue)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><CalendarDays className="w-5 h-5" /></div>
            <div className="stat-info">
              <h3>Chi phí</h3>
              <div className="stat-value text-base">{formatCurrency(totalCost)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><CalendarDays className="w-5 h-5" /></div>
            <div className="stat-info">
              <h3>Thuế GTGT</h3>
              <div className="stat-value text-base">{formatCurrency(vatAmount)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><CalendarDays className="w-5 h-5" /></div>
            <div className="stat-info">
              <h3>Thuế TNCN</h3>
              <div className="stat-value text-base">{formatCurrency(pitAmount)}</div>
            </div>
          </div>
        </div>

        {/* Bar chart visualization */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="card-title">Doanh thu & Chi phí theo tháng</h2>
          </div>
          <div className="card-body">
            <div className="space-y-6">
              {monthlyData.map((m) => (
                <div key={m.month}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Tháng {m.month}</span>
                    <span className="text-gray-500">{formatCurrency(m.revenue)}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(m.revenue / 40000000) * 100}%`,
                          background: 'linear-gradient(90deg, #10b981, #34d399)',
                        }}
                      />
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(m.cost / 40000000) * 100}%`,
                          background: 'linear-gradient(90deg, #ef4444, #f87171)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Doanh thu</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Chi phí</span>
                    <span className="ml-auto font-medium text-green-600">LN: {formatCurrency(m.revenue - m.cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details Table */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Tổng hợp Quý {quarter}/{year}</h2>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th className="text-right">Doanh thu</th>
                  <th className="text-right">Chi phí</th>
                  <th className="text-right">Lợi nhuận</th>
                  <th className="text-right">GTGT (8%)</th>
                  <th className="text-right">TNCN (1.5%)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m) => (
                  <tr key={m.month}>
                    <td className="font-medium">Tháng {m.month}</td>
                    <td className="text-right font-mono text-green-600">{formatCurrency(m.revenue)}</td>
                    <td className="text-right font-mono text-red-600">{formatCurrency(m.cost)}</td>
                    <td className="text-right font-mono font-medium">{formatCurrency(m.revenue - m.cost)}</td>
                    <td className="text-right font-mono text-blue-600">{formatCurrency(Math.round(m.revenue * 0.08))}</td>
                    <td className="text-right font-mono text-purple-600">{formatCurrency(Math.round(m.revenue * 0.015))}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-50 border-t-2">
                  <td>Tổng cộng</td>
                  <td className="text-right font-mono text-green-700">{formatCurrency(totalRevenue)}</td>
                  <td className="text-right font-mono text-red-700">{formatCurrency(totalCost)}</td>
                  <td className="text-right font-mono">{formatCurrency(profit)}</td>
                  <td className="text-right font-mono text-blue-700">{formatCurrency(vatAmount)}</td>
                  <td className="text-right font-mono text-purple-700">{formatCurrency(pitAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
