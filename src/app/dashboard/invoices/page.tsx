'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Search, FileText, Eye, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getPaymentMethodLabel, getStatusLabel, getStatusColor } from '@/lib/utils';
import type { Invoice } from '@/lib/types';
import toast from 'react-hot-toast';

const demoInvoices: Invoice[] = [
  { id: '1', user_id: '', invoice_number: 'HD2603-0001', invoice_date: '2026-03-25', customer_name: 'Nguyễn Văn A', customer_address: '123 Lê Lợi, Q.1, TP.HCM', subtotal: 4750000, vat_rate: 8, vat_amount: 380000, total_amount: 5130000, payment_method: 'cash', status: 'completed', created_at: '', updated_at: '' },
  { id: '2', user_id: '', invoice_number: 'HD2603-0002', invoice_date: '2026-03-24', customer_name: 'Trần Thị B', customer_address: '456 Nguyễn Huệ, Q.1, TP.HCM', subtotal: 3200000, vat_rate: 8, vat_amount: 256000, total_amount: 3456000, payment_method: 'transfer', status: 'completed', created_at: '', updated_at: '' },
  { id: '3', user_id: '', invoice_number: 'HD2603-0003', invoice_date: '2026-03-23', customer_name: 'Lê Văn C', subtotal: 8500000, vat_rate: 8, vat_amount: 680000, total_amount: 9180000, payment_method: 'cash', status: 'draft', created_at: '', updated_at: '' },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(demoInvoices);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadInvoices(); }, []);

  async function loadInvoices() {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false });
      if (data && data.length > 0) setInvoices(data);
    } catch { console.log('Using demo data'); }
  }

  const filtered = invoices.filter((inv) => {
    const matchSearch = !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !dateFrom || inv.invoice_date >= dateFrom;
    const matchTo = !dateTo || inv.invoice_date <= dateTo;
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchFrom && matchTo && matchStatus;
  });

  async function handleDownloadPDF(invoice: Invoice) {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank');
    } else {
      // Generate PDF via API
      try {
        const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${invoice.invoice_number}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          toast.error('Không thể tạo PDF');
        }
      } catch {
        toast.error('Tính năng PDF sẽ hoạt động khi kết nối Supabase');
      }
    }
  }

  return (
    <>
      <Header
        title="Hóa đơn"
        subtitle="Quản lý hóa đơn bán hàng"
        onMenuClick={() => {}}
      />

      <div className="page-content">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input type="text" placeholder="Tìm theo số hóa đơn hoặc khách hàng..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Từ:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Đến:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="completed">Hoàn thành</option>
            <option value="draft">Nháp</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số HĐ</th>
                  <th>Ngày</th>
                  <th>Khách hàng</th>
                  <th className="text-right">Tiền hàng</th>
                  <th className="text-right">VAT</th>
                  <th className="text-right">Tổng tiền</th>
                  <th className="text-center">Thanh toán</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <h3>Chưa có hóa đơn</h3>
                        <p>Hóa đơn sẽ tự động tạo khi bán hàng</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-mono font-medium text-blue-600">{inv.invoice_number}</td>
                      <td className="font-mono">{formatDate(inv.invoice_date)}</td>
                      <td className="font-medium">{inv.customer_name}</td>
                      <td className="text-right font-mono">{formatCurrency(inv.subtotal)}</td>
                      <td className="text-right font-mono text-blue-600">{formatCurrency(inv.vat_amount)}</td>
                      <td className="text-right font-mono font-medium text-green-600">{formatCurrency(inv.total_amount)}</td>
                      <td className="text-center text-sm">{getPaymentMethodLabel(inv.payment_method)}</td>
                      <td className="text-center">
                        <span className={`badge ${getStatusColor(inv.status)}`}>
                          {getStatusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="btn btn-ghost btn-sm" title="Xem" onClick={() => toast('Chi tiết hóa đơn')}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="btn btn-ghost btn-sm text-blue-600" title="Tải PDF" onClick={() => handleDownloadPDF(inv)}>
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
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
