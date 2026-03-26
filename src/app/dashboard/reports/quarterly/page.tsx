'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { FileDown, CalendarDays, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MonthData { month: number; revenue: number; cost: number; }
interface QuarterlyReport {
  quarter: number;
  year: number;
  business_info?: { vat_rate?: number; pit_rate?: number; business_name?: string };
  total_revenue: number;
  total_cost: number;
  vat_amount: number;
  pit_amount: number;
  monthly_breakdown: MonthData[];
}

export default function QuarterlyReportPage() {
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<QuarterlyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/quarterly?quarter=${quarter}&year=${year}`);
      if (res.ok) setReport(await res.json());
    } catch { console.log('Fetch error'); }
    finally { setLoading(false); }
  }, [quarter, year]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const monthlyData = report?.monthly_breakdown ?? [];
  const totalRevenue = report?.total_revenue ?? 0;
  const totalCost = report?.total_cost ?? 0;
  const profit = totalRevenue - totalCost;
  const vatAmount = report?.vat_amount ?? 0;
  const pitAmount = report?.pit_amount ?? 0;
  const vatRate = report?.business_info?.vat_rate ?? 8;
  const pitRate = report?.business_info?.pit_rate ?? 1.5;
  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  return (
    <>
      <Header
        title="Báo cáo Quý"
        subtitle={`Quý ${quarter}/${year}${report?.business_info?.business_name ? ` — ${report.business_info.business_name}` : ''}`}
        onMenuClick={() => {}}
        actions={
          <div className="flex gap-2">
            <button onClick={loadReport} className="btn btn-secondary btn-sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <FileDown className="w-4 h-4" /> Xuất PDF
            </button>
          </div>
        }
      />

      <div className="page-content">
        <div className="toolbar">
          <div className="filter-group">
            <label>Quý:</label>
            <select className="form-select" style={{ width: 'auto' }} value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Quý {q}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Năm:</label>
            <select className="form-select" style={{ width: 'auto' }} value={year}
              onChange={(e) => setYear(Number(e.target.value))}>
              {[2023, 2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Doanh thu', value: totalRevenue, color: 'green' },
                { label: 'Chi phí', value: totalCost, color: 'red' },
                { label: `Thuế GTGT (${vatRate}%)`, value: vatAmount, color: 'blue' },
                { label: `Thuế TNCN (${pitRate}%)`, value: pitAmount, color: 'purple' },
              ].map(({ label, value, color }) => (
                <div key={label} className="stat-card">
                  <div className={`stat-icon ${color}`}><CalendarDays className="w-5 h-5" /></div>
                  <div className="stat-info">
                    <h3>{label}</h3>
                    <div className="stat-value text-base">{formatCurrency(value)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card mb-6">
              <div className="card-header">
                <h2 className="card-title">Doanh thu &amp; Chi phí theo tháng</h2>
              </div>
              <div className="card-body">
                {totalRevenue === 0 ? (
                  <p className="text-center text-gray-400 py-8">Chưa có dữ liệu cho Quý {quarter}/{year}</p>
                ) : (
                  <div className="space-y-6">
                    {monthlyData.map((m) => (
                      <div key={m.month}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Tháng {m.month}</span>
                          <span className="text-gray-500">{formatCurrency(m.revenue)}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(m.revenue / maxRevenue) * 100}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                          </div>
                          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(m.cost / maxRevenue) * 100}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
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
                )}
              </div>
            </div>

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
                      <th className="text-right">GTGT ({vatRate}%)</th>
                      <th className="text-right">TNCN ({pitRate}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m) => (
                      <tr key={m.month}>
                        <td className="font-medium">Tháng {m.month}</td>
                        <td className="text-right font-mono text-green-600">{formatCurrency(m.revenue)}</td>
                        <td className="text-right font-mono text-red-600">{formatCurrency(m.cost)}</td>
                        <td className="text-right font-mono font-medium">{formatCurrency(m.revenue - m.cost)}</td>
                        <td className="text-right font-mono text-blue-600">{formatCurrency(Math.round(m.revenue * vatRate / 100))}</td>
                        <td className="text-right font-mono text-purple-600">{formatCurrency(Math.round(m.revenue * pitRate / 100))}</td>
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
          </>
        )}
      </div>
    </>
  );
}
