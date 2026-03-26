'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { FileDown, Calendar, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface QuarterData { quarter: number; revenue: number; cost: number; }
interface YearlyReport {
  year: number;
  business_info?: { business_name?: string; owner_name?: string; tax_code?: string; vat_rate?: number; pit_rate?: number };
  total_revenue: number;
  total_cost: number;
  vat_amount: number;
  pit_amount: number;
  quarterly_breakdown: QuarterData[];
}

export default function YearlyReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/yearly?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch {
      console.log('Using fallback data');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const quarterlyData = report?.quarterly_breakdown ?? [];
  const totalRevenue = report?.total_revenue ?? 0;
  const totalCost = report?.total_cost ?? 0;
  const profit = totalRevenue - totalCost;
  const vatAmount = report?.vat_amount ?? 0;
  const pitAmount = report?.pit_amount ?? 0;
  const vatRate = report?.business_info?.vat_rate ?? 8;
  const pitRate = report?.business_info?.pit_rate ?? 1.5;
  const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0';
  const maxRevenue = Math.max(...quarterlyData.map(q => q.revenue), 1);

  return (
    <>
      <Header
        title="Báo cáo Năm"
        subtitle={report?.business_info?.business_name ? `${report.business_info.business_name} — Năm ${year}` : `Năm ${year}`}
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
        <div className="toolbar mb-6">
          <div className="filter-group">
            <label>Năm:</label>
            <select className="form-select" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2023, 2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {report?.business_info?.tax_code && (
            <span className="text-sm text-gray-500">MST: {report.business_info.tax_code}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
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
                  <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full"
                    style={{ width: totalRevenue > 0 ? `${(totalCost / totalRevenue) * 100}%` : '0%' }} />
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
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                    style={{ width: `${Math.min(Number(profitMargin), 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Tax Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">{vatRate}%</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Thuế GTGT phải nộp</div>
                  <div className="text-lg font-bold text-blue-600">{formatCurrency(vatAmount)}</div>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-sm">{pitRate}%</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Thuế TNCN phải nộp</div>
                  <div className="text-lg font-bold text-purple-600">{formatCurrency(pitAmount)}</div>
                </div>
              </div>
            </div>

            {/* Chart */}
            {quarterlyData.length > 0 && (
              <div className="card mb-6">
                <div className="card-header">
                  <h2 className="card-title">So sánh theo quý</h2>
                </div>
                <div className="card-body">
                  {totalRevenue === 0 ? (
                    <p className="text-center text-gray-400 py-8">Chưa có dữ liệu doanh thu năm {year}</p>
                  ) : (
                    <div className="flex items-end gap-6 h-56 justify-center">
                      {quarterlyData.map((q) => {
                        const revH = (q.revenue / maxRevenue) * 100;
                        const costH = (q.cost / maxRevenue) * 100;
                        return (
                          <div key={q.quarter} className="flex flex-col items-center gap-2 flex-1 max-w-32">
                            <div className="flex items-end gap-1 h-44 w-full">
                              <div className="flex-1 rounded-t-md transition-all duration-700"
                                style={{ height: `${revH}%`, background: 'linear-gradient(to top, #10b981, #6ee7b7)' }} />
                              <div className="flex-1 rounded-t-md transition-all duration-700"
                                style={{ height: `${costH}%`, background: 'linear-gradient(to top, #f87171, #fca5a5)' }} />
                            </div>
                            <span className="text-sm font-medium text-gray-600">Q{q.quarter}</span>
                            <span className="text-xs text-gray-400">{formatCurrency(q.revenue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Doanh thu</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300" /> Chi phí</span>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
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
                      <th className="text-right">GTGT ({vatRate}%)</th>
                      <th className="text-right">TNCN ({pitRate}%)</th>
                      <th className="text-right">Tổng thuế</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterlyData.map((q) => {
                      const qVat = Math.round(q.revenue * vatRate / 100);
                      const qPit = Math.round(q.revenue * pitRate / 100);
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
          </>
        )}
      </div>
    </>
  );
}
