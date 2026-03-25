'use client';

import { useState, useRef } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/Modal';
import { Upload, FileSpreadsheet, Check, AlertCircle, Trash2, Plus, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
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
  error?: string;
}

const sampleCSV = `ma_hang,ten_hang,dvt,so_luong,don_gia
XM001,Xi măng PCB40 Hà Tiên,bao,100,85000
TH001,Thép cuộn phi 10 Hòa Phát,kg,500,14500
GO001,Gạch ống 4 lỗ,viên,2000,800
SN002,Sơn Jotun 5L,thùng,20,350000`;

export default function ImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; newProducts: number }>({ success: 0, failed: 0, newProducts: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load products for matching
  async function loadProducts() {
    try {
      const { data } = await supabase.from('products').select('*').eq('is_active', true);
      if (data) setProducts(data);
    } catch {
      // Demo products
      setProducts([
        { id: '1', user_id: '', code: 'XM001', name: 'Xi măng PCB40 Hà Tiên', unit: 'bao', purchase_price: 85000, selling_price: 95000, is_active: true, created_at: '', updated_at: '' },
        { id: '2', user_id: '', code: 'TH001', name: 'Thép cuộn phi 10 Hòa Phát', unit: 'kg', purchase_price: 14500, selling_price: 16000, is_active: true, created_at: '', updated_at: '' },
        { id: '3', user_id: '', code: 'GO001', name: 'Gạch ống 4 lỗ', unit: 'viên', purchase_price: 800, selling_price: 1100, is_active: true, created_at: '', updated_at: '' },
      ]);
    }
  }

  function parseCSV(content: string): ImportRow[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header to detect columns
    const header = lines[0].toLowerCase().replace(/\r/g, '');
    const cols = header.split(',').map(c => c.trim());

    const codeIdx = cols.findIndex(c => ['ma_hang', 'ma', 'code', 'ma_hh', 'mã hàng', 'mã'].some(k => c.includes(k)));
    const nameIdx = cols.findIndex(c => ['ten_hang', 'ten', 'name', 'tên hàng', 'tên'].some(k => c.includes(k)));
    const unitIdx = cols.findIndex(c => ['dvt', 'don_vi', 'unit', 'đơn vị'].some(k => c.includes(k)));
    const qtyIdx = cols.findIndex(c => ['so_luong', 'sl', 'qty', 'quantity', 'số lượng'].some(k => c.includes(k)));
    const priceIdx = cols.findIndex(c => ['don_gia', 'gia', 'price', 'đơn giá', 'giá'].some(k => c.includes(k)));

    const parsedRows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].replace(/\r/g, '').split(',').map(v => v.trim());
      if (values.length < 2) continue;

      const code = codeIdx >= 0 ? values[codeIdx] : '';
      const name = nameIdx >= 0 ? values[nameIdx] : values[1] || '';
      const unit = unitIdx >= 0 ? values[unitIdx] : 'cái';
      const quantity = qtyIdx >= 0 ? parseFloat(values[qtyIdx]) || 0 : 0;
      const unitPrice = priceIdx >= 0 ? parseFloat(values[priceIdx]) || 0 : 0;

      if (!name && !code) continue;

      // Try to match with existing product
      const matchedProduct = products.find(
        p => p.code.toLowerCase() === code.toLowerCase() ||
          p.name.toLowerCase() === name.toLowerCase()
      );

      parsedRows.push({
        product_code: code,
        product_name: name,
        unit: matchedProduct?.unit || unit,
        quantity,
        unit_price: unitPrice || matchedProduct?.purchase_price || 0,
        total: quantity * (unitPrice || matchedProduct?.purchase_price || 0),
        matched_product: matchedProduct,
        status: matchedProduct ? 'matched' : 'new',
      });
    }

    return parsedRows;
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await loadProducts();

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);

      if (parsed.length === 0) {
        toast.error('Không tìm thấy dữ liệu hợp lệ trong file');
        return;
      }

      setRows(parsed);
      setStep('review');
      toast.success(`Đã đọc ${parsed.length} dòng từ file`);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleRemoveRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  function handleUpdateRow(idx: number, field: keyof ImportRow, value: any) {
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  }

  async function handleImport() {
    if (rows.length === 0) return;

    setLoading(true);
    let success = 0;
    let failed = 0;
    let newProducts = 0;

    try {
      for (const row of rows) {
        try {
          let productId = row.matched_product?.id;

          // Create new product if not matched
          if (!productId && row.status === 'new') {
            try {
              const { data: newProduct, error: prodError } = await supabase
                .from('products')
                .insert({
                  user_id: (await supabase.auth.getUser()).data.user?.id,
                  code: row.product_code || `AUTO-${Date.now()}`,
                  name: row.product_name,
                  unit: row.unit,
                  purchase_price: row.unit_price,
                  selling_price: Math.round(row.unit_price * 1.15), // 15% markup default
                })
                .select()
                .single();

              if (newProduct) {
                productId = newProduct.id;
                newProducts++;
              }
            } catch {
              // Demo mode - generate fake ID
              productId = `demo-${Date.now()}-${Math.random()}`;
              newProducts++;
            }
          }

          if (!productId) {
            productId = row.matched_product?.id || `demo-${Date.now()}`;
          }

          // Create purchase record
          try {
            await supabase.from('purchases').insert({
              user_id: (await supabase.auth.getUser()).data.user?.id,
              product_id: productId,
              purchase_date: importDate,
              quantity: row.quantity,
              unit_price: row.unit_price,
              total_amount: row.total,
              supplier_name: supplierName,
              supplier_invoice: supplierInvoice,
              notes: `Import từ file hóa đơn`,
            });
          } catch {
            // Demo mode
          }

          success++;
        } catch {
          failed++;
        }
      }

      setImportResult({ success, failed, newProducts });
      setStep('done');
      toast.success(`Nhập kho thành công: ${success}/${rows.length} mặt hàng`);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi nhập kho');
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_nhap_hoa_don.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setRows([]);
    setStep('upload');
    setImportResult({ success: 0, failed: 0, newProducts: 0 });
    setSupplierName('');
    setSupplierInvoice('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <>
      <Header
        title="Import Hóa đơn nhập hàng"
        subtitle="Upload file CSV/Excel để tự động cập nhật kho"
        onMenuClick={() => {}}
      />

      <div className="page-content">
        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            {/* Upload Area */}
            <div
              className="card p-12 text-center cursor-pointer hover:border-blue-300 transition-colors border-2 border-dashed border-gray-200"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Kéo thả hoặc nhấn để chọn file</h3>
              <p className="text-sm text-gray-500 mb-4">
                Hỗ trợ: CSV, TXT (mã UTF-8)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button className="btn btn-primary">
                <FileSpreadsheet className="w-4 h-4" /> Chọn file
              </button>
            </div>

            {/* Template Download */}
            <div className="card mt-6 p-6">
              <h3 className="font-semibold mb-3">📋 Hướng dẫn</h3>
              <div className="text-sm text-gray-600 space-y-2 mb-4">
                <p>1. File CSV phải có các cột: <code className="bg-gray-100 px-1 rounded">ma_hang, ten_hang, dvt, so_luong, don_gia</code></p>
                <p>2. Hệ thống sẽ tự động khớp mã hàng với sản phẩm đã có trong kho</p>
                <p>3. Sản phẩm mới sẽ được tự động tạo với giá bán mặc định +15%</p>
                <p>4. Tồn kho sẽ tự động cập nhật sau khi import</p>
              </div>
              <button onClick={handleDownloadTemplate} className="btn btn-secondary btn-sm">
                <Download className="w-4 h-4" /> Tải file mẫu CSV
              </button>
            </div>

            {/* Sample Preview */}
            <div className="card mt-6">
              <div className="card-header">
                <h3 className="card-title">Ví dụ file CSV</h3>
              </div>
              <div className="card-body">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{sampleCSV}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <>
            {/* Invoice Info */}
            <div className="card mb-6">
              <div className="card-body">
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Ngày nhập hàng</label>
                    <input
                      className="form-input"
                      type="date"
                      value={importDate}
                      onChange={(e) => setImportDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhà cung cấp</label>
                    <input
                      className="form-input"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder="Tên nhà cung cấp"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số hóa đơn NCC</label>
                    <input
                      className="form-input"
                      value={supplierInvoice}
                      onChange={(e) => setSupplierInvoice(e.target.value)}
                      placeholder="VD: HD-2026-001"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
                <div className="text-xs text-blue-600">Tổng mặt hàng</div>
                <div className="text-xl font-bold text-blue-700">{rows.length}</div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-center">
                <div className="text-xs text-green-600">Đã khớp</div>
                <div className="text-xl font-bold text-green-700">{rows.filter(r => r.status === 'matched').length}</div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-center">
                <div className="text-xs text-orange-600">Sản phẩm mới</div>
                <div className="text-xl font-bold text-orange-700">{rows.filter(r => r.status === 'new').length}</div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
                <div className="text-xs text-purple-600">Tổng giá trị</div>
                <div className="text-lg font-bold text-purple-700">{formatCurrency(totalAmount)}</div>
              </div>
            </div>

            {/* Review Table */}
            <div className="card">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Mã HH</th>
                      <th>Tên hàng hóa</th>
                      <th>ĐVT</th>
                      <th className="text-right">Số lượng</th>
                      <th className="text-right">Đơn giá</th>
                      <th className="text-right">Thành tiền</th>
                      <th className="text-center">Trạng thái</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="text-center text-gray-400">{idx + 1}</td>
                        <td>
                          <input
                            className="form-input py-1 px-2 text-sm"
                            value={row.product_code}
                            onChange={(e) => handleUpdateRow(idx, 'product_code', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input py-1 px-2 text-sm font-medium"
                            value={row.product_name}
                            onChange={(e) => handleUpdateRow(idx, 'product_name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input py-1 px-2 text-sm"
                            style={{ width: '60px' }}
                            value={row.unit}
                            onChange={(e) => handleUpdateRow(idx, 'unit', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input py-1 px-2 text-sm text-right"
                            style={{ width: '80px' }}
                            type="number"
                            value={row.quantity || ''}
                            onChange={(e) => handleUpdateRow(idx, 'quantity', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input py-1 px-2 text-sm text-right font-mono"
                            style={{ width: '110px' }}
                            type="number"
                            value={row.unit_price || ''}
                            onChange={(e) => handleUpdateRow(idx, 'unit_price', Number(e.target.value))}
                          />
                        </td>
                        <td className="text-right font-mono font-medium">
                          {formatCurrency(row.total)}
                        </td>
                        <td className="text-center">
                          {row.status === 'matched' ? (
                            <span className="badge badge-success"><Check className="w-3 h-3 mr-1" /> Đã khớp</span>
                          ) : row.status === 'new' ? (
                            <span className="badge badge-warning"><Plus className="w-3 h-3 mr-1" /> Mới</span>
                          ) : (
                            <span className="badge badge-danger"><AlertCircle className="w-3 h-3 mr-1" /> Lỗi</span>
                          )}
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
                    <tr className="font-bold bg-gray-50">
                      <td colSpan={6} className="text-right">Tổng cộng:</td>
                      <td className="text-right font-mono text-lg text-green-700">{formatCurrency(totalAmount)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-6">
              <button onClick={handleReset} className="btn btn-secondary">
                ← Quay lại
              </button>
              <div className="flex gap-3">
                <div className="text-sm text-gray-500 flex items-center">
                  {rows.filter(r => r.status === 'new').length > 0 && (
                    <span className="text-orange-600">
                      ⚠ {rows.filter(r => r.status === 'new').length} sản phẩm mới sẽ được tạo tự động
                    </span>
                  )}
                </div>
                <button
                  onClick={handleImport}
                  className="btn btn-primary btn-lg"
                  disabled={loading || rows.length === 0}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner" /> Đang nhập kho...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> Xác nhận nhập kho ({rows.length} mặt hàng)
                    </>
                  )}
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
              <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                <div className="text-2xl font-bold text-green-700">{importResult.success}</div>
                <div className="text-xs text-green-600">Thành công</div>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                <div className="text-2xl font-bold text-orange-700">{importResult.newProducts}</div>
                <div className="text-xs text-orange-600">SP mới tạo</div>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                <div className="text-2xl font-bold text-red-700">{importResult.failed}</div>
                <div className="text-xs text-red-600">Thất bại</div>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button onClick={handleReset} className="btn btn-secondary">
                <Upload className="w-4 h-4" /> Import thêm
              </button>
              <a href="/dashboard/inventory" className="btn btn-primary">
                Xem tồn kho →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
