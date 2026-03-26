import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()));

  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: business } = await supabase.from('business_info').select('*').single();
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*, product:products(name, code), invoice:invoices(invoice_number)')
    .gte('sale_date', startDate)
    .lte('sale_date', endDate)
    .order('sale_date', { ascending: true });

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const fmt = (n: number) =>
    new Intl.NumberFormat('vi-VN').format(Math.round(n));

  const fmtDate = (d: string) => {
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  };

  const rows = (sales || []).map((s: any) => s);
  const totalRevenue   = rows.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);
  const totalVAT       = rows.reduce((sum: number, s: any) => sum + (s.vat_amount || 0), 0);
  const totalWithVAT   = rows.reduce((sum: number, s: any) => sum + (s.total_with_vat || 0), 0);

  const vatRate = business?.vat_rate || 8;
  const pitRate = business?.pit_rate || 1.5;
  const pitAmount = Math.round(totalWithVAT * pitRate / 100);

  const businessName = business?.business_name || 'Chưa cập nhật';
  const ownerName    = business?.owner_name    || 'Chưa cập nhật';
  const taxCode      = business?.tax_code      || '';
  const address      = business?.address       || '';

  const rowsHTML = rows.map((s: any, i: number) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td class="center">${fmtDate(s.sale_date)}</td>
      <td class="center">${s.invoice?.invoice_number || '—'}</td>
      <td>${s.product?.name || 'Hàng hóa'}</td>
      <td class="right">${fmt(s.quantity || 0)}</td>
      <td class="right">${fmt(s.unit_price || 0)}</td>
      <td class="right">${fmt(s.total_amount || 0)}</td>
      <td class="center">${vatRate}%</td>
      <td class="right">${fmt(s.vat_amount || 0)}</td>
      <td class="right">${fmt(s.total_with_vat || 0)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Sổ S2a-HKD Tháng ${month}/${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      color: #000;
      padding: 15mm 15mm 15mm 20mm;
    }
    .header-block { text-align: center; margin-bottom: 8px; }
    .header-block .ministry { font-size: 10pt; }
    .header-block .title { font-size: 14pt; font-weight: bold; margin: 6px 0 4px; }
    .header-block .period { font-size: 11pt; }
    .info-table { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
    .info-table td { padding: 1px 4px; font-size: 10.5pt; }
    table.data {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 10pt;
    }
    table.data th, table.data td {
      border: 1px solid #000;
      padding: 3px 5px;
      vertical-align: middle;
    }
    table.data th {
      background: #f0f0f0;
      text-align: center;
      font-weight: bold;
    }
    .right  { text-align: right; }
    .center { text-align: center; }
    .total-row td { font-weight: bold; background: #f9f9f9; }
    .summary { margin-top: 10px; font-size: 10.5pt; line-height: 1.8; }
    .signature-block {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      text-align: center;
      font-size: 10.5pt;
    }
    .signature-block .sig-item { width: 30%; }
    .sig-name { font-style: italic; margin-bottom: 50px; }
    @media print {
      body { padding: 10mm 10mm 10mm 15mm; }
      @page { size: A4 landscape; margin: 10mm; }
    }
    @media screen {
      body { max-width: 297mm; margin: auto; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    }
  </style>
</head>
<body>

  <div class="header-block">
    <div class="ministry">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>Độc lập - Tự do - Hạnh phúc</div>
    <div class="title">SỔ CHI TIẾT DOANH THU<br>MẪU S2a-HKD</div>
    <div class="period">Tháng ${month} năm ${year}</div>
  </div>

  <table class="info-table">
    <tr>
      <td><strong>Tên hộ kinh doanh:</strong> ${businessName}</td>
      <td><strong>Mã số thuế:</strong> ${taxCode}</td>
    </tr>
    <tr>
      <td><strong>Chủ hộ:</strong> ${ownerName}</td>
      <td><strong>Địa chỉ:</strong> ${address}</td>
    </tr>
  </table>

  <table class="data">
    <thead>
      <tr>
        <th rowspan="2" style="width:35px">STT</th>
        <th rowspan="2" style="width:70px">Ngày</th>
        <th rowspan="2" style="width:90px">Số hóa đơn</th>
        <th rowspan="2">Tên hàng hóa, dịch vụ</th>
        <th rowspan="2" style="width:55px">Số lượng</th>
        <th rowspan="2" style="width:75px">Đơn giá</th>
        <th colspan="2">Doanh thu</th>
        <th colspan="2">Thuế GTGT</th>
      </tr>
      <tr>
        <th style="width:85px">Chưa có thuế</th>
        <th style="width:45px">Thuế suất</th>
        <th style="width:85px">Tiền thuế</th>
        <th style="width:90px">Doanh thu sau thuế</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML || '<tr><td colspan="10" class="center">Không có dữ liệu trong tháng này</td></tr>'}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" class="right">CỘNG THÁNG ${month}/${year}:</td>
        <td class="right">${fmt(totalRevenue)}</td>
        <td></td>
        <td class="right">${fmt(totalVAT)}</td>
        <td class="right">${fmt(totalWithVAT)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <p><strong>Tổng doanh thu (chưa thuế):</strong> ${fmt(totalRevenue)} đồng</p>
    <p><strong>Thuế GTGT (${vatRate}%):</strong> ${fmt(totalVAT)} đồng</p>
    <p><strong>Tổng doanh thu (sau thuế):</strong> ${fmt(totalWithVAT)} đồng</p>
    <p><strong>Thuế TNCN tạm nộp (${pitRate}%):</strong> ${fmt(pitAmount)} đồng</p>
  </div>

  <div class="signature-block">
    <div class="sig-item">
      <div class="sig-name"><em>Người lập sổ</em></div>
      <div>(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="sig-item">
      <div class="sig-name"><em>Kế toán trưởng</em></div>
      <div>(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="sig-item">
      <div class="sig-name"><em>${ownerName}</em></div>
      <div>Chủ hộ kinh doanh<br>(Ký, đóng dấu)</div>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog when opened directly
    window.onload = () => {
      if (window.location.search.includes('print=1')) {
        window.print();
      }
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
