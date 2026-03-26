'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Register Vietnamese-friendly font
// Using system fonts for now, you can add custom fonts later

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    color: '#555',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 150,
  },
  infoValue: {
    flex: 1,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333',
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
    padding: 5,
    minHeight: 24,
    alignItems: 'center',
  },
  tableFooter: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderColor: '#333',
    padding: 6,
    backgroundColor: '#fafafa',
  },
  colSTT: { width: 30, textAlign: 'center' },
  colDate: { width: 70 },
  colInvoice: { width: 80 },
  colDesc: { flex: 1 },
  colAmount: { width: 90, textAlign: 'right' },
  colNote: { width: 50 },
  bold: { fontWeight: 'bold' },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  signatureArea: {
    flexDirection: 'row',
    marginTop: 40,
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
    textAlign: 'center',
  },
  signatureTitle: {
    fontWeight: 'bold',
    fontSize: 10,
    marginBottom: 4,
  },
  signatureHint: {
    fontSize: 8,
    color: '#888',
    marginBottom: 60,
  },
  taxSummary: {
    marginTop: 15,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#ccc',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function formatDateVN(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

// ==============================================
// Invoice PDF
// ==============================================
interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_address?: string;
  customer_tax_code?: string;
  payment_method: string;
  items: {
    name: string;
    unit: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  business_name: string;
  business_address: string;
  business_tax_code: string;
  business_phone: string;
}

export function InvoicePDF({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>
            {data.business_name}
          </Text>
          <Text style={{ fontSize: 8, color: '#666' }}>{data.business_address}</Text>
          <Text style={{ fontSize: 8, color: '#666' }}>MST: {data.business_tax_code} | SĐT: {data.business_phone}</Text>
        </View>

        <Text style={styles.title}>HOA DON BAN HANG</Text>
        <Text style={styles.subtitle}>
          So: {data.invoice_number} | Ngay: {formatDateVN(data.invoice_date)}
        </Text>

        {/* Customer Info */}
        <View style={{ marginBottom: 15 }}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Khach hang:</Text>
            <Text style={styles.infoValue}>{data.customer_name}</Text>
          </View>
          {data.customer_address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dia chi:</Text>
              <Text style={styles.infoValue}>{data.customer_address}</Text>
            </View>
          )}
          {data.customer_tax_code && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>MST:</Text>
              <Text style={styles.infoValue}>{data.customer_tax_code}</Text>
            </View>
          )}
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colSTT, styles.bold]}>STT</Text>
            <Text style={[styles.colDesc, styles.bold]}>Ten hang hoa</Text>
            <Text style={[{ width: 40 }, styles.bold, styles.center]}>DVT</Text>
            <Text style={[{ width: 50 }, styles.bold, styles.right]}>SL</Text>
            <Text style={[styles.colAmount, styles.bold, styles.right]}>Don gia</Text>
            <Text style={[styles.colAmount, styles.bold, styles.right]}>Thanh tien</Text>
          </View>
          {data.items.map((item, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colSTT}>{idx + 1}</Text>
              <Text style={styles.colDesc}>{item.name}</Text>
              <Text style={[{ width: 40 }, styles.center]}>{item.unit}</Text>
              <Text style={[{ width: 50 }, styles.right]}>{item.quantity}</Text>
              <Text style={[styles.colAmount, styles.right]}>{formatVND(item.unit_price)}</Text>
              <Text style={[styles.colAmount, styles.right]}>{formatVND(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.taxSummary}>
          <View style={styles.summaryRow}>
            <Text>Tien hang:</Text>
            <Text style={styles.bold}>{formatVND(data.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Thue GTGT ({data.vat_rate}%):</Text>
            <Text style={styles.bold}>{formatVND(data.vat_amount)}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: '#333', paddingTop: 6, marginTop: 4 }]}>
            <Text style={[styles.bold, { fontSize: 12 }]}>TONG THANH TOAN:</Text>
            <Text style={[styles.bold, { fontSize: 12 }]}>{formatVND(data.total_amount)}</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>Nguoi mua hang</Text>
            <Text style={styles.signatureHint}>(Ky, ho ten)</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>Nguoi ban hang</Text>
            <Text style={styles.signatureHint}>(Ky, ho ten, dong dau)</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ==============================================
// S2a Report PDF
// ==============================================
interface S2aData {
  business_name: string;
  owner_name: string;
  tax_code: string;
  address: string;
  month: number;
  year: number;
  rows: {
    date: string;
    invoice_number: string;
    description: string;
    revenue: number;
  }[];
  total_revenue: number;
  vat_amount: number;
  pit_amount: number;
}

export function S2aReportPDF({ data }: { data: S2aData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Form header */}
        <View style={styles.header}>
          <Text style={styles.formLabel}>Mau so: S2a-HKD</Text>
          <Text style={[styles.formLabel, { marginBottom: 8 }]}>
            (Ban hanh kem theo Thong tu so 88/2021/TT-BTC ngay 11/10/2021)
          </Text>
          <Text style={styles.title}>SO CHI TIET DOANH THU BAN HANG HOA, DICH VU</Text>
          <Text style={styles.subtitle}>Thang {data.month} nam {data.year}</Text>
        </View>

        {/* Business Info */}
        <View style={{ marginBottom: 15 }}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ho va ten nguoi nop thue:</Text>
            <Text style={styles.infoValue}>{data.owner_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ma so thue:</Text>
            <Text style={styles.infoValue}>{data.tax_code}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dia chi:</Text>
            <Text style={styles.infoValue}>{data.address}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colSTT, styles.bold]}>STT</Text>
            <Text style={[styles.colDate, styles.bold]}>Ngay</Text>
            <Text style={[styles.colInvoice, styles.bold]}>So chung tu</Text>
            <Text style={[styles.colDesc, styles.bold]}>Dien giai</Text>
            <Text style={[styles.colAmount, styles.bold, styles.right]}>Doanh thu (VND)</Text>
            <Text style={[styles.colNote, styles.bold, styles.center]}>Ghi chu</Text>
          </View>

          {/* Column labels */}
          <View style={[styles.tableRow, { backgroundColor: '#f9f9f9' }]}>
            <Text style={styles.colSTT}>A</Text>
            <Text style={styles.colDate}>B</Text>
            <Text style={styles.colInvoice}>C</Text>
            <Text style={styles.colDesc}>D</Text>
            <Text style={[styles.colAmount, styles.right]}>1</Text>
            <Text style={[styles.colNote, styles.center]}>2</Text>
          </View>

          {/* Opening balance */}
          <View style={[styles.tableRow, { backgroundColor: '#fffff0' }]}>
            <Text style={styles.colSTT}>-</Text>
            <Text style={styles.colDate}>-</Text>
            <Text style={styles.colInvoice}>-</Text>
            <Text style={[styles.colDesc, styles.bold]}>So du dau ky</Text>
            <Text style={[styles.colAmount, styles.right]}>0</Text>
            <Text style={styles.colNote}>-</Text>
          </View>

          {/* Data rows */}
          {data.rows.map((row, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colSTT}>{idx + 1}</Text>
              <Text style={styles.colDate}>{formatDateVN(row.date)}</Text>
              <Text style={styles.colInvoice}>{row.invoice_number}</Text>
              <Text style={styles.colDesc}>{row.description}</Text>
              <Text style={[styles.colAmount, styles.right]}>{formatVND(row.revenue)}</Text>
              <Text style={styles.colNote}>-</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.tableFooter}>
            <Text style={[styles.colSTT]}></Text>
            <Text style={[styles.colDate]}></Text>
            <Text style={[styles.colInvoice]}></Text>
            <Text style={[styles.colDesc, styles.bold]}>Cong phat sinh trong ky:</Text>
            <Text style={[styles.colAmount, styles.right, styles.bold]}>{formatVND(data.total_revenue)}</Text>
            <Text style={styles.colNote}></Text>
          </View>
        </View>

        {/* Tax Summary */}
        <View style={styles.taxSummary}>
          <View style={styles.summaryRow}>
            <Text>Tong doanh thu:</Text>
            <Text style={styles.bold}>{formatVND(data.total_revenue)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Thue GTGT (8%):</Text>
            <Text style={styles.bold}>{formatVND(data.vat_amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Thue TNCN (1.5%):</Text>
            <Text style={styles.bold}>{formatVND(data.pit_amount)}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: '#333', paddingTop: 6, marginTop: 4 }]}>
            <Text style={[styles.bold, { fontSize: 11 }]}>Tong thue phai nop:</Text>
            <Text style={[styles.bold, { fontSize: 11 }]}>{formatVND(data.vat_amount + data.pit_amount)}</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>Nguoi ghi so</Text>
            <Text style={styles.signatureHint}>(Ky, ho ten)</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureTitle}>Nguoi nop thue</Text>
            <Text style={styles.signatureHint}>(Ky, ho ten, dong dau)</Text>
            <Text style={{ fontSize: 10 }}>{data.owner_name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
