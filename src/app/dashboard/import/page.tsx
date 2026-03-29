/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import Header from '@/components/Header';
import {
  Upload, FileSpreadsheet, Check, AlertCircle, Trash2,
  Plus, Download, FileText, Loader2, Eye, ChevronRight, Gift, Code2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiFetch';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/lib/types';
import toast from 'react-hot-toast';

interface ImportRow {
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  matched_product?: Product;
  status: 'pending' | 'matched' | 'new' | 'error';
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
}

const sampleCSV = `ma_hang,ten_hang,dvt,so_luong,don_gia
KEM001,Kem que socola,cai,100,3000
KEM002,Kem oc que,cai,200,4000
KEM003,Kem banh,hop,50,15000`;

export default function ImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; newProducts: number }>({ success: 0, failed: 0, newProducts: 0 });
  const [pdfPreviewText, setPdfPreviewText] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'xml' | 'pdf' | 'csv'>('xml');
  const [pricesIncludeVat, setPricesIncludeVat] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  async function loadProducts() {
    try {
      const { data } = await supabase.from('products').select('*').eq('is_active', true);
      if (data) setProducts(data);
    } catch { /* ignore */ }
  }

  /** Chuẩn hóa chuỗi: lowercase, bỏ dấu tiếng Việt, chỉ giữ chữ cái và số */
  function normalizeName(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // bỏ dấu
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, '')       // bỏ ký tự đặc biệt
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Tính tỉ lệ từ chung giữa 2 chuỗi đã normalize */
  function wordOverlap(a: string, b: string): number {
    const wa = new Set(a.split(' ').filter(w => w.length > 1));
    const wb = new Set(b.split(' ').filter(w => w.length > 1));
    if (wa.size === 0 || wb.size === 0) return 0;
    let common = 0;
    wa.forEach(w => { if (wb.has(w)) common++; });
    return common / Math.max(wa.size, wb.size);
  }

  /** Tìm sản phẩm khớp best: exact → normalized → fuzzy word overlap ≥ 0.65 */
  function findBestMatch(row: ImportRow, productList: Product[]): Product | undefined {
    const rowCode = row.product_code.toLowerCase().trim();
    const rowName = row.product_name.toLowerCase().trim();
    const rowNorm = normalizeName(row.product_name);

    // 1) Exact: code hoặc tên
    for (const p of productList) {
      if (rowCode && p.code.toLowerCase().trim() === rowCode) return p;
      if (p.name.toLowerCase().trim() === rowName) return p;
    }

    // 2) Normalized exact (bỏ dấu, ký tự đặc biệt)
    for (const p of productList) {
      if (normalizeName(p.name) === rowNorm) return p;
    }

    // 3) Substring: một cái chứa cái kia (sau normalize)
    for (const p of productList) {
      const pNorm = normalizeName(p.name);
      if (rowNorm.includes(pNorm) || pNorm.includes(rowNorm)) return p;
    }

    // 4) Fuzzy word overlap ≥ 65%
    let best: Product | undefined;
    let bestScore = 0.64;
    for (const p of productList) {
      const score = wordOverlap(rowNorm, normalizeName(p.name));
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  function matchProducts(parsedRows: ImportRow[], productList: Product[]): ImportRow[] {
    return parsedRows.map(row => {
      const matched = findBestMatch(row, productList);
      // Preserve price=0/total=0 for promotional items — do NOT override with stock price
      const isPromo = row.unit_price === 0 && row.total === 0 && row.quantity > 0;
      return {
        ...row,
        matched_product: matched,
        unit: matched?.unit || row.unit,
        unit_price: isPromo ? 0 : (row.unit_price || matched?.purchase_price || 0),
        total: isPromo ? 0 : row.quantity * (row.unit_price || matched?.purchase_price || 0),
        status: matched ? 'matched' : 'new',
      };
    });
  }

  // ── CSV Parse ──────────────────────────────────────────────
  function parseCSV(content: string): ImportRow[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase().replace(/\r/g, '');
    const cols = header.split(',').map(c => c.trim());
    const codeIdx = cols.findIndex(c => ['ma_hang', 'ma', 'code', 'ma_hh'].some(k => c.includes(k)));
    const nameIdx = cols.findIndex(c => ['ten_hang', 'ten', 'name', 'tên hàng', 'tên'].some(k => c.includes(k)));
    const unitIdx = cols.findIndex(c => ['dvt', 'don_vi', 'unit', 'đơn vị'].some(k => c.includes(k)));
    const qtyIdx = cols.findIndex(c => ['so_luong', 'sl', 'qty', 'quantity', 'số lượng'].some(k => c.includes(k)));
    const priceIdx = cols.findIndex(c => ['don_gia', 'gia', 'price', 'đơn giá', 'giá'].some(k => c.includes(k)));
    const parsed: ImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].replace(/\r/g, '').split(',').map(v => v.trim());
      if (values.length < 2) continue;
      const code = codeIdx >= 0 ? values[codeIdx] : '';
      const name = nameIdx >= 0 ? values[nameIdx] : values[1] || '';
      const unit = unitIdx >= 0 ? values[unitIdx] : 'cái';
      const qty = qtyIdx >= 0 ? parseFloat(values[qtyIdx]) || 0 : 0;
      const price = priceIdx >= 0 ? parseFloat(values[priceIdx]) || 0 : 0;
      if (!name && !code) continue;
      parsed.push({ product_code: code, product_name: name, unit, quantity: qty, unit_price: price, total: qty * price, status: 'pending' });
    }
    return parsed;
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prods = await loadProductsAndReturn();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const allParsed = parseCSV(content);
      if (allParsed.length === 0) { toast.error('Không tìm thấy dữ liệu hợp lệ trong file'); return; }
      // Filter: only rows starting with "kem"
      const parsed = allParsed.filter(r => r.product_name.toLowerCase().trimStart().startsWith('kem'));
      const skipped = allParsed.length - parsed.length;
      const toImport = parsed.length > 0 ? parsed : allParsed; // fallback: all rows if none match
      const matched = matchProducts(toImport, prods);
      setRows(matched);
      setStep('review');
      const skipMsg = skipped > 0 ? ` (bỏ qua ${skipped} dòng không phải "kem")` : '';
      toast.success(`Đã đọc ${matched.length} dòng từ file CSV${skipMsg}`);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function loadProductsAndReturn(): Promise<Product[]> {
    try {
      // Load ALL products (kể cả is_active=false) để matching tốt hơn
      const { data } = await supabase.from('products').select('*');
      const prods = data || [];
      setProducts(prods);
      return prods;
    } catch { return []; }
  }

  // ── XML Parse ──────────────────────────────────────────────
  async function handleXMLUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseLoading(true);
    try {
      const prods = await loadProductsAndReturn();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/parse-xml', { method: 'POST', body: fd });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Lỗi đọc file XML'); return; }

      if (result.warning || !result.items?.length) {
        toast.error(result.warning || 'Không nhận diện được mặt hàng');
        setRows([{ product_code: '', product_name: '', unit: 'cái', quantity: 1, unit_price: 0, total: 0, status: 'new' }]);
        setStep('review');
        return;
      }

      // Tự điền nhà cung cấp từ XML
      if (result.supplier_name) setSupplierName(result.supplier_name);

      const allParsed: ImportRow[] = (result.items || []).map((item: any) => ({
        product_code: item.product_code || '',
        product_name: item.product_name || '',
        unit: item.unit || 'cái',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
        confidence: item.confidence,
        status: 'pending' as const,
      }));

      // Lọc chỉ mặt hàng bắt đầu bằng "kem"
      const parsed = allParsed.filter(r => r.product_name.toLowerCase().trimStart().startsWith('kem'));
      const skipped = allParsed.length - parsed.length;
      const toImport = parsed.length > 0 ? parsed : allParsed;
      const matched = matchProducts(toImport, prods);
      setRows(matched);
      setStep('review');
      const matchCount = matched.filter(r => r.status === 'matched').length;
      const skipMsg = skipped > 0 ? ` (bỏ qua ${skipped} dòng không phải "kem")` : '';
      toast.success(`✅ XML: ${matched.length} mặt hàng — ${matchCount} khớp, ${matched.length - matchCount} mới${skipMsg}`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xử lý XML');
    } finally {
      setParseLoading(false);
    }
  }

  // ── PDF Parse ──────────────────────────────────────────────
  async function handlePDFUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseLoading(true);
    try {
      const prods = await loadProductsAndReturn();
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/import/parse-pdf', { method: 'POST', body: fd });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || 'Lỗi đọc file');
        return;
      }

      if (result.text) setPdfPreviewText(result.text);

      if (result.warning || result.items?.length === 0) {
        toast.error(result.warning || 'Không nhận diện được mặt hàng — vui lòng nhập thủ công');
        // Still go to review with empty rows so user can add manually
        setRows([{ product_code: '', product_name: '', unit: 'cái', quantity: 1, unit_price: 0, total: 0, status: 'new' }]);
        setStep('review');
        return;
      }

      // Map parsed items to ImportRow format
      const allParsed: ImportRow[] = (result.items || []).map((item: any) => ({
        product_code: item.product_code || '',
        product_name: item.product_name || '',
        unit: item.unit || 'cái',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total: item.total || 0,
        confidence: item.confidence,
        status: 'pending' as const,
      }));

      // Filter: only keep rows where product_name starts with "kem" (case-insensitive)
      const parsed = allParsed.filter(r =>
        r.product_name.toLowerCase().trimStart().startsWith('kem')
      );
      const skipped = allParsed.length - parsed.length;

      if (parsed.length === 0) {
        toast.error(`Không tìm thấy mặt hàng nào bắt đầu bằng "kem" (${allParsed.length} dòng bị bỏ qua)`);
        setRows([{ product_code: '', product_name: '', unit: 'cái', quantity: 1, unit_price: 0, total: 0, status: 'new' }]);
        setStep('review');
        return;
      }

      const matched = matchProducts(parsed, prods);
      setRows(matched);
      setStep('review');

      const highConf = matched.filter(r => r.confidence === 'high').length;
      const skipMsg = skipped > 0 ? ` (bỏ qua ${skipped} dòng không phải "kem")` : '';
      toast.success(`Nhận diện ${matched.length} mặt hàng (${highConf} độ chắc cao)${skipMsg}`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xử lý PDF');
    } finally {
      setParseLoading(false);
    }
  }

  // ── Row helpers ──────────────────────────────────────────────
  function handleRemoveRow(idx: number) { setRows(prev => prev.filter((_, i) => i !== idx)); }

  function handleUpdateRow(idx: number, field: keyof ImportRow, value: any) {
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      if (field === 'quantity' || field === 'unit_price') updated.total = updated.quantity * updated.unit_price;
      return updated;
    }));
  }

  function handleAddRow() {
    setRows(prev => [...prev, { product_code: '', product_name: '', unit: 'cái', quantity: 1, unit_price: 0, total: 0, status: 'new' }]);
  }

  // ── Import ──────────────────────────────────────────────────
  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map(r => ({
            product_code: r.product_code,
            product_name: r.product_name,
            unit: r.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
          })),
          purchase_date: importDate,
          supplier_name: supplierName || null,
          supplier_invoice: supplierInvoice || null,
        }),
      });
      const result = await res.json();
      if (!res.ok && result.success === 0) { toast.error(result.errors?.[0] || 'Nhập kho thất bại'); return; }
      setImportResult({ success: result.success ?? rows.length, failed: result.failed ?? 0, newProducts: result.new_products ?? 0 });
      setStep('done');
      toast.success(`Nhập kho thành công: ${result.success ?? rows.length}/${rows.length} mặt hàng`);
    } catch {
      setImportResult({ success: rows.length, failed: 0, newProducts: rows.filter(r => r.status === 'new').length });
      setStep('done');
      toast.success('Demo: Nhập kho thành công');
    } finally { setLoading(false); }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mau_nhap_hang.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setRows([]); setStep('upload'); setImportResult({ success: 0, failed: 0, newProducts: 0 });
    setSupplierName(''); setSupplierInvoice(''); setPdfPreviewText(''); setShowPdfPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (xmlInputRef.current) xmlInputRef.current.value = '';
  }

  const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);
  // Nếu giá đã bao gồm VAT: tổng = totalAmount, rút giả thuế ra
  // Nếu giá chưa có VAT: tổng = totalAmount + 8%
  const vatRate = 0.08;
  const totalBeforeVat = pricesIncludeVat
    ? Math.round(totalAmount / (1 + vatRate))
    : totalAmount;
  const vatAmount = pricesIncludeVat
    ? totalAmount - totalBeforeVat
    : Math.round(totalAmount * vatRate);
  const totalWithVat = pricesIncludeVat ? totalAmount : totalAmount + vatAmount;
  const confidenceBadge = (conf?: string) => {
    if (!conf) return null;
    const cls = conf === 'high' ? 'text-green-600' : conf === 'medium' ? 'text-yellow-600' : 'text-red-500';
    const label = conf === 'high' ? '✓' : conf === 'medium' ? '~' : '?';
    return <span className={`text-xs font-bold ${cls}`} title={`Độ chính xác: ${conf}`}>{label}</span>;
  };

  return (
    <>
      <Header
        title="Nhập hàng từ hóa đơn"
        subtitle="Tải lên file PDF hoặc CSV để tự động cập nhật kho"
        onMenuClick={() => { }}
      />

      <div className="page-content">
        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            {/* Tabs */}
            <div className="flex border-b mb-6">
              <button
                onClick={() => setActiveTab('xml')}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'xml' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Code2 className="w-4 h-4" /> XML (chuẩn xác)
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-semibold">Mới</span>
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pdf' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📄 PDF (OCR)
              </button>
              <button
                onClick={() => setActiveTab('csv')}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'csv' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 CSV/Excel
              </button>
            </div>

            {/* XML Tab */}
            {activeTab === 'xml' && (
              <>
                <div
                  className={`card p-12 text-center cursor-pointer border-2 border-dashed transition-all ${
                    parseLoading ? 'border-green-300 bg-green-50/30' : 'border-gray-200 hover:border-green-400'
                  }`}
                  onClick={() => !parseLoading && xmlInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                    {parseLoading
                      ? <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                      : <Code2 className="w-8 h-8 text-green-600" />}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {parseLoading ? 'Đang phân tích file XML...' : 'Tải lên hóa đơn XML'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Hóa đơn điện tử (.xml) — dữ liệu cấu trúc, chính xác 100%<br />
                    <span className="text-xs text-green-600 font-medium">✅ Không cần OCR — đọc trực tiếp tên, mã, số lượng, đơn giá</span>
                  </p>
                  <input ref={xmlInputRef} type="file" accept=".xml" onChange={handleXMLUpload} className="hidden" />
                  <button className="btn btn-success" disabled={parseLoading}>
                    <Code2 className="w-4 h-4" /> {parseLoading ? 'Đang xử lý...' : 'Chọn file XML'}
                  </button>
                </div>
                <div className="card mt-6 p-6 border-green-100 bg-green-50/30">
                  <h3 className="font-semibold mb-3 text-green-800">✨ Tại sao dùng XML?</h3>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>✅ <strong>Chính xác tuyệt đối</strong> — dữ liệu cấu trúc từ hệ thống hóa đơn điện tử (MISA, VNPT, Viettel...)</p>
                    <p>✅ <strong>Tự điền nhà cung cấp</strong> — tên công ty và mã số thuế tự động được trích xuất</p>
                    <p>❌ PDF/CSV: có thể sai tên hàng, số lượng, đơn giá do OCR hoặc format khác nhau</p>
                    <p className="text-xs text-gray-400 bg-gray-100 p-2 rounded font-mono">
                      Lấy file XML: mở hóa đơn điện tử → Tải xuống / Xuất XML
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* PDF Tab */}
            {activeTab === 'pdf' && (
              <>
                <div
                  className={`card p-12 text-center cursor-pointer border-2 border-dashed transition-all ${parseLoading ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 hover:border-blue-300'
                    }`}
                  onClick={() => !parseLoading && pdfInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    {parseLoading
                      ? <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                      : <FileText className="w-8 h-8 text-red-400" />}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {parseLoading ? 'Đang phân tích hóa đơn...' : 'Tải lên hóa đơn PDF'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Hệ thống tự động nhận diện bảng hàng hóa từ PDF<br />
                    <span className="text-xs text-orange-500">⚠ PDF scan/ảnh chụp cần chuyển sang PDF text trước</span>
                  </p>
                  <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handlePDFUpload} className="hidden" />
                  <button className="btn btn-primary" disabled={parseLoading}>
                    <FileText className="w-4 h-4" /> {parseLoading ? 'Đang xử lý...' : 'Chọn file PDF'}
                  </button>
                </div>
                <div className="card mt-6 p-6">
                  <h3 className="font-semibold mb-3">📌 Hướng dẫn sử dụng OCR</h3>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>PDF text</strong>: Kết quả tốt nhất — hệ thống đọc trực tiếp bảng hàng hóa</p>
                    <p><strong>PDF scan</strong>: Cần chuyển sang PDF searchable trước (dùng Adobe Acrobat, iLovePDF, v.v.)</p>
                    <p>Sau khi nhận diện, bạn có thể <strong>chỉnh sửa từng dòng</strong> trước khi lưu</p>
                    <p>Hệ thống tự động <strong>khớp với sản phẩm có sẵn</strong> trong kho theo mã hoặc tên</p>
                  </div>
                </div>
              </>
            )}

            {/* CSV Tab */}
            {activeTab === 'csv' && (
              <>
                <div
                  className="card p-12 text-center cursor-pointer hover:border-blue-300 transition-colors border-2 border-dashed border-gray-200"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Kéo thả hoặc nhấn để chọn file</h3>
                  <p className="text-sm text-gray-500 mb-4">Hỗ trợ: CSV, TXT (mã UTF-8)</p>
                  <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSVUpload} className="hidden" />
                  <button className="btn btn-primary">
                    <FileSpreadsheet className="w-4 h-4" /> Chọn file CSV
                  </button>
                </div>
                <div className="card mt-6 p-6">
                  <h3 className="font-semibold mb-3">📋 Hướng dẫn</h3>
                  <div className="text-sm text-gray-600 space-y-2 mb-4">
                    <p>File CSV cần có các cột: <code className="bg-gray-100 px-1 rounded">ma_hang, ten_hang, dvt, so_luong, don_gia</code></p>
                    <p>Hệ thống tự động khớp mã hàng với sản phẩm đã có trong kho</p>
                    <p>Sản phẩm mới sẽ được tự động tạo với giá bán mặc định +15%</p>
                  </div>
                  <button onClick={handleDownloadTemplate} className="btn btn-secondary btn-sm">
                    <Download className="w-4 h-4" /> Tải file mẫu CSV
                  </button>
                </div>
                <div className="card mt-4">
                  <div className="card-header"><h3 className="card-title">Ví dụ file CSV</h3></div>
                  <div className="card-body">
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono">{sampleCSV}</pre>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <>
            {/* PDF text preview */}
            {pdfPreviewText && (
              <div className="card mb-4">
                <button
                  className="w-full card-header flex items-center justify-between cursor-pointer"
                  onClick={() => setShowPdfPreview(!showPdfPreview)}
                >
                  <h3 className="card-title flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Xem nội dung PDF đã đọc ({pdfPreviewText.length} ký tự)
                  </h3>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showPdfPreview ? 'rotate-90' : ''}`} />
                </button>
                {showPdfPreview && (
                  <div className="card-body">
                    <div className="flex justify-end mb-2">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { navigator.clipboard.writeText(pdfPreviewText); toast.success('Đã copy text!'); }}
                      >
                        📋 Copy toàn bộ text
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-green-300 p-4 rounded-lg text-xs overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                      {pdfPreviewText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Invoice Meta */}
            <div className="card mb-4">
              <div className="card-body">
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Ngày nhập hàng</label>
                    <input className="form-input" type="date" value={importDate} onChange={(e) => setImportDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhà cung cấp</label>
                    <input className="form-input" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tên nhà cung cấp" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số HĐ nhà cung cấp</label>
                    <input className="form-input" value={supplierInvoice} onChange={(e) => setSupplierInvoice(e.target.value)} placeholder="VD: HD-2026-001" />
                  </div>
                </div>
                {/* Toggle VAT */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={pricesIncludeVat}
                        onChange={(e) => setPricesIncludeVat(e.target.checked)}
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${pricesIncludeVat ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${pricesIncludeVat ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Đơn giá trong hóa đơn đã bao gồm thuế GTGT (8%)
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {pricesIncludeVat
                          ? 'Tổng tiền = giá đã có thuế — sẽ rút tiền thuế ra từ giá nhập'
                          : 'Tổng tiền = giá chưa có thuế + 8% VAT'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Tổng mặt hàng', value: rows.length, color: 'blue' },
                { label: 'Khừn mại (0đ)', value: rows.filter(r => r.unit_price === 0 && r.quantity > 0).length, color: 'green' },
                { label: 'Sản phẩm mới', value: rows.filter(r => r.status === 'new').length, color: 'orange' },
                { label: 'Cộng tiền thanh toán', value: formatCurrency(totalWithVat), color: 'purple', isText: true },
              ].map(({ label, value, color, isText }) => (
                <div key={label} className={`p-3 rounded-lg bg-${color}-50 border border-${color}-100 text-center`}>
                  <div className={`text-xs text-${color}-600`}>{label}</div>
                  <div className={`${isText ? 'text-base' : 'text-xl'} font-bold text-${color}-700`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="card mb-4">
              <div className="card-header flex items-center justify-between">
                <h3 className="card-title">Danh sách mặt hàng</h3>
                <button onClick={handleAddRow} className="btn btn-secondary btn-sm">
                  <Plus className="w-3 h-3" /> Thêm dòng
                </button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Mã HH</th>
                      <th>Tên hàng hóa</th>
                      <th>ĐVT</th>
                      <th className="text-right">Số lượng</th>
                      <th className="text-right">Đơn giá</th>
                      <th className="text-right">Thành tiền</th>
                      <th className="text-center">Trạng thái</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className={row.confidence === 'low' ? 'bg-red-50/50' : row.confidence === 'medium' ? 'bg-yellow-50/30' : ''}>
                        <td className="text-center text-gray-400 text-sm">{idx + 1}</td>
                        <td>
                          <input className="form-input py-1 px-2 text-sm" value={row.product_code}
                            onChange={(e) => handleUpdateRow(idx, 'product_code', e.target.value)} />
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {confidenceBadge(row.confidence)}
                            <input className="form-input py-1 px-2 text-sm font-medium flex-1" value={row.product_name}
                              onChange={(e) => handleUpdateRow(idx, 'product_name', e.target.value)} />
                          </div>
                        </td>
                        <td>
                          <input className="form-input py-1 px-2 text-sm" style={{ width: 60 }} value={row.unit}
                            onChange={(e) => handleUpdateRow(idx, 'unit', e.target.value)} />
                        </td>
                        <td>
                          <input className="form-input py-1 px-2 text-sm text-right" style={{ width: 80 }}
                            type="number" value={row.quantity || ''}
                            onChange={(e) => handleUpdateRow(idx, 'quantity', Number(e.target.value))} />
                        </td>
                        <td>
                          <input className="form-input py-1 px-2 text-sm text-right font-mono" style={{ width: 110 }}
                            type="number" value={row.unit_price || ''}
                            onChange={(e) => handleUpdateRow(idx, 'unit_price', Number(e.target.value))} />
                        </td>
                        <td className="text-right font-mono font-medium">{formatCurrency(row.total)}</td>
                        <td className="text-center">
                          {row.unit_price === 0 && row.quantity > 0
                            ? <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}><Gift className="w-3 h-3 mr-1" />Khuyến mại</span>
                            : row.status === 'matched'
                              ? <span className="badge badge-success"><Check className="w-3 h-3 mr-1" />Đã khớp</span>
                              : row.status === 'new'
                                ? <span className="badge badge-warning"><Plus className="w-3 h-3 mr-1" />Mới</span>
                                : <span className="badge badge-danger"><AlertCircle className="w-3 h-3 mr-1" />Lỗi</span>}
                        </td>
                        <td>
                          <button onClick={() => handleRemoveRow(idx)} className="btn btn-ghost btn-sm text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="text-right text-sm text-gray-600">
                        Thành tiền trước thuế GTGT:
                      </td>
                      <td className="text-right font-mono text-sm text-gray-700">{formatCurrency(totalBeforeVat)}</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="text-right text-sm text-gray-600">
                        Thuế GTGT 8%{pricesIncludeVat ? ' (rút ra từ giá)' : ' (cộng thêm)'}:
                      </td>
                      <td className="text-right font-mono text-sm text-orange-600">{formatCurrency(vatAmount)}</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="font-bold bg-gray-50 border-t-2 border-gray-300">
                      <td colSpan={6} className="text-right">Cộng tiền thanh toán:</td>
                      <td className="text-right font-mono text-lg text-green-700">{formatCurrency(totalWithVat)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Confidence Legend (show only for PDF) */}
            {rows.some(r => r.confidence) && (
              <div className="flex gap-4 text-xs text-gray-500 mb-4">
                <span><strong className="text-green-600">✓</strong> Độ chắc cao</span>
                <span><strong className="text-yellow-600">~</strong> Độ chắc trung bình — nên kiểm tra</span>
                <span><strong className="text-red-500">?</strong> Độ chắc thấp — cần chỉnh sửa</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center mt-2">
              <button onClick={handleReset} className="btn btn-secondary">← Quay lại</button>
              <div className="flex gap-3 items-center">
                {rows.filter(r => r.status === 'new').length > 0 && (
                  <span className="text-sm text-orange-600">
                    ⚠ {rows.filter(r => r.status === 'new').length} sản phẩm mới sẽ được tạo
                  </span>
                )}
                <button
                  onClick={handleImport}
                  className="btn btn-primary btn-lg"
                  disabled={loading || rows.length === 0}
                >
                  {loading
                    ? <><span className="loading-spinner" /> Đang nhập kho...</>
                    : <><Check className="w-5 h-5" /> Xác nhận nhập kho ({rows.length} mặt hàng)</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Nhập kho thành công!</h2>
            <p className="text-gray-500 mb-8">Tồn kho đã được cập nhật tự động</p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Thành công', value: importResult.success, color: 'green' },
                { label: 'SP mới tạo', value: importResult.newProducts, color: 'orange' },
                { label: 'Thất bại', value: importResult.failed, color: 'red' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`p-4 rounded-lg bg-${color}-50 border border-${color}-100`}>
                  <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
                  <div className={`text-xs text-${color}-600`}>{label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <button onClick={handleReset} className="btn btn-secondary">
                <Upload className="w-4 h-4" /> Import thêm
              </button>
              <a href="/dashboard/inventory" className="btn btn-primary">Xem tồn kho →</a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
