/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// Dynamic import — pdf-parse v1 bundles pdfjs 2.x (Node.js compatible)
async function parsePDF(buffer: Buffer): Promise<string> {
  const mod: any = await import('pdf-parse');
  const pdfParse = (mod.default || mod) as (
    buf: Buffer,
    opts?: object
  ) => Promise<{ text: string }>;

  // Custom pagerender: sort text items by y DESC then x ASC
  // This fixes column-ordered PDFs (MISA meInvoice) where text is stored
  // column-by-column instead of row-by-row
  const pagerender = async (pageData: any) => {
    const content = await pageData.getTextContent({ normalizeWhitespace: false });

    const items: { str: string; x: number; y: number }[] = content.items
      .filter((t: any) => t.str.trim().length > 0)
      .map((t: any) => ({ str: t.str.trim(), x: t.transform[4], y: t.transform[5] }));

    if (items.length === 0) return '';

    // --- Try STT-proximity grouping ----------------------------
    // Find standalone STT numbers (1-99) in the leftmost column (x < 60)
    const sttItems = items
      .filter(t => /^\d{1,2}$/.test(t.str) && +t.str >= 1 && +t.str <= 99 && t.x < 60)
      .sort((a, b) => b.y - a.y); // top → bottom

    if (sttItems.length >= 2) {
      // Build groups keyed by STT number
      const groups = new Map<number, { y: number; items: typeof items }>();
      for (const s of sttItems) groups.set(+s.str, { y: s.y, items: [] });
      const sttYs = sttItems.map(s => s.y);

      // Assign each text item to nearest STT row by y-distance.
      // Skip items that are table column-header or summary labels — they must never
      // contaminate the last product row even when their y is close (< threshold).
      // Filter out column-header / footer text items BEFORE proximity assignment.
      // Includes multi-word labels AND single-word header fragments that wrap to a
      // second line (e.g. "tính" from "Đơn vị tính", "vị" from narrow columns).
      const isLabelItem = (s: string) => {
        const t = s.trim();
        // Standalone header word fragments (single token, not a product-name word)
        if (/^(t[ií]nh|v[iị]|[dđ][oơ]n\s*v[iị]|gtgt|chú)$/i.test(t)) return true;
        // Multi-word label patterns
        return /^(th[aà]nh\s*ti[eề]n|ti[eề]n\s*thu[eế]|t[oổ]ng\s*h[oợ]p|c[oộ]ng\s*ti[eề]n)/i.test(t);
      };

      for (const item of items) {
        if (isLabelItem(item.str)) continue; // skip footer/header labels
        let nearestIdx = 0, minDist = Infinity;
        for (let i = 0; i < sttYs.length; i++) {
          const d = Math.abs(item.y - sttYs[i]);
          if (d < minDist) { minDist = d; nearestIdx = i; }
        }
        // 25 PDF units: captures multi-line cell continuations (~12-15 units gap)
        // without pulling in the summary footer row that sits ~20+ units below last item
        if (minDist < 25) {
          groups.get(+sttItems[nearestIdx].str)!.items.push(item);
        }
      }

      // Reconstruct rows: sort each group's items so the STT number always leads,
      // then remaining items by y desc, x asc.
      // WHY: In some MISA meInvoice PDFs the product-name text item starts at a lower
      // x than the STT cell, so a plain x-asc sort puts the name before the number.
      // Forcing the STT item first makes isSttLine() in parseInvoiceText() recognise it.
      let text = '';
      for (const [sttNum, grp] of [...groups.entries()].sort((a, b) => b[1].y - a[1].y)) {
        grp.items.sort((a, b) => {
          const aIsStt = a.str === String(sttNum); // exact STT string
          const bIsStt = b.str === String(sttNum);
          if (aIsStt && !bIsStt) return -1;
          if (!aIsStt && bIsStt) return 1;
          return Math.abs(a.y - b.y) > 1 ? b.y - a.y : a.x - b.x;
        });
        // Merge items into lines within the group
        let rowText = '', lastY: number | null = null;
        for (const item of grp.items) {
          if (lastY === null) { lastY = item.y; }
          else if (Math.abs(item.y - lastY) > 1) { rowText += ' '; lastY = item.y; }
          else { rowText += ' '; }
          rowText += item.str;
        }
        if (rowText.trim()) text += rowText.trim() + '\n';
      }
      return text;
    }

    // --- Fallback: sort by y desc, x asc with tolerance 1 ---
    items.sort((a, b) => Math.abs(a.y - b.y) > 1 ? b.y - a.y : a.x - b.x);
    let text = '', lastY: number | null = null;
    for (const item of items) {
      if (lastY === null) { lastY = item.y; }
      else if (Math.abs(item.y - lastY) > 1) { text += '\n'; lastY = item.y; }
      else { text += ' '; }
      text += item.str;
    }
    return text + '\n';
  };

  const result = await pdfParse(buffer, { pagerender, max: 0 });
  return result.text || '';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return Response.json({ error: 'Không có file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    let items: ParsedItem[] = [];

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      text = await parsePDF(buffer);
      items = parseInvoiceText(text);
    } else {
      text = buffer.toString('utf-8');
      items = parseInvoiceText(text);
    }

    // Dedup + sort by STT
    const seen = new Set<string>();
    const uniqueItems = items
      .filter(item => {
        const key = `${item.product_name.toLowerCase().trim()}-${item.quantity}-${item.total}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (a.stt ?? 999) - (b.stt ?? 999));

    return Response.json({
      success: true,
      text,
      items: uniqueItems,
      total_items: uniqueItems.length,
      warning: uniqueItems.length === 0
        ? 'Không tìm thấy bảng hàng hóa. Vui lòng kiểm tra nội dung PDF và nhập thủ công.'
        : undefined,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Lỗi xử lý file' }, { status: 500 });
  }
}

interface ParsedItem {
  stt?: number;
  product_code: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Table extraction (getTable() path) ─────────────────────────────────────

function parseTableData(table: any): ParsedItem[] {
  const items: ParsedItem[] = [];
  if (!table?.data || !Array.isArray(table.data)) return items;
  const rows: string[][] = table.data;
  if (rows.length < 2) return items;

  const headerRow = rows[0].map((c: string) => (c ?? '').toLowerCase().trim());
  const colIdx = {
    stt:   findColIdx(headerRow, ['stt', 'tt', '#']),
    code:  findColIdx(headerRow, ['mã', 'code', 'ma hang']),
    name:  findColIdx(headerRow, ['tên', 'hàng hóa', 'diễn giải', 'name', 'hh & dv', 'hàng hoá']),
    unit:  findColIdx(headerRow, ['dvt', 'đvt', 'đơn vị', 'dv', 'unit']),
    qty:   findColIdx(headerRow, ['số lượng', 'sl', 'qty', 'quantity']),
    price: findColIdx(headerRow, ['đơn giá', 'giá', 'price', 'đg']),
    total: findColIdx(headerRow, ['thành tiền', 'thành', 'amount']),
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const nameCol = colIdx.name >= 0 ? colIdx.name : 1;
    const rawName = cleanCell(row[nameCol] ?? '');
    if (!rawName || rawName.length < 2) continue;
    if (/^(cộng|tổng|thuế|vat|chiết khấu)/i.test(rawName)) continue;

    const qty   = colIdx.qty   >= 0 ? parseViNum(row[colIdx.qty])   : 0;
    const price = colIdx.price >= 0 ? parseViNum(row[colIdx.price]) : 0;
    const total = colIdx.total >= 0 ? parseViNum(row[colIdx.total]) : 0;
    const sttRaw = colIdx.stt >= 0 ? parseInt(row[colIdx.stt] ?? '') : NaN;
    const code = colIdx.code >= 0 ? cleanCell(row[colIdx.code] ?? '') : '';
    let unit = colIdx.unit >= 0 ? cleanCell(row[colIdx.unit] ?? '') : '';
    if (!unit) unit = detectUnit(rawName) || 'cái';

    const finalQty   = qty > 0 ? qty : 1;
    const finalPrice = price > 0 ? price : (total > 0 ? Math.round(total / finalQty) : 0);
    const finalTotal = total > 0 ? total : finalQty * finalPrice;
    if (finalQty <= 0 && finalTotal <= 0) continue;

    items.push({
      stt: isNaN(sttRaw) ? undefined : sttRaw,
      product_code: code,
      product_name: rawName,
      unit,
      quantity: finalQty,
      unit_price: finalPrice,
      total: finalTotal,
      confidence: isApprox(finalQty * finalPrice, finalTotal) ? 'high' : finalTotal > 0 ? 'medium' : 'low',
    });
  }
  return items;
}

// ─── Text extraction (fallback) ──────────────────────────────────────────────

/**
 * Smart text parser for Vietnamese VAT invoices.
 *
 * Uses STT-based row aggregation: each group of lines sharing an STT number
 * is merged before parsing, which handles multi-line product names.
 *
 * Format: STT | Tên hàng hóa | ĐVT | Số lượng | Đơn giá | Thành tiền | Thuế% | Tiền thuế
 */
function parseInvoiceText(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Normalize
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // ── Footer / header detection ─────────────────────────────────────────────
  // These patterns mark lines that belong to the PDF header or footer,
  // NOT to any product row.
  const isSkipLine = (line: string): boolean => {
    if (line.length === 0) return true;
    if (/^(stt|tt|#|mã hh|tên hàng|diễn giải|đơn vị|số lượng|đơn giá|thành tiền|thuế suất|tiền thuế|ghi chú)/i.test(line)) return true;
    // Summary/separator rows inside the table — skip but DO NOT stop processing (items may follow)
    if (/^(tổng hợp|cộng trang|thuế suất\s*\d)/i.test(line)) return true;
    return false;
  };

  const isFooterLine = (line: string): boolean => {
    return (
      // Hard stops: grand total row, written amount, signature blocks
      /^(tổng cộng|cộng tiền|số tiền (viết|bằng chữ)|bằng chữ)/i.test(line) ||
      /^(người mua|người bán|chủ hộ|kế toán|giám đốc|signature|ký bởi|ký ngày|tra cứu)/i.test(line) ||
      /^(phát hành bởi|công ty cổ phần misa|meinvoice|hóa đơn điện tử)/i.test(line) ||
      /https?:\/\//i.test(line) ||        // URL lines
      /^tiep theo trang/i.test(line) ||
      /^-- of --/i.test(line) ||
      /trang \d+ (of|\/)/i.test(line)
    );
  };

  // ── Strategy A: STT-based row aggregation ──────────────────────────────────
  type RowGroup = { stt: number; lines: string[] };
  const groups: RowGroup[] = [];
  let footerReached = false;

  const isSttLine = (line: string): number | null => {
    if (isSkipLine(line) || isFooterLine(line)) return null;
    const m = line.match(/^(\d{1,3})(?:\s|$)/);
    if (!m) return null;
    const n = parseInt(m[1]);
    if (n < 1 || n > 500) return null;
    return n;
  };

  for (const line of lines) {
    if (footerReached) break;
    if (isFooterLine(line)) { footerReached = true; break; }
    if (isSkipLine(line)) continue;

    const sttNum = isSttLine(line);
    if (sttNum !== null) {
      const lastSTT = groups.length > 0 ? groups[groups.length - 1].stt : 0;
      if (sttNum > lastSTT || groups.length === 0) {
        groups.push({ stt: sttNum, lines: [line] });
        continue;
      }
    }
    // Not a new STT line → append to current group (only non-footer lines)
    if (groups.length > 0) {
      groups[groups.length - 1].lines.push(line);
    }
  }

  if (groups.length >= 2) {
    for (const group of groups) {
      const combined = group.lines.join(' ').replace(/\s{2,}/g, ' ');
      const item = parseCombinedRow(combined, group.stt);
      if (item) items.push(item);
    }
    return items;
  }

  // ── Strategy B: Line-by-line fallback ──────────────────────────────────────
  for (const line of lines) {
    if (isSkipLine(line) || isFooterLine(line)) continue;
    const item = parseCombinedRow(line, undefined);
    if (item) items.push(item);
  }

  return items;
}

const KNOWN_UNITS = ['thùng', 'hộp', 'bao', 'gói', 'lon', 'chai', 'cái', 'chiếc', 'viên', 'kg', 'gram', 'tấn', 'lít', 'ml', 'mét', 'cuộn', 'tờ', 'quyển', 'bộ', 'túi'];

function parseCombinedRow(line: string, knownStt: number | undefined): ParsedItem | null {
  // Remove percentage values (VAT rates like 8%, 10%, X)
  const lineClean = line
    .replace(/\b\d+(?:[.,]\d+)?%/g, '')  // remove n%
    .replace(/\bX\b/g, '');              // remove "X" (tax-exempt marker)

  // ─ Tokenize numbers ─────────────────────────────────────────────────────────
  // Match numeric tokens in original order, with their original string form
  interface NumToken { raw: string; val: number; isQty: boolean; isPrice: boolean }

  const numTokens: NumToken[] = [];
  const numRe = /\d[\d.,]*/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(lineClean)) !== null) {
    const raw = m[0];
    const val = parseViNum(raw);
    if (val <= 0 || !isFinite(val) || isNaN(val)) continue;

    // Qty pattern: ends with ,00 or .00 (e.g. "3.150,00", "108,00", "900,00")
    const isQty = /[,.]00$/.test(raw);

    // Price pattern: ends with non-zero decimals after comma (e.g. "2.777,78", "3.240,74")
    const hasDec = /[,]\d{1,2}$/.test(raw);
    const isPrice = hasDec && !isQty;

    numTokens.push({ raw, val, isQty, isPrice });
  }

  if (numTokens.length === 0) return null;

  // ─ Extract product name ─────────────────────────────────────────────────────
  const textRaw = lineClean
    .replace(/\d[\d.,]*/g, ' ')          // remove numbers
    .replace(/[|│┃\t]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!textRaw || textRaw.length < 2) return null;
  if (/^(cộng|tổng|thuế|vat|chiết khấu)/i.test(textRaw)) return null;

  // Detect unit
  let unit = '';
  const lowerLine = line.toLowerCase();
  for (const u of KNOWN_UNITS) {
    const re = new RegExp(`(?<![\\p{L}])${u}(?![\\p{L}])`, 'ui');
    if (re.test(lowerLine)) { unit = u; break; }
  }

  // Clean product name: remove unit + parenthetical notes "(Hàng khuyến mại...)"
  let productName = textRaw;
  if (unit) {
    productName = productName.replace(new RegExp(`(?<![\\p{L}])${unit}(?![\\p{L}])`, 'gui'), '').trim();
  }
  // Remove ONLY clearly promotional parenthetical notes — keep meaningful variants like (OT), (SG), (Q), (Cool)
  // Covers both spellings: "khuyến mại" and "khuyến mãi"
  productName = productName.replace(/\((hàng\s*khuy[eê]n\s*m[aã][iy]|km|qu[aà]\s*t[aặ]ng|mi[eễ]n\s*ph[ií]|kh[oô]ng\s*thu\s*ti[eề]n|gift|free)[^)]*\)/gi, '').trim();
  productName = productName.replace(/\s{2,}/g, ' ').trim();
  if (productName.length < 2) return null;

  // ─ Assign STT ───────────────────────────────────────────────────────────────
  let stt = knownStt;

  // Remove STT from token list if it appears as first token
  // (STT is an integer that matches knownStt, or a small integer at the front)
  const qtyTokens  = numTokens.filter(t => t.isQty);
  const priceTokens = numTokens.filter(t => t.isPrice);
  const otherTokens = numTokens.filter(t => !t.isQty && !t.isPrice);

  // ─ Determine qty, price, total ──────────────────────────────────────────────
  let qty = 0, price = 0, total = 0;

  if (qtyTokens.length > 0) {
    // Pick the first qty-pattern token as Số lượng
    qty = qtyTokens[0].val;
  }

  if (priceTokens.length > 0) {
    // Pick the first price-pattern token as Đơn giá
    price = priceTokens[0].val;
  }

  // Total (Thành tiền): large integer — look in "other" tokens or verify qty*price
  if (qty > 0 && price > 0) {
    const expected = qty * price;
    // Find a token close to expected total
    const totalCandidate = otherTokens.find(t => isApprox(t.val, expected));
    if (totalCandidate) {
      total = totalCandidate.val;
    } else {
      total = Math.round(expected); // compute it
    }
  } else if (qty > 0 && price === 0) {
    // Free item (Hàng khuyến mại) — qty only, price=0, total=0
    total = 0;
  } else {
    // Fallback: try triple search on all values
    const vals = numTokens.map(t => t.val);
    // Remove tiny leading integer (likely STT)
    if (vals.length > 0 && vals[0] <= 500 && Number.isInteger(vals[0])) {
      if (stt === undefined) stt = vals[0];
      vals.shift();
    }
    let found = false;
    for (let i = vals.length - 1; i >= 2 && !found; i--) {
      for (let j = i - 1; j >= 1 && !found; j--) {
        for (let k = j - 1; k >= 0 && !found; k--) {
          if (isApprox(vals[k] * vals[j], vals[i])) {
            qty = vals[k]; price = vals[j]; total = vals[i]; found = true;
          }
        }
      }
    }
    if (!found && vals.length >= 1) {
      qty = vals[0]; price = 0; total = 0;
    }
  }

  // Must have at least qty
  if (qty <= 0) return null;

  // Product code detection
  let productCode = '';
  const codeMatch = productName.match(/^([A-Z]{2,12}[0-9]*)\s/);
  if (codeMatch && !KNOWN_UNITS.includes(codeMatch[1].toLowerCase())) {
    productCode = codeMatch[1];
    productName = productName.substring(codeMatch[0].length).trim();
  }

  const confidence: 'high' | 'medium' | 'low' =
    qty > 0 && price > 0 && isApprox(qty * price, total) ? 'high'
    : qty > 0 && price === 0 ? 'medium'  // free item — known format
    : total > 0 ? 'medium' : 'low';

  return {
    stt,
    product_code: productCode,
    product_name: productName || textRaw.substring(0, 100),
    unit: unit || 'cái',
    quantity: qty,
    unit_price: price,
    total,
    confidence,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findColIdx(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (keywords.some(k => headers[i].includes(k))) return i;
  }
  return -1;
}

/** Parse Vietnamese number format: 1.234.567 or 1.234,56 */
function parseViNum(s: string | null | undefined): number {
  if (!s) return 0;
  const clean = String(s)
    .replace(/\s/g, '')
    .replace(/%/g, '')                 // strip % (VAT rates)
    .replace(/\.(?=\d{3}(?:[.,]|$))/g, '')  // remove thousand-separator dots
    .replace(',', '.');                // decimal comma → dot
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function cleanCell(s: string): string {
  return s.replace(/[|│┃\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function detectUnit(text: string): string {
  const units = ['thùng', 'hộp', 'bao', 'gói', 'lon', 'chai', 'cái', 'chiếc', 'viên', 'kg', 'gram', 'tấn', 'lít', 'ml', 'mét', 'cuộn', 'tờ', 'quyển', 'bộ', 'túi'];
  const lower = text.toLowerCase();
  for (const u of units) {
    if (lower.includes(u)) return u;
  }
  return '';
}

/** Check if two numbers are approximately equal (within 5%) */
function isApprox(a: number, b: number): boolean {
  if (a === 0 && b === 0) return true;
  const max = Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) / max < 0.05;
}
