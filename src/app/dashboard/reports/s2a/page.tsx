'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { BookOpen, FileDown, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

// Demo S2a data
const demoS2aData = {
  business_name: 'Cửa hàng VLXD Minh Phát',
  owner_name: 'Nguyễn Văn Minh',
  tax_code: '0123456789',
  address: '123 Quốc lộ 1A, Quận 12, TP.HCM',
  rows: [
    { date: '2026-03-01', invoice_number: 'HD2603-0001', description: 'Bán xi măng PCB40', revenue: 5130000 },
    { date: '2026-03-03', invoice_number: 'HD2603-0002', description: 'Bán thép phi 10', revenue: 3456000 },
    { date: '2026-03-05', invoice_number: 'HD2603-0003', description: 'Bán gạch ống', revenue: 9180000 },
    { date: '2026-03-08', invoice_number: 'HD2603-0004', description: 'Bán sơn Dulux', revenue: 2052000 },
    { date: '2026-03-10', invoice_number: 'HD2603-0005', description: 'Bán tôn lợp', revenue: 7344000 },
    { date: '2026-03-12', invoice_number: 'HD2603-0006', description: 'Bán xi măng + thép', revenue: 12500000 },
    { date: '2026-03-15', invoice_number: 'HD2603-0007', description: 'Bán VLXD tổng hợp', revenue: 8900000 },
    { date: '2026-03-18', invoice_number: 'HD2603-0008', description: 'Bán gạch men', revenue: 6400000 },
    { date: '2026-03-20', invoice_number: 'HD2603-0009', description: 'Bán ống nhựa PVC', revenue: 3200000 },
    { date: '2026-03-22', invoice_number: 'HD2603-0010', description: 'Bán xi măng', revenue: 4750000 },
    { date: '2026-03-25', invoice_number: 'HD2603-0011', description: 'Bán thép + tôn', revenue: 15600000 },
  ],
};

export default function S2aReportPage() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data] = useState(demoS2aData);

  const totalRevenue = data.rows.reduce((sum, r) => sum + r.revenue, 0);
  const vatAmount = Math.round(totalRevenue * 0.08);
  const pitAmount = Math.round(totalRevenue * 0.015);

  async function handleExportPDF() {
    try {
      const res = await fetch(`/api/reports/s2a?month=${month}&year=${year}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `S2a-HKD_T${month}_${year}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      alert('PDF export sẽ hoạt động khi kết nối API');
    }
  }

  return (
    <>
      <Header
        title="Sổ chi tiết doanh thu S2a-HKD"
        subtitle={`Tháng ${month}/${year}`}
        onMenuClick={() => {}}
        actions={
          <div className="flex gap-2">
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
            <select className="form-select" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
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

        {/* S2a Report Table */}
        <div className="card" id="s2a-report">
          {/* Report Header */}
          <div className="p-6 text-center border-b border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Mẫu số: S2a-HKD</p>
            <p className="text-xs text-gray-400 mb-4">(Ban hành kèm theo Thông tư số 88/2021/TT-BTC ngày 11/10/2021)</p>
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ
            </h2>
            <p className="text-sm text-gray-600">
              Tháng {month} năm {year}
            </p>
            <div className="mt-4 text-left max-w-xl mx-auto text-sm text-gray-600 space-y-1">
              <p><strong>Họ và tên người nộp thuế:</strong> {data.owner_name}</p>
              <p><strong>Mã số thuế:</strong> {data.tax_code}</p>
              <p><strong>Địa chỉ:</strong> {data.address}</p>
            </div>
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
                {data.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="text-center">{idx + 1}</td>
                    <td className="font-mono">{formatDate(row.date)}</td>
                    <td className="font-mono text-blue-600">{row.invoice_number}</td>
                    <td>{row.description}</td>
                    <td className="text-right font-mono font-medium">{formatCurrency(row.revenue)}</td>
                    <td>—</td>
                  </tr>
                ))}
                <tr className="bg-yellow-50 font-bold border-t-2 border-gray-300">
                  <td colSpan={4} className="text-right">Cộng phát sinh trong kỳ:</td>
                  <td className="text-right font-mono text-lg text-green-700">{formatCurrency(totalRevenue)}</td>
                  <td></td>
                </tr>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={4} className="text-right">Số dư cuối kỳ:</td>
                  <td className="text-right font-mono text-lg">{formatCurrency(totalRevenue)}</td>
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
                <span className="text-gray-600">Thuế GTGT (8%):</span>
                <span className="font-bold font-mono text-blue-600">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Thuế TNCN (1.5%):</span>
                <span className="font-bold font-mono text-purple-600">{formatCurrency(pitAmount)}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="font-medium">Tổng thuế phải nộp:</span>
                <span className="font-bold font-mono text-red-600 text-lg">{formatCurrency(vatAmount + pitAmount)}</span>
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
                <p className="font-medium">{data.owner_name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
