/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const runtime = 'nodejs';

interface ParsedItem {
  stt?: number;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_rate?: number;
  confidence: 'high' | 'medium' | 'low';
}

/** Lấy giá trị từ object theo nhiều key có thể (fallback chain) */
function get(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

/** Parse số từ XML (có thể là number hoặc string dạng "1.234,56") */
function parseNum(v: any): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Trích sản phẩm từ node HHDVu */
function parseLineItem(item: any, idx: number): ParsedItem | null {
  // Tên hàng — nhiều trường có thể dùng
  const name = String(
    get(item, 'THHDVu', 'TenHH', 'TenHHDV', 'MoTa', 'Description') ?? ''
  ).trim();
  if (!name || name.length < 2) return null;
  if (/^(cộng|tổng|chiết khấu|discount)/i.test(name)) return null;

  const code = String(get(item, 'MHHDVu', 'MaHH', 'MaSP', 'ProductCode') ?? '').trim();
  const unit = String(get(item, 'DVTinh', 'DonViTinh', 'Unit', 'DVT') ?? 'cái').trim();
  const qty  = parseNum(get(item, 'SLuong', 'SoLuong', 'Quantity', 'Sl'));
  const price = parseNum(get(item, 'DGia', 'DonGia', 'UnitPrice', 'Dg'));
  const total = parseNum(get(item, 'ThTien', 'ThanhTien', 'Amount', 'TienHang'));
  const sttRaw = get(item, 'STT', 'Stt', 'TT');
  const vatRaw = String(get(item, 'TSuat', 'ThueSuat', 'VATRate') ?? '').replace('%', '');
  const vatRate = parseFloat(vatRaw) || 0;

  const finalQty   = qty > 0 ? qty : 1;
  const finalPrice = price > 0 ? price : (total > 0 && finalQty > 0 ? Math.round(total / finalQty) : 0);
  const finalTotal = total > 0 ? total : Math.round(finalQty * finalPrice);

  // Khuyến mại không tính tiền
  const isPromo = finalPrice === 0 && finalTotal === 0 && finalQty > 0;
  const approx = finalPrice > 0 && finalQty > 0 && Math.abs(finalQty * finalPrice - finalTotal) / Math.max(1, finalTotal) < 0.05;

  return {
    stt: sttRaw !== undefined ? parseInt(String(sttRaw)) : idx + 1,
    product_code: code,
    product_name: name,
    unit: unit || 'cái',
    quantity: finalQty,
    unit_price: finalPrice,
    total: finalTotal,
    vat_rate: vatRate,
    confidence: isPromo ? 'medium' : (approx ? 'high' : (finalTotal > 0 ? 'medium' : 'low')),
  };
}

/** Tìm mảng HHDVu trong cây XML (đệ quy) */
function findItems(node: any, depth = 0): any[] {
  if (depth > 8 || !node || typeof node !== 'object') return [];

  // Các tên phổ biến cho danh sách sản phẩm
  const listKeys = ['DSHHDVu', 'DanhSachHH', 'Items', 'LineItems', 'Hang', 'HangHoa'];
  const itemKeys = ['HHDVu', 'HHDv', 'Item', 'LineItem', 'HangHoaDichVu'];

  for (const lk of listKeys) {
    if (node[lk]) {
      const list = node[lk];
      for (const ik of itemKeys) {
        let items = list[ik];
        if (items) {
          if (!Array.isArray(items)) items = [items];
          return items;
        }
      }
      // Nếu không có nested item key → thử chính list
      if (Array.isArray(list)) return list;
    }
  }

  // Thử item keys top-level
  for (const ik of itemKeys) {
    if (node[ik]) {
      let items = node[ik];
      if (!Array.isArray(items)) items = [items];
      return items;
    }
  }

  // Đệ quy vào các node con
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (child && typeof child === 'object') {
      const found = findItems(child, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/** Trích thông tin nhà cung cấp từ XML */
function extractSupplier(root: any): { name: string; tax_code: string } {
  const sellerNode = root?.HDon?.DLHDon?.NDHDon?.NBan
    ?? root?.Invoice?.Seller
    ?? root?.NBan
    ?? {};
  return {
    name: String(get(sellerNode, 'Ten', 'Name', 'TenCongTy') ?? '').trim(),
    tax_code: String(get(sellerNode, 'MST', 'TaxCode', 'MaSoThue') ?? '').trim(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return Response.json({ error: 'Không có file' }, { status: 400 });

    const text = Buffer.from(await file.arrayBuffer()).toString('utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
      parseAttributeValue: true,
      parseTagValue: true,
      trimValues: true,
      numberParseOptions: { leadingZeros: false, hex: false },
    });

    let root: any;
    try {
      root = parser.parse(text);
    } catch (e: any) {
      return Response.json({ error: `File XML không hợp lệ: ${e.message}` }, { status: 400 });
    }

    const rawItems = findItems(root);

    if (rawItems.length === 0) {
      return Response.json({
        success: false,
        text: text.substring(0, 2000),
        items: [],
        warning: 'Không tìm thấy danh sách hàng hóa trong file XML. Vui lòng kiểm tra định dạng.',
      });
    }

    const items: ParsedItem[] = [];
    rawItems.forEach((item, idx) => {
      const parsed = parseLineItem(item, idx);
      if (parsed) items.push(parsed);
    });

    const supplier = extractSupplier(root);

    return Response.json({
      success: true,
      items,
      total_items: items.length,
      supplier_name: supplier.name || undefined,
      supplier_tax_code: supplier.tax_code || undefined,
      warning: items.length === 0
        ? 'Không nhận diện được mặt hàng. Vui lòng kiểm tra cấu trúc XML.'
        : undefined,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Lỗi xử lý file XML' }, { status: 500 });
  }
}
