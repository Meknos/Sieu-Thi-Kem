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
        title="Sổ doanh thu S2a-HKD"
        subtitle={`Tháng ${month}/${year}`}
        onMenuClick={() => { }}
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

        {loading && (
          <div className="card">
            <div className="card-body py-16 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>Đang tải báo cáo tháng {month}/{year}...</p>
            </div>
          </div>
        )}

        {/* S2a Report — theo mẫu TT 152/2025/TT-BTC */}
        {!loading && report && (
          <div className="card" id="s2a-report">
            <div className="p-6">

              {/* ── PHẦN ĐẦU FORM ── */}
              <div className="flex justify-between items-start mb-2">
                {/* Trái: thông tin hộ KD */}
                <div className="text-sm text-gray-800 space-y-1">
                  <p>
                    <span className="font-semibold">HỘ, CÁ NHÂN KINH DOANH: </span>
                    <span className="border-b border-dotted border-gray-400 inline-block min-w-[200px] ml-1">
                      {report.owner_name || ''}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">Địa chỉ: </span>
                    <span className="border-b border-dotted border-gray-400 inline-block min-w-[250px] ml-1">
                      {report.address || ''}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">Mã số thuế: </span>
                    <span className="border-b border-dotted border-gray-400 inline-block min-w-[150px] ml-1 font-mono">
                      {report.tax_code || ''}
                    </span>
                  </p>
                </div>

                {/* Phải: số mẫu */}
                <div className="text-right text-xs text-gray-500 space-y-0.5 max-w-[200px]">
                  <p className="font-semibold text-sm text-gray-700">Mẫu số S2a-HKD</p>
                  <p>(Kèm theo Thông tư số 152/2025/TT-BTC</p>
                  <p>ngày 31 tháng 12 năm 2025 của Bộ trưởng</p>
                  <p>Bộ Tài Chính)</p>
                </div>
              </div>

              {/* ── TIÊU ĐỀ ── */}
              <div className="text-center my-4">
                <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">
                  Sổ doanh thu bán hàng hóa, dịch vụ
                </h2>
              </div>

              {/* ── THÔNG TIN KỲ KÊ KHAI ── */}
              <div className="flex gap-8 text-sm text-gray-700 mb-4">
                <p>
                  Địa điểm kinh doanh:{' '}
                  <span className="border-b border-dotted border-gray-400 inline-block min-w-[180px]">
                    {report.address || ''}
                  </span>
                </p>
                <p>
                  Kỳ kê khai:{' '}
                  <span className="border-b border-dotted border-gray-400 inline-block min-w-[120px]">
                    Tháng {month}/{year}
                  </span>
                </p>
                <p>
                  Đơn vị tính:{' '}
                  <span className="border-b border-dotted border-gray-400 inline-block min-w-[80px]">
                    VNĐ
                  </span>
                </p>
              </div>

              {/* ── BẢNG DỮ LIỆU ── */}
              <table className="w-full border-collapse text-sm" style={{ border: '1px solid #333' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {/* Nhóm CHỨNG TỪ */}
                    <th
                      colSpan={2}
                      className="text-center font-bold py-2 px-2"
                      style={{ border: '1px solid #333', width: '240px' }}
                    >
                      CHỨNG TỪ
                    </th>
                    <th
                      className="text-center font-bold py-2 px-2"
                      style={{ border: '1px solid #333' }}
                    >
                      DIỄN GIẢI
                    </th>
                    <th
                      className="text-center font-bold py-2 px-2"
                      style={{ border: '1px solid #333', width: '160px' }}
                    >
                      SỐ TIỀN
                    </th>
                  </tr>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th
                      className="text-center py-1.5 px-2 text-xs"
                      style={{ border: '1px solid #333', width: '120px' }}
                    >
                      Số hiệu
                    </th>
                    <th
                      className="text-center py-1.5 px-2 text-xs"
                      style={{ border: '1px solid #333', width: '120px' }}
                    >
                      Ngày tháng
                    </th>
                    <th style={{ border: '1px solid #333' }}></th>
                    <th style={{ border: '1px solid #333' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400" style={{ border: '1px solid #333' }}>
                        Chưa có doanh thu trong tháng {month}/{year}
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2 font-mono text-center" style={{ border: '1px solid #333' }}>
                          {row.invoice_number}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-center" style={{ border: '1px solid #333' }}>
                          {formatDate(row.date)}
                        </td>
                        <td className="py-1.5 px-3" style={{ border: '1px solid #333' }}>
                          {row.description}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono" style={{ border: '1px solid #333' }}>
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* ── TỔNG DOANH THU ── */}
                  <tr style={{ background: '#f9f9f9' }}>
                    <td
                      colSpan={3}
                      className="py-2 px-3 text-center font-bold"
                      style={{ border: '1px solid #333' }}
                    >
                      TỔNG DOANH THU
                    </td>
                    <td className="py-2 px-3 text-right font-bold font-mono text-green-700" style={{ border: '1px solid #333' }}>
                      {formatCurrency(totalRevenue)}
                    </td>
                  </tr>

                  {/* ── THUẾ GTGT ── */}
                  <tr>
                    <td
                      colSpan={3}
                      className="py-2 px-3 font-semibold text-center"
                      style={{ border: '1px solid #333' }}
                    >
                      Tổng số thuế GTGT phải nộp
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700" style={{ border: '1px solid #333' }}>
                      {formatCurrency(vatAmount)}
                    </td>
                  </tr>

                  {/* ── THUẾ TNCN ── */}
                  <tr>
                    <td
                      colSpan={3}
                      className="py-2 px-3 font-semibold text-center"
                      style={{ border: '1px solid #333' }}
                    >
                      Tổng số thuế TNCN phải nộp
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-purple-700" style={{ border: '1px solid #333' }}>
                      {formatCurrency(pitAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ── CHỮ KÝ ── */}
              <div className="mt-8 text-right text-sm text-gray-700 space-y-1 mr-8">
                <p className="italic">Ngày ... tháng ... năm ......</p>
                <p className="font-bold uppercase">Người đại diện hộ kinh doanh</p>
                <p className="text-gray-500 text-xs italic">(Ký, ghi rõ họ tên, đóng dấu (nếu có))</p>
                <div className="h-16"></div>
                <p className="font-semibold">{report.owner_name}</p>
              </div>

              {(!report.owner_name || report.owner_name === 'Chưa cập nhật') && (
                <p className="mt-4 text-xs text-orange-500 text-center">
                  ⚠ Thông tin kinh doanh chưa đủ.{' '}
                  <a href="/dashboard/settings" className="underline font-medium">Cập nhật tại đây</a>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
