import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { vi } from 'date-fns/locale';

// =============================================
// Format currency VND
// =============================================
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format number with separators
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

// =============================================
// Date formatting
// =============================================
export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: vi });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: vi });
}

export function formatMonthYear(date: string | Date): string {
  return format(new Date(date), 'MM/yyyy', { locale: vi });
}

// =============================================
// Date ranges
// =============================================
export function getMonthRange(date: Date = new Date()) {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  };
}

export function getQuarterRange(quarter: number, year: number) {
  const date = new Date(year, (quarter - 1) * 3, 1);
  return {
    start: format(startOfQuarter(date), 'yyyy-MM-dd'),
    end: format(endOfQuarter(date), 'yyyy-MM-dd'),
  };
}

export function getYearRange(year: number) {
  const date = new Date(year, 0, 1);
  return {
    start: format(startOfYear(date), 'yyyy-MM-dd'),
    end: format(endOfYear(date), 'yyyy-MM-dd'),
  };
}

// =============================================
// Tax calculations
// =============================================
export function calculateVAT(amount: number, rate: number = 8): number {
  return Math.round(amount * rate / 100);
}

export function calculatePIT(revenue: number, rate: number = 1.5): number {
  return Math.round(revenue * rate / 100);
}

export function calculateTotalWithVAT(amount: number, vatRate: number = 8): number {
  return amount + calculateVAT(amount, vatRate);
}

// =============================================
// Invoice number generator
// =============================================
export function generateInvoiceNumber(prefix: string = 'HD'): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}${month}-${random}`;
}

// =============================================
// Number to Vietnamese words (đọc số tiền)
// =============================================
const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const positions = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const one = n % 10;

  let result = '';
  if (hundred > 0) result += ones[hundred] + ' trăm ';
  if (ten > 1) {
    result += ones[ten] + ' mươi ';
    if (one === 1) result += 'mốt';
    else if (one === 5) result += 'lăm';
    else result += ones[one];
  } else if (ten === 1) {
    result += 'mười ';
    if (one === 5) result += 'lăm';
    else result += ones[one];
  } else if (ten === 0 && hundred > 0 && one > 0) {
    result += 'lẻ ' + ones[one];
  } else {
    result += ones[one];
  }

  return result.trim();
}

export function numberToVietnameseWords(n: number): string {
  if (n === 0) return 'không đồng';

  let result = '';
  let pos = 0;

  while (n > 0) {
    const threeDigits = n % 1000;
    if (threeDigits > 0) {
      const words = readThreeDigits(threeDigits);
      result = words + ' ' + positions[pos] + ' ' + result;
    }
    n = Math.floor(n / 1000);
    pos++;
  }

  result = result.trim();
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
  return result;
}

// =============================================
// Misc helpers
// =============================================
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// Get current quarter
export function getCurrentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

// Payment method label
export function getPaymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    card: 'Thẻ',
  };
  return map[method] || method;
}

// Status label
export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Nháp',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };
  return map[status] || status;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}
