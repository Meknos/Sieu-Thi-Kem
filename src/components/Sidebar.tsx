'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  FileText,
  BookOpen,
  CalendarDays,
  Calendar,
  Settings,
  Warehouse,
  Upload,
  LogOut,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    section: 'Tổng quan',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Quản lý',
    items: [
      { href: '/dashboard/products', label: 'Hàng hóa', icon: Package },
      { href: '/dashboard/purchases', label: 'Nhập hàng', icon: ShoppingCart },
      { href: '/dashboard/sales', label: 'Bán hàng', icon: Receipt },
      { href: '/dashboard/inventory', label: 'Tồn kho', icon: Warehouse },
      { href: '/dashboard/invoices', label: 'Hóa đơn', icon: FileText },
      { href: '/dashboard/import', label: 'Import HĐ', icon: Upload },
    ],
  },
  {
    section: 'Báo cáo',
    items: [
      { href: '/dashboard/reports/s2a', label: 'Sổ S2a-HKD', icon: BookOpen },
      { href: '/dashboard/reports/quarterly', label: 'Báo cáo quý', icon: CalendarDays },
      { href: '/dashboard/reports/yearly', label: 'Báo cáo năm', icon: Calendar },
    ],
  },
  {
    section: 'Cài đặt',
    items: [
      { href: '/dashboard/settings', label: 'Thông tin KD', icon: Settings },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="flex items-center justify-between">
            <h1>
              <BookOpen className="w-6 h-6 text-blue-400" />
              <div>
                Hóa Đơn App
                <br />
                <span>Kế toán HKD</span>
              </div>
            </h1>
            <button
              onClick={onClose}
              className="md:hidden text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-title">{section.section}</div>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/8 space-y-2">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
          <div className="text-xs text-gray-600 text-center">
            © 2026 Hóa Đơn App v1.0
          </div>
        </div>
      </aside>
    </>
  );
}
