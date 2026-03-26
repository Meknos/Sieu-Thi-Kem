/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { BookOpen, FileDown, Printer, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface S2aRow {
  date: string;
  invoice_number: string;
  description: string;
  revenue: number;
}

interface S2aReport {
  business_name: string;
  owner_name: string;
  tax_code: string;
  address: string;
  period: string;
  month: number;
  year: number;
  rows: S2aRow[];
  total_revenue: number;
  vat_amount: number;
  pit_amount: number;
}

export default function S2aReportPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<S2aReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/s2a?month=${month}&year=${year}`);
      if (!res.ok) throw new Error('Lỗi tải báo cáo');
      const data: S2aReport = await res.json();
      setReport(data);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải báo cáo S2a');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { loadReport(); }, [loadReport]);

  function handleExportPDF() {
    const url = `/api/reports/s2a/pdf?month=${month}&year=${year}&print=1`;
    window.open(url, '_blank');
  }

  function handlePreview() {
    const url = `/api/reports/s2a/pdf?month=${month}&year=${year}`;
    window.open(url, '_blank');
  }

  const totalRevenue = report?.total_revenue ?? 0;
  const vatAmount = report?.vat_amount ?? 0;
  const pitAmount = report?.pit_amount ?? 0;

  return (
    <>
      <Header
        title="Sổ chi tiết doanh thu S2a-HKD"
        subtitle={`Tháng ${month}/${year}`}
        onMenuClick={() => {}}
        actions={
          <div className="flex gap-2">
            <button onClick={loadReport} className="btn btn-secondary" disabled={loading} title="Tải lại">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handlePreview} className="btn btn-secondary">
              <BookOpen className="w-4 h-4" /> Xem trước
            </button>
            <button onClick={handleExportPDF} className="btn btn-primary">
              <FileDown className="w-4 h-4" /> Xuất PDF
            </button>
            <button onClick={() => window.print()} className="btn btn-secondary">
              <Printer className="w-4 h-4" /> In
            </button>
          </div>
        }
      />

      <div className="page-content">
        {/* Period selector */}
        <div className="toolbar">
          <div className="filter-group">
            <label>Tháng:</label>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Năm:</label>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2023, 2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="card">
            <div className="card-body py-16 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>Đang tải báo cáo tháng {month}/{year}...</p>
            </div>
          </div>
        )}

        {/* S2a Report Table */}
        {!loading && report && (
          <div className="card" id="s2a-report">
            {/* Report Header */}
            <div className="p-6 text-center border-b border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Mẫu số: S2a-HKD</p>
              <p className="text-xs text-gray-400 mb-4">
                (Ban hành kèm theo Thông tư số 88/2021/TT-BTC ngày 11/10/2021)
              </p>
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ
              </h2>
              <p className="text-sm text-gray-600">Tháng {month} năm {year}</p>
              <div className="mt-4 text-left max-w-xl mx-auto text-sm text-gray-600 space-y-1">
                <p><strong>Họ và tên người nộp thuế:</strong> {report.owner_name || '—'}</p>
                <p><strong>Mã số thuế:</strong> {report.tax_code || '—'}</p>
                <p><strong>Địa chỉ:</strong> {report.address || '—'}</p>
              </div>
              {(!report.owner_name || report.owner_name === 'Chưa cập nhật') && (
                <p className="mt-3 text-xs text-orange-500">
                  ⚠ Thông tin kinh doanh chưa đủ.{' '}
                  <a href="/dashboard/settings" className="underline font-medium">Cập nhật tại đây</a>
                </p>
              )}
            </div>

            {/* Data Table */}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="text-center" style={{ width: '50px' }}>STT</th>
                    <th>Ngày, tháng ghi sổ</th>
                    <th>Số hiệu chứng từ</th>
                    <th>Diễn giải nội dung</th>
                    <th className="text-right">Doanh thu bán HHDV (VNĐ)</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 font-medium">
                    <td className="text-center">A</td>
                    <td>B</td>
                    <td>C</td>
                    <td>D</td>
                    <td className="text-right">1</td>
                    <td>2</td>
                  </tr>
                  <tr className="bg-yellow-50 font-medium">
                    <td className="text-center">—</td>
                    <td>—</td>
                    <td>—</td>
                    <td className="font-bold">Số dư đầu kỳ</td>
                    <td className="text-right font-mono">0</td>
                    <td>—</td>
                  </tr>

                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state py-12">
                          <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                          <p>Chưa có doanh thu trong tháng {month}/{year}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="font-mono">{formatDate(row.date)}</td>
                        <td className="font-mono text-blue-600">{row.invoice_number}</td>
                        <td>{row.description}</td>
                        <td className="text-right font-mono font-medium">{formatCurrency(row.revenue)}</td>
                        <td>—</td>
                      </tr>
                    ))
                  )}

                  <tr className="bg-yellow-50 font-bold border-t-2 border-gray-300">
                    <td colSpan={4} className="text-right">Cộng phát sinh trong kỳ:</td>
                    <td className="text-right font-mono text-lg text-green-700">
                      {formatCurrency(totalRevenue)}
                    </td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={4} className="text-right">Số dư cuối kỳ:</td>
                    <td className="text-right font-mono text-lg">
                      {formatCurrency(totalRevenue)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tax Summary */}
            <div className="p-6 border-t border-gray-200">
              <div className="max-w-md space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tổng doanh thu:</span>
                  <span className="font-bold font-mono">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Thuế GTGT ({report.vat_amount > 0 && totalRevenue > 0 ? Math.round(report.vat_amount / totalRevenue * 100) : 8}%):</span>
                  <span className="font-bold font-mono text-blue-600">{formatCurrency(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Thuế TNCN ({report.pit_amount > 0 && totalRevenue > 0 ? (report.pit_amount / totalRevenue * 100).toFixed(1) : 1.5}%):</span>
                  <span className="font-bold font-mono text-purple-600">{formatCurrency(pitAmount)}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="font-medium">Tổng thuế phải nộp:</span>
                  <span className="font-bold font-mono text-red-600 text-lg">
                    {formatCurrency(vatAmount + pitAmount)}
                  </span>
                </div>
              </div>

              {/* Signature area */}
              <div className="mt-8 grid grid-cols-2 gap-8 text-center text-sm">
                <div>
                  <p className="font-medium">Người ghi sổ</p>
                  <p className="text-gray-400 text-xs mt-1">(Ký, họ tên)</p>
                  <div className="h-20"></div>
                </div>
                <div>
                  <p className="font-medium">Người nộp thuế</p>
                  <p className="text-gray-400 text-xs mt-1">(Ký, họ tên, đóng dấu)</p>
                  <div className="h-20"></div>
                  <p className="font-medium">{report.owner_name}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
