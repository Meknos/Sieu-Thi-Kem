'use client';

import { Bell, User, Menu } from 'lucide-react';
import { useSidebar } from '@/lib/sidebar-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, onMenuClick, actions }: HeaderProps) {
  const { toggle } = useSidebar();
  const handleMenu = onMenuClick ?? toggle;

  return (
    <header className="header-bar">
      <div className="flex items-center gap-4">
        <button
          onClick={handleMenu}
          className="btn btn-ghost p-2"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="header-actions">
        {actions}
        <button className="btn btn-ghost p-2 relative" aria-label="Notifications">
          <Bell className="w-5 h-5 text-gray-500" />
        </button>
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="w-4 h-4 text-blue-600" />
        </div>
      </div>
    </header>
  );
}
